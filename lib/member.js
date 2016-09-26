module.exports = Member;

var Happn = require('happn');
var clone = require('clone');

var property = require('./property');

function Member(member, loginConfig) {
  var _this = this;
  this.memberId = member.memberId;

  // remote happn.name
  this.name = null;

  // got connection to remote happn
  this.connectedTo = false;

  // got connection from remote happn
  this.connectedFrom = false;

  var login = clone(loginConfig);
  login.info.memberId = this.memberId;
  login.config.url = member.happnUrl;

  Happn.client.create(login, function(error, happnClient) {

    // TODO: handle error
    // TODO: subscribe to path(s) on remote
    // TODO: subscribe to connection events

    _this.name = happnClient.serverInfo.name;
    property(_this, 'happnClient', happnClient);

  });

}

Member.prototype.depart = function(info) {
  // console.log('depart', this);
};

Member.prototype.resume = function(info) {
  // console.log('resume', this);
};
