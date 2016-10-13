var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var should = require('should');
var hooks = require('./lib/hooks');

var clusterSize = 3;
var isSecure = true;

xdescribe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  hooks.startCluster({
    size: clusterSize,
    isSecure: isSecure
  });


  it('replicates specific events');

  it('does not replicate other events');

  hooks.stopCluster();

  after(benchmarket.store());
  benchmarket.stop();

});
