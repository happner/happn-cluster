/**
 * Created by grant on 2016/09/27.
 */

var path = require('path');
var filename = path.basename(__filename);
var Promise = require('bluebird');
var os = require('os');
var dface = require('dface');
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

  before('clear collection (before)', function(done) {
    Mongo.clearCollection(mongoUrl, mongoCollection, done);
  });

  before('start cluster', function (done) {

    var self = this;

    var i = 0;

    function generateConfig() {
      i++;

      return {
        port: 55000 + i,
        services: {
          data: {
            path: 'happn-service-mongo',
            config: {
              collection: mongoCollection,
              url: mongoUrl
            }
          },
          membership: {
            config: {
              clusterName: 'cluster1',
              seed: i == 1,
              seedWait: 500,
              joinType: 'static',
              host: device,
              port: 11000 + i,
              hosts: [ipAddress + ':11001', ipAddress + ':11002', ipAddress + ':11003'],

              // -swim-configs-
              joinTimeout: 400,
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

  it('can proxy a request to each server', function (done) {

    var self = this;

    setTimeout(function() {

      self.servers.forEach(function(server) {
        // TODO: fire off a request to each proxy and check that a response is returned from the proxied server
      });
      done();

    }, 3000);

  });

});
