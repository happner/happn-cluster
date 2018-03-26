var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');
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

  it.only('includes isLocal and origin in replication events', function (done) {

    var server1 = this.servers[0];
    var server2 = this.servers[1];

    var received1;
    server1.services.replicator.on('topic/name', function (payload, isLocal, origin) {
      received1 = {
        payload: payload,
        isLocal: isLocal,
        origin: origin
      }
    });

    var received2;
    server2.services.replicator.on('topic/name', function (payload, isLocal, origin) {
      received2 = {
        payload: payload,
        isLocal: isLocal,
        origin: origin
      }
    });

    server1.services.replicator.replicate('topic/name', 'PAYLOAD', function (err) {
      if (err) return done(err);
    });

    setTimeout(function () {

      expect(received1).to.eql({
        payload: 'PAYLOAD',
        isLocal: true,
        origin: server1.name
      });


      expect(received2).to.eql({
        payload: 'PAYLOAD',
        isLocal: false,
        origin: server1.name
      });

      done();

    }, 500);

  });

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

  });

});
