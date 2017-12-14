/**
 * Created by grant on 2016/09/27.
 */

var path = require('path');
var filename = path.basename(__filename);
var hooks = require('../lib/hooks');
var testUtils = require('../lib/test-utils');

var testSequence = parseInt(filename.split('-')[0]);
var clusterSize = 3;
var happnSecure = false;

var async = require('async');

describe(filename, function () {

  this.timeout(20000);

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  hooks.startCluster({
    testSequence: testSequence,
    size: clusterSize,
    happnSecure: happnSecure
  });

  it('can create a happn client and send a get request via each proxy instance', function (done) {

    var self = this;
    var currentConfig = 0;

    async.eachSeries(self.__configs, function(config, configCB){

      var port = config.services.proxy.config.port;
      var host = config.services.proxy.config.host;

      // create happn client instance and log in
      testUtils.createClientInstance(host, port, function (err, instance) {

        if (err) return configCB(err);

        // send get request for wildcard resources in root
        instance.get('/*', null, function (e) {

          if (e) return configCB(e);

          currentConfig++;
          instance.disconnect(configCB);

        });
      });

    }, done);
  });

  hooks.stopCluster();

  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
  });

});
