module.exports = MockSwim;

var Swim = require("happn-swim");
var util = require("util");
var EventEmitter = require("events").EventEmitter;

function MockSwim(config) {
  this.__config = config;
}

util.inherits(MockSwim, EventEmitter);

MockSwim.prototype.bootstrap = function(hostsToJoin, callback) {
  if (MockSwim.__queuedError) {
    callback(MockSwim.__queuedError);
    delete MockSwim.__queuedError;
    return;
  }
  callback();
};

MockSwim.prototype.members = function() {
  return MockSwim.__discoveredMembers;
};

MockSwim.__discoveredMembers = [];

MockSwim.__queuedError = undefined;

MockSwim.__queueError = function(error) {
  MockSwim.__queuedError = error;
};

MockSwim.prototype.__emitUpdate = function(member) {
  this.emit(Swim.EventType.Update, member);
};
