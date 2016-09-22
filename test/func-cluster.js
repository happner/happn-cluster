var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');

var HappnCluster = require('../');
var Promise = require('bluebird');

describe(filename, function() {

  benchmarket.start();

  before('start cluster', function(done) {
    var clusterSize = 5, _this = this;

    function createConfig(i) {
      return {
        port: 55001 + i
      }
    }

    // start clusterSize members concurrently
    Promise.resolve(new Array(clusterSize)).map(function(_, i) {
      return HappnCluster.create(createConfig(i));
    })
      .then(function(cluster) {
        _this.cluster = cluster;
      })
      .then(done)
      .catch(done);
  });

  after('stop cluster', function(done) {
    Promise.resolve(this.cluster).map(function(member) {
      return member.stop({reconnect: false});
    })
      .then(function() {})
      .then(done)
      .catch(done);
  });

  it('events emitted at one member are received at all members', function(done) {
    done();
  });

  after(benchmarket.store());
  benchmarket.stop();

});
