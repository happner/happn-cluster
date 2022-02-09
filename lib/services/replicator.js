/* Special case intra-cluster replicator service,
 * see orchestrator/member.js for regular cluster replication
 */

module.exports = Replicator;

const EventEmitter = require("events").EventEmitter;
const util = require("util");
var Promise = require("bluebird");
const property = require("../utils/property");
const SD_EVENTS = require("happn-3").constants.SECURITY_DIRECTORY_EVENTS;

function Replicator(opts) {
  property(this, "log", opts.logger.createLogger("Replicator"));
  property(this, "securityChangeset", []);
}

util.inherits(Replicator, EventEmitter);

Replicator.prototype.send = function(topic, payload, callback) {
  if (!this.localClient) return callback(new Error("Replicator not ready"));
  if (topic === "/security/dataChanged") {
    this.securityChangeset.push(payload);
    return callback();
  }
  this.__replicate(topic, payload, callback);
};

Replicator.prototype.__replicate = function(topic, payload, callback) {
  this.localClient.set(
    "/__REPLICATE",
    {
      topic,
      payload,
      origin: this.happn.name
    },
    { noStore: true },
    function(err) {
      if (err) return callback(err);
      callback();
    }
  );
};

Replicator.prototype.initialize = function(config, callback) {
  property(this, "happn", this.happn);
  property(this, "config", config || {});
  this.__defaults(callback);
};

Replicator.prototype.stop = function(options, callback) {
  if (typeof options === "function") callback = options;
  this.__stopped = true;
  if (this.securityChangesetReplicateTimeout) {
    clearTimeout(this.securityChangesetReplicateTimeout);
    //flush the replication changeset
    this.securityChangesetReplicate(true);
  }
  this.log.info("stopped");
  callback();
};

Replicator.prototype.start = Promise.promisify(function(callback) {
  property(this, "localClient", this.happn.services.orchestrator.localClient);
  this.securityChangesetReplicate();
  this.localClient.on(
    "/__REPLICATE",
    data => {
      var topic = data.topic;
      var payload = data.payload;
      var origin = data.origin;
      var isLocal = origin === this.happn.name;

      if (topic === "/security/dataChanged")
        return this.emitSecurityDataChanged(payload, isLocal, origin);
      this.emit(topic, payload, isLocal, origin);
    },
    function(err) {
      if (err) return callback(err);
      callback();
    }
  );
});

Replicator.prototype.failSecurityChangesetReplicate = function(
  e,
  endingProcess
) {
  const errorMessage = `unable to replicate security data: ${e.message}`;
  if (!endingProcess) this.log.fatal(errorMessage);
  this.log.error(errorMessage);
};

Replicator.prototype.securityChangesetReplicate = function(endingProcess) {
  if (this.securityChangeset.length > 0) {
    try {
      this.__replicate(
        "/security/dataChanged",
        this.batchSecurityUpdate(),
        e => {
          if (e) this.failSecurityChangesetReplicate(e, endingProcess);
        }
      );
    } catch (e) {
      this.failSecurityChangesetReplicate(e, endingProcess);
    }
  }

  if (!this.__stopped)
    this.securityChangesetReplicateTimeout = setTimeout(
      this.securityChangesetReplicate.bind(this),
      this.config.securityChangesetReplicateInterval
    );
};

Replicator.prototype.getChangedKey = function(whatHappnd, changedData) {
  switch (whatHappnd) {
    case SD_EVENTS.LINK_GROUP:
      return changedData._meta.path.split("/").pop();
    case SD_EVENTS.UNLINK_GROUP:
      return changedData.path.split("/").pop();
    case SD_EVENTS.DELETE_USER:
      return changedData.obj._meta.path.replace(
        "/_SYSTEM/_SECURITY/_USER/",
        ""
      );
    case SD_EVENTS.DELETE_GROUP:
      return changedData.obj.name;
    case SD_EVENTS.UPSERT_GROUP:
      return changedData.name;
    case SD_EVENTS.PERMISSION_REMOVED:
      return changedData.groupName;
    case SD_EVENTS.PERMISSION_UPSERTED:
      return changedData.groupName;
    case SD_EVENTS.UPSERT_USER:
      return changedData.username;
    case SD_EVENTS.LOOKUP_TABLE_CHANGED:
      return changedData.table;
    case SD_EVENTS.LOOKUP_PERMISSION_CHANGED:
      return changedData.table;
    default:
      throw new Error(`unknown security data changed event: ${whatHappnd}`);
  }
};

Replicator.prototype.batchSecurityUpdate = function() {
  return this.securityChangeset.splice(0).reduce((reduced, change) => {
    if (!reduced[change.whatHappnd]) reduced[change.whatHappnd] = {};
    reduced[change.whatHappnd][
      this.getChangedKey(change.whatHappnd, change.changedData)
    ] = {
      changedData: change.changedData,
      additionalInfo: change.additionalInfo
    };
    return reduced;
  }, {});
};

Replicator.prototype.unpackBywhatHappnd = function(payload, whatHappnd) {
  if (payload[whatHappnd] == null) return [];
  return Object.keys(payload[whatHappnd]).map(changedKey => {
    return { whatHappnd, ...payload[whatHappnd][changedKey] };
  });
};

Replicator.prototype.unbatchSecurityUpdate = function(payload) {
  let unbatched = [];
  unbatched = unbatched.concat(
    this.unpackBywhatHappnd(payload, SD_EVENTS.LINK_GROUP)
  );
  unbatched = unbatched.concat(
    this.unpackBywhatHappnd(payload, SD_EVENTS.UNLINK_GROUP)
  );
  unbatched = unbatched.concat(
    this.unpackBywhatHappnd(payload, SD_EVENTS.UPSERT_GROUP)
  );
  unbatched = unbatched.concat(
    this.unpackBywhatHappnd(payload, SD_EVENTS.UPSERT_USER)
  );
  unbatched = unbatched.concat(
    this.unpackBywhatHappnd(payload, SD_EVENTS.PERMISSION_REMOVED)
  );
  unbatched = unbatched.concat(
    this.unpackBywhatHappnd(payload, SD_EVENTS.PERMISSION_UPSERTED)
  );
  unbatched = unbatched.concat(
    this.unpackBywhatHappnd(payload, SD_EVENTS.DELETE_USER)
  );
  unbatched = unbatched.concat(
    this.unpackBywhatHappnd(payload, SD_EVENTS.DELETE_GROUP)
  );
  unbatched = unbatched.concat(
    this.unpackBywhatHappnd(payload, SD_EVENTS.LOOKUP_TABLE_CHANGED)
  );
  unbatched = unbatched.concat(
    this.unpackBywhatHappnd(payload, SD_EVENTS.LOOKUP_PERMISSION_CHANGED)
  );
  return unbatched;
};

Replicator.prototype.emitSecurityDataChanged = function(
  payload,
  isLocal,
  origin
) {
  this.unbatchSecurityUpdate(payload).forEach(update => {
    this.emit("/security/dataChanged", update, isLocal, origin);
  });
};

Replicator.prototype.__defaults = function(callback) {
  if (!this.config.securityChangesetReplicateInterval)
    this.config.securityChangesetReplicateInterval = 3000;
  callback();
};
