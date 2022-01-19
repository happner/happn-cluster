const EventEmitter = require("events").EventEmitter;
const Replicator = require("../../lib/services/replicator");
const MockHappn = require("../mocks/mock-happn");
const mockOpts = require("../mocks/mock-opts");
const SD_EVENTS = require("happn-3").constants.SECURITY_DIRECTORY_EVENTS;
const test = require("../lib/test-helper").create();

describe(test.testName(), function() {
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
        test.expect(Date.now() - started > 3000).to.be(true);
        test.expect(topic).to.be("/security/dataChanged");
        test.expect(batch).to.eql({
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
        test.expect(replicator.securityChangeset).to.eql([]);
        test.expect(replicator.unbatchSecurityUpdate(batch)).to.eql([
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
          test.expect(replicator.securityChangeset).to.eql([
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
              test.expect(replicator.securityChangeset).to.eql([
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
                  test.expect(replicator.securityChangeset).to.eql([
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
          test.expect(Date.now() - started <= 3000).to.be(true);
          test.expect(topic).to.be("/security/dataChanged");
          test.expect(batch).to.eql({
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
          test.expect(replicator.securityChangeset).to.eql([]);
          test.expect(replicator.unbatchSecurityUpdate(batch)).to.eql([
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
            test.expect(replicator.securityChangeset).to.eql([
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
                test.expect(replicator.securityChangeset).to.eql([
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
                    test.expect(replicator.securityChangeset).to.eql([
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

  it("can getChangedKey", function() {
    const SD_EVENTS = require("happn-3").constants.SECURITY_DIRECTORY_EVENTS;
    const replicator = new Replicator(mockOpts);
    test
      .expect(
        replicator.getChangedKey(SD_EVENTS.LINK_GROUP, {
          _meta: {
            path: "test/path"
          }
        })
      )
      .to.be("path");

    test
      .expect(
        replicator.getChangedKey(SD_EVENTS.UNLINK_GROUP, {
          path: "test/path"
        })
      )
      .to.be("path");

    test
      .expect(
        replicator.getChangedKey(SD_EVENTS.LOOKUP_TABLE_CHANGED, {
          table: "table"
        })
      )
      .to.be("table");

    test
      .expect(
        replicator.getChangedKey(SD_EVENTS.LOOKUP_PERMISSION_CHANGED, {
          table: "table"
        })
      )
      .to.be("table");

    test
      .expect(
        test.tryNonAsyncMethod(
          replicator,
          "getChangedKey",
          SD_EVENTS.DELETE_USER,
          {
            obj: {
              _meta: {
                path: "/_SYSTEM/_SECURITY/_USER/path"
              }
            }
          }
        )
      )
      .to.be("path");

    test
      .expect(
        test.tryNonAsyncMethod(
          replicator,
          "getChangedKey",
          SD_EVENTS.DELETE_GROUP,
          {
            obj: {
              name: "group-name"
            }
          }
        )
      )
      .to.be("group-name");

    test
      .expect(
        test.tryNonAsyncMethod(
          replicator,
          "getChangedKey",
          SD_EVENTS.UPSERT_GROUP,
          {
            name: "group-name"
          }
        )
      )
      .to.be("group-name");

    test
      .expect(
        test.tryNonAsyncMethod(
          replicator,
          "getChangedKey",
          SD_EVENTS.PERMISSION_REMOVED,
          {
            groupName: "group-name"
          }
        )
      )
      .to.be("group-name");

    test
      .expect(
        test.tryNonAsyncMethod(
          replicator,
          "getChangedKey",
          SD_EVENTS.PERMISSION_UPSERTED,
          {
            groupName: "group-name"
          }
        )
      )
      .to.be("group-name");

    test
      .expect(
        test.tryNonAsyncMethod(
          replicator,
          "getChangedKey",
          SD_EVENTS.UPSERT_USER,
          {
            username: "user-name"
          }
        )
      )
      .to.be("user-name");

    test
      .expect(
        test.tryNonAsyncMethod(replicator, "getChangedKey", "unknown", {})
      )
      .to.be("unknown security data changed event: unknown");
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
      test.expect(emitted).to.eql([
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

  it("tests the unbatchSecurityUpdate method", function(done) {
    const replicator = new Replicator(mockOpts);
    replicator.happn = new MockHappn("http", 9000);
    let payload = {};

    payload[SD_EVENTS.LINK_GROUP] = {
      key1: { changedData: "changed1", additionalInfo: "additional1" }
    };
    payload[SD_EVENTS.UNLINK_GROUP] = {
      key2: { changedData: "changed2", additionalInfo: "additional2" }
    };
    payload[SD_EVENTS.UPSERT_GROUP] = {
      key3: { changedData: "changed3", additionalInfo: "additional3" }
    };
    payload[SD_EVENTS.UPSERT_USER] = {
      key4: { changedData: "changed4", additionalInfo: "additional4" }
    };
    payload[SD_EVENTS.PERMISSION_REMOVED] = {
      key5: { changedData: "changed5", additionalInfo: "additional5" }
    };
    payload[SD_EVENTS.PERMISSION_UPSERTED] = {
      key6: { changedData: "changed6", additionalInfo: "additional6" }
    };
    payload[SD_EVENTS.DELETE_USER] = {
      key7: { changedData: "changed7", additionalInfo: "additional7" }
    };
    payload[SD_EVENTS.DELETE_GROUP] = {
      key8: { changedData: "changed8", additionalInfo: "additional8" }
    };
    payload[SD_EVENTS.LOOKUP_TABLE_CHANGED] = {
      key9: { changedData: "changed9", additionalInfo: "additional9" }
    };
    payload[SD_EVENTS.LOOKUP_PERMISSION_CHANGED] = {
      key10: { changedData: "changed10", additionalInfo: "additional10" }
    };
    test.expect(replicator.unbatchSecurityUpdate(payload)).to.eql([
      {
        whatHappnd: SD_EVENTS.LINK_GROUP,
        changedData: "changed1",
        additionalInfo: "additional1"
      },
      {
        whatHappnd: SD_EVENTS.UNLINK_GROUP,
        changedData: "changed2",
        additionalInfo: "additional2"
      },
      {
        whatHappnd: SD_EVENTS.UPSERT_GROUP,
        changedData: "changed3",
        additionalInfo: "additional3"
      },
      {
        whatHappnd: SD_EVENTS.UPSERT_USER,
        changedData: "changed4",
        additionalInfo: "additional4"
      },
      {
        whatHappnd: SD_EVENTS.PERMISSION_REMOVED,
        changedData: "changed5",
        additionalInfo: "additional5"
      },
      {
        whatHappnd: SD_EVENTS.PERMISSION_UPSERTED,
        changedData: "changed6",
        additionalInfo: "additional6"
      },
      {
        whatHappnd: SD_EVENTS.DELETE_USER,
        changedData: "changed7",
        additionalInfo: "additional7"
      },
      {
        whatHappnd: SD_EVENTS.DELETE_GROUP,
        changedData: "changed8",
        additionalInfo: "additional8"
      },
      {
        whatHappnd: SD_EVENTS.LOOKUP_TABLE_CHANGED,
        changedData: "changed9",
        additionalInfo: "additional9"
      },
      {
        whatHappnd: SD_EVENTS.LOOKUP_PERMISSION_CHANGED,
        changedData: "changed10",
        additionalInfo: "additional10"
      }
    ]);
    done();
  });
});
// SD_EVENTS.LINK_GROUP
// SD_EVENTS.UNLINK_GROUP
// SD_EVENTS.UPSERT_GROUP
//  SD_EVENTS.UPSERT_USER
// SD_EVENTS.PERMISSION_REMOVED
//  SD_EVENTS.PERMISSION_UPSERTED
//  SD_EVENTS.DELETE_USER
//  SD_EVENTS.DELETE_GROUP
// , SD_EVENTS.LOOKUP_TABLE_CHANGED
//  SD_EVENTS.LOOKUP_PERMISSION_CHANGED
