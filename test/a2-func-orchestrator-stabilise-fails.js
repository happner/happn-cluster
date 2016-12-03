var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var Promise = require('bluebird');
var expect = require('expect.js');

var HappnCluster = require('../');
var Member = require('../lib/services/orchestrator/member');
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
    happnSecure: happnSecure
  });

  before('create extra config', function (done) {
    var _this = this;
    testUtils.createMemberConfigs(clusterSize + 1, false, false, {}, function (e, configs) {
      if (e) return done(e);
      _this.extraConfig = configs.pop();
      done();
    })
  });

  before('backup functions being stubbed', function () {
    this.originalSubscribe = Member.prototype.__subscribe;
  });

  after('restore functions being stubbed', function () {
    Member.prototype.__subscribe = this.originalSubscribe;
  });


  it('stops the server on failure to stabilise', function (done) {

    Member.prototype.__subscribe = function (path) {
      return new Promise(function (resolve, reject) {
        reject(new Error('Fake failure to subscribe'));
      });
    };

    HappnCluster.create(this.extraConfig)

      .then(function (server) {
        return server.stop();
      })

      .then(function () {
        throw new Error('should not have started');
      })

      .catch(function (error) {
        expect(error.message).to.equal('Fake failure to subscribe');
        done();
      })

      .catch(done);

  });


  hooks.stopCluster();

  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
  });

  after(benchmarket.store());
  benchmarket.stop();

});
