var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');

var testUtil = require('./lib/test-utils');

describe(filename, function() {

  benchmarket.start();

  before('clear collection (before)', function(done) {
    testUtil.clearMongoCollection(done);
  });

  after('clear collection (after)', function(done) {
    testUtil.clearMongoCollection(done);
  });

  after(benchmarket.store());
  benchmarket.stop();

});
