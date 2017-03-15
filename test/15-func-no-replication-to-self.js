var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var expect = require('expect.js');
var Promise = require('bluebird');
var request = Promise.promisify(require('request'));
var HappnClient = require('happn-3').client;

var hooks = require('./lib/hooks');

var testSequence = parseInt(filename.split('-')[0]);
var clusterSize = 1;
var happnSecure = true;
var proxySecure = true;

describe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  hooks.startCluster({
    testSequence: testSequence,
    size: clusterSize,
    happnSecure: happnSecure,
    proxySecure: proxySecure
  });

  var port;

  before(function () {
    var address = this.servers[0].services.proxy.__proxyServer._server.address();
    port = address.port;
  });

  it('does not replicate to self in infinite loop', function (done) {
    var client, count = 0;
    HappnClient.create({
      config: {
        url: 'https://127.0.0.1:' + port,
        username: '_ADMIN',
        password: 'secret'
      }
    })
      .then(function (_client) {
        client = _client;
      })
      .then(function () {
        return new Promise(function (resolve, reject) {
          client.on('/test/path', function (data, meta) {
            count++;
          }, function (e) {
            if (e) return reject(e);
            resolve();
          })
        })
      })
      .then(function () {
        return client.set('/test/path', {some: 'data'})
      })
      .then(function () {
        return Promise.delay(100);
      })
      .then(function () {
        expect(count).to.be(1);
      })
      .then(function () {
        done();
      })
      .catch(done);
  });


  hooks.stopCluster();

  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
  });

  after(benchmarket.store());
  benchmarket.stop();

});
