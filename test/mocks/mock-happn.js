/**
 * Created by grant on 2016/09/27.
 */

var path = require('path');

var MockHappn = function (mode) {
  this.__mode = 'mode';
};

Object.defineProperty(MockHappn.prototype, "log", {
  get: function () {
    return {
      error: function (message, err) {
        console.log(message);
        throw(err);
      },
      info: function (message, err) {
        console.log(message);
      }
    }
  }
});

Object.defineProperty(MockHappn.prototype, "config", {
  get: function () {
    return {
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
