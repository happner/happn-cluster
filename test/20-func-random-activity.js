var path = require('path');
var filename = path.basename(__filename);
var Promise = require('bluebird');
var Happn = require('happn-3');
var benchmarket = require('benchmarket');
var hooks = require('./lib/hooks');
var MultiRandomActivity = require('./lib/multi-random-activity');

var testSequence = parseInt(filename.split('-')[0]);
var clusterSize = 10;
var happnSecure = false;
var proxySecure = false;
var duration = 2000;

xdescribe(filename, function () {

  this.timeout(30000);
  benchmarket.start();

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'info';
  });

  hooks.startMultiProcessCluster({
    testSequence: testSequence,
    size: clusterSize,
    happnSecure: happnSecure,
    proxySecure: proxySecure
  });

  before('connect a client to each server', function (done) {
    var _this = this;
    Promise.resolve(this.__configs).map(function (config) {
      var loginConfig = {
        config: {
          host: config.services.proxy.config.host,
          port: config.services.proxy.config.port,
          protocol: 'http',
        }
      };

      return Happn.client.create(loginConfig);
    })
      .then(function (clients) {
        clients.forEach(function (client) {
          client.onAsync = Promise.promisify(client.on);
        });
        _this.clients = clients;
        done();
      })
      .catch(done);
  });


  before('create activity generators', function () {
    this.generator = new MultiRandomActivity(this.clients, {onTimeout: 10000});
  });


  it('tests random activity', function (done) {
    var generator = this.generator;
    generator.generateActivityStart('test', function (e) {
      if (e) return done(e);
      setTimeout(function () {
        generator.generateActivityEnd('test', function (log) {
          generator.verify(function (e, logs) {
            done(e);
          }, 'test');
        });
      }, duration);

    });
  });


  after('disconnect all clients', function (done) {
    if (!this.clients) return done();
    Promise.resolve(this.clients).map(function (client) {
      return client.disconnect();
    })
      .then(function () {
        done();
      })
      .catch(done);
  });

  hooks.stopMultiProcessCluster();

  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
  });

  after(benchmarket.store());
  benchmarket.stop();

});
