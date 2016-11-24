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

module.exports.createMemberConfigs = Promise.promisify(function (clusterSize, happnSecure, proxySecure, services, callback) {

  var ipAddress = getAddress();
  var fs = require('fs');
  var transport = null;
  var certPath, keyPath;

  if (happnSecure) {
    transport = {
      mode: 'https',
      certPath: 'test/keys/happn.com.cert',
      keyPath: 'test/keys/happn.com.key'
    };
  }

  var configs = [];
  var i = 0;

  while (i < clusterSize) {

    i++;

    var config = {
      port: 57000 + i,
      transport: transport,
      services: {
        data: {
          path: 'happn-service-mongo-2',
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
            seedWait: 1000,
            joinType: 'static',
            host: ipAddress,
            port: 56000 + i,
            hosts: [ipAddress + ':56001', ipAddress + ':56002', ipAddress + ':56003'],
            joinTimeout: 1000,
            pingInterval: 200,
            pingTimeout: 20,
            pingReqTimeout: 60
          }
        }
        ,
        proxy: {
          config: {
            host: '0.0.0.0',
            port: 55000 + i,
            allowSelfSignedCerts: true
          }
        }
      }
    };

    if (happnSecure) {
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

    if (proxySecure) {
      config.services.proxy.config.certPath = 'test/keys/proxy.com.cert';
      config.services.proxy.config.keyPath = 'test/keys/proxy.com.key';
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

  callback(null, configs);

});

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

  (require('happn-3')).client.create({
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
