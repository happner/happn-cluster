var path = require("path");
var filename = path.basename(__filename);
var expect = require("expect.js");
// var Promise = require("bluebird");

var HappnCluster = require("../..");
var hooks = require("../lib/hooks");
var testUtils = require("../lib/test-utils");

var testSequence = parseInt(filename.split("-")[0]);
var clusterSize = 3;
var happnSecure = false;

describe(filename, function() {
  this.timeout(30000);

  before(function() {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "off";
  });

  hooks.startCluster({
    testSequence: testSequence,
    size: clusterSize,
    happnSecure: happnSecure
  });

  it("stops the server after timeout on failure to stabilise", async function() {
    this.timeout(25000);
    try {
      await testUtils.awaitExactPeerCount(this.servers, clusterSize);
      let configs = await testUtils.createMemberConfigs(
        testSequence,
        clusterSize + 1,
        happnSecure,
        false,
        {
          orchestrator: {
            minimumPeers: clusterSize + 2,
            stabiliseTimeout: 2000
          }
        }
      );

      let config = configs.pop();

      let server = await HappnCluster.create(config);
      setImmediate(() => {
        this.servers.push(server); // for hooks.stopCluster()
        throw new Error("should not have started");
      });
    } catch (error) {
      expect(error.name).to.match(/StabiliseTimeout/);
    }
  });

  hooks.stopCluster();

  after(function() {
    process.env.LOG_LEVEL = this.logLevel;
  });
});
