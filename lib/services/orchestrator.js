module.exports = Orchestrator;

var Happn = require('happn');
var Promise = require('bluebird');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Member = require('./orchestrator/member');
var property = require('../utils/property');
var getAddress = require('../utils/get-address');
var Mapper = require('../mappers/event-mapper');

function Orchestrator(opts) {
  property(this, 'log', opts.logger.createLogger('Orchestrator'));
  property(this, 'stabiliseWaiting', []); // callbacks waiting on stabilise
  property(this, 'stableExpectationMask', {
    name: 'defined',
    connectingTo: false,
    connectedTo: true,
    connectedFrom: true,
    subscribedTo: true,
    subscribedFrom: true,
    error: null
  });
  property(this, 'stableReportInterval', null);
}

util.inherits(Orchestrator, EventEmitter);

// TODO: emit  member/add member/remove

Orchestrator.prototype.initialize = function (config, callback) {
  property(this, 'happn', this.happn);
  property(this, 'config', config);
  this.members = {}; // list of all members (by memberId/swim)
  this.peers = {};   // list of ready/connected members by happn.name

  property(this, '__onConnectionFromHandler', this.__onConnectionFrom.bind(this));
  property(this, '__onDisconnectionFromHandler', this.__onDisconnectionFrom.bind(this));
  this.happn.services.pubsub.on('authentic', this.__onConnectionFromHandler);
  this.happn.services.pubsub.on('disconnect', this.__onDisconnectionFromHandler);

  this.__defaults(callback);
};

Orchestrator.prototype.stop = function (options, callback) {
  if (typeof options == 'function') callback = options;

  var members = this.members, log = this.log;
  log.info('stopping');

  // TODO: fix bug in happn, https://github.com/happner/happn/issues/136
  // this.happn.services.pubsub.removeListener('authentic', this.__onConnectionFromHandler);
  // this.happn.services.pubsub.removeListener('disconnect', this.__onDisconnectionFromHandler);

  if (this.membership) {
    this.membership.removeListener('remove', this.__removeMembershipHandler);
    this.membership.removeListener('add', this.__addMembershipHandler);
  }

  clearInterval(this.stableReportInterval);

  Promise.resolve(Object.keys(members)).map(function (name) {
    return members[name].stop();
  })
    .then(function () {
      log.info('stopped');
      callback();
    })
    .catch(function (error) {
      log.error('failed to stop orchestrator', error);
      // not much can be done, want to still allow the rest of the system to stop
      // by not erroring the happn service shutdown sequence
      callback();
    });
};

Orchestrator.prototype.prepare = Promise.promisify(function (callback) {
  var protocol, address, happnUrl, _this = this;
  if (!this.happn.services.membership) {
    return callback(new Error('missing membership service'));
  }

  protocol = this.happn.config.transport.mode;
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

  property(this, 'loginConfig', {
    // used to login to remote cluster members as a cluster peer
    info: {
      name: this.happn.name, // a.k.a. mesh.name
      clusterName: this.happn.services.membership.config.clusterName,
      memberId: this.happn.services.membership.memberId,
      url: happnUrl
    },
    config: {}
  });

  property(this, 'membership', this.happn.services.membership);
  property(this, '__removeMembershipHandler', this.__onMembershipRemoveMember.bind(this));
  property(this, '__addMembershipHandler', this.__onMembershipAddMember.bind(this));

  this.membership.on('remove', this.__removeMembershipHandler);
  this.membership.on('add', this.__addMembershipHandler);

  Happn.client.create({
    config: {
      // username: '_ADMIN',
      // password: 'xxx'
    },
    plugin: Happn.client_plugins.intra_process,
    context: this.happn
  }, function (error, client) {
    if (error) return callback(error);

    _this.members.__self = new Member({
      orchestrator: _this,
      localClient: client
    });

    callback();
  });

});

Orchestrator.prototype.stabilized = Promise.promisify(function (callback) {
  this.log.info('stabilising');
  var _this = this;

  property(this, 'startedAt', Date.now());

  if (typeof callback == 'function') this.stabiliseWaiting.push(callback);

  if (this.stableReportInterval) return;

  this.stableReportInterval = setInterval(function () {
    _this.__stateUpdate(true);
  }, this.config.stableReportInterval);

  this.__stateUpdate();
});

