module.exports = MockTransport;

var EventEmitter = require("events").EventEmitter;
var util = require("util");

function MockTransport() {
  MockTransport.instance = this;
  this.config = {
    mode: "http"
  };
}

util.inherits(MockTransport, EventEmitter);
