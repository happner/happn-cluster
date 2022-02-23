var path = require("path");
var filename = path.basename(__filename);
var expect = require("expect.js");
// var Promise = require("bluebird");
var Happn = require("happn-3");
var testUtils = require("../lib/test-utils");
var hooks = require("../lib/hooks");
const nodeUtils = require("util");
var testSequence = parseInt(filename.split("-")[0]);
var clusterSize = 3;
var happnSecure = false;

describe(filename, function() {
  this.timeout(30000);
  const self = this;
  before(function() {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "off";
  });

  hooks.startCluster({
    testSequence: testSequence,
    size: clusterSize,
    happnSecure: happnSecure
  });

  before("connect a client to each server", async function() {
    await testUtils.awaitExactMembershipCount(this.servers, clusterSize);
    console.log("CREATING CLIENTS");
    let clients = await Promise.all(
      this.__configs.map(function(config) {
        var loginConfig = {
          config: {
            // secure: happnSecure,
            host: config.services.proxy.config.host,
            port: config.services.proxy.config.port,
            protocol: "http"
            // username: config.services.security.config.adminUser.username,
            // password: config.services.security.config.adminUser.password
          }
        };

        return Happn.client.create(loginConfig);
      })
    );
    clients.forEach(function(client) {
      client.onAsync = nodeUtils.promisify(client.on);
    });
    this.clients = clients;
  });

  after("disconnect all clients", async function() {
    if (!this.clients) return;
    await Promise.all(
      this.clients.map(function(client) {
        return client.disconnect();
      })
    );
  });

  context("on set events", function() {
    it("replicates with wildcards", async function() {
      this.timeout(30000);
      // first client is the "control", it does the emits so its events appear the
      // way all other client's events should appear: If properly replicated!

      var _this = this;
      var unpause;
      var controlEvent,
        replicatedEvents = [];

      for (let [i, client] of Object.entries(this.clients)) {
        await client.onAsync("/some/*/*/set", (data, meta) => {
          delete meta.sessionId; // not the same across events
          if (parseInt(i) === 0) {
            controlEvent = {
              data: data,
              meta: meta
            };
          } else {
            replicatedEvents.push({
              data: data,
              meta: meta
            });
          }
          if (controlEvent && replicatedEvents.length === clusterSize - 1) {
            setTimeout(function() {
              unpause();
            }, 100);
          }
        });
      }

      await _this.clients[0].set("/some/path/to/set", { some: "data" });
      await new Promise(function(resolve) {
        unpause = resolve;
      });

      for (let event of replicatedEvents) {
        expect(event).to.eql(controlEvent);
      }
    });

    it("replicates without wildcards", async function() {
      var unpause;
      var controlEvent,
        replicatedEvents = [];

      for (let [i, client] of Object.entries(this.clients)) {
        await client.onAsync("/some/path/to/set/on", function(data, meta) {
          delete meta.sessionId;
          if (parseInt(i) === 0) {
            controlEvent = {
              data: data,
              meta: meta
            };
          } else {
            replicatedEvents.push({
              data: data,
              meta: meta
            });
          }
          if (controlEvent && replicatedEvents.length === clusterSize - 1) {
            setTimeout(function() {
              unpause();
            }, 400);
          }
        });
      }

      await this.clients[0].set("/some/path/to/set/on", { some: "data" });

      await new Promise(function(resolve) {
        unpause = resolve;
      });

      expect(replicatedEvents.length).to.be(2);

      for (let event of replicatedEvents) {
        expect(event).to.eql(controlEvent);
      }
    });
  });

  context("on remove events", function() {
    it("replicates", async function() {
      var unpause;
      var controlEvent,
        replicatedEvents = [];
      await this.clients[0].set("/some/path/to/remove/on", {
        some: "data"
      });

      await Promise.all(
        this.clients.map(function(client, i) {
          return client.onAsync("/some/path/to/remove/*", function(data, meta) {
            delete meta.sessionId;
            if (i === 0) {
              controlEvent = {
                data: data,
                meta: meta
              };
            } else {
              replicatedEvents.push({
                data: data,
                meta: meta
              });
            }
            if (controlEvent && replicatedEvents.length === clusterSize - 1) {
              setTimeout(function() {
                unpause();
              }, 100);
            }
          });
        })
      );

      await this.clients[0].remove("/some/path/to/remove/on");

      await new Promise(function(resolve) {
        unpause = resolve;
      });
      for (let event of replicatedEvents) {
        expect(event).to.eql(controlEvent);
      }
    });
  });

  context("on tag events", function() {
    it("replicates", async function() {
      var unpause;
      var controlEvent,
        replicatedEvents = [];

      await this.clients[0].set("/some/path/to/tag/on", { some: "data" });

      await Promise.all(
        this.clients.map(function(client, i) {
          return client.onAsync("*", function(data, meta) {
            delete meta.sessionId;
            delete meta.action; // <---------------------------------- can't replicate .action in tag operations

            /*

               should look like this
               ---------------------

               data = { // raw data, including stored meta being "tagged"
               data: { some: 'data' },
               _meta: {
               created: 1476388008625,
               modified: 1476388008625,
               path: '/some/path/to/tag/on',
               _id: '/some/path/to/tag/on'
               }
               }
               meta = {
               path: '/_TAGS/some/path/to/tag/on/62c70bc4927e48ba893daca24e716d02',
               tag: 'TAGNAME',
               type: 'data',
               action: '/SET@/some/path/to/tag/on',
               channel: '/ALL@/*'
               }

               after replication it looks like this
               ------------------------------------

               data = {
               data: { some: 'data' },
               _meta: {
               created: 1476388375945,
               modified: 1476388375945,
               path: '/some/path/to/tag/on',
               _id: '/some/path/to/tag/on'
               }
               }

               meta = {
               path: '/_TAGS/some/path/to/tag/on/62c70bc4927e48ba893daca24e716d02',
               tag: 'TAGNAME',
               action: '/SET@/_TAGS/some/path/to/tag/on/62c70bc4927e48ba893daca24e716d02', <--- different
               channel: '/ALL@/*',
               type: 'data'
               }

               */

            if (i === 0) {
              controlEvent = {
                data: data,
                meta: meta
              };
            } else {
              replicatedEvents.push({
                data: data,
                meta: meta
              });
            }
            if (controlEvent && replicatedEvents.length === clusterSize - 1) {
              setTimeout(function() {
                unpause();
              }, 100);
            }
          });
        })
      );

      await this.clients[0].set("/some/path/to/tag/on", null, {
        tag: "TAGNAME"
      });

      await new Promise(function(resolve) {
        unpause = resolve;
      });

      for (let event of replicatedEvents) {
        expect(event).to.eql(controlEvent);
      }
    });
  });

  context("on merge events", function() {
    it("replicates", async function() {
      var unpause;
      var controlEvent,
        replicatedEvents = [];

      await this.clients[0].set("/some/path/to/merge/on", {
        some: "data"
      });
      await Promise.all(
        this.clients.map(function(client, i) {
          return client.onAsync("/some/path/to/merge/on", function(data, meta) {
            delete meta.sessionId;
            if (i === 0) {
              controlEvent = {
                data: data,
                meta: meta
              };
            } else {
              replicatedEvents.push({
                data: data,
                meta: meta
              });
            }
            if (controlEvent && replicatedEvents.length === clusterSize - 1) {
              setTimeout(function() {
                unpause();
              }, 100);
            }
          });
        })
      );

      await this.clients[0].set(
        "/some/path/to/merge/on",
        { more: "data" },
        { merge: true }
      );

      await new Promise(function(resolve) {
        unpause = resolve;
      });

      for (let event of replicatedEvents) {
        expect(event).to.eql(controlEvent);
      }
    });
  });

  hooks.stopCluster();

  after(function() {
    process.env.LOG_LEVEL = this.logLevel;
  });
});
