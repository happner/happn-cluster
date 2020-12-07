/**
 * Created by simon on 2020/11/25.
 */
const property = require("../utils/property");

function HealthService(opts) {
  property(this, "log", opts.logger.createLogger("HealthService"));
}

HealthService.prototype.initialize = function(config, callback) {
  this.log.info("initialising health service");
  property(this, "happn", this.happn);
  property(this, "config", config);
  if (!this.config.warmupLimit) this.config.warmupLimit = 120000;
  if (!this.config.healthInterval) this.config.healthInterval = 10000;
  callback();
};

HealthService.prototype.start = function() {
  this.log.info("starting health service");
  this.clusterHealthInterval = setInterval(
    this.reportClusterHealth.bind(this),
    this.config.healthInterval
  );
  this.started = Date.now();
};

HealthService.prototype.stop = function(_options, callback) {
  this.log.info("stopping health service");
  clearInterval(this.clusterHealthInterval);
  callback();
};

HealthService.prototype.findMissingClusterMembers = function(orchestrator) {
  return Object.values(orchestrator.peers)
    .filter(peer => {
      return orchestrator.members[peer.memberId] == null;
    })
    .map(peer => {
      return peer.memberId;
    });
};

HealthService.prototype.findMissingSwimMembers = function(orchestrator) {
  return Object.values(orchestrator.members)
    .filter(member => {
      return orchestrator.peers[member.name] == null;
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
        stats["TOTAL_SWIM_MEMBERS"],
        stats["TOTAL_CLUSTER_MEMBERS"],
        stats["TOTAL_CONFIGURED_HOSTS"],
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
    TOTAL_SWIM_MEMBERS: Object.values(orchestrator.peers).length,
    MISSING_SWIM_MEMBERS: [],
    TOTAL_CLUSTER_MEMBERS: Object.values(orchestrator.members).length,
    MISSING_CLUSTER_MEMBERS: [],
    TOTAL_CONFIGURED_HOSTS: membership.config.hosts.length,
    MISSING_CONFIGURED_HOSTS: [],
    STATUS: "HEALTHY",
    TIMESTAMP: Date.now()
  };

  const status = [];

  if (stats.TOTAL_SWIM_MEMBERS > stats.TOTAL_CLUSTER_MEMBERS) {
    status.push("CLUSTER-MEMBERS-MISSING");
    stats.MISSING_CLUSTER_MEMBERS = this.findMissingClusterMembers(
      orchestrator
    );
  }

  if (stats.TOTAL_CLUSTER_MEMBERS > stats.TOTAL_SWIM_MEMBERS) {
    status.push("SWIM-MEMBERS-MISSING");
    stats.MISSING_CLUSTER_MEMBERS = this.findMissingSwimMembers(orchestrator);
  }

  if (stats.TOTAL_CONFIGURED_HOSTS > stats.TOTAL_SWIM_MEMBERS) {
    //we dont modify the STATUS, as we may correctly have configured hosts that may or may not need to exist
    stats.MISSING_CONFIGURED_HOSTS = this.findMissingHosts(membership);
  }

  stats.STATUS = status.length === 0 ? "HEALTHY" : status.join("-");

  if (
    stats.STATUS !== "HEALTHY" &&
    Date.now() - this.started <= this.config.warmupLimit
  )
    stats.STATUS += "-WARMUP";

  if (this.statsHaveChanged(stats)) {
    if (stats.STATUS === "HEALTHY" || stats.STATUS.indexOf("WARMUP") > -1)
      return this.log.json.info(stats, "happn-cluster-health");
    this.log.json.warn(stats, "happn-cluster-health");
  }
};

module.exports = HealthService;
