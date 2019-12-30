module.exports = MockMembership;

var EventEmitter = require("events").EventEmitter;
var util = require("util");

function MockMembership() {
  this.memberId = "MEMBER_ID";
  this.config = {
    clusterName: "cluster-name"
  };
  MockMembership.instance = this;
}

util.inherits(MockMembership, EventEmitter);
