/**
 * Created by grant on 2016/10/05.
 */

var http = require('http');
var https = require('https');

module.exports.createClientInstance = function (host, port, callback) {

  (require('happn')).client.create({
    config: {
      secure: true,
      host: host,
      port: port,
      protocol: 'http',
      allowSelfSignedCerts: true,
      username: '_ADMIN',
      password: 'secret'
    }
  }, function (err, response) {
    if (err)
      return callback(err);

    callback(null, response);
  })
};

module.exports.createBrowserClientInstance = function (host, port, callback) {

  var tempDir = 'test/temp/';
  var browserClientName = 'browser-client.js';

  var fs = require('fs');

  var download = function (cb) {

    // get the browser client via HTTP GET
    http.get({hostname: host, port: port, path: '/browser_client'}, function (response) {

      var body = '';

      response.on('error', function (e) {
        cb(e);
      });

      response.on('data', function (d) {
        body += d;
      });

      response.on('end', function () {

        fs.exists(tempDir, function (exists) {

          if (!exists)
            fs.mkdir(tempDir);

          // now write the client to a local file and export as a module
          fs.writeFileSync(tempDir + browserClientName, body);
          module.exports = fs.readFileSync(tempDir + browserClientName);
          clientDownloaded = true;

          cb();
        });
      });
    });
  };

  var createClient = function (cb2) {

    var HappnClient = require('./temp/' + browserClientName);

    HappnClient.create({
      config: {
        secure: true,
        host: host,
        port: port
      }
    }, function (err, response) {
      if (err)
        return cb2(err);

      cb2(null, response);
    })
  };

  var clientDownloaded = false;

  fs.exists(tempDir + browserClientName, function (exists) {

    if (exists) {
      download(function (err) {
        if (err)
          return callback(err);

        createClient(callback);
      });
    } else
      createClient(callback);
  });
};
