var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var Promise = require('bluebird');

var testUtil = require('./lib/test-utils');

var HappnCluster = require('../');

xdescribe(filename, function () {

  benchmarket.start();

  before('clear collection (before)', function (done) {
    testUtil.clearMongoCollection(done);
  });

  before('start 2 members', function (done) {

    var self = this;

    testUtil.createMemberConfigs(2, false, function (err, result) {

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

  after('stop cluster', function (done) {
    if (!this.servers) return done();
    Promise.resolve(this.servers).map(function (server) {
        return server.stop();
      })
      .then(function () {
        done();
      })
      .catch(done);
  });

  xit('joining member fails to start if login to existing member fails before stabilized() is called',
    function (done) {

      // check for member stop...!!

      testUtil.createMemberConfigs(1, false, function (err, result) {
        HappnCluster.create(result)

          .then(function (_server) {

          })

          .catch(function (error) {
            console.log(error);

          });

        done();
      })
    });

  xit('joining member fails to start if login to existing member fails while stabilized() is waiting',
    function (done) {
      done();
    }
  );

  xit('joining member succeeds while simultaneously another member departs',
    function (done) {

    }
  );

  after('clear collection (after)', function (done) {
    testUtil.clearMongoCollection(done);
  });

  after(benchmarket.store());
  benchmarket.stop();

});
