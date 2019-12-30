var path = require("path");
var filename = path.basename(__filename);
var expect = require("expect.js");
var Promise = require("bluebird");
var Happn = require("happn-3");

var hooks = require("../lib/hooks");

var testSequence = parseInt(filename.split("-")[0]);
var clusterSize = 3;
var happnSecure = true;

describe(filename, function() {
  this.timeout(30000);

  before(function() {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "off";
  });

  hooks.startCluster({
    testSequence: testSequence,
    size: clusterSize,
    happnSecure: happnSecure,
    services: {
      orchestrator: {
        replicate: ["/*/*/this", "/and/that"] // <---------------
      }
    }
  });

  before("connect a client to each server", function(done) {
    var _this = this;
    Promise.resolve(this.__configs)
      .map(function(config) {
        var loginConfig = {
          config: {
            secure: happnSecure,
            host: config.services.proxy.config.host,
            port: config.services.proxy.config.port,
            protocol: "http",
            username: config.services.security.config.adminUser.username,
            password: config.services.security.config.adminUser.password
          }
        };

        return Happn.client.create(loginConfig);
      })
      .then(function(clients) {
        clients.forEach(function(client) {
          client.onAsync = Promise.promisify(client.on);
        });
        _this.clients = clients;
        done();
      })
      .catch(done);
  });

  after("disconnect all clients", function(done) {
    if (!this.clients) return done();

    var async = require("async");

    async.eachSeries(
      this.clients,
      function(client, clientCB) {
        return client.disconnect(clientCB);
      },
      done
    );
  });

  it("replicates specified paths", function(done) {
    var _this = this;
    var unpause1, unpause2;
    var controlEvent1,
      replicatedEvents1 = [];
    var controlEvent2,
      replicatedEvents2 = [];

    Promise.resolve()

      .then(function() {
        return Promise.resolve(_this.clients).map(function(client, i) {
          return client.onAsync("/something/like/this", function(data, meta) {
            delete meta.sessionId; // not the same across events
            if (i === 0) {
              controlEvent1 = {
                data: data,
                meta: meta
              };
            } else {
              replicatedEvents1.push({
                data: data,
                meta: meta
              });
            }
            if (controlEvent1 && replicatedEvents1.length === clusterSize - 1) {
              setTimeout(function() {
                unpause1();
              }, 100);
            }
          });
        });
      })

      .then(function() {
        return Promise.resolve(_this.clients).map(function(client, i) {
          return client.onAsync("/*/that", function(data, meta) {
            delete meta.sessionId; // not the same across events
            if (i === 0) {
              controlEvent2 = {
                data: data,
                meta: meta
              };
            } else {
              replicatedEvents2.push({
                data: data,
                meta: meta
              });
            }
            if (controlEvent2 && replicatedEvents2.length === clusterSize - 1) {
              setTimeout(function() {
                unpause2();
              }, 200);
            }
          });
        });
      })

      .then(function() {
        return _this.clients[0].set("/something/like/this", { some1: "data1" });
      })

      .then(function() {
        return new Promise(function(resolve) {
          unpause1 = resolve;
        });
      })

      .then(function() {
        return _this.clients[0].set("/and/that", { some2: "data2" });
      })

      .then(function() {
        return new Promise(function(resolve) {
          unpause2 = resolve;
        });
      })

      .then(function() {
        for (var i = 0; i < replicatedEvents1.length; i++) {
          expect(replicatedEvents1[i]).to.eql(controlEvent1);
        }
      })

      .then(function() {
        for (var i = 0; i < replicatedEvents2.length; i++) {
          expect(replicatedEvents2[i]).to.eql(controlEvent2);
        }
      })

      .then(function() {
        done();
      })
      .catch(done);
  });

  it("does not replicate unspecified paths", function(done) {
    var _this = this;
    var receivedCount = 0;

    Promise.resolve()

      .then(function() {
        return Promise.resolve(_this.clients).map(function(client) {
          return client.onAsync("/unreplicated/path", function() {
            receivedCount++;
          });
        });
      })

      .then(function() {
        return _this.clients[0].set("/unreplicated/path", { some: "data" });
      })

      .then(function() {
        return Promise.delay(404);
      })

      .then(function() {
        // only client logged into original emitting host receives event
        expect(receivedCount).to.eql(1);
      })

      .then(function() {
        done();
      })
      .catch(done);
  });

  hooks.stopCluster();

  after(function() {
    process.env.LOG_LEVEL = this.logLevel;
  });
});
