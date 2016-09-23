var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');

var HappnCluster = require('../');
var Mongo = require('./lib/mongo');

var mongoUrl = 'mongodb://127.0.0.1:27017/happn-cluster-test';
var mongoCollection = 'happn-cluster-test';

describe(filename, function() {

  benchmarket.start();

  before('clear collection (before)', function(done) {
    Mongo.clearCollection(mongoUrl, mongoCollection, done);
  });

  after('clear collection (after)', function(done) {
    Mongo.clearCollection(mongoUrl, mongoCollection, done);
  });

  after(benchmarket.store());
  benchmarket.stop();

});
