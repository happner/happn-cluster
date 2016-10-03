var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var Promise = require('bluebird');
var os = require('os');
var dface = require('dface');

var HappnCluster = require('../');
var Mongo = require('./lib/mongo');

var mongoUrl = 'mongodb://127.0.0.1:27017/happn-cluster-test';
var mongoCollection = 'happn-cluster-test';
var device = os.platform() == 'linux' ? 'eth0' : 'en0'; // windows?
var ipAddress = dface(device);

return;

var i = 0;
var generateConfig = function() {
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
      membership: {
        config: {
          seed: i == 1,
          seedWait: 500,
          joinType: 'static',
          host: device,
          port: 56000 + i,
          hosts: [ipAddress + ':56001', ipAddress + ':56002', ipAddress + ':56003'],

          // -swim-configs-
          joinTimeout: 400,
          pingInterval: 200,
          pingTimeout: 20,
          pingReqTimeout: 60
        }
      }
    }
  };
  return config;
}

describe(filename, function() {

  benchmarket.start();

  before('clear collection (before)', function(done) {
    Mongo.clearCollection(mongoUrl, mongoCollection, done);
  });

  before('start 2 members', function(done) {
    var _this = this;


    Promise.resolve(new Array(2)).map(function() {
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

  it('joining member fails to start if login to existing member fails before stabilized() is called',
    function(done) {

      // check for member stop...!!

      var server, config = generateConfig();

      HappnCluster.create(config)

        .then(function(_server) {

        })

        .catch(function(error) {
          console.log(error);


        });

      done();
    }
  );

  xit('joining member fails to start if login to existing member fails while stabilized() is waiting',
    function(done) {
      done();
    }
  );

  after('clear collection (after)', function(done) {
    Mongo.clearCollection(mongoUrl, mongoCollection, done);
  });

  after(benchmarket.store());
  benchmarket.stop();

});
