module.exports = Member;

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Happn = require('happn');
var clone = require('clone');

var property = require('./property');

function Member(member, orchestrator) {
  var _this = this;
  this.memberId = member.memberId;

  // remote happn.name
  this.name = null;

  // got connection to remote happn
  this.connectedTo = false;

  // got connection from remote happn
  this.connectedFrom = false;

  // orchestrator.stabilized() discovers this error and this
  // whole cluster node fails to start because it could not
  // login to one of the other members
  this.error = null;

  var login = clone(orchestrator.loginConfig);
  login.info.memberId = this.memberId;
  login.config.url = member.happnUrl;

  Happn.client.create(login, function(error, client) {

    if (error) {
      _this.error = error;
      _this.emit('error', error);
      return;
    }

    property(_this, 'client', happnClient);
    _this.name = client.serverInfo.name;

    // TODO: handle error
    // TODO: subscribe to path(s) on remote
    // TODO: subscribe to connection events

    console.log(orchestrator.config);

  });
}

util.inherits(Member, EventEmitter);

Member.prototype.depart = function(info) {
  // console.log('depart', this);
};

Member.prototype.resume = function(info) {
  // console.log('resume', this);
};
