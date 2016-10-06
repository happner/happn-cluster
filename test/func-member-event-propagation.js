/**
 * Created by grant on 2016/10/04.
 */

var assert = require('assert');
var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var Promise = require('bluebird');

var HappnCluster = require('../');

var testUtil = require('./lib/test-utils');
var clusterSize = 2;

describe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  before('clear collection (before)', function (done) {
    testUtil.clearMongoCollection(done);
  });

  before('start cluster', function (done) {

    var self = this;

    testUtil.createMemberConfigs(clusterSize, false, function (err, result) {

      if (err)
        return done(err);

      self.__configs = result;

      Promise.resolve(self.__configs).map(function (element) {
          return HappnCluster.create(element)
        })
        .then(function (servers) {
          self.servers = servers;
        })
        .then(done)
        .catch(done)
    });
  });


  after('stop cluster', function (done) {
    if (!this.servers) return done();
    Promise.resolve(this.servers).map(function (server) {
        return server.stop();
      })
      .then(function () {
        done();
      })
      .catch(done);
  });


  after('clear collection (after)', function (done) {
    testUtil.clearMongoCollection(done);
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

      testUtil.createClientInstance(member1Host, member1Port, function (err, publisherClient) {

        if (err)
          return done(err);

        testUtil.createClientInstance(member2Host, member2Port, function (err, listenerClient) {

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

  after(benchmarket.store());
  benchmarket.stop();

});
