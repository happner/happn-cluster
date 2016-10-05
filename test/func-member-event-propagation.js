/**
 * Created by grant on 2016/10/04.
 */

var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var Promise = require('bluebird');
var os = require('os');
var dface = require('dface');

var HappnCluster = require('../');
var Mongo = require('./lib/mongo');
var testUtil = require('./lib/test-utils');

var clusterSize = 2;

var mongoUrl = 'mongodb://127.0.0.1:27017/happn-cluster-test';
var mongoCollection = 'happn-cluster-test';
var device = os.platform() == 'linux' ? 'eth0' : 'en0'; // windows?
var ipAddress = dface(device);

describe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  before('clear collection (before)', function (done) {
    Mongo.clearCollection(mongoUrl, mongoCollection, done);
  });

  before('start cluster', function (done) {

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
              listenPort: 8015 + i,
              allowSelfSignedCerts: true
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


  after('stop cluster', function (done) {
    if (!this.servers) return done();
    Promise.resolve(this.servers).map(function (server) {
        return server.stop();
      })
      .then(function () {
        done();
      })
      .catch(done);
  });


  after('clear collection (after)', function (done) {
    Mongo.clearCollection(mongoUrl, mongoCollection, done);
  });

  it('data set event is propagated to cluster members', function (done) {

    var self = this;

    setTimeout(function () {

      /* EXPECTED PROCESS:
         publisher client → publisher member → publisher backchannel client
         listener client ← listener member ← listener back channel client ↵
       */

      var member1Port = self.__configs[0].services.proxy.config.listenPort;
      var member1Host = self.__configs[0].services.proxy.config.listenHost;

      var member2Port = self.__configs[1].services.proxy.config.listenPort;
      var member2Host = self.__configs[1].services.proxy.config.listenHost;

      var testPath = '/EVENT_PROPAGATION_DATA';
      var testData = {testField: 'testValue'};

      testUtil.createClientInstance(member1Host, member1Port, function (err, publisherClient) {

        if (err)
          return done(err);

        testUtil.createClientInstance(member2Host, member2Port, function (err, listenerClient) {

          if (err)
            return done(err);

          listenerClient.on(testPath + '/*', {event_type: 'set', count: 1}, function (result2, meta) {

            console.log('### data received by listener client: ' + JSON.stringify(result2));

            assert(result2.indexOf(testPath) > -1);
            return done();

          }, function (e) {

            console.log('### setting data from publisher client: ' + member1Host + ':' + member1Port);

            publisherClient.set(testPath + '/test1', testData, null)
              .then(function (result) {
                console.log('### waiting for event propagation to listener...')
              })
              .catch(function (err) {
                return done(err);
              });
          });
        });
      });

    }, 3000);

  });

  after(benchmarket.store());
  benchmarket.stop();

});
