/**
 * Created by grant on 2016/09/27.
 */

var MockPubsub = require("./mock-pubsub");
var MockTransport = require("./mock-transport");
var MockSession = require("./mock-session");
var MockMembership = require("./mock-membership");
const mockOpts = require("../mocks/mock-opts");
var MockOrchestrator = require("./mock-orchestrator");

var MockHappn = function(mode, targetPort, mockDataService) {
  this.__mode = mode;
  this.__targetPort = targetPort;

  this.name = "local-happn-instance";

  this.services = {
    pubsub: new MockPubsub(),
    transport: new MockTransport(),
    session: new MockSession(),
    orchestrator: new MockOrchestrator(mockOpts),
    data: mockDataService,
    proxy: {
      config: {
        host: "0.0.0.0",
        port: 8015
      }
    },
    membership: new MockMembership()
  };
};

Object.defineProperty(MockHappn.prototype, "log", {
  get: function() {
    return {
      error: function(err) {
        throw err;
      },
      info: function() {}
    };
  }
});

//Object.defineProperty(MockHappn.prototype, "port", {
//  get: function () {
//    return this.__targetPort
//  }
//});

Object.defineProperty(MockHappn.prototype, "config", {
  get: function() {
    return {
      port: this.__targetPort,
      transport: {
        mode: this.__mode
      }
    };
  }
});

Object.defineProperty(MockHappn.prototype, "server", {
  get: function() {
    return {
      address: function() {
        return {
          address: "0.0.0.0",
          port: 9000
        };
      }
    };
  }
});

module.exports = MockHappn;
