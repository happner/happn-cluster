process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

var Promise = require('bluebird');
var HappnCluster = require('../../');
var testUtils = require('./test-utils');

module.exports.startCluster = function(clusterOpts) {

  var clusterSize = clusterOpts.size || 5;
  var isSecure = typeof clusterOpts.isSecure == 'boolean' ? clusterOpts.isSecure : false;

  before('clear collection (before)', function (done) {
    testUtils.clearMongoCollection(done);
  });

  before('start cluster', function (done) {

    var self = this;

    testUtils.createMemberConfigs(clusterSize, isSecure, function (err, result) {

      if (err)
        return done(err);

      self.__configs = result;

      Promise.resolve(self.__configs).map(function (element) {
        return HappnCluster.create(element)
      })
        .then(function (servers) {
          self.servers = servers;
        })
        .then(done)
        .catch(done)
    });
  });
};

module.exports.stopCluster = function() {

  after('stop cluster', function (done) {

    if (!this.servers) return done();
    Promise.resolve(this.servers).map(function (server) {
      return server.stop()
        .then(function() {
          // stopping all at once causes replicator client happn logouts to timeout
          // because happn logout attempts unsubscribe on server, and all servers
          // are gone
          return Promise.delay(200);
        })
    }, {concurrency: 1})
      .then(function () {
        done()
      })
      .catch(done);
  });

  after('clear collection (after)', function (done) {
    testUtils.clearMongoCollection(done);
  });
};
