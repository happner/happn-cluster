module.exports = Membership;

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Swim = require('happn-swim');
var Promise = require('bluebird');
var dface = require('dface');

var property = require('../utils/property');
var getAddress = require('../utils/get-address');

function Membership(opts) {
  property(this, 'log', opts.logger.createLogger('Membership'));
  property(this, 'Swim', Swim);
}

util.inherits(Membership, EventEmitter);

Membership.prototype.initialize = function (config, callback) {
  property(this, 'happn', this.happn);
  property(this, 'config', config);
  // this.config = config;
  this.members = {};
  this.__defaults(callback);
};

Membership.prototype.stop = function (options, callback) {
  if (typeof options == 'function') callback = options;
  this.log.info('stopping');

  if (this.swim) {
    this.swim.leave();
    this.swim.removeAllListeners();
  }

  this.log.info('stopped');
  callback();
};

Membership.prototype.bootstrap = Promise.promisify(function (callback) {
  var config, protocol, address, happnUrl, wait, _this = this;

  this.log.info('listening at %s', this.swimAddress);
  this.log.info('joining cluster \'%s\'', this.config.clusterName);

  config = this.config;
  protocol = this.happn.services.transport.config.mode;
  address = this.happn.server.address();

  if (address.address == '0.0.0.0') {
    // using this to inform remote hosts where to attach
    // 0.0.0.0 won't do, instead use first public ipv4 address
    happnUrl = getAddress();
  } else {
    happnUrl = address.address;
  }
  happnUrl += ':' + address.port;
  happnUrl = protocol + '://' + happnUrl;

  if (this.swim) {
    this.swim.leave();
    this.swim.removeAllListeners();
  }

  property(this, 'swim', new this.Swim({
    local: {
      host: this.swimAddress,
      meta: {
        cluster: config.clusterName,
        url: happnUrl
      }
    },
    disseminationFactor: config.disseminationFactor,
    interval: config.pingInterval,
    joinTimeout: config.joinTimeout,
    pingTimeout: config.pingTimeout,
    pingReqTimeout: config.pingReqTimeout,
    pingReqGroupSize: config.pingReqGroupSize,
    udp: config.udp
  }));

  wait = config.seed ? 0 : config.seedWait;

  if (config.randomWait > 0 && !config.seed) {
    wait += Math.round(Math.random() * config.randomWait)
  }

  setTimeout(function () {
    _this.swim.bootstrap(_this.config.hosts, function (error) {

      if (error) {
        if (_this.config.seed && error.name == 'JoinFailedError') {
          // seed member accepts failure to join cluster
        } else {
          return callback(error);
        }
      }

      function addMember(member) {
        if (_this.members[member.host]) return;
        _this.members[member.host] = {
          url: member.meta.url
        };
        _this.log.debug('has %d other members (%s arrived)',
          Object.keys(_this.members).length, member.host);
        _this.emit('add', {
          memberId: member.host,
          url: member.meta.url
        });
      }

      function removeMember(member) {
        if (!_this.members[member.host]) return;
        delete _this.members[member.host];
        _this.log.debug('has %d other members (%s left)',
          Object.keys(_this.members).length, member.host);
        _this.emit('remove', {
          memberId: member.host
        });
      }

      function onUpdate(member) {
        if (member.host == _this.swimAddress) return;
        if (member.meta.cluster !== config.clusterName) return;
        if (member.state == 0) return addMember(member);
        if (member.state == 1) return;
        if (member.state == 2) return removeMember(member);
      }

      var members = _this.swim.members();

      members.forEach(addMember);

      _this.swim.on(Swim.EventType.Update, onUpdate);
      _this.swim.on(Swim.EventType.Change, onUpdate);

      callback();
    });
  }, wait);
});

Membership.prototype.__defaults = function (callback) {
  var dataPlugin, config = this.config;

  // try {
  //   // cluster requires shared database (for now)
  //   // the only shared database plugin is happn-service-mongo
  //   // (missing some way to test isDatabasePluginShared)
  //   dataPlugin = this.happn.config.services.data.path;
  //   if (dataPlugin !== 'happn-service-mongo') {
  //     return callback(new Error('cluster requires shared data service'));
  //   }
  // } catch (e) {
  //   return callback(new Error('cluster requires shared data service'));
  // }

  if (!config.clusterName) config.clusterName = 'happn-cluster';

  if (typeof config.seed !== 'boolean') config.seed = false;

  if (typeof config.seedWait !== 'number') config.seedWait = 0;
  if (typeof config.randomWait !== 'number') config.randomWait = 0;

  try {
    config.host = dface(config.host);
  } catch (e) {
    return callback(e);
  }
  // need actual ip address, remote hosts can't connect to 0.0.0.0 here
  if (config.host == '0.0.0.0') config.host = getAddress();

  if (!config.port) config.port = 56000;

  if (!config.hosts || config.hosts.length == 0) return callback(new Error('missing membership.hosts to join'));

  if (typeof config.joinTimeout == 'undefined') config.joinTimeout = 1000;
  if (typeof config.pingInterval == 'undefined') config.pingInterval = 1000;
  if (typeof config.pingTimeout == 'undefined') config.pingTimeout = 200;
  if (typeof config.pingReqTimeout == 'undefined') config.pingReqTimeout = 600;
  if (typeof config.pingReqGroupSize == 'undefined') config.pingReqGroupSize = 3;
  if (typeof config.udp == 'undefined') config.udp = {};
  if (typeof config.udp.maxDgramSize == 'undefined') config.udp.maxDgramSize = 512;
  if (typeof config.disseminationFactor == 'undefined') config.disseminationFactor = 15;

  property(this, 'swimAddress', config.host + ':' + config.port);

  this.memberId = this.swimAddress;

  callback();
};
