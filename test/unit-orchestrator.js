var path = require('path');
var filename = path.basename(__filename);
var should = require('should');
var Promise = require('bluebird');
var Happn = require('happn');

var Orchestrator = require('../lib/services/orchestrator');
var MockHappn = require('./mocks/mock-happn');
var MockHappnClient = require('./mocks/mock-happn-client');
var MockPubsub = require('./mocks/mock-pubsub');
var MockMembership = require('./mocks/mock-membership');
var mockOpts = require('./mocks/mock-opts');
var address = require('../lib/utils/get-address')();

describe(filename, function () {

  before(function() {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  context('initialise', function () {


    it('subscribes to happn server connection events', function(done) {

      var o = new Orchestrator(mockOpts);
      o.happn = new MockHappn('http', 9000);

      o.initialize({}, function(e) {
        if (e) return done(e);

        MockPubsub.instance._events.authentic.should.eql(
          o.__onConnectionFromHandler
        );
        MockPubsub.instance._events.disconnect.should.eql(
          o.__onDisconnectionFromHandler
        );

        done();
      });
    });


    it('defaults config', function (done) {

      var o = new Orchestrator(mockOpts);
      o.happn = new MockHappn('http', 9000);

      o.initialize({}, function(e) {
        if (e) return done(e);

        o.config.should.eql({
          minimumPeers: 1,
          replicate: ['/*'],
          stableReportInterval: 5000
        });

        done();
      });
    });


    it('can assign all config', function (done) {

      var o = new Orchestrator(mockOpts);
      o.happn = new MockHappn('http', 9000);

      o.initialize({
        minimumPeers: 3,
        replicate: [],
        stableReportInterval: 10000
      }, function(e) {
        if (e) return done(e);

        o.config.should.eql({
          minimumPeers: 3,
          replicate: [],
          stableReportInterval: 10000
        });

        done();
      });
    });

  });


  context('stop', function() {

    it('stops all members', function(done) {

      var o = new Orchestrator(mockOpts);
      o.happn = new MockHappn('http', 9000);

      var stopped = 0;

      var stop = function() {
        return new Promise(function(resolve, reject) {
          stopped++;
          resolve();
        });
      };

      o.initialize({}, function(e) {
        if (e) return done(e);

        o.members = {
          'memberId1': {
            stop: stop
          },
          'memberId2': {
            stop: stop
          },
          'memberId3': {
            stop: stop
          }
        }

        o.stop(function(e) {
          if (e) return done(e);
          stopped.should.equal(3);
          done()
        })

      });
    });

  });


  context('prepare', function() {

    var o;

    beforeEach(function(done) {
      o = new Orchestrator(mockOpts);
      o.happn = new MockHappn('http', 9000);
      o.HappnClient = MockHappnClient;
      o.initialize({}, done);
    });


    it('prepares loginConfig for inter-cluster happn client logins',
      function(done) {

        o.prepare()
          .then(function() {

            o.loginConfig.should.eql({
              config: {},
              info: {
                clusterName: 'cluster-name',
                memberId: 'MEMBER_ID',
                name: 'happn-instance-name',
                url: 'http://' + address + ':9000'
              }
            });

            done();
          })
          .catch(done)
      }
    );


    it('it subscribes to membership events', function(done) {

      o.prepare()
        .then(function() {

          MockMembership.instance._events.add.should.eql(
            o.__addMembershipHandler
          );
          MockMembership.instance._events.remove.should.eql(
            o.__removeMembershipHandler
          );

          done();
        })
        .catch(done);
    });


    it('connects intra-process client to self', function(done) {

      o.prepare()
        .then(function() {

          MockHappnClient.getLastLoginConfig().should.eql({
            config: {},
            context: o.happn,
            plugin: Happn.client_plugins.intra_process
          });

          done();
        })
        .catch(done);
    });

  });


  context('stabilise', function() {

    

  });


  after(function() {
    process.env.LOG_LEVEL = this.logLevel;
  });

});
