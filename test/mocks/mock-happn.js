/**
 * Created by grant on 2016/09/27.
 */

var path = require('path');

var MockPubsub = require('./mock-pubsub');
var MockMembership = require('./mock-membership');

var MockHappn = function (mode, targetPort) {
  this.__mode = mode;
  this.__targetPort = targetPort;

  this.name = 'local-happn-instance';
  this.services = {
    pubsub: new MockPubsub(),
    proxy: {
      config: {
        host: '0.0.0.0',
        port: 8015
      }
    },
    membership: new MockMembership()
  }
};

Object.defineProperty(MockHappn.prototype, "log", {
  get: function () {
    return {
      error: function (message, err) {
        console.log(message);
        throw(err);
      },
      info: function (message) {
        console.log(message);
      }
    }
  }
});

//Object.defineProperty(MockHappn.prototype, "port", {
//  get: function () {
//    return this.__targetPort
//  }
//});

Object.defineProperty(MockHappn.prototype, "config", {
  get: function () {
    return {
      port: this.__targetPort,
      transport: {
        mode: this.__mode
      }
    }
  }
});

Object.defineProperty(MockHappn.prototype, "server", {
  get: function () {
    return {
      address: function () {
        return {
          address: '0.0.0.0',
          port: 9000
        }
      }
    }
  }
});

module.exports = MockHappn;
