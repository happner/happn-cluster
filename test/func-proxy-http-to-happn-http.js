var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var expect = require('expect.js');
var Promise = require('bluebird');
var request = Promise.promisify(require('request'));
var HappnClient = require('happn-3').client;

var hooks = require('./lib/hooks');

var clusterSize = 1;
var happnSecure = false;

describe(filename, function () {

  this.timeout(30000);

  //benchmarket.start();

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  hooks.startCluster({
    size: clusterSize,
    happnSecure: happnSecure
  });

  var port;

  before(function () {
    var address = this.servers[0].services.proxy.__proxyServer._server.address();
    port = address.port;
  });

  it('can do web', function (done) {
    request('http://127.0.0.1:' + port + '/browser_client')
      .then(function (result) {
        expect(result.body).to.match(/HappnClient/);
        done();
      })
      .catch(done);
  });


  it('can do client', function (done) {
    var client;
    HappnClient.create({
      config: {
        url: 'http://127.0.0.1:' + port
      }
    })
      .then(function (_client) {
        client = _client;
        return client.set('/this/' + filename, {x: 1});
      })
      .then(function () {
        return client.get('/this/' + filename);
      })
      .then(function (result) {
        delete result._meta;
        expect(result).to.eql({x: 1});
        done();
      })
      .catch(done);
  });


  hooks.stopCluster();

  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
  });

  // after(benchmarket.store());
  // benchmarket.stop();

});
