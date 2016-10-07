var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var Promise = require('bluebird');

var testUtil = require('./lib/test-utils');

var HappnCluster = require('../');

var clusterSize = 10;

xdescribe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  before('clear collection (before)', function (done) {
    testUtil.clearMongoCollection(done);
  });

  before('start cluster', function (done) {

    var self = this;

    testUtil.createMemberConfigs(clusterSize, false, function (err, result) {

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
        done()
      })
      .catch(done);
  });

  after('clear collection (after)', function (done) {
    testUtil.clearMongoCollection(done);
  });

  it('test', function (done) {
    var self = this;

    self.timeout(3500);

    setTimeout(function () {

      self.servers.forEach(function (server) {
        var size = Object.keys(server.services.membership.members).length;
        if (size != clusterSize - 1) {
          console.log('-->', size);
        } else {
          console.log(size);
        }
      });
      done();

    }, 3000);
  });

  after(benchmarket.store());
  benchmarket.stop();

});
