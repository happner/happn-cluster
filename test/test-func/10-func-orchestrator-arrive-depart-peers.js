var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var expect = require('expect.js');

var HappnCluster = require('../..');
var hooks = require('../lib/hooks');
var testUtils = require('../lib/test-utils');

var testSequence = parseInt(filename.split('-')[0]);
var clusterSize = 10;
var happnSecure = false;

describe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  hooks.startCluster({
    testSequence: testSequence,
    size: clusterSize,
    happnSecure: happnSecure
  });

  before('create extra config', function (done) {
    var _this = this;
    testUtils.createMemberConfigs(testSequence, clusterSize + 1, false, false, {}, function (e, configs) {
      if (e) return done(e);
      _this.extraConfig = configs.pop();
      done();
    })
  });

  it('arriving and departing peers become known to all nodes', function (done) {

    var _this = this;

    var emittedAdd = {};
    var emittedRemove = {};

    this.servers.forEach(function (server, i) {

      server.services.orchestrator.on('peer/add', function (name, member) {
        emittedAdd[i] = member;
      });

      server.services.orchestrator.on('peer/remove', function (name, member) {
        emittedRemove[i] = member;
      });

    });

    HappnCluster.create(this.extraConfig)

      .then(function (server) {
        _this.servers.push(server); // add new server at end
      })

      .then(function () {
        return testUtils.awaitExactPeerCount(_this.servers);
      })

      .then(function () {
        var server = _this.servers.pop(); // remove and stop new server
        return server.stop({reconnect: false});
      })

      .then(function () {
        return testUtils.awaitExactPeerCount(_this.servers);
      })

      .then(function () {
        // console.log(emittedAdd);
        expect(Object.keys(emittedAdd).length).to.equal(clusterSize);
        expect(Object.keys(emittedRemove).length).to.equal(clusterSize);
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
