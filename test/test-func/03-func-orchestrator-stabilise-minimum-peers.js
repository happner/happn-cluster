var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var expect = require('expect.js');
var Promise = require('bluebird');

var HappnCluster = require('../..');
var Orchestrator = require('../../lib/services/orchestrator');
var hooks = require('../lib/hooks');
var testUtils = require('../lib/test-utils');

var testSequence = parseInt(filename.split('-')[0]);
var clusterSize = 3;
var happnSecure = false;

describe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  // hooks.startCluster({
  //   size: clusterSize,
  //   happnSecure: happnSecure
  // });

  before('backup functions being mocked', function () {
    this.original__stateUpdate = Orchestrator.prototype.__stateUpdate;
  });

  after('restore functions being mocked', function () {
    Orchestrator.prototype.__stateUpdate = this.original__stateUpdate;
  });


  it('pends the stabilise callback till after minimumPeers are fully connected', function (done) {
    var self = this;
    var configs;
    var lastConfig;
    var interval;

    self.servers = []; // servers for hooks.stopCluster(); to stop

    // because we get no callback before stabilise we need to intercept internally in order
    // to know when to start the last server such that we're actually testing for minimumPeers

    var readyNames = {};
    Orchestrator.prototype.__stateUpdate = function () {

      // call original so that nothing is out of the ordinary,
      // `this` refers to the orchestrator instance for the necessary context
      self.original__stateUpdate.call(this);

      if (Object.keys(this.peers).length == clusterSize - 1) {
        // got all the peers we should have in order to trigger starting the last one
        readyNames[this.happn.name] = 1;
      }
    };

    // set waiting interval to start last peer

    interval = setInterval(function () {
      if (Object.keys(readyNames).length != clusterSize - 1) return;
      clearInterval(interval);

      HappnCluster.create(lastConfig)
        .then(function (server) {
          self.servers.push(server);
        })
        .catch(done);
    }, 10);


    // start the first clusterSize - 1 peers

    Promise.resolve()

      .then(function () {
        return testUtils.createMemberConfigs(testSequence, clusterSize, false, false, {});
      })

      .then(function (_configs) {
        configs = _configs;
        // relying on minimumPeers being configured in createMemberConfigs
        expect(configs[0].services.orchestrator.config.minimumPeers).to.equal(clusterSize);
        lastConfig = configs.pop();
      })

      .then(function () {
        return Promise.resolve(configs).map(function (config, sequence) {
          if (sequence == 0) {
            return HappnCluster.create(config)
              .then(function (server) {
                self.servers.push(server);
              })
              // can't reject the entire set on one failure,
              // because we need to accumulate those that did start
              // for hooks.stopCluster();
              .catch(function (error) {
                console.error('ERROR IN ' + filename, error);
              });
          }
          return Promise.delay(500)
            .then(function () {
              return HappnCluster.create(config);
            })
            .then(function (server) {
              self.servers.push(server);
            })
            .catch(function (error) {
              console.error('ERROR IN ' + filename, error);
            });
        })
      })

      .then(function () {
        return testUtils.awaitExactMembershipCount(self.servers, clusterSize);
      })

      .then(function () {
        return testUtils.awaitExactPeerCount(self.servers, clusterSize);
      })

      .then(done).catch(done)

      .finally(function () {
        clearInterval(interval);
      });

  });


  hooks.stopCluster();

  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
  });

  after(benchmarket.store());
  benchmarket.stop();

});
