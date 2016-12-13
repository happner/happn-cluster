module.exports = MockOrchestrator;

var MockHappnClient = require('./mock-happn-client');

function MockOrchestrator(opts) {

  this.log = opts.logger.createLogger('Orchestrator');

  this.HappnClient = MockHappnClient;

  this.config = {
    replicate: ['/*']
  };

  this.loginConfig = {
    config: {},
    info: {
      name: 'local-instance-name',
      clusterName: 'cluster-name',
      memberId: '10.0.0.1:56000',
      url: 'http://10.0.0.1:55000'
    }
  };

  this.members = {};
  this.peers = {};

  this.happn = {
    services: {
      pubsub: {}
    }
  }
}

MockOrchestrator.prototype.getLoginConfig = function(){

  var clone = require('clone');

  if (!this.loginConfig) return null;

  var clonedConfig = clone(this.loginConfig);

  return {
    info:clonedConfig.info,
    username:clonedConfig.username,
    password:clonedConfig.password
  }

};

MockOrchestrator.prototype.__stateUpdate = function () {

};
