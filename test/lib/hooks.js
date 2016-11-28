process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

var Promise = require('bluebird');
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

      if (err)
        return done(err);

      self.__configs = result;

      Promise.resolve(self.__configs).map(function (element) {
        return HappnCluster.create(element)
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

      console.log('stopping server:::', server.config.name);

      return server.stop()
        .then(function () {
          // stopping all at once causes replicator client happn logouts to timeout
          // because happn logout attempts unsubscribe on server, and all servers
          // are gone
          return Promise.delay(100); // ...so pause between stops
        })
    }, {concurrency: 1}) // ...and do them one at a time
      .then(function () {

        console.log('stop successful:::');

        done()
      })
      .catch(function(e){

        console.log('failed stopping:::', e.toString());
        done(e);
      });
  });

  after('clear collection (after)', function (done) {
    testUtils.clearMongoCollection(done);
  });
};
