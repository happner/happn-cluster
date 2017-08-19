var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var HappnCluster = require('../../');

var hooks = require('../lib/hooks');
var testSequence = parseInt(filename.split('-')[0]);
var clusterSize = 5;
var happnSecure = true;

describe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  hooks.startCluster({
    testSequence: testSequence,
    size: clusterSize,
    happnSecure: happnSecure
  });

  hooks.stopCluster();

  it('can restart a cluster peer', function (done) {
    var _this = this;
    var server = this.servers.pop();
    var config = this.__configs[this.__configs.length -1];
    server.stop()
      .then(function () {
        return HappnCluster.create(config)
      })
      .then(function (server) {
        _this.servers.push(server);
      })
      .then(done).catch(done);
  });

  after(benchmarket.store());
  benchmarket.stop();

});
