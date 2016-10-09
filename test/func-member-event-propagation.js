/**
 * Created by grant on 2016/10/04.
 */

var assert = require('assert');
var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var testUtils = require('./lib/test-utils');
var hooks = require('./lib/hooks');

var clusterSize = 2;
var isSecure = false;

describe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  hooks.startCluster({
    size: clusterSize,
    isSecure: isSecure
  });


  it('data set event is propagated to cluster members', function (done) {

    var self = this;

    setTimeout(function () {

      /* EXPECTED PROCESS:
       publisher client → publisher member → publisher backchannel client
       listener client ← listener member ← listener back channel client ↵
       */

      var expectedEventOrigin = self.__configs[0].services.membership.config.clusterName;

      var member1Port = self.__configs[0].services.proxy.config.listenPort;
      var member1Host = self.__configs[0].services.proxy.config.listenHost;

      var member2Port = self.__configs[1].services.proxy.config.listenPort;
      var member2Host = self.__configs[1].services.proxy.config.listenHost;

      var testPath = '/EVENT_PROPAGATION_DATA';
      var testData = {testField: 'testValue'};

      testUtils.createClientInstance(member1Host, member1Port, function (err, publisherClient) {

        if (err)
          return done(err);

        testUtils.createClientInstance(member2Host, member2Port, function (err, listenerClient) {

          if (err)
            return done(err);

          listenerClient.on(testPath + '/*', {event_type: 'set', count: 1}, function (result2, meta) {

            assert(meta.path.indexOf(testPath) > -1);
            assert(meta.eventOrigin != null);
            assert(meta.eventOrigin == expectedEventOrigin);

            done();

          }, function (e) {

            console.log('### setting data from publisher client: ' + member1Host + ':' + member1Port);

            publisherClient.set(testPath + '/test1', testData, null)
              .then(function (result) {
                console.log('### waiting for event propagation to listener...');
              })
              .catch(function (err) {
                return done(err);
              });
          });
        });
      });

    }, 3000);

  });


  hooks.stopCluster();

  after(benchmarket.store());
  benchmarket.stop();

});