Orchestrator.prototype.__stateUpdate = function (report) {
  var callback, _this = this;

  var errors = [];
  var reports = [];
  var unstableCount = 0;

  Object.keys(this.members).forEach(function (memberId) {
    var error, missing, member = _this.members[memberId];

    // skip existing peers, already stable
    if (member.name && _this.peers[member.name]) return;

    error = false;
    missing = [];

    Object.keys(_this.stableExpectationMask).forEach(function (key) {
      var expectedValue = _this.stableExpectationMask[key];

      if (key == 'error' && member.error) {
        errors.push(member.error);
        error = true;
        return;
      }
      if (expectedValue == 'defined') {
        if (!member[key]) missing.push(key);
        return;
      }
      if (expectedValue != member[key]) return missing.push(key);
    });

    if (!error && missing.length == 0) return _this.__addPeer(member);

    unstableCount++;

    if (report) {
      reports.push(util.format(
        'member %s awaiting %s', member.name || member.memberId, missing.join(', '))
      );
    }

  });

  if (errors.length > 0) {
    // each erroring member already logged it's error
    clearInterval(this.stableReportInterval);
    // can only callback with one error
    while (callback = this.stabiliseWaiting.shift()) callback(errors[0]);
    return;
  }

  if (reports.length > 0) {
    this.log.info('');
    this.log.info('--- stabilise report ---');
    reports.forEach(function(line) {
      _this.log.info(line);
    });
    this.log.info('');
  }

  if (unstableCount != 0) return;

  clearInterval(this.stableReportInterval);

  if (this.stabiliseWaiting.length == 0) return;

  this.log.info('stabilised in %dms', Date.now() - this.startedAt);

  while (callback = this.stabiliseWaiting.shift()) callback();
};

Orchestrator.prototype.__addPeer = function (member) {
  if (this.peers[member.name]) return;

  this.peers[member.name] = member; // includes self by name
  if (member.self) property(this.peers, '__self', member); // non enumerable __self
  this.emit('peer/add', member);

  this.log.info('has %d other peers (%s arrived)', Object.keys(this.peers).length - 1, member.name);
};

Orchestrator.prototype.__removePeer = function (member) {
  if (!this.peers[member.name]) return;
  delete this.peers[member.name];
  if (member.self) delete this.peers.__self;
  this.emit('peer/remove', member);

  this.log.info('has %d other peers (%s left)', Object.keys(this.peers).length - 1, member.name);
};

Orchestrator.prototype.__removeMember = function (member) {
  this.log.debug('remove member %s', member.name);
  var _this = this;
  member.stop()
    .then(function () {
      delete _this.members[member.memberId];
      _this.__stateUpdate();
    })
    .catch(function (error) {
      _this.log.error('failed to cleanly remove member %s', member.name, error);
      delete _this.members[member.memberId];
      _this.__stateUpdate();
    })
};

Orchestrator.prototype.__onConnectionFrom = function (data) {
  if (!data.info) return;
  if (!data.info.clusterName) return;

  this.log.debug('connect from (<-) %s/%s', data.info.clusterName, data.info.name);

  if (data.info.clusterName !== this.membership.config.clusterName) {
    this.log.warn('ignoring connection from %s - wrong cluster %s',
      data.info.name, data.info.clusterName);
    return;
  }

  var memberFromLogin, member = this.members[data.info.memberId];
  if (!member) {

    // remote happn client loggin into here provides the necessary
    // info to login straight back and thus stabilise without
    // waiting for the swim member discovery

    memberFromLogin = {
      memberId: data.info.memberId,
      url: data.info.url,
      name: data.info.name
    };

    member = this.members[memberFromLogin.memberId] = new Member({
      memberFromLogin: memberFromLogin,
      orchestrator: this,
      eventMapper: Mapper.create(),
      clusterName: this.happn.services.membership.config.clusterName
    });
  }

  member.connectedFrom = true;
  this.__stateUpdate();
};

Orchestrator.prototype.__onDisconnectionFrom = function (data) {
  if (!data.info) return;
  if (!data.info.clusterName) return;

  this.log.debug('disconnect from (<-) %s/%s', data.info.clusterName, data.info.name);

  if (data.info.clusterName !== this.membership.config.clusterName) return;

  var member = this.members[data.info.memberId];
  if (!member) return;

  member.connectedFrom = false;
  this.__removePeer(member);
};

Orchestrator.prototype.__onMembershipAddMember = function (info) {
  var member = this.members[info.memberId];
  if (member) return member.addMembership(info);
  this.members[info.memberId] = new Member({
    member: info,
    orchestrator: this,
    eventMapper: Mapper.create(),
    clusterName: this.happn.services.membership.config.clusterName
  });
};

Orchestrator.prototype.__onMembershipRemoveMember = function (info) {
  var member = this.members[info.memberId];
  if (!member) return;

  member.removeMembership(info);

  if (member.connectingTo || member.connectedTo) {
    return; // ignore swim flap
  }

  this.__removePeer(member);
  this.__removeMember(member);
};

Orchestrator.prototype.__defaults = function (callback) {
  this.config.replicate = this.config.replicate || ['/*'];
  this.config.stableReportInterval = this.config.stableReportInterval || 5000;
  callback();
};
