module.exports = Orchestrator;

var Happn = require('happn-3');
var Promise = require('bluebird');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Member = require('./orchestrator/member');
var property = require('../utils/property');
var getAddress = require('../utils/get-address');
var clone = require('clone');

function Orchestrator(opts) {

  this.peers = {};   // list of ready (fully connected) members by happn.name

  property(this, 'members', {}); // list of all members (by memberId/swim)
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
  property(this, 'stableTimeout', null);
  property(this, 'stableAwaitingMinimumPeers', null);
  property(this, 'HappnClient', Happn.client);
  property(this, 'Member', Member);
}

util.inherits(Orchestrator, EventEmitter);

Orchestrator.prototype.initialize = function (config, callback) {

  property(this, 'happn', this.happn);
  property(this, 'config', config);
  property(this, 'secure', this.happn.config.secure);
  property(this, 'announceHost', this.happn.config.announceHost);

  if (this.announceHost == '') {
    // ansible is loading empty string
    this.log.error('announceHost is empty string!');
    process.exit(1);
  }

  if (this.secure) {
    try {
      property(this, 'adminUser', this.happn.services.security.config.adminUser);
    } catch (e) {
      return callback(new Error('missing services.security.config.adminUser'));
    }
  }

  property(this, '__onConnectionFromHandler', this.__onConnectionFrom.bind(this));
  property(this, '__onDisconnectionFromHandler', this.__onDisconnectionFrom.bind(this));

  this.happn.services.session.on('authentic', this.__onConnectionFromHandler);
  this.happn.services.session.on('disconnect', this.__onDisconnectionFromHandler);

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
  clearTimeout(this.stableTimeout);

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

Orchestrator.prototype.getLoginConfig = function () {

  if (!this.loginConfig) return null;

  var config = {info: clone(this.loginConfig.info)};

  if (this.loginConfig.username) config.username = this.loginConfig.username.toString();
  if (this.loginConfig.password) config.password = this.loginConfig.password.toString();

  return config;
};

Orchestrator.prototype.prepare = Promise.promisify(function (callback) {

  var protocol, address, happnUrl, intraProcess, _this = this;

  if (!this.happn.services.membership) return callback(new Error('missing membership service'));

  protocol = this.happn.services.transport.config.mode;

  address = this.happn.server.address();

  if (address.address == '0.0.0.0') {
    // using this to inform remote hosts where to attach
    // 0.0.0.0 won't do, instead use first public ipv4 address
    happnUrl = getAddress();
  } else happnUrl = address.address;

  if (this.announceHost) {
    happnUrl = this.announceHost;
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
    }
  });

  if (this.secure) {
    this.loginConfig.username = this.adminUser.username;
    this.loginConfig.password = this.adminUser.password;
  }

  property(this, 'membership', this.happn.services.membership);
  property(this, '__removeMembershipHandler', this.__onMembershipRemoveMember.bind(this));
  property(this, '__addMembershipHandler', this.__onMembershipAddMember.bind(this));

  this.membership.on('remove', this.__removeMembershipHandler);
  this.membership.on('add', this.__addMembershipHandler);

  // remove clusterName for localLogin (to self) so that
  // in happner-cluster our self connection receives replicated events
  // ie. not filtered out by happn when noCluster is set
  var localLoginConfig = clone(this.loginConfig);
  delete localLoginConfig.info.clusterName;

  this.happn.services.session.localClient(localLoginConfig, function (error, client) {

    if (error) return callback(error);

    _this.members.__self = new _this.Member({
      orchestrator: _this,
      localClient: client
    });

    callback();
  });
});

Orchestrator.prototype.stabilised = Promise.promisify(function (callback) {

  this.log.debug('testing stabilised');

  var _this = this;

  if (typeof callback == 'function') this.stabiliseWaiting.push(callback);

  if (this.stableReportInterval) return;

  this.stableReportInterval = setInterval(function () {
    _this.__stateUpdate(true);
  }, this.config.stableReportInterval);

  if (this.stableTimeout) return;

  if (this.config.stabiliseTimeout !== 0) {
    this.stableTimeout = setTimeout(function () {
      var error = new Error('failed to stabilise in time');
      error.name = 'StabiliseTimeout';

      clearInterval(_this.stableReportInterval);
      while ((callback = _this.stabiliseWaiting.shift()) !== undefined) callback(error);
    }, this.config.stabiliseTimeout);
  }

  this.__stateUpdate();
});

