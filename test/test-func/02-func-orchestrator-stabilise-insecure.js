var path = require("path");
var filename = path.basename(__filename);
var expect = require("expect.js");
var hooks = require("../lib/hooks");

var testSequence = parseInt(filename.split("-")[0]);
var clusterSize = 10;
var happnSecure = false;
const wait = require("await-delay");
const cloneMember = require("../../lib/utils/cloneMember");
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

  it("each server stabilised with all 10 peers", async function() {
    this.timeout(60000);
    var self = this;
    await wait(15000);
    // let peerCounts = self.servers.map(
    //   server => Object.keys(server.services.orchestrator.peers).length
    // );
    console.log(self.servers.map(server => server.services.orchestrator.state));
    expect(
      self.servers.every(
        server => server.services.orchestrator.state === "stable"
      )
    ).to.be(true);
    // expect(peerCounts).to.eql([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
    // done();
  });

  hooks.stopCluster();

  after(function() {
    process.env.LOG_LEVEL = this.logLevel;
  });
});
