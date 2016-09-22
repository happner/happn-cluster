var path = require('path');
var filename = path.basename(__filename);
var should = require('should');
var benchmarket = require('benchmarket');

var HappnCluster = require('../');
var Happn = require('happn');
var Promise = require('bluebird');

describe(filename, function() {

  benchmarket.start();

  before('start happn server', function(done) {
    var _this = this;
    Happn.service.create({
      port: 55001
    })
      .then(function(happn) {
        _this.happn = happn;
        done();
      })
      .catch(done);
  });

  after('stop happn server', function(done) {
    this.happn.stop({reconnect: false}, done);
  });

  before('start happn-cluster server', function(done) {
    var _this = this;
    HappnCluster.create({
      port: 55002
    })
      .then(function(happnCluster) {
        _this.happnCluster = happnCluster;
        done();
      })
      .catch(done);
  });

  after('stop happn-cluster server', function(done) {
    this.happnCluster.stop({reconnect: false}, done);
  });

  it('happn-cluster.create() resolves with object whose interface matches happn.create() ', function(done) {
    var missing = {}, _this = this;
    Object.keys(this.happn).forEach(function(key) {
      if (!_this.happnCluster.hasOwnProperty(key) ||
        typeof _this.happnCluster[key] !== typeof _this.happn[key]) {
        missing[key] = typeof _this.happn[key];
      }
    });
    missing.should.eql({});
    done();
  });

  after(benchmarket.store());
  benchmarket.stop();

});
