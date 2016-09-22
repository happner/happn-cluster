var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');

describe(filename, function() {

  benchmarket.start();

  it('test', function(done) {
    done();
  });

  after(benchmarket.store());
  benchmarket.stop();

});
