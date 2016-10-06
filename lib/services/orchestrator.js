module.exports = Orchestrator;

var Happn = require('happn');
var Promise = require('bluebird');

var Member = require('./orchestrator/member');
var property = require('../utils/property');
var getAddress = require('../utils/get-address');

function Orchestrator(opts) {
  property(this, 'log', opts.logger.createLogger('Orchestrator'));
}

Orchestrator.prototype.initialize = function(config, callback) {
  property(this, 'happn', this.happn);
  property(this, 'config', config);
  this.members = {}; // list of all members (by memberId/swim)
  this.peers = {};   // list of ready/connected members by happn.name
  this.__defaults(callback);
};

Orchestrator.prototype.stop = function(options, callback) {
  if (typeof options == 'function') callback = options;

  var members = this.members, log = this.log;
  log.info('stopping');

  if (typeof options == 'function') callback = options;
  if (this.membership) {
    this.membership.removeListener('remove', this.__removeMemberHandler);
    this.membership.removeListener('add', this.__addMemberHandler);
  }

  Promise.resolve(Object.keys(members)).map(function(name) {
    return members[name].stop();
  })
    .then(function() {
      log.debug('stopped');
      callback();
    })
    .catch(function(error) {
      log.error('failed to stop orchestrator', error);
      // not much can be done, want to still allow the rest of the system to stop
      // by not erroring the happn service shutdown sequence
      callback();
    });
};

Orchestrator.prototype.prepare = Promise.promisify(function(callback) {
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
      url: happnUrl
    },
    config: {}
  });

  property(this, 'startedAt', Date.now());
  property(this, 'membership', this.happn.services.membership);
  property(this, '__removeMemberHandler', this.__onRemoveMember.bind(this));
  property(this, '__addMemberHandler', this.__onAddMember.bind(this));

  this.membership.on('remove', this.__removeMemberHandler);
  this.membership.on('add', this.__addMemberHandler);

  Happn.client.create({
    config: {
      // username: '_ADMIN',
      // password: 'xxx'
    },
    plugin: Happn.client_plugins.intra_process,
    context: this.happn
  }, function(error, client) {
    if (error) return callback(error);

    _this.members.__self = new Member({
      orchestrator: _this,
      localClient: client
    });

    callback();
  });

});

Orchestrator.prototype.stabilized = Promise.promisify(function(callback) {
  this.log.info('stabilized in %dms', Date.now() - this.startedAt);

  // var _this = this;
  // setTimeout(function() {
  //   console.log(_this.members.__self);
  // }, 1000);

  callback();
});


Orchestrator.prototype.__onAddMember = function(info) {
  var member = this.members[info.memberId];
  if (member) return member.resume(info);
  member = this.members[info.memberId] = new Member({
    member: info,
    orchestrator: this
  });

  member.on('error', function(error) {
    console.log('ERROR', error);
  });
};

Orchestrator.prototype.__onRemoveMember = function(info) {
  var member = this.members[info.memberId];
  if (member) return member.depart(info);
};

Orchestrator.prototype.__defaults = function(callback) {
  this.config.replicate = this.config.replicate || ['/*'];
  callback();
};