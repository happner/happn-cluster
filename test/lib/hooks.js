process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

var path = require('path');
var Promise = require('bluebird');
var ChildProcess = require('child_process');
var clone = require('clone');
var HappnCluster = require('../../');
var testUtils = require('./test-utils');

module.exports.startCluster = function (clusterOpts) {

  var clusterSize = clusterOpts.size || 5;
  var happnSecure = typeof clusterOpts.happnSecure == 'boolean' ? clusterOpts.happnSecure : false;
  var proxySecure = typeof clusterOpts.proxySecure == 'boolean' ? clusterOpts.proxySecure : false;
  var services = clusterOpts.services || {};

  before('clear collection (before)', function (done) {
    testUtils.clearMongoCollection(done);
  });

  before('start cluster', function (done) {

    var self = this;

    testUtils.createMemberConfigs(clusterSize, happnSecure, proxySecure, services, function (err, result) {

      if (err) return done(err);

      self.__configs = result;

      Promise.resolve(self.__configs).map(function (config) {
        return HappnCluster.create(clone(config))
      })
        .then(function (servers) {
          self.servers = servers;
        })
        .then(function(e){
          done(e);
        })
        .catch(function(e){
          done(e);
        })
    });
  });
};

module.exports.stopCluster = function () {

  after('stop cluster', function (done) {

    if (!this.servers) return done();
    Promise.resolve(this.servers).map(function (server) {
      return server.stop()
        .then(function () {
          // stopping all at once causes replicator client happn logouts to timeout
          // because happn logout attempts unsubscribe on server, and all servers
          // are gone
          return Promise.delay(500); // ...so pause between stops (long for travis)
        })
    }, {concurrency: 1}) // ...and do them one at a time
      .then(function () {
        done()
      })
      .catch(done);

  });

  after('clear collection (after)', function (done) {
    testUtils.clearMongoCollection(done);
  });

};

module.exports.startMultiProcessCluster = function (clusterOpts) {

  before('multi clear collection (before)', function (done) {
    testUtils.clearMongoCollection(done);
  });

  var clusterSize = clusterOpts.size || 5;
  var happnSecure = typeof clusterOpts.happnSecure == 'boolean' ? clusterOpts.happnSecure : false;
  var proxySecure = typeof clusterOpts.proxySecure == 'boolean' ? clusterOpts.proxySecure : false;
  var services = clusterOpts.services || {};

  var peerPath = __dirname + path.sep + 'peer.js';

  before('start cluster', function (done) {

    var self = this;

    testUtils.createMemberConfigs(clusterSize, happnSecure, proxySecure, services, function (err, result) {

      if (err) return done(err);

      self.__configs = result;

      Promise.resolve(self.__configs).map(function (config) {
        var configJson = [JSON.stringify(config)];

        return new Promise(function (resolve, reject) {
          var peerProcess = ChildProcess.fork(peerPath, configJson);
          peerProcess.on('message', function (message) {
            if (message == 'ready') return resolve(peerProcess);
          });
        });
      })

        .then(function (processes) {
          self.peerProcesses = processes;
          self.servers = 'see .peerProcesses[n].send';
        })
        .then(function(e){
          done(e);
        })
        .catch(function(e){
          done(e);
        });

    });
  });
};

module.exports.stopMultiProcessCluster = function () {

  after('stop cluster', function (done) {
    if (!this.peerProcesses) return done();
    this.peerProcesses.forEach(function (proc) {
      proc.kill();
    });
    done();
  });

  after('multi clear collection (after)', function (done) {
    testUtils.clearMongoCollection(done);
  });

};


