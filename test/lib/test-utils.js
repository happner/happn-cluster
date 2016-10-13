/**
 * Created by grant on 2016/10/05.
 */

var http = require('http');
var https = require('https');
var Promise = require('bluebird');

var getAddress = require('../../lib/utils/get-address');
var Mongo = require('./mongo');

var mongoUrl = 'mongodb://127.0.0.1:27017/happn-cluster-test';
var mongoCollection = 'happn-cluster-test';

module.exports.clearMongoCollection = function (callback) {
  Mongo.clearCollection(mongoUrl, mongoCollection, callback);
};

module.exports.createMemberConfigs = Promise.promisify(function (clusterSize, isSecure, services, callback) {

  // var os = require('os');
  // var dface = require('dface');
  // var device = os.platform() == 'linux' ? 'eth0' : 'en0'; // windows?
  var ipAddress = getAddress();
  var fs = require('fs');

  var transport = null;

  if (typeof isSecure == 'function') {
    callback = isSecure;
    isSecure = false;
    services = {};
  }

  if (typeof services == 'function') {
    callback = services;
    services = {};
  }

  var generateConfigs = function () {

    var configs = [];
    var i = 0;

    while (i < clusterSize) {

      i++;

      var config = {
        port: 55000 + i,
        transport: transport,
        services: {
          data: {
            path: 'happn-service-mongo',
            config: {
              collection: mongoCollection,
              url: mongoUrl
            }
          }
          ,
          orchestrator: {
            config: {
              minimumPeers: clusterSize
            }
          }
          ,
          membership: {
            config: {
              clusterName: 'cluster1',
              seed: i == 1,
              seedWait: 500,
              joinType: 'static',
              host: ipAddress,
              port: 56000 + i,
              hosts: [ipAddress + ':56001', ipAddress + ':56002', ipAddress + ':56003'],
              joinTimeout: 800,
              pingInterval: 200,
              pingTimeout: 20,
              pingReqTimeout: 60
            }
          }
          ,
          proxy: {
            config: {
              listenHost: '0.0.0.0',
              listenPort: 8015 + i,
              allowSelfSignedCerts: true
            }
          }
        }
      };

      if (isSecure) {
        config.secure = true;
        config.services.security = {
          config: {
            adminUser: {
              username: '_ADMIN',
              password: 'secret'
            }
          }
        }
      }

      Object.keys(services).forEach(function (serviceName) {
        var ammendDefaultService = services[serviceName];
        Object.keys(ammendDefaultService).forEach(function (keyName) {
          config.services[serviceName].config[keyName] = ammendDefaultService[keyName];
        });
      });

      // console.log(JSON.stringify(config, null, 2));

      configs.push(config);
    }

    return configs;
  };

  if (isSecure) {
    this.__generateCertificate(function (err, result) {
      if (err)
        return callback(err);

      transport = {
        mode: 'https',
        certPath: result.certDir + result.certName,
        keyPath: result.certDir + result.keyName
      };

      callback(null, generateConfigs());
    });
  } else {
    callback(null, generateConfigs());
  }
});

module.exports.__generateCertificate = function (callback) {

  var certUtil = require('../lib/cert-utils');
  var certDir = 'test/keys/';
  var certName = 'test_cert.pem';
  var keyName = 'test_key.rsa';

  certUtil.generateCertificate(certDir, keyName, certName, function (err) {
    if (err)
      return callback(err);

    callback(null, {certDir: certDir, certName: certName, keyName: keyName});
  });
};

module.exports.awaitExactMembershipCount = Promise.promisify(function (servers, count, callback) {
  var interval, gotExactCount = false;

  if (typeof count == 'function') {
    callback = count;
    count = servers.length;
  }

  interval = setInterval(function () {

    if (servers.length !== count) return;

    gotExactCount = true;

    servers.forEach(function (server) {
      if (Object.keys(server.services.membership.members).length != count - 1) {
        gotExactCount = false;
      }
    });

    if (gotExactCount) {
      clearInterval(interval);
      callback();
    }

  }, 100);

});

module.exports.awaitExactPeerCount = Promise.promisify(function (servers, count, callback) {
  var interval, gotExactCount = false;

  if (typeof count == 'function') {
    callback = count;
    count = servers.length;
  }

  interval = setInterval(function () {

    if (servers.length !== count) return;

    gotExactCount = true;

    servers.forEach(function (server) {
      if (Object.keys(server.services.orchestrator.peers).length != count) {
        gotExactCount = false;
      }
    });

    if (gotExactCount) {
      clearInterval(interval);
      callback();
    }

  }, 100);

});

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

        // now write the client to a local file and export as a module
        fs.writeFileSync(tempDir + browserClientName, body);
        module.exports = fs.readFileSync(tempDir + browserClientName);

        cb();
      });
    });
  };

  var createClient = function (cb2) {

    var HappnClient = require('../temp/' + browserClientName);

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

  fs.exists(tempDir + browserClientName, function (exists) {

    if (!exists) {

      try {
        fs.mkdirSync(tempDir);
      } catch (err) {
      }

      download(function (err) {
        if (err)
          return callback(err);

        createClient(callback);
      });
    } else
      createClient(callback);
  });
};
