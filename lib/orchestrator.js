module.exports = Orchestrator;

var Promise = require('bluebird');

var property = require('./property');

function Orchestrator(opts) {
  property(this, 'log', opts.logger.createLogger('Orchestrator'));
}

Orchestrator.prototype.initialize = function(config, callback) {
  property(this, 'happn', this.happn);
  this.config = config;
  this.members = {};
  return callback();
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


Orchestrator.prototype.__onAddMember = function(member) {
  // console.log('add member', member);
};

Orchestrator.prototype.__onRemoveMember = function(member) {
  // console.log('remove member', member);
};
