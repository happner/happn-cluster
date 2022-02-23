process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

var path = require("path");
var ChildProcess = require("child_process");
var clone = require("clone");
var HappnCluster = require("../../");
var testUtils = require("./test-utils");
const wait = require("await-delay");

module.exports.startCluster = function(clusterOpts) {
  var testSequence = clusterOpts.testSequence || 1;
  var clusterSize = clusterOpts.size || 5;
  var happnSecure =
    typeof clusterOpts.happnSecure === "boolean"
      ? clusterOpts.happnSecure
      : false;
  var proxySecure =
    typeof clusterOpts.proxySecure === "boolean"
      ? clusterOpts.proxySecure
      : false;
  var services = clusterOpts.services || {};

  before("clear collection (before)", function(done) {
    testUtils.clearMongoCollection(done);
  });

  before("start cluster", async function() {
    var self = this;

    self.__configs = await testUtils.createMemberConfigs(
      testSequence,
      clusterSize,
      happnSecure,
      proxySecure,
      services
    );

    let servers = [];
    servers.push(HappnCluster.create(clone(self.__configs[0])));
    await wait(2000);
    // start first peer immediately and other a momentf
    // later so they don't all fight over creating the
    // admin user in the shared database
    for (let [sequence, config] of self.__configs.entries()) {
      if (sequence === 0) {
        continue;
      }
      servers.push(HappnCluster.create(clone(config)));
    }
    self.servers = await Promise.all(servers);
    return self.servers
  });
};

module.exports.stopCluster = function() {
  after("stop cluster", async function() {
    if (!this.servers) return;
    for (let server of this.servers) {
      await server.stop({ reconnect: false });
      // stopping all at once causes replicator client happn logouts to timeout
      // because happn logout attempts unsubscribe on server, and all servers
      // are gone
      await wait(1000); // ...so pause between stops (long for travis)
    }
  });

  after("clear collection (after)", function(done) {
    testUtils.clearMongoCollection(done);
  });
};

module.exports.startMultiProcessCluster = function(clusterOpts) {
  before("multi clear collection (before)", function(done) {
    testUtils.clearMongoCollection(done);
  });

  var testSequence = clusterOpts.testSequence || 1;
  var clusterSize = clusterOpts.size || 5;
  var happnSecure =
    typeof clusterOpts.happnSecure === "boolean"
      ? clusterOpts.happnSecure
      : false;
  var proxySecure =
    typeof clusterOpts.proxySecure === "boolean"
      ? clusterOpts.proxySecure
      : false;
  var services = clusterOpts.services || {};

  var peerPath = __dirname + path.sep + "peer.js";

  before("start cluster", async function() {
    var self = this;

    testUtils.createMemberConfigs(
      testSequence,
      clusterSize,
      happnSecure,
      proxySecure,
      services,
      function(err, result) {
        if (err) return done(err);

        self.__configs = result;

        Promise.all(
          self.__configs.map(function(config) {
            var configJson = [JSON.stringify(config)];

            return new Promise(function(resolve) {
              var peerProcess = ChildProcess.fork(peerPath, configJson);
              peerProcess.on("message", function(message) {
                if (message === "ready") return resolve(peerProcess);
              });
            });
          })
        )

          .then(function(processes) {
            self.peerProcesses = processes;
            self.servers = "see .peerProcesses[n].send";
          })
          .then(function(e) {
            done(e);
          })
          .catch(function(e) {
            done(e);
          });
      }
    );
  });
};

module.exports.stopMultiProcessCluster = function() {
  after("stop cluster", function(done) {
    if (!this.peerProcesses) return done();
    this.peerProcesses.forEach(function(proc) {
      proc.kill();
    });
    done();
  });

  after("multi clear collection (after)", function(done) {
    testUtils.clearMongoCollection(done);
  });
};
