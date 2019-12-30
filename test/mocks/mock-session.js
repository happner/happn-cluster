module.exports = MockSession;

var EventEmitter = require("events").EventEmitter;
var util = require("util");

function MockSession() {
  MockSession.instance = this;
  this.config = {};
}

util.inherits(MockSession, EventEmitter);

MockSession.prototype.localClient = function(config, callback) {
  var ClientBase = require("./mock-happn-client");
  var LocalPlugin = require("./mock-happn-local-plugin");

  ClientBase.create(
    {
      config: config.config,
      info: config.info,
      plugin: LocalPlugin,
      context: {}
    },
    function(e, instance) {
      if (e) return callback(e);
      callback(null, instance);
    }
  );

  callback(null, {});
};
