/* Special case intra-cluster replicator service,
 * see orchestrator/member.js for regular cluster replication
 */

module.exports = Replicator;

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Promise = require('bluebird');
var property = require('../utils/property');

function Replicator(opts) {
  property(this, 'log', opts.logger.createLogger('Replicator'));
};

util.inherits(Replicator, EventEmitter);

Replicator.prototype.initialize = function (config, callback) {
  property(this, 'happn', this.happn);
  property(this, 'config', config);

  this.__defaults(callback);
};

Replicator.prototype.stop = function (options, callback) {
  if (typeof options == 'function') callback = options;

  this.log.info('stopped');
  callback();
};

Replicator.prototype.start = Promise.promisify(function (callback) {
  property(this, 'localClient', this.happn.services.orchestrator.members.__self.client);

  this.localClient.on('/__REPLICATE',
    function (data, meta) {

      console.log('TODO: emit with isLocal flag and origin name');

    },
    function (err) {
      if (err) return callback(err);
      callback();
    }
  );
});

Replicator.prototype.replicate = function (topic, payload, callback) {
  if (!this.localClient) return callback(new Error('Replicator not ready'));

  console.log('replicate', topic, payload);
  callback();
};

Replicator.prototype.__defaults = function (callback) {
  callback();
};
