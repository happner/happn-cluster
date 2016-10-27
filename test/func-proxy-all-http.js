/**
 * Created by grant on 2016/09/27.
 */

var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var hooks = require('./lib/hooks');
var testUtils = require('./lib/test-utils');

var clusterSize = 3;
var happnSecure = false;

describe(filename, function () {

  this.timeout(20000);

  benchmarket.start();

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  hooks.startCluster({
    size: clusterSize,
    happnSecure: happnSecure
  });

  it('can create a happn client and send a get request via each proxy instance', function (done) {

    var self = this;
    var currentConfig = 0;

    self.__configs.forEach(function (config) {

      var port = config.services.proxy.config.port;
      var host = config.services.proxy.config.host;

      // create happn client instance and log in
      testUtils.createClientInstance(host, port, function (err, instance) {

        if (err) return done(err);

        // send get request for wildcard resources in root
        instance.get('/*', null, function (e, results) {

          if (e) return done(e);

          currentConfig++;
          instance.disconnect();

          if (currentConfig == self.__configs.length)
            // we have iterated through all proxy instances without error
            return done();
        });
      });
    });
  });

  hooks.stopCluster();

  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
  });

  after(benchmarket.store());
  benchmarket.stop();

});
