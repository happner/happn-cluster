module.exports = Orchestrator;

var property = require('./property');

function Orchestrator(opts) {
  property(this, 'log', opts.logger.createLogger('Membership'));
}


Orchestrator.prototype.initialize = function(config, callback) {
  property(this, 'happn', this.happn);
  this.config = config;
  // try {
  //   this.defaults();
  // } catch (e) {
  //   return callback(e);
  // }
  return callback();
};

Orchestrator.prototype.stop = function(options, callback) {
  if (typeof options == 'function') callback = options;
  this.log.warn('todo: stop');
  callback();
};
