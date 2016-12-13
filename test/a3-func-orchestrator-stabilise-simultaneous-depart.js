var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var Promise = require('bluebird');

var HappnCluster = require('../');
var hooks = require('./lib/hooks');
var testUtils = require('./lib/test-utils');

var clusterSize = 3;
var happnSecure = false;

describe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  hooks.startCluster({
    size: clusterSize,
    happnSecure: happnSecure,
    services: {
      membership: {
        pingInterval: 2000
      }
    }
  });

  it('starting a new member survives when stopping an existing member simultaneously', function (done) {

    // the starting member receives the membership list which includes the departed member
    // so it attempts to login to the departed member - only discovering later (swim lag)
    // that the departed member is departed.
    //
    // so it gets ECONNREFUSED
    //
    // safe at this point to assume the member is not there (literally no socket listening)
    // so the member is removed from the expectation list of members-that-must-be-connected-to-for-stabilise

    var _this = this;

    Promise.resolve()

      .then(function () {
        return testUtils.createMemberConfigs(clusterSize + 1, happnSecure, false, {
          membership: {
            pingInterval: 2000
          }
        });
      })

      .then(function (configs) {
        return configs.pop();
      })

      .then(function (config) {
        var stopServer = _this.servers.pop();
        setTimeout(function () {
          stopServer.stop().then(function () {
          }).catch(done);
        }, config.services.membership.config.joinTimeout - 20);

        config.services.orchestrator.config.minimumPeers--;
        return HappnCluster.create(config);
      })

      .then(function (newServer) {
        _this.servers.push(newServer);
      })

      .then(function () {
        return testUtils.awaitExactMembershipCount(_this.servers);
      })

      .then(done).catch(done);

  });

  hooks.stopCluster();

  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
  });

  after(benchmarket.store());
  benchmarket.stop();

});
