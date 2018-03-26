var path = require('path');
var filename = path.basename(__filename);
var HappnCluster = require('../../');

var hooks = require('../lib/hooks');
var testSequence = parseInt(filename.split('-')[0]);
var clusterSize = 2;
var happnSecure = false;

describe(filename, function () {

  this.timeout(60000);

  hooks.startCluster({
    testSequence: testSequence,
    size: clusterSize,
    happnSecure: happnSecure
  });

  hooks.stopCluster();

  it('can replicate an event throughout the cluster', function (done) {

    this.timeout(3000);

    var servers = this.servers;

    function testReplicate(server, eventName) {

      var replicatedEvents = {};

      function generateEventHandler(i) {
        return function eventHandler(payload) {
          console.log('received event', i, payload);
        }
      }

      for (var i = 0; i < servers.length; i++) {
        var receivingServer = servers[i];
        servers[i].services.replicator.on(eventName, generateEventHandler(i));
      }

      server.services.replicator.replicate(eventName, {pay: 'load'}, function (e) {

        if (e) throw e;

      });

    }

    for (var i = 0; i < servers.length; i++) {

      testReplicate(servers[i], 'event' + i);

    }

    // done();

  });

});
