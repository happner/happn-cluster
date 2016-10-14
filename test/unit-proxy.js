/**
 * Created by grant on 2016/09/26.
 */

var path = require('path');
var filename = path.basename(__filename);
var assert = require('assert');
var Proxy = require('../lib/services/proxy');
var MockHappn = require('./mocks/mock-happn');
var mockOpts = require('./mocks/mock-opts');

describe(filename, function () {

  this.timeout(20000);

  before('sets up configuration', function (done) {

    this.__config = {
      listenHost: '0.0.0.0',
      listenPort: 8015
    };

    Object.defineProperty(Proxy.prototype, "happn", {
      get: function () {
        return new MockHappn('http', 9000);
      }
    });

    done();
  });

  it('can initialize the proxy', function (done) {

    var proxy = new Proxy(mockOpts);

    proxy.initialize(this.__config, function (err, result) {
      if (err)
        return callback(err);

      assert.notEqual(result, null);
      return done();
    })
  });

  it('can start and stop the proxy', function (done) {

    var proxy = new Proxy(mockOpts);

    proxy.initialize(this.__config, function (err, result) {
      if (err)
        return callback(err);

      proxy.start()
        .then(function (result) {
          proxy.stop(null, function (err) {
            if (err)
              callback(err);

            assert.notEqual(result, null);
            return done();
          })
        })
        .catch(function (err) {
          return done(err);
        })
    });
  });

  it('can proxy an http server', function (done) {

    var proxy = new Proxy(mockOpts);

    var http = require('http');

    var proxyHost = proxy.happn.services.proxy.config.listenHost;
    var proxyPort = proxy.happn.services.proxy.config.listenPort;
    var targetHost = proxy.happn.server.address().host;
    var targetPort = proxy.happn.config.port;

    const EXPECTED = 'request successfully proxied!';

    // set up independent http server
    var proxiedServer = http.createServer(function (req, res) {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.write(EXPECTED);
      res.end();
    });

    // the proxied server is set up as the target in happn (the mock in this case)
    // console.log('Target port: ' + targetPort);
    proxiedServer.listen(targetPort);


    proxy.initialize(this.__config, function (err, result) {
      if (err)
        return callback(err);

      proxy.start()
        .then(function () {

          // send GET request to proxy - this should pass the request to the target
          http.request({port: proxyPort, host: proxyHost}, function (res) {

            var result = '';

            res.on('data', function (chunk) {
              result += chunk;
            });

            res.on('end', function () {
              // console.log(result);
              assert.equal(result, EXPECTED);

              proxy.stop(null, function (err) {
                if (err)
                  return done(err);

                return done();
              })
            });

          })
            .end();
        })
        .catch(function (err) {
          return done(err);
        })
    });
  });
});

