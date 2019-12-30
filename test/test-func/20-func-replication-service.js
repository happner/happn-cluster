var path = require("path");
var filename = path.basename(__filename);
var expect = require("expect.js");
var Promise = require("bluebird");

var hooks = require("../lib/hooks");
var testSequence = parseInt(filename.split("-")[0]);
var clusterSize = 5;
var happnSecure = false;

describe(filename, function() {
  this.timeout(60000);

  hooks.startCluster({
    testSequence: testSequence,
    size: clusterSize,
    happnSecure: happnSecure
  });

  hooks.stopCluster();

  it("includes isLocal and origin in replication events", function(done) {
    var server1 = this.servers[0];
    var server2 = this.servers[1];

    var received1;
    server1.services.replicator.on("topic/name", function(
      payload,
      isLocal,
      origin
    ) {
      received1 = {
        payload: payload,
        isLocal: isLocal,
        origin: origin
      };
    });

    var received2;
    server2.services.replicator.on("topic/name", function(
      payload,
      isLocal,
      origin
    ) {
      received2 = {
        payload: payload,
        isLocal: isLocal,
        origin: origin
      };
    });

    server1.services.replicator.send("topic/name", "PAYLOAD", function(err) {
      if (err) return done(err);
    });

    setTimeout(function() {
      expect(received1).to.eql({
        payload: "PAYLOAD",
        isLocal: true,
        origin: server1.name
      });

      expect(received2).to.eql({
        payload: "PAYLOAD",
        isLocal: false,
        origin: server1.name
      });

      done();
    }, 700);
  });

  it("can replicate an event throughout the cluster from any to all", function(done) {
    this.timeout(3000);

    var servers = this.servers;

    function testReplicate(server, eventName) {
      return new Promise(function(resolve, reject) {
        var replicatedEvents = {};

        function generateHandler(receivingServer) {
          return function handler(payload, isLocal, origin) {
            replicatedEvents[receivingServer.name] = {
              payload: payload,
              isLocal: isLocal,
              origin: origin
            };
          };
        }

        for (var i = 0; i < servers.length; i++) {
          var receivingServer = servers[i];
          receivingServer.services.replicator.on(
            eventName,
            generateHandler(receivingServer)
          );
        }

        server.services.replicator.send(eventName, "PAYLOAD", function(e) {
          if (e) return reject(e);
        });

        setTimeout(function() {
          var expectedEvents = {};

          for (var i = 0; i < servers.length; i++) {
            expectedEvents[servers[i].name] = {
              payload: "PAYLOAD",
              isLocal: servers[i].name === server.name,
              origin: server.name
            };
          }

          try {
            expect(replicatedEvents).to.eql(expectedEvents);
            resolve();
          } catch (e) {
            reject(e);
          }
        }, 700);
      });
    }

    Promise.resolve(this.servers)
      .map(function(server, i) {
        return testReplicate(server, "event " + i);
      })

      .then(function() {
        done();
      })

      .catch(done);
  });
});
