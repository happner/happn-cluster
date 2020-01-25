/* Special case intra-cluster replicator service,
 * see orchestrator/member.js for regular cluster replication
 */

module.exports = Replicator;

var EventEmitter = require("events").EventEmitter;
var util = require("util");
var Promise = require("bluebird");
var property = require("../utils/property");

function Replicator(opts) {
  property(this, "log", opts.logger.createLogger("Replicator"));
}

util.inherits(Replicator, EventEmitter);

Replicator.prototype.send = function(topic, payload, callback) {
  if (!this.localClient) return callback(new Error("Replicator not ready"));
  this.localClient.set(
    "/__REPLICATE",
    {
      topic: topic,
      payload: payload,
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
  property(this, "config", config);

  this.__defaults(callback);
};

Replicator.prototype.stop = function(options, callback) {
  if (typeof options === "function") callback = options;

  this.log.info("stopped");
  callback();
};

Replicator.prototype.start = Promise.promisify(function(callback) {
  property(
    this,
    "localClient",
    this.happn.services.orchestrator.members.__self.client
  );

  var _this = this;

  this.localClient.on(
    "/__REPLICATE",
    function(data) {
      var topic = data.topic;
      var payload = data.payload;
      var origin = data.origin;
      var isLocal = origin === _this.happn.name;

      _this.emit(topic, payload, isLocal, origin);
    },
    function(err) {
      if (err) return callback(err);
      callback();
    }
  );
});

Replicator.prototype.__defaults = function(callback) {
  callback();
};
