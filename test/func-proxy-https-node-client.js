/**
 * Created by grant on 2016/09/29.
 */

var path = require('path');
var filename = path.basename(__filename);
var Promise = require('bluebird');

var HappnCluster = require('../');

var testUtil = require('./lib/test-utils');
var clusterSize = 10;

describe(filename, function () {

  var assert = require('assert');
  this.timeout(20000);

  before('clear Mongo collection', function (done) {
    testUtil.clearMongoCollection(done);
  });

  before('start cluster', function (done) {

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
    var self = this;

    testUtil.createMemberConfigs(clusterSize, true, function (err, result) {

      if (err)
        return done(err);

      self.__configs = result;

      Promise.resolve(self.__configs).map(function (element) {
          return HappnCluster.create(element)
        })
        .then(function (servers) {
          self.servers = servers;
        })
        .then(done)
        .catch(done)
    });
  });

  it('can create a happn client and send a get request via each proxy instance', function (done) {

    var self = this;
    var currentConfig = 0;

    setTimeout(function () {

      self.__configs.forEach(function (config) {

        var port = config.services.proxy.config.listenPort;
        var host = config.services.proxy.config.listenHost;

        // create happn client instance and log in
        testUtil.createClientInstance(host, port, function (err, instance) {

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

  after('stop cluster', function (done) {

    if (!this.servers)
      return done();

    Promise.resolve(this.servers).map(function (server) {
        return server.stop();
      })
      .then(function () {
        done();
      })
      .catch(done);
  });

});
