
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

module.exports.instances = instances = {};

function MockHappnClient(name) {
  this.serverInfo = {
    name: name
  };
  instances[name] = this;
}

MockHappnClient.prototype.onEvent = function() {

};

MockHappnClient.prototype.offEvent = function() {

};

MockHappnClient.prototype.on = function(path, opts, handler, callback) {
  callback();
};
