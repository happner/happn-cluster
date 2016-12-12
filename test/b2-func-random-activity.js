var path = require('path');
var filename = path.basename(__filename);
var Promise = require('bluebird');
var Happn = require('happn-3');
var benchmarket = require('benchmarket');
var hooks = require('./lib/hooks');
var MultiRandomActivity = require('./lib/multi-random-activity');

var clusterSize = 10;
var happnSecure = true;
var proxySecure = true;
var duration = 2000;

describe.only(filename, function () {

  this.timeout(30000);
  benchmarket.start();

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'info';
  });

  hooks.startMultiProcessCluster({
    size: clusterSize,
    happnSecure: happnSecure,
    proxySecure: proxySecure
  });

  before('connect a client to each server', function (done) {
    var _this = this;
    Promise.resolve(this.__configs).map(function (config) {
      var loginConfig = {
        config: {
          secure: happnSecure,
          host: config.services.proxy.config.host,
          port: config.services.proxy.config.port,
          protocol: 'https',
          username: config.services.security.config.adminUser.username,
          password: config.services.security.config.adminUser.password
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
