/**
 * Created by grant on 2016/09/27.
 */

var path = require('path');
var filename = path.basename(__filename);
var Promise = require('bluebird');
var os = require('os');
var dface = require('dface');
var http = require('http');

var HappnCluster = require('../');
var Mongo = require('./lib/mongo');

var clusterSize = 10;
var mongoUrl = 'mongodb://127.0.0.1:27017/happn-cluster-test';
var mongoCollection = 'happn-cluster-test';
var device = os.platform() == 'linux' ? 'eth0' : 'en0';
var ipAddress = dface(device);

describe(filename, function () {

  var assert = require('assert');
  this.timeout(20000);

  before('clear Mongo collection', function (done) {
    Mongo.clearCollection(mongoUrl, mongoCollection, done);
  });

  before('start cluster', function (done) {

    var self = this;
    self.__configs = [];

    var i = 0;

    function generateConfig() {
      i++;

      var config = {
        port: 55000 + i,
        services: {
          data: {
            path: 'happn-service-mongo',
            config: {
              collection: mongoCollection,
              url: mongoUrl
            }
          },
          security: {
            config: {
              adminUser: {
                username: '_ADMIN',
                password: 'secret'
              }
            }
          },
          membership: {
            config: {
              clusterName: 'cluster1',
              seed: i == 1,
              seedWait: 500,
              joinType: 'static',
              host: device,
              port: 56000 + i,
              hosts: [ipAddress + ':56001', ipAddress + ':56002', ipAddress + ':56003'],

              // -swim-configs-
              joinTimeout: 800,
              pingInterval: 200,
              pingTimeout: 20,
              pingReqTimeout: 60
            }
          },
          proxy: {
            config: {
              listenHost: '0.0.0.0',
              listenPort: 8015 + i
            }
          }
        }

      };

      self.__configs.push(config);
      return config;
    }

    Promise.resolve(new Array(clusterSize)).map(function () {
        return HappnCluster.create(generateConfig())
      })
      .then(function (servers) {
        self.servers = servers;
      })
      .then(done)
      .catch(done);
  });

  it('can create a happn client and send a get request via each proxy instance', function (done) {

    var self = this;

    setTimeout(function () {

      var currentConfig = 0;

      self.__configs.forEach(function (config) {

        var port = config.services.proxy.config.listenPort;
        var host = config.services.proxy.config.listenHost;

        // create happn client instance and log in
        createClientInstance(host, port, function (err, instance) {

          if (err)
            return done(err);

          console.log('### Sending request to -> ' + host + ':' + port);

          // send get request for wildcard resources in root
          instance.get('/*', null, function (e, results) {

            if (e)
              return done(e);

            console.log('### Response received from proxied cluster node: ' + JSON.stringify(results));

            instance.disconnect();
            currentConfig++;

            if (currentConfig == self.__configs.length) // we have iterated through all proxy instances
              done();
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

  function createClientInstance(host, port, callback) {

    (require('happn')).client.create({
      config: {
        secure: true,
        host: host,
        port: port
      }
    }, function (err, response) {
      if (err)
        return callback(err);

      callback(null, response);
    })
  }

});