module.exports = Orchestrator;

var Happn = require('happn');
var Promise = require('bluebird');

var Member = require('./orchestrator/member');
var property = require('../utils/property');
var getAddress = require('../utils/get-address');
var Mapper = require('../mappers/event-mapper');

function Orchestrator(opts) {
  property(this, 'log', opts.logger.createLogger('Orchestrator'));
}

// TODO: emit  member/add member/remove peer/add peer/remove

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

  property(this, 'startedAt', Date.now());
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
  this.log.info('waiting for stabilise');

  // TODO: incorporate all member's connectingTo, connectedTo, connectedFrom, subscribedTo, subscribedFrom, error, member
  // TODO: consider not waiting for swim (member)
  // TODO: stabilize timeout

  this.log.info('stabilized in %dms', Date.now() - this.startedAt);
  callback();
});

Orchestrator.prototype.__stateUpdate = function() {

};

Orchestrator.prototype.__removeMember = function(member) {
  this.log.debug('remove member %s', member.name);
  var _this = this;
  member.stop()
    .then(function() {
      delete _this.members[member.memberId];
      _this.__stateUpdate();
    })
    .catch(function(error) {
      _this.log.error('failed to cleanly remove member %s', member.name, error);
      delete _this.members[member.memberId];
      _this.__stateUpdate();
    })
};

Orchestrator.prototype.__removePeer = function(member) {
  this.log.warn('TODO: remove peer %s', member.name);
};

Orchestrator.prototype.__onConnectionFrom = function (data) {
  if (!data.info) return;
  if (!data.info.clusterName) return;
  if (data.info.clusterName !== this.membership.config.clusterName) {
    this.log.warn('ignoring connection from %s - wrong cluster %s',
      data.info.name, data.info.clusterName);
    return;
  }

  var member = this.members[data.info.memberId];
  if (!member) {
    this.log.warn('TODO: learn member before swim', data.info.name);
    return;
  }

  member.connectedFrom = true;
  this.log.warn('TODO: add peer if ready');
  this.__stateUpdate();
};

Orchestrator.prototype.__onDisconnectionFrom = function (data) {
  if (!data.info) return;
  if (!data.info.clusterName) return;
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
  callback();
};
