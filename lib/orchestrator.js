module.exports = Orchestrator;

var Promise = require('bluebird');

var Member = require('./member');
var property = require('./property');

function Orchestrator(opts) {
  property(this, 'log', opts.logger.createLogger('Orchestrator'));
}

Orchestrator.prototype.initialize = function(config, callback) {
  property(this, 'happn', this.happn);
  property(this, 'config', config);
  this.members = {};
  this.__defaults(callback);
};

Orchestrator.prototype.stop = function(options, callback) {
  if (typeof options == 'function') callback = options;
  if (this.membership) {
    this.membership.removeListener('remove', this.__removeMemberHandler);
    this.membership.removeListener('add', this.__addMemberHandler);
  }

  this.log.warn('todo: stop');
  callback();
};

Orchestrator.prototype.prepare = Promise.promisify(function(callback) {
  if (!this.happn.services.membership) {
    return callback(new Error('missing membership service'));
  }

  property(this, 'loginConfig', {
    // used to login to remote cluster members as a cluster peer
    info: {
      name: this.happn.name, // a.k.a. mesh.name
      clusterName: this.happn.services.membership.config.clusterName
    },
    config: {}
  });

  property(this, 'startedAt', Date.now());
  property(this, 'membership', this.happn.services.membership);
  property(this, '__removeMemberHandler', this.__onRemoveMember.bind(this));
  property(this, '__addMemberHandler', this.__onAddMember.bind(this));

  this.membership.on('remove', this.__removeMemberHandler);
  this.membership.on('add', this.__addMemberHandler);



  callback();
});

Orchestrator.prototype.stabilized = Promise.promisify(function(callback) {
  this.log.info('stabilized in %dms', Date.now() - this.startedAt);
  callback();
});


Orchestrator.prototype.__onAddMember = function(info) {
  var member = this.members[info.memberId];
  if (member) return member.resume(info);
  member = this.members[info.memberId] = new Member(info, this);

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
