module.exports = Membership;

var Swim = require('happn-swim');
var Promise = require('bluebird');
var dface = require('dface');

var getAddress = require('./get-address');

function Membership(happn, happnAddress) {
  var config, swimAddress;
  this.log = happn.log.createLogger('Membership');
  this.clusterName = happn.config.cluster.name;

  happn.config.cluster.membership = happn.config.cluster.membership || {};
  config = this.config = happn.config.cluster.membership;

  if (typeof config.seed !== 'boolean') {
    config.seed = false;
  }

  config.joinType = config.joinType || 'dynamic';

  if (config.joinType !== 'static' && config.joinType !== 'dynamic') {
    throw new Error('invalid membership joinType');
  }

  config.host = dface(config.host);

  // need actual ip address, remote hosts can't connect to 0.0.0.0 here
  if (config.host == '0.0.0.0') {
    config.host = getAddress();
  }

  if (config.host == '0.0.0.0' || config.host == '::') {
    throw new Error('invalid membership host');
  }

  if (!config.port) {
    config.port = 11000;
  }

  if (config.joinType == 'static' && (!config.hosts || config.hosts.length == 0)) {
    throw new Error('missing membership.hosts to join');
  }

  if (typeof config.joinTimeout == 'undefined') config.joinTimeout = 2000;
  if (typeof config.pingInterval == 'undefined') config.pingInterval = 1000;
  if (typeof config.pingTimeout == 'undefined') config.pingTimeout = 200;
  if (typeof config.pingReqTimeout == 'undefined') config.pingReqTimeout = 600;
  if (typeof config.pingReqGroupSize == 'undefined') config.pingReqGroupSize = 3;
  if (typeof config.udp == 'undefined') config.udp = {};
  if (typeof config.udp.maxDgramSize == 'undefined') config.udp.maxDgramSize = 512;
  if (typeof config.disseminationFactor == 'undefined') config.disseminationFactor = 15;

  swimAddress = config.host + ':' + config.port;

  this.swim = new Swim({
    local: {
      host: swimAddress,
      meta: {
        cluster: this.clusterName,
        happn: happnAddress
      }
    },
    disseminationFactor: config.disseminationFactor,
    interval: config.pingInterval,
    joinTimeout: config.joinTimeout,
    pingTimeout: config.pingTimeout,
    pingReqTimeout: config.pingReqTimeout,
    pingReqGroupSize: config.pingReqGroupSize,
    udp: config.udp
  });
}

Membership.prototype.bootstrap = Promise.promisify(function(callback) {
  var _this = this;
  this.log.info('joining cluster \'%s\'', this.clusterName);

  this.swim.bootstrap(this.config.hosts, function(error) {
    if (error) {
      if (error.name == 'JoinFailedError' && _this.config.seed) {
        return callback(); // seed member accepts failure to join cluster
      }
      return callback(error);
    }

    callback();
  });
});

Membership.prototype.stop = function() {
  this.swim.leave();
};
