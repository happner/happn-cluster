/**
 * Created by grant on 2016/09/30.
 */

var path = require('path');
var filename = path.basename(__filename);
var Promise = require('bluebird');
var os = require('os');
var dface = require('dface');
var http = require('http');
var https = require('https');

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

  var clientDownloaded = false;
  var tempDir = 'test/temp/';
  var browserClientName = 'browser-client.js';

  before('clear Mongo collection', function (done) {
    Mongo.clearCollection(mongoUrl, mongoCollection, done);
  });

  before('start cluster', function (done) {

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

    var self = this;
    self.__configs = [];

    var i = 0;

    function generateConfig() {
      i++;

      var fs = require('fs');

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
              port: 11000 + i,
              hosts: [ipAddress + ':11001', ipAddress + ':11002', ipAddress + ':11003'],

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

    var fs = require('fs');

    var download = function (cb) {

      // get the browser client via HTTP GET
      http.get({hostname: host, port: port, path: '/browser_client'}, function (response) {

        var body = '';

        response.on('error', function (e) {
          cb(e);
        });

        response.on('data', function (d) {
          body += d;
        });

        response.on('end', function () {

          fs.exists(tempDir, function (exists) {

            if (!exists)
              fs.mkdir(tempDir);

            // now write the client to a local file and export as a module
            fs.writeFileSync(tempDir + browserClientName, body);
            module.exports = fs.readFileSync(tempDir + browserClientName);
            clientDownloaded = true;

            cb();
          });
        });
      });
    };

    var createClient = function (cb2) {

      var HappnClient = require('./temp/' + browserClientName);

      HappnClient.create({
        config: {
          secure: true,
          host: host,
          port: port
        }
      }, function (err, response) {
        if (err)
          return cb2(err);

        cb2(null, response);
      })
    };

    if (!clientDownloaded) {
      download(function (err) {
        if (err)
          return callback(err);

        createClient(callback);
      });
    } else
      createClient(callback);
  }
});
