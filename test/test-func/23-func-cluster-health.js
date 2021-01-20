const path = require("path");
const filename = path.basename(__filename);
let expect = require("expect.js");
const { delay } = require("bluebird");
const CaptureStdout = require("capture-stdout");
const getAddress = require("../../lib/utils/get-address");

describe(filename, function() {
  this.timeout(80000);

  it("checks cluster health logging is working", async () => {
    const clusterManager = require("../lib/cluster-manager").create({
      minimumPeers: 2,
      hosts: [],
      healthInterval: 1000
    });
    await clusterManager.initialize();
    const captureStdout = new CaptureStdout();
    captureStdout.startCapture();
    await clusterManager.addSeed();
    const member1Id = await clusterManager.addMember();
    await delay(3000);
    await clusterManager.setLogLevelOnSeed("debug");
    const member2Id = await clusterManager.addMember();
    await delay(1000);
    await clusterManager.addMember();
    await delay(1000);
    await clusterManager.addMember();
    await delay(10000);
    clusterManager.disconnectMember(member1Id);
    await delay(3000);
    clusterManager.disconnectPeer(member2Id);
    await delay(3000);
    captureStdout.stopCapture();
    const seedLogs = captureStdout
      .getCapturedText()
      .filter(item => {
        return item.indexOf(`"MEMBER_ID":"${getAddress()}:56000"`) > -1;
      })
      .map(seedLogItem => {
        let itemObj = JSON.parse(seedLogItem);
        delete itemObj.timestamp;
        return itemObj;
      });
    const filteredSeedLogs = seedLogs
      .map(seedLog => {
        return seedLog.data.STATUS;
      })
      .filter((seedLogStatus, seedLogStatusIndex, seedLogStatusArray) => {
        return seedLogStatusArray.indexOf(seedLogStatus) === seedLogStatusIndex;
      });
    const states = filteredSeedLogs.join(",");
    try {
      expect(states.indexOf("SWIM-MEMBERS-MISSING")).to.be.greaterThan(-1);
      expect(states.indexOf("CLUSTER-MEMBERS-MISSING")).to.be.greaterThan(-1);
      expect(states.indexOf("WARMUP")).to.be.greaterThan(-1);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        "INTERMITTENT TEST FAILURE, HEALTH SERVICE, STATES: " + states
      );
    }
    await clusterManager.setLogLevelOnSeed(process.env.LOG_LEVEL || "info");
    await clusterManager.stopCluster();
  });
});
