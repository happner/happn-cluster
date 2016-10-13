var path = require('path');
var filename = path.basename(__filename);
var should = require('should');

var Member = require('../lib/services/orchestrator/member');
var MockOrchestrator = require('./mocks/mock-orchestrator');
var mockOpts = require('./mocks/mock-opts');
var MockHappnClient = require('./mocks/mock-happn-client');

describe(filename, function () {

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  before(function () {
    this.orchestrator = new MockOrchestrator(mockOpts);
  });

  beforeEach(function () {
    MockHappnClient.instances = {};
    this.orchestrator.config.replicate = ['/*'];
  });


  context('initialised from remote\'s login.info', function () {

    it('logs back into remote and updates state', function (done) {

      var m = new Member({
        orchestrator: this.orchestrator,
        clusterName: 'cluster-name',
        memberFromLogin: {
          memberId: 'MEMBER_ID',
          url: 'http://10.0.0.2:55000'
        }
      });

      m.connectingTo.should.equal(true);

      // wait for login
      setTimeout(function () {

        should.exist(MockHappnClient.instances['10-0-0-2_55000']);

        m.connectingTo.should.equal(false);
        m.connectedTo.should.equal(true);
        m.connectedFrom.should.equal(false);
        m.name.should.equal('10-0-0-2_55000');

        done();
      }, 20);
    });
  });


  context('initialised from membership (swim) info', function () {

    it('logs back into remote and updates state', function (done) {

      var m = new Member({
        orchestrator: this.orchestrator,
        clusterName: 'cluster-name',
        member: {
          memberId: 'MEMBER_ID',
          url: 'http://10.0.0.2:55000'
        }
      });

      m.connectingTo.should.equal(true);

      setTimeout(function () {

        should.exist(MockHappnClient.instances['10-0-0-2_55000']);

        m.connectingTo.should.equal(false);
        m.connectedTo.should.equal(true);
        m.connectedFrom.should.equal(false);
        m.name.should.equal('10-0-0-2_55000');

        done();
      }, 20);
    });
  });


  context('replication', function () {

    it('subscribes to configured paths to replicate', function (done) {

      var m = new Member({
        orchestrator: this.orchestrator,
        clusterName: 'cluster-name',
        member: {
          memberId: 'MEMBER_ID',
          url: 'http://10.0.0.2:55000'
        }
      });

      setTimeout(function () {

        var replicationClient = MockHappnClient.instances['10-0-0-2_55000'];
        replicationClient.__subscribed.should.eql(['/*']);
        m.subscribedTo.should.equal(true);

        done();
      }, 20);
    });


    it('can subscribe to multiple paths', function (done) {

      this.orchestrator.config.replicate = ['/alternative/*', '/paths/*'];

      var m = new Member({
        orchestrator: this.orchestrator,
        clusterName: 'cluster-name',
        member: {
          memberId: 'MEMBER_ID',
          url: 'http://10.0.0.2:55000'
        }
      });

      setTimeout(function () {

        var replicationClient = MockHappnClient.instances['10-0-0-2_55000'];
        replicationClient.__subscribed.should.eql(['/alternative/*', '/paths/*']);
        m.subscribedTo.should.equal(true);

        done();
      }, 20);
    });


    it('can subscribe to no paths', function (done) {
      this.orchestrator.config.replicate = [];

      var m = new Member({
        orchestrator: this.orchestrator,
        clusterName: 'cluster-name',
        member: {
          memberId: 'MEMBER_ID',
          url: 'http://10.0.0.2:55000'
        }
      });

      setTimeout(function () {

        var replicationClient = MockHappnClient.instances['10-0-0-2_55000'];
        replicationClient.__subscribed.should.eql([]);
        m.subscribedTo.should.equal(true);

        done();
      }, 20);
    });

  });


  context('errors', function () {

    it('sets error on login error', function (done) {

      MockHappnClient.queueLoginError(new Error('login error'));

      var m = new Member({
        orchestrator: this.orchestrator,
        clusterName: 'cluster-name',
        member: {
          memberId: 'MEMBER_ID',
          url: 'http://10.0.0.2:55000'
        }
      });

      this.orchestrator.members[m.memberId] = m;

      setTimeout(function () {

        m.error.message.should.equal('login error');
        done();

      }, 20);
    });


    it('sets error on subscription error', function (done) {

      MockHappnClient.queueSubscriptionError(new Error('subscription error'));

      var m = new Member({
        orchestrator: this.orchestrator,
        clusterName: 'cluster-name',
        member: {
          memberId: 'MEMBER_ID',
          url: 'http://10.0.0.2:55000'
        }
      });

      this.orchestrator.members[m.memberId] = m;

      setTimeout(function () {

        m.error.message.should.equal('subscription error');
        done();

      }, 20);
    });

  });


  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
  });

});
