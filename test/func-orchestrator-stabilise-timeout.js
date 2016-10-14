var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var Promise = require('bluebird');

var HappnCluster = require('../');
var hooks = require('./lib/hooks');
var testUtils = require('./lib/test-utils');

var clusterSize = 3;
var isSecure = false;

describe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  hooks.startCluster({
    size: clusterSize,
    isSecure: isSecure
  });


  it('stops the server after timeout on failure to stabilise', function (done) {

    var _this = this;

    this.timeout(8000);

    Promise.resolve()

      .then(function () {
        return testUtils.createMemberConfigs(clusterSize + 1, isSecure, {
          orchestrator: {
            minimumPeers: clusterSize + 2,
            stabiliseTimeout: 2000
          }
        });
      })

      .then(function (configs) {
        return configs.pop();
      })

      .then(function (config) {
        return HappnCluster.create(config);
      })

      .then(function (server) {
        _this.servers.push(server); // for hooks.stopCluster()
        done(new Error('should not have started'));
      })

      .catch(function (error) {
        error.name.should.match('StabiliseTimeout');
        done();
      });

  });


  hooks.stopCluster();

  after(benchmarket.store());
  benchmarket.stop();

});