Orchestrator.prototype.__stateUpdate = function (report) {

  var callback, _this = this;
  var peerCount;
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
    clearInterval(this.stableTimeout);
    // can only callback with one error
    while ((callback = this.stabiliseWaiting.shift()) !== undefined) callback(errors[0]);
    return;
  }

  if (reports.length > 0) {
    this.log.info('');
    this.log.info('--- stabilise report ---');
    reports.forEach(function (line) {
      _this.log.info(line);
    });
    this.log.info('');
  }

  if (unstableCount != 0) return;

  clearInterval(this.stableReportInterval);

  if (this.stabiliseWaiting.length == 0) return;

  peerCount = Object.keys(this.peers).length;
  if (peerCount < this.config.minimumPeers) {
    if (!this.stableAwaitingMinimumPeers) {
      this.log.warn('requires %d more peers to stabilise',
        this.config.minimumPeers - peerCount);
    }
    this.stableAwaitingMinimumPeers = true;
    return;
  }

  this.stableAwaitingMinimumPeers = false;

  this.log.info('stabilised');

  clearInterval(this.stableTimeout);

  while ((callback = this.stabiliseWaiting.shift()) !== undefined) callback();
};

Orchestrator.prototype.__addPeer = function (member) {
  if (this.peers[member.name]) return;

  this.peers[member.name] = member; // includes self by name
  if (member.self) property(this.peers, '__self', member); // non enumerable __self
  this.emit('peer/add', member.name, member);

  if (this.stableAwaitingMinimumPeers) {
    this.log.info('cluster size %d/%d (%s arrived)',
      Object.keys(this.peers).length, this.config.minimumPeers, member.name);
    return;
  }
  this.log.info('cluster size %d (%s arrived)',
    Object.keys(this.peers).length, member.name);
};

Orchestrator.prototype.__removePeer = function (member) {
  if (!this.peers[member.name]) return;
  delete this.peers[member.name];
  if (member.self) delete this.peers.__self;
  this.emit('peer/remove', member.name, member);

  if (this.stableAwaitingMinimumPeers) {
    this.log.info('cluster size %d/%d (%s left)',
      Object.keys(this.peers).length, this.config.minimumPeers, member.name);
    return;
  }
  this.log.info('cluster size %d (%s left)',
    Object.keys(this.peers).length, member.name);
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
    });
};

Orchestrator.prototype.__onConnectionFrom = function (data) {

  if (!data.info) return;
  if (!data.info.clusterName) return;

  if (this.secure) {

    if (data.user.username !== this.adminUser.username) {
      // ignore login from "claimed" cluster peers (got info.clusterName)
      // where the remote is logging in with a different username.
      //
      // otherwise, anyone can login as cluster peers and we would
      // log back into them, exposing our admin password
      this.log.warn('ignoring connection from %s - wrong user %s', data.info.name, this.adminUser.username);
      return;
    }
  }

  if (this.getLoginConfig().info.name === data.info.name) {
    // dont re-login a replication client back to self
    // (causes duplication)
    return;
  }

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

    member = this.members[memberFromLogin.memberId] = new this.Member({
      memberFromLogin: memberFromLogin,
      orchestrator: this,
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

  this.members[info.memberId] = new this.Member({
    member: info,
    orchestrator: this,
    clusterName: this.happn.services.membership.config.clusterName
  });
};

Orchestrator.prototype.__onMembershipRemoveMember = function (info) {

  var member = this.members[info.memberId];
  if (!member) return;

  member.removeMembership(info);

  if (member.connectingTo || member.connectedTo) return; // ignore swim flap

  this.__removePeer(member);
  this.__removeMember(member);
};

Orchestrator.prototype.__defaults = function (callback) {

  this.config.minimumPeers = this.config.minimumPeers || 1;
  this.config.replicate = this.config.replicate || ['*'];
  this.config.replicate.push('/__REPLICATE');
  this.config.replicate = this.__reducePaths(this.config.replicate);
  this.config.stableReportInterval = this.config.stableReportInterval || 5000;

  if (typeof this.config.stabiliseTimeout == 'undefined') this.config.stabiliseTimeout = 120 * 1000;

  callback();
};

Orchestrator.prototype.__reducePaths = function (paths) {

  if (paths.length == 1) return paths;

  //* means match anything
  if (paths.some(function(path){
    return path == '*';
  })) return ['*'];

  //remove any duplicates
  let returnPaths = paths.filter((v, i) => paths.indexOf(v) === i);

  let wildPaths = returnPaths.reduce((arr, path) => {
    if (path.indexOf('*') > -1) arr.push(path.split('/'));
    return arr;
  }, []);

  let tamePaths = returnPaths.reduce((arr, path) => {
    if (path.indexOf('*') == -1) arr.push(path.split('/'));
    return arr;
  }, []);

  for (let wildPathArr of wildPaths){
    for (let tamePathArr of tamePaths){
      if (tamePathArr.length == wildPathArr.length){//same amount of segments
        let wildPath = wildPathArr.join('/');
        let tamePath = tamePathArr.join('/');
        if (tamePath.match(new RegExp(wildPath.replace(/\*/g, '.*'))) != null){
          returnPaths.splice(returnPaths.indexOf(tamePath), 1);
        }
      }
    }
  }

  return returnPaths;
};
