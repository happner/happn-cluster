/**
 * Created by simon on 2020/11/25.
 */
const property = require("../utils/property");

function HealthService(opts) {
  property(this, "log", opts.logger.createLogger("HealthService"));
}

HealthService.prototype.initialize = function(config, callback) {
  try {
    this.log.info("initialising health service");
    property(this, "happn", this.happn);
    property(this, "config", config || {});
    if (!this.config.warmupLimit) this.config.warmupLimit = 120000;
    if (!this.config.healthInterval) this.config.healthInterval = 10000;
    callback();
  } catch (e) {
    callback(e);
  }
};

HealthService.prototype.start = function() {
  return new Promise((resolve, reject) => {
    try {
      this.log.info("starting health service");
      this.clusterHealthInterval = setInterval(
        this.reportClusterHealth.bind(this),
        this.config.healthInterval
      );
      this.started = Date.now();
      resolve();
    } catch (e) {
      reject(e);
    }
  });
};

HealthService.prototype.stop = function(_options, callback) {
  this.log.info("stopping health service");
  clearInterval(this.clusterHealthInterval);
  callback();
};

HealthService.prototype.findMissingClusterMembers = function(orchestrator) {
  return Object.values(orchestrator.peers)
    .filter(peer => {
      return !peer.self && orchestrator.members[peer.memberId] == null;
    })
    .map(peer => {
      return peer.memberId;
    });
};

HealthService.prototype.findMissingSwimMembers = function(orchestrator) {
  return Object.values(orchestrator.members)
    .filter(member => {
      return !member.self && orchestrator.peers[member.name] == null;
    })
    .map(member => {
      return member.name;
    });
};

HealthService.prototype.findMissingHosts = function(membership) {
  return membership.config.hosts.filter(swimHost => {
    return membership.members[swimHost] == null;
  });
};

HealthService.prototype.statsHaveChanged = function(stats) {
  const statsHash = require("crypto")
    .createHash("sha1")
    .update(
      JSON.stringify([
        stats["MISSING_CLUSTER_MEMBERS"],
        stats["MISSING_SWIM_MEMBERS"],
        stats["MISSING_CONFIGURED_HOSTS"],
        stats["STATUS"]
      ])
    )
    .digest("hex");

  const changed = this.__lastStats !== statsHash;
  this.__lastStats = statsHash;
  return changed;
};

HealthService.prototype.reportClusterHealth = function() {
  let orchestrator = this.happn.services.orchestrator;
  let membership = this.happn.services.membership;

  const stats = {
    MEMBER_ID: membership.memberId,
    TOTAL_CLUSTER_MEMBERS: Object.values(orchestrator.peers).filter(
      member => !member.self
    ).length,
    MISSING_CLUSTER_MEMBERS: [],
    TOTAL_SWIM_MEMBERS: Object.values(orchestrator.members).filter(
      member => !member.self
    ).length,
    MISSING_SWIM_MEMBERS: [],
    TOTAL_CONFIGURED_HOSTS: membership.config.hosts.length,
    MISSING_CONFIGURED_HOSTS: [],
    STATUS: "HEALTHY"
  };

  const status = [];

  stats.MISSING_CLUSTER_MEMBERS = this.findMissingClusterMembers(orchestrator);
  if (stats.MISSING_CLUSTER_MEMBERS.length > 0)
    status.push("CLUSTER-MEMBERS-MISSING");

  stats.MISSING_SWIM_MEMBERS = this.findMissingSwimMembers(orchestrator);
  if (stats.MISSING_SWIM_MEMBERS.length > 0)
    status.push("SWIM-MEMBERS-MISSING");

  stats.MISSING_CONFIGURED_HOSTS = this.findMissingHosts(membership);
  if (stats.MISSING_CONFIGURED_HOSTS.length > 0)
    status.push("CONFIGURED-HOSTS-MISSING");

  stats.STATUS = status.length === 0 ? "HEALTHY" : status.join("|");

  if (Date.now() - this.started <= this.config.warmupLimit)
    stats.STATUS += "|WARMUP";

  if (this.statsHaveChanged(stats)) {
    if (stats.STATUS === "HEALTHY" || stats.STATUS.indexOf("WARMUP") > -1)
      return this.log.json.info(stats, "happn-cluster-health");
    this.log.json.warn(stats, "happn-cluster-health");
  }
};

module.exports = HealthService;
