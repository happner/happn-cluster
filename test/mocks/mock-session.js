module.exports = MockSession;

var EventEmitter = require('events').EventEmitter;
var util = require('util');

function MockSession() {
  MockSession.instance = this;
  this.config = {};
}

util.inherits(MockSession, EventEmitter);

MockSession.prototype.localClient = function(config, callback){
  callback(null, {});
};
