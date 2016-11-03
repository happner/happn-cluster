module.exports = MockPubsub;

var EventEmitter = require('events').EventEmitter;
var util = require('util');

function MockPubsub() {
  MockPubsub.instance = this;
}

util.inherits(MockPubsub, EventEmitter);
