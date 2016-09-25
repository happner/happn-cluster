module.exports = Membership;

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Swim = require('happn-swim');
var Promise = require('bluebird');
var dface = require('dface');

var property = require('./property');
var getAddress = require('./get-address');

function Membership(happn, happnAddress) {
  this.clusterName = happn.config.cluster.name;
  this.config = happn.config.cluster.membership;
  property(this, 'log', happn.log.createLogger('Membership'));
  this.initialize(happnAddress);
}

util.inherits(Membership, EventEmitter);

Membership.prototype.bootstrap = Promise.promisify(function(callback) {
  var _this = this;
  this.log.info('listening at %s', this.swimAddress);
  this.log.info('joining cluster \'%s\'', this.clusterName);

  this.swim.bootstrap(this.config.hosts, function(error) {
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
        happn: member.meta.happn
      };
      logMemberChange();
      _this.emit('add', {
        memberId: member.host,
        happnUrl: member.meta.happn
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
      if (member.meta.cluster !== _this.clusterName) return;
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
});

Membership.prototype.stop = function() {
  this.swim.leave();
};

Membership.prototype.initialize = function(happnAddress) {
  var config = this.config;

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

  property(this, 'swimAddress', config.host + ':' + config.port);
  this.membershipId = this.swimAddress;
  this.members = {};

  property(this, 'swim', new Swim({
    local: {
      host: this.swimAddress,
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
  }));
};
