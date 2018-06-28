var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');
var Promise = require('bluebird');
var request = Promise.promisify(require('request'));
var HappnClient = require('happn-3').client;

var hooks = require('../lib/hooks');

var testSequence = parseInt(filename.split('-')[0]);
var clusterSize = 1;
var happnSecure = true;

describe(filename, function () {

  this.timeout(30000);

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  hooks.startCluster({
    testSequence: testSequence,
    size: clusterSize,
    happnSecure: happnSecure
  });

  var port;

  before(function () {
    var address = this.servers[0].services.proxy.__proxyServer.address();
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
        url: 'http://127.0.0.1:' + port,
        username: '_ADMIN',
        password: 'secret'
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

});
