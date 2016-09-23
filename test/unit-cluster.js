var path = require('path');
var filename = path.basename(__filename);
var should = require('should');
var benchmarket = require('benchmarket');
var Happn = require('happn');

var HappnCluster = require('../');
var Mongo = require('./lib/mongo');

var mongoUrl = 'mongodb://127.0.0.1:27017/happn-cluster-test';
var mongoCollection = 'happn-cluster-test';

describe(filename, function() {

  benchmarket.start();

  before('clear collection (before)', function(done) {
    Mongo.clearCollection(mongoUrl, mongoCollection, done);
  });

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
      services: {
        data: {
          path: 'happn-service-mongo',
          config: {
            collection: mongoCollection,
            url: mongoUrl
          }
        }
      },
      cluster: {
        membership: {
          seed: true
        }
      }
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

  after('clear collection (after)', function(done) {
    Mongo.clearCollection(mongoUrl, mongoCollection, done);
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
