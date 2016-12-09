var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var RandomActivity = require('happn-random-activity-generator');
var hooks = require('./lib/hooks');

var clusterSize = 20;

describe.only(filename, function () {

  this.timeout(30000);
  benchmarket.start();

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'info';
  });

  hooks.startMultiProcessCluster({
    size: clusterSize
  });


  it('tests random activity', function (done) {
    done();
  });


  hooks.stopMultiProcessCluster();

  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
  });

  after(benchmarket.store());
  benchmarket.stop();

});
