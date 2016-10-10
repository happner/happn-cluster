
var lastLoginConfig;

module.exports.getLastLoginConfig = function() {
  return lastLoginConfig;
};

module.exports.create = function(config, callback) {
  var name = 'remote-happn-instance';

  // console.log('CONFIG', JSON.stringify(config.info, null, 2));

  if (config.config.url) {
    name = config.config.url.split('//')[1].replace(/\./g, '-').replace(/\:/g, '_');
  }

  lastLoginConfig = config;
  callback(null, new MockHappnClient(name));
};

var instances;

module.exports.instances = {};

function MockHappnClient(name) {
  this.serverInfo = {
    name: name
  };
  module.exports.instances[name] = this;
  this.eventHandlers = {};

  var onDestroy, _this = this;
  this.pubsub = {
    on: function(event, handler) {
      if (event == 'destroy') {
        onDestroy = handler;
        return;
      }
    },
    destroy: function() {
      _this.destroyed = true;
      onDestroy();
    }
  }
}

MockHappnClient.prototype.onEvent = function(event, handler) {
  this.eventHandlers[event] = this.eventHandlers[event] || [];
  this.eventHandlers[event].push(handler);
};

MockHappnClient.prototype.offEvent = function() {

};

MockHappnClient.prototype.on = function(path, opts, handler, callback) {
  callback();
};

MockHappnClient.prototype.emitDisconnect = function() {
  var handlers = this.eventHandlers['reconnect-scheduled'];
  if (!handlers) return;
  handlers.forEach(function(fn) {
    fn();
  });
};
