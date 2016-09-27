/**
 * Created by grant on 2016/09/26.
 */

var path = require('path');
var filename = path.basename(__filename);
var Proxy = require('../lib/proxy');
var MockHappn = require('./mocks/mock-happn');

describe(filename, function () {

  var assert = require('assert');

  this.timeout(20000);

  before('sets up configuration', function (done) {

    var self = this;

    /*
     listenHost:'0.0.0.0'
     listenPort:'8015'
     key:'asdasd' (only interrogated if secure:true)
     cert:'asdadsasd' (only interrogated if secure:true)
     */

    self.__config = {
      listenHost: '0.0.0.0',
      listenPort: '8015'
    };

    Object.defineProperty(Proxy.prototype, "happn", {
      get: function () {
        return new MockHappn('http');
      }
    });

    done();
  });

  it('can initialize the proxy', function (done) {

    var self = this;

    var proxy = new Proxy();

    proxy.initialize(self.__config, function (err, result) {
      if (err)
        return done(err);

      proxy.stop(function (err) {
        if (err)
          return done(err);

        assert.notEqual(result, null);

        return done();
      });
    });
  });

  it('can start and stop the proxy', function (done) {

    var self = this;
    var proxy = new Proxy();

    proxy.initialize(self.__config, function (err, result) {
      if (err)
        return done(err);

      proxy.start(function (err, result) {
        if (err)
          return done(err);

        proxy.stop(function (err) {
          if (err)
            return done(err);

          assert.notEqual(result, null);

          return done();
        });
      });
    });
  });

  it('can proxy an http server', function (done) {

    var self = this;
    var proxy = new Proxy();
    var http = require('http');

    const EXPECTED = 'request successfully proxied!';

    // set up independent http server
    var proxiedServer = http.createServer(function (req, res) {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.write(EXPECTED);
      res.end();
    });

    // the proxied server is set up as the target in happn (the mock in this case)
    proxiedServer.listen(proxy.happn.server.address().port);

    // set up proxy
    proxy.initialize(self.__config, function (err, result) {
      if (err)
        return done(err);

      proxy.start(function (err, result) {
        if (err)
          return done(err);

        // send GET request to proxy - this should pass the request to the target
        http.request({port: self.__config.listenPort, host: self.__config.listenHost}, function (res) {

            var result = '';

            res.on('data', function (chunk) {
              result += chunk;
            });

            res.on('end', function () {
              proxy.stop(function (err) {
                if (err)
                  return done(err);

                assert.equal(result, EXPECTED);

                return done();
              });
            })
          })
          .end();
      });
    });
  });
});

