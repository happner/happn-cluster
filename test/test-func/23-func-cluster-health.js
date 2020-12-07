const path = require("path");
const filename = path.basename(__filename);
let expect = require("expect.js");
const { delay } = require("bluebird");
const CaptureStdout = require("capture-stdout");

describe(filename, function() {
  this.timeout(40000);

  it("checks cluster health logging is working", async () => {
    const clusterManager = require("../lib/cluster-manager").create({
      minimumPeers: 5,
      hosts: [],
      healthInterval: 500
    });
    // await clusterManager.initialize();
    // const captureStdout = new CaptureStdout();
    // captureStdout.startCapture();
    await clusterManager.addSeed();
    await delay(2000);
    const member1Id = await clusterManager.addMember();
    await delay(2000);
    const member2Id = await clusterManager.addMember();
    await delay(2000);
    await clusterManager.addMember();
    await delay(2000);
    await clusterManager.addMember();
    await delay(2000);
    await clusterManager.disconnectSWIM(member1Id);
    await delay(1000);
    await clusterManager.disconnectMember(member2Id);
    await delay(1000);
    await clusterManager.addMember();
    await delay(1000);
    await clusterManager.stopCluster();
    // const arrJson = captureStdout.getCapturedText();
    // console.log(arrJson);
  });
});
