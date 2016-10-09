var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var should = require('should');
var hooks = require('./lib/hooks');

var clusterSize = 10;
var isSecure = false;

describe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  hooks.startCluster({
    size: clusterSize,
    isSecure: isSecure
  });


  it('each server has all 10 peers', function (done) {
    var self = this;

    var peerCounts = [];
    self.servers.forEach(function (server) {
      var count = Object.keys(server.services.orchestrator.peers).length;
      peerCounts.push(count);
    });

    peerCounts.should.eql([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
    done();
  });


  hooks.stopCluster();

  after(benchmarket.store());
  benchmarket.stop();

});
