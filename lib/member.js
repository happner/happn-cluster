module.exports = Member;

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Happn = require('happn');
var clone = require('clone');

var property = require('./property');

function Member(member, orchestrator) {
  var _this = this;

  property(this, 'orchestrator', orchestrator);

  // remote happn.name
  this.name = null;

  // got happn connection to remote happn
  this.connectedTo = false;

  // got happn connection from remote happn
  this.connectedFrom = false;

  // orchestrator.stabilized() discovers this error and this
  // whole cluster node fails to start because it could not
  // login to one of the other members
  //
  // populate it with happn login error or subscribe error
  this.error = null;

  // member present only if SWIM got first notice of new member
  if (member) this.connect(member);

}

util.inherits(Member, EventEmitter);


Member.prototype.connect = function(member) {
  var _this = this;
  var login = clone(this.orchestrator.loginConfig);

  this.memberId = member.memberId;
  login.info.memberId = this.memberId;
  login.config.url = member.happnUrl;

  console.log('login', login);

  Happn.client.create(login, function(error, client) {

    if (error) {
      _this.error = error;
      _this.emit('error', error);
      return;
    }

    property(_this, 'client', client);
    _this.name = client.serverInfo.name;

    // TODO: handle error
    // TODO: subscribe to path(s) on remote
    // TODO: subscribe to connection events

    console.log(_this.orchestrator.config);

  });
};

Member.prototype.depart = function(info) {
  // console.log('depart', this);
};

Member.prototype.resume = function(info) {
  // console.log('resume', this);
};
