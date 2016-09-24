var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var Promise = require('bluebird');
var os = require('os');
var dface = require('dface');

var HappnCluster = require('../');
var Mongo = require('./lib/mongo');

var clusterSize = 10; // increasing this may require increasing -swim-configs-
var mongoUrl = 'mongodb://127.0.0.1:27017/happn-cluster-test';
var mongoCollection = 'happn-cluster-test';
var device = os.platform() == 'linux' ? 'eth0' : 'en0'; // windows?
var ipAddress = dface(device);

describe(filename, function() {

  benchmarket.start();

  before('clear collection (before)', function(done) {
    Mongo.clearCollection(mongoUrl, mongoCollection, done);
  });

  before('start cluster', function(done) {
    var _this = this;

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
          }
        },
        cluster: {
          name: 'cluster1',
          membership: {
            seed: i == 1,
            seedWait: 500,
            joinType: 'static',
            host: device,
            port: 11000 + i,
            hosts: [ipAddress + ':11001', ipAddress + ':11002', ipAddress + ':11003'],

            // -swim-configs-
            joinTimeout: 500,
            probeInterval: 200,
            probeTimeout: 20,
            probeReqTimeout: 60
          }
        }
      };
      return config;
    }

    Promise.resolve(new Array(clusterSize)).map(function() {
      return HappnCluster.create(generateConfig())
    })
      .then(function(servers) {
        _this.servers = servers;
      })
      .then(done)
      .catch(done);
  });


  after('stop cluster', function(done) {
    if (!this.servers) return done();
    Promise.resolve(this.servers).map(function(server){
      return server.stop();
    })
      .then(function() {
        done();
      })
      .catch(done);
  });


  after('clear collection (after)', function(done) {
    Mongo.clearCollection(mongoUrl, mongoCollection, done);
  });

  it('test', function(done) {
    this.timeout(3500);
    var _this = this;

    setTimeout(function() {

      _this.servers.forEach(function(server) {
        var size = Object.keys(server.membership.members).length;
        if (size != clusterSize - 1) {
          console.log('-->', size);
        } else {
          console.log(size);
        }
      });
      done();

    }, 3000);


  });

  after(benchmarket.store());
  benchmarket.stop();

});
