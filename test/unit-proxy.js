/**
 * Created by grant on 2016/09/26.
 */

var path = require('path');
var filename = path.basename(__filename);
var Proxy = require('../lib/proxy');

describe(filename, function () {

  var assert = require('assert');

  this.timeout(20000);

  before('sets up configuration', function (done) {

    /*
     protocol: 'ws','tcp','http','https'
     targetHost: '127.0.0.1'
     targetPort:'9000'
     listenPort:'8015'
     secure:'true','false'
     key:'asdasd' (only interrogated if secure:true)
     cert:'asdadsasd' (only interrogated if secure:true)
     */

    this.__config = {
      protocol: 'http',
      targetHost: '127.0.0.1',
      targetPort: '9000',
      listenHost: '127.0.0.1',
      listenPort: '8015',
      secure: 'false'
    };

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

    proxiedServer.listen(self.__config.targetPort);

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
        }).end();
      });
    });
  });

});

