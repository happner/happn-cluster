module.exports = Membership;

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Swim = require('happn-swim');
var Promise = require('bluebird');
var dface = require('dface');

var property = require('./property');
var getAddress = require('./get-address');

function Membership(opts) {
  property(this, 'log', opts.logger.createLogger('Membership'));
}

util.inherits(Membership, EventEmitter);

Membership.prototype.initialize = function(config, callback) {
  property(this, 'happn', this.happn);
  property(this, 'config', config);
  // this.config = config;
  this.members = {};
  this.__defaults(callback);
};

Membership.prototype.stop = function(options, callback) {
  if (typeof options == 'function') callback = options;
  this.log.info('stopping');

  if (this.swim) {
    this.swim.leave();
    this.swim.removeAllListeners();
  }

  this.log.debug('stopped');
  callback();
};

Membership.prototype.bootstrap = Promise.promisify(function(callback) {
  var config, /* protocol, address, happnAddress, */ wait, _this = this;

  this.log.info('listening at %s', this.swimAddress);
  this.log.info('joining cluster \'%s\'', this.config.clusterName);

  config = this.config;
  // protocol = this.happn.config.transport.mode;
  // address = this.happn.server.address();
  // if (address.address == '0.0.0.0') {
  //   // using this to inform remote hosts where to attach
  //   // 0.0.0.0 won't do, instead use first public ipv4 address
  //   happnAddress = getAddress();
  // } else {
  //   happnAddress = address.address;
  // }
  // happnAddress += ':' + address.port;
  // happnAddress = protocol + '://' + happnAddress;

  if (this.swim) {
    this.swim.leave();
    this.swim.removeAllListeners();
  }

  property(this, 'swim', new Swim({
    local: {
      host: this.swimAddress,
      meta: {
        name: this.happn.name,
        cluster: config.clusterName
        // happn: happnAddress
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

  setTimeout(function() {
    _this.swim.bootstrap(_this.config.hosts, function(error) {
      if (error) {
        if (error.name == 'JoinFailedError' && !_this.config.seed) {
          return callback(error);
          // seed member accepts failure to join cluster
        }
      }

      var doLog = false;

      function logMemberChange() {
        if (!doLog) return;
        _this.log.info('has %d other members', Object.keys(_this.members).length);
      }

      function addMember(member) {
        if (_this.members[member.host]) return;
        _this.members[member.host] = {
          name: member.meta.name
        };
        logMemberChange();
        _this.emit('add', {
          memberId: member.host,
          name: member.meta.name
        });
      }

      function removeMember(member) {
        if (!_this.members[member.host]) return;
        delete _this.members[member.host];
        logMemberChange();
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
      _this.log.info('has %d other members', members.length);

      members.forEach(addMember);

      doLog = true;

      _this.swim.on(Swim.EventType.Update, onUpdate);
      _this.swim.on(Swim.EventType.Change, onUpdate);

      callback();
    });
  }, wait);
});

Membership.prototype.__defaults = function(callback) {
  var dataPlugin, config = this.config;

  try {
    // cluster requires shared database (for now)
    // the only shared database plugin is happn-service-mongo
    // (missing some way to test isDatabasePluginShared)
    dataPlugin = this.happn.config.services.data.path;
    if (dataPlugin !== 'happn-service-mongo') {
      return callback(new Error('cluster requires shared data service'));
    }
  } catch (e) {
    return callback(new Error('cluster requires shared data service'));
  }

  if (typeof config.seed !== 'boolean') {
    config.seed = false;
  }

  if (typeof config.seedWait !== 'number') {
    config.seedWait = 0;
  }

  config.joinType = config.joinType || 'dynamic';

  if (config.joinType !== 'static' && config.joinType !== 'dynamic') {
    return callback(new Error('invalid membership joinType'));
  }

  try {
    config.host = dface(config.host);
  } catch (e) {
    return callback(e);
  }

  // need actual ip address, remote hosts can't connect to 0.0.0.0 here
  if (config.host == '0.0.0.0') {
    config.host = getAddress();
  }

  if (!config.port) {
    config.port = 56000;
  }

  if (config.joinType == 'static' && (!config.hosts || config.hosts.length == 0)) {
    return callback(new Error('missing membership.hosts to join'));
  }

  if (typeof config.joinTimeout == 'undefined') config.joinTimeout = 2000;
  if (typeof config.pingInterval == 'undefined') config.pingInterval = 1000;
  if (typeof config.pingTimeout == 'undefined') config.pingTimeout = 200;
  if (typeof config.pingReqTimeout == 'undefined') config.pingReqTimeout = 600;
  if (typeof config.pingReqGroupSize == 'undefined') config.pingReqGroupSize = 3;
  if (typeof config.udp == 'undefined') config.udp = {};
  if (typeof config.udp.maxDgramSize == 'undefined') config.udp.maxDgramSize = 512;
  if (typeof config.disseminationFactor == 'undefined') config.disseminationFactor = 15;

  property(this, 'swimAddress', config.host + ':' + config.port);
  this.membershipId = this.swimAddress;

  callback();
};
