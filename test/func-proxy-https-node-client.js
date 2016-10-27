/**
 * Created by grant on 2016/09/29.
 */

var path = require('path');
var filename = path.basename(__filename);
var hooks = require('./lib/hooks');
var testUtils = require('./lib/test-utils');

var clusterSize = 3;
var isSecure = true;

describe(filename, function () {

  this.timeout(20000);

  hooks.startCluster({
    size: clusterSize,
    isSecure: isSecure
  });


  it('can create a happn client and send a get request via each proxy instance', function (done) {

    var self = this;
    var currentConfig = 0;

    setTimeout(function () {

      self.__configs.forEach(function (config) {

        var port = config.services.proxy.config.port;
        var host = config.services.proxy.config.host;

        // create happn client instance and log in
        testUtils.createClientInstance(host, port, function (err, instance) {

          if (err)
            return done(err);

          console.log('### Sending request to -> ' + host + ':' + port);

          // send get request for wildcard resources in root
          instance.get('/*', null, function (e, results) {

            if (e)
              return done(e);

            console.log('### Response received from proxied cluster node: ' + JSON.stringify(results));
            currentConfig++;
            instance.disconnect();

            if (currentConfig == self.__configs.length) // we have iterated through all proxy instances
              return done();
          });
        });
      });
    }, 3000);
  });

  hooks.stopCluster();

});
