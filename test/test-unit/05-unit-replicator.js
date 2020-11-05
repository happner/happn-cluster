/**
 * Created by grant on 2016/09/26.
 */
const filename = require("path").basename(__filename);
const EventEmitter = require("events").EventEmitter;
const Replicator = require("../../lib/services/replicator");
const MockHappn = require("../mocks/mock-happn");
const mockOpts = require("../mocks/mock-opts");
const SD_EVENTS = require("happn-3").constants.SECURITY_DIRECTORY_EVENTS;
var expect = require("expect.js");

describe(filename, function() {
  this.timeout(15000);

  it("can initialize the replicator", function(done) {
    const replicator = new Replicator(mockOpts);
    replicator.happn = new MockHappn("http", 9000);
    replicator.happn.services.orchestrator.members = {
      __self: {
        client: {
          on: () => {}
        }
      }
    };
    replicator.initialize({}, () => {
      replicator.start();
      replicator.stop(done);
    });
  });

  it("can call the send function, security update - default interval", function(done) {
    const replicator = new Replicator(mockOpts);
    let started;
    replicator.happn = new MockHappn("http", 9000);
    replicator.happn.services.orchestrator.members = {
      __self: {
        client: {
          on: () => {}
        }
      }
    };
    replicator.initialize({}, () => {
      replicator.start();
      replicator.__replicate = (topic, batch) => {
        expect(Date.now() - started > 3000).to.be(true);
        expect(topic).to.be("/security/dataChanged");
        expect(batch).to.eql({
          "unlink-group": {
            group1: {
              additionalInfo: undefined,
              changedData: {
                path: "/test/group1"
              }
            }
          },
          "link-group": {
            group1: {
              additionalInfo: undefined,
              changedData: {
                _meta: {
                  path: "/test/group1"
                }
              }
            }
          }
        });
        //this should be emptied out
        expect(replicator.securityChangeset).to.eql([]);
        expect(replicator.unbatchSecurityUpdate(batch)).to.eql([
          {
            additionalInfo: undefined,
            whatHappnd: "link-group",
            changedData: {
              _meta: {
                path: "/test/group1"
              }
            }
          },
          {
            additionalInfo: undefined,
            whatHappnd: "unlink-group",
            changedData: {
              path: "/test/group1"
            }
          }
        ]);
        replicator.stop(done);
      };
      started = Date.now();
      replicator.send(
        "/security/dataChanged",
        {
          whatHappnd: SD_EVENTS.UNLINK_GROUP,
          changedData: { path: "/test/group1" }
        },
        () => {
          expect(replicator.securityChangeset).to.eql([
            {
              whatHappnd: "unlink-group",
              changedData: { path: "/test/group1" }
            }
          ]);

          replicator.send(
            "/security/dataChanged",
            {
              whatHappnd: SD_EVENTS.UNLINK_GROUP,
              changedData: { path: "/test/group1" }
            },
            () => {
              expect(replicator.securityChangeset).to.eql([
                {
                  whatHappnd: "unlink-group",
                  changedData: { path: "/test/group1" }
                },
                {
                  whatHappnd: "unlink-group",
                  changedData: { path: "/test/group1" }
                }
              ]);

              replicator.send(
                "/security/dataChanged",
                {
                  whatHappnd: SD_EVENTS.LINK_GROUP,
                  changedData: { _meta: { path: "/test/group1" } }
                },
                () => {
                  expect(replicator.securityChangeset).to.eql([
                    {
                      whatHappnd: "unlink-group",
                      changedData: { path: "/test/group1" }
                    },
                    {
                      whatHappnd: "unlink-group",
                      changedData: { path: "/test/group1" }
                    },
                    {
                      whatHappnd: "link-group",
                      changedData: { _meta: { path: "/test/group1" } }
                    }
                  ]);
                }
              );
            }
          );
        }
      );
    });
  });

  it("can call the send function, security update - faster interval", function(done) {
    const replicator = new Replicator(mockOpts);
    let started;
    replicator.happn = new MockHappn("http", 9000);
    replicator.happn.services.orchestrator.members = {
      __self: {
        client: {
          on: () => {}
        }
      }
    };
    replicator.initialize(
      {
        securityChangesetReplicateInterval: 1000
      },
      () => {
        replicator.start();
        replicator.__replicate = (topic, batch) => {
          expect(Date.now() - started <= 3000).to.be(true);
          expect(topic).to.be("/security/dataChanged");
          expect(batch).to.eql({
            "unlink-group": {
              group1: {
                additionalInfo: undefined,
                changedData: {
                  path: "/test/group1"
                }
              }
            },
            "link-group": {
              group1: {
                additionalInfo: undefined,
                changedData: {
                  _meta: {
                    path: "/test/group1"
                  }
                }
              }
            }
          });
          //this should be emptied out
          expect(replicator.securityChangeset).to.eql([]);
          expect(replicator.unbatchSecurityUpdate(batch)).to.eql([
            {
              additionalInfo: undefined,
              whatHappnd: "link-group",
              changedData: {
                _meta: {
                  path: "/test/group1"
                }
              }
            },
            {
              additionalInfo: undefined,
              whatHappnd: "unlink-group",
              changedData: {
                path: "/test/group1"
              }
            }
          ]);
          replicator.stop(done);
        };
        started = Date.now();
        replicator.send(
          "/security/dataChanged",
          {
            whatHappnd: SD_EVENTS.UNLINK_GROUP,
            changedData: { path: "/test/group1" }
          },
          () => {
            expect(replicator.securityChangeset).to.eql([
              {
                whatHappnd: "unlink-group",
                changedData: { path: "/test/group1" }
              }
            ]);

            replicator.send(
              "/security/dataChanged",
              {
                whatHappnd: SD_EVENTS.UNLINK_GROUP,
                changedData: { path: "/test/group1" }
              },
              () => {
                expect(replicator.securityChangeset).to.eql([
                  {
                    whatHappnd: "unlink-group",
                    changedData: { path: "/test/group1" }
                  },
                  {
                    whatHappnd: "unlink-group",
                    changedData: { path: "/test/group1" }
                  }
                ]);

                replicator.send(
                  "/security/dataChanged",
                  {
                    whatHappnd: SD_EVENTS.LINK_GROUP,
                    changedData: { _meta: { path: "/test/group1" } }
                  },
                  () => {
                    expect(replicator.securityChangeset).to.eql([
                      {
                        whatHappnd: "unlink-group",
                        changedData: { path: "/test/group1" }
                      },
                      {
                        whatHappnd: "unlink-group",
                        changedData: { path: "/test/group1" }
                      },
                      {
                        whatHappnd: "link-group",
                        changedData: { _meta: { path: "/test/group1" } }
                      }
                    ]);
                  }
                );
              }
            );
          }
        );
      }
    );
  });

  it("can call the send function, security update - emit", function(done) {
    const replicator = new Replicator(mockOpts);
    const emitted = [];
    replicator.happn = new MockHappn("http", 9000);
    const emitter = new EventEmitter();

    replicator.emit = (topic, payload, isLocal, origin) => {
      emitted.push({ topic, payload, isLocal, origin });
    };

    replicator.happn.services.orchestrator.members = {
      __self: {
        client: {
          set: (topic, payload) => {
            emitter.emit(topic, payload);
          },
          on: (topic, cb) => {
            emitter.on(topic, cb);
          }
        }
      }
    };

    setTimeout(() => {
      expect(emitted).to.eql([
        {
          topic: "/security/dataChanged",
          payload: {
            additionalInfo: undefined,
            whatHappnd: "link-group",
            changedData: {
              _meta: {
                path: "/test/group1"
              }
            }
          },
          isLocal: false,
          origin: "test-origin"
        },
        {
          topic: "/security/dataChanged",
          payload: {
            additionalInfo: undefined,
            whatHappnd: "unlink-group",
            changedData: {
              path: "/test/group1"
            }
          },
          isLocal: false,
          origin: "test-origin"
        }
      ]);
      replicator.stop(done);
    }, 3000);

    replicator.initialize(
      {
        securityChangesetReplicateInterval: 1000
      },
      () => {
        replicator.start();
        replicator.localClient.set("/__REPLICATE", {
          origin: "test-origin",
          topic: "/security/dataChanged",
          payload: {
            "unlink-group": {
              group1: {
                additionalInfo: undefined,
                changedData: {
                  path: "/test/group1"
                }
              }
            },
            "link-group": {
              group1: {
                additionalInfo: undefined,
                changedData: {
                  _meta: {
                    path: "/test/group1"
                  }
                }
              }
            }
          }
        });
      }
    );
  });
});
