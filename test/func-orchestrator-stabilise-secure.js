var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var expect = require('expect.js');
var hooks = require('./lib/hooks');

var clusterSize = 10;
var isSecure = true;

describe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  hooks.startCluster({
    size: clusterSize,
    isSecure: isSecure
  });


  it('each server stabilised with all 10 peers', function (done) {
    var self = this;

    var peerCounts = [];
    self.servers.forEach(function (server) {
      var count = Object.keys(server.services.orchestrator.peers).length;
      peerCounts.push(count);
    });

    expect(peerCounts).to.eql([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
    done();
  });


  hooks.stopCluster();

  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
  });

  after(benchmarket.store());
  benchmarket.stop();

});
