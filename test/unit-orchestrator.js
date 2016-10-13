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

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  context('initialise', function () {


    it('subscribes to happn server connection events', function (done) {

      var o = new Orchestrator(mockOpts);
      o.happn = new MockHappn('http', 9000);

      o.initialize({}, function (e) {
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

      o.initialize({}, function (e) {
        if (e) return done(e);

        o.config.should.eql({
          minimumPeers: 1,
          replicate: ['/*'],
          stableReportInterval: 5000,
          stabiliseTimeout: 120000
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
      }, function (e) {
        if (e) return done(e);

        o.config.should.eql({
          minimumPeers: 3,
          replicate: [],
          stableReportInterval: 10000,
          stabiliseTimeout: 120000
        });

        done();
      });
    });

    context('reduce replication paths', function() {

      var o;

      beforeEach(function() {
        o = new Orchestrator(mockOpts);
        o.happn = new MockHappn('http', 9000);
      });

      it('removes duplicate paths', function(done) {

        o.initialize({
          replicate: [
            '/same/path',
            '/same/path'
          ]
        }, function(e) {
          if (e) return done(e);

          o.config.replicate.should.eql(['/same/path']);
          done();

        });
      });

      it('collapses simple wildcard paths (forward)', function (done) {
        o.initialize({
          replicate: [
            '/same/*',
            '/same/path'
          ]
        }, function(e) {
          if (e) return done(e);

          o.config.replicate.should.eql(['/same/*']);
          done();

        });
      });

      it('collapses simple wildcard paths (backwards)', function (done) {
        o.initialize({
          replicate: [
            '/same/path',
            '/same/*'
          ]
        }, function(e) {
          if (e) return done(e);

          o.config.replicate.should.eql(['/same/*']);
          done();

        });
      });

      it('collapses complicated wildcard paths (forward)', function (done) {
        o.initialize({
          replicate: [
            '/same/*/with/*/more',
            '/same/path',
            '/same/path/with/some/more'
          ]
        }, function(e) {
          if (e) return done(e);

          o.config.replicate.should.eql([
            '/same/*/with/*/more',
            '/same/path'
          ]);
          done();

        });
      });

      it('collapses complicated wildcard paths (reverse)', function (done) {
        o.initialize({
          replicate: [
            '/same/path/with/some/more',
            '/same/*/with/*/more',
            '/same/path/*'
          ]
        }, function(e) {
          if (e) return done(e);

          o.config.replicate.should.eql([
            '/same/*/with/*/more',
            '/same/path/*'
          ]);
          done();

        });
      });

      it('does the obvious', function (done) {
        o.initialize({
          replicate: [
            '/same/*/with/some/more',
            '/same/path/with/*/more',
            '/same/path',
            '/*'
          ]
        }, function(e) {
          if (e) return done(e);

          o.config.replicate.should.eql([
            '/*'
          ]);
          done();

        });
      });

      it('is idiot proof', function (done) {
        o.initialize({
          replicate: [
            '/*/*/*/*/*/*/*/*/*',
            '/*/*/*/*/*/*/*/*',
            '/*/*/*/*/*/*/*',
            '/*/*/*/*/*/*',
            '/*/*/*/*/*',
            '/*/*/*/*',
            '/*/*/*',
            '/*/*',
            '/*'
          ]
        }, function(e) {
          if (e) return done(e);

          o.config.replicate.should.eql([
            '/*'
          ]);
          done();

        });
      });
    });
  });


  context('stop', function () {

    it('stops all members', function (done) {

      var o = new Orchestrator(mockOpts);
      o.happn = new MockHappn('http', 9000);

      var stopped = 0;

      var stop = function () {
        return new Promise(function (resolve, reject) {
          stopped++;
          resolve();
        });
      };

      o.initialize({}, function (e) {
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
        };

        o.stop(function (e) {
          if (e) return done(e);
          stopped.should.equal(3);
          done()
        })

      });
    });

  });


  context('prepare', function () {

    var o;

    beforeEach(function (done) {
      o = new Orchestrator(mockOpts);
      o.happn = new MockHappn('http', 9000);
      o.HappnClient = MockHappnClient;
      o.initialize({}, done);
    });


    it('prepares loginConfig for inter-cluster happn client logins',
      function (done) {

        o.prepare()
          .then(function () {

            o.loginConfig.should.eql({
              config: {},
              info: {
                clusterName: 'cluster-name',
                memberId: 'MEMBER_ID',
                name: 'local-happn-instance',
                url: 'http://' + address + ':9000'
              }
            });

            done();
          })
          .catch(done)
      }
    );


    it('it subscribes to membership events', function (done) {

      o.prepare()
        .then(function () {

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


    it('connects intra-process client to self', function (done) {

      o.prepare()
        .then(function () {

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


  context('stabilised', function () {

    var o;

    beforeEach(function () {
      MockHappnClient.instances = {};
    });

    beforeEach(function (done) {
      o = new Orchestrator(mockOpts);
      o.happn = new MockHappn('http', 9000);
      o.HappnClient = MockHappnClient;
      o.initialize({}, function (e) {
        if (e) return done(e);
        o.prepare()
          .then(done)
          .catch(done);
      });
    });

    context('first member in cluster', function () {

      it('immediately stabilises with only self as member', function (done) {

        o.stabilised()
          .then(function () {

            Object.keys(o.peers).should.eql(['local-happn-instance']);
            o.peers.__self.should.equal(o.peers['local-happn-instance']);

            done();
          })
          .catch(done);
      });

      it('pends stabilise if minimumPeers is set', function (done) {
        var stable = false;

        o.config.minimumPeers = 2;

        o.stabilised()
          .then(function () {
            stable = true;
          })
          .catch(done);

        setTimeout(function () {

          // stabilised() has not resolved
          stable.should.equal(false);

          // new member discovered
          MockMembership.instance.emit('add', {
            memberId: '10.0.0.1:56001',
            url: 'http://10.0.0.1:55001'
          });

          // member record was added
          should.exist(o.members['10.0.0.1:56001']); // SWIM host as key

          // peer record was not added
          should.not.exist(o.peers['10-0-0-1_55001']);

          // wait for member login to remote
          setTimeout(function () {

            // member logged in to remote
            should.exist(MockHappnClient.instances['10-0-0-1_55001']); // remote happn.name as key

            // member state is correct
            o.members['10.0.0.1:56001'].connectingTo.should.equal(false);
            o.members['10.0.0.1:56001'].connectedTo.should.equal(true);
            o.members['10.0.0.1:56001'].connectedFrom.should.equal(false); // <---- pending login back to us
            o.members['10.0.0.1:56001'].subscribedTo.should.equal(true);
            o.members['10.0.0.1:56001'].subscribedFrom.should.equal(true);

            // THEN... peer logs back into us
            MockPubsub.instance.emit('authentic', {
              info: {
                name: '10-0-0-1_55001',
                clusterName: 'cluster-name',
                memberId: '10.0.0.1:56001',
                url: 'http://10.0.0.1:55001'
              }
            });

            o.members['10.0.0.1:56001'].connectedFrom.should.equal(true); // <---- pending login done

            // added as peer
            should.exist(o.peers['10-0-0-1_55001']);

            // stabilised() has resolved (got 2 peers, self + 1)
            stable.should.equal(true);
            done();

          }, 20);

        }, 20);
      });
    });


    context('multiple other members discovered (from swim bootstrap)', function () {

      // sometimes SWIM is first to inform of remote member

      it('pends stabilise until all are connected to and from', function (done) {

        MockMembership.instance.emit('add', {
          memberId: '10.0.0.1:56001',
          url: 'http://10.0.0.1:55001'
        });

        MockMembership.instance.emit('add', {
          memberId: '10.0.0.2:56001',
          url: 'http://10.0.0.2:55001'
        });

        MockMembership.instance.emit('add', {
          memberId: '10.0.0.3:56001',
          url: 'http://10.0.0.3:55001'
        });

        // members already (immediately) created on discovery
        should.exist(o.members['10.0.0.1:56001']);
        should.exist(o.members['10.0.0.2:56001']);
        should.exist(o.members['10.0.0.3:56001']);

        // wait for member logins to remote peers
        setTimeout(function () {

          should.exist(MockHappnClient.instances['10-0-0-1_55001']);
          should.exist(MockHappnClient.instances['10-0-0-2_55001']);
          should.exist(MockHappnClient.instances['10-0-0-3_55001']);

          var stable = false;

          o.stabilised()
            .then(function () {
              stable = true;
            })
            .catch(done);

          setTimeout(function () {

            stable.should.equal(false);

            // remotes log back into us
            MockPubsub.instance.emit('authentic', {
              info: {
                name: '10-0-0-1_55001',
                clusterName: 'cluster-name',
                memberId: '10.0.0.1:56001',
                url: 'http://10.0.0.1:55001'
              }
            });

            stable.should.equal(false);

            MockPubsub.instance.emit('authentic', {
              info: {
                name: '10-0-0-2_55001',
                clusterName: 'cluster-name',
                memberId: '10.0.0.2:56001',
                url: 'http://10.0.0.2:55001'
              }
            });

            stable.should.equal(false);

            MockPubsub.instance.emit('authentic', {
              info: {
                name: '10-0-0-3_55001',
                clusterName: 'cluster-name',
                memberId: '10.0.0.3:56001',
                url: 'http://10.0.0.3:55001'
              }
            });

            stable.should.equal(true);
            done();

          }, 20);
        }, 20);
      });

    });


    context('multiple other members discovered (from happn login to us)', function () {

      // sometimes remote peers logging into us is first to inform of remote member

      it('pends stabilise until all are connected to and from', function (done) {

        Object.keys(o.members).should.eql(['__self']);

        // discover members from their login to us

        MockPubsub.instance.emit('authentic', {
          info: {
            name: '10-0-0-1_55001',
            clusterName: 'cluster-name',
            memberId: '10.0.0.1:56001',
            url: 'http://10.0.0.1:55001'
          }
        });

        MockPubsub.instance.emit('authentic', {
          info: {
            name: '10-0-0-2_55001',
            clusterName: 'cluster-name',
            memberId: '10.0.0.2:56001',
            url: 'http://10.0.0.2:55001'
          }
        });

        MockPubsub.instance.emit('authentic', {
          info: {
            name: '10-0-0-3_55001',
            clusterName: 'cluster-name',
            memberId: '10.0.0.3:56001',
            url: 'http://10.0.0.3:55001'
          }
        });

        Object.keys(o.members).should.eql([
          '__self',
          '10.0.0.1:56001',
          '10.0.0.2:56001',
          '10.0.0.3:56001'
        ]);

        should.exist(o.members['10.0.0.1:56001']);
        should.exist(o.members['10.0.0.2:56001']);
        should.exist(o.members['10.0.0.3:56001']);


        // wait for members to login to remote peers
        setTimeout(function () {
          should.exist(MockHappnClient.instances['10-0-0-1_55001']);
          should.exist(MockHappnClient.instances['10-0-0-2_55001']);
          should.exist(MockHappnClient.instances['10-0-0-3_55001']);

          // then discover same + 1 members from swim
          MockMembership.instance.emit('add', {
            memberId: '10.0.0.1:56001',
            url: 'http://10.0.0.1:55001'
          });

          MockMembership.instance.emit('add', {
            memberId: '10.0.0.2:56001',
            url: 'http://10.0.0.2:55001'
          });

          MockMembership.instance.emit('add', {
            memberId: '10.0.0.3:56001',
            url: 'http://10.0.0.3:55001'
          });

          MockMembership.instance.emit('add', {
            memberId: '10.0.0.4:56001',
            url: 'http://10.0.0.4:55001'
          });

          var stable = false;
          o.stabilised()
            .then(function () {
              stable = true;
            })
            .catch(done);

          setTimeout(function () {

            stable.should.equal(false);

            // correction: socket reports last member actually gone
            MockHappnClient.instances['10-0-0-4_55001'].emitDisconnect();
            stable.should.equal(false);

            // correction confirmed: swim reports last member actually gone
            MockMembership.instance.emit('remove', {
              memberId: '10.0.0.4:56001'
            });

            setTimeout(function () {

              // no longer waiting for 4 peer
              stable.should.equal(true);
              done();

            }, 20);
          }, 20);
        }, 20);
      });
    });


    context('event peer/add', function () {

      it('is emitted when a member becomes fully connected', function (done) {

        var emitted = {};
        o.on('peer/add', function (name, member) {
          if (name == 'local-happn-instance') return;
          emitted.name = name;
          emitted.member = member;
        });

        MockMembership.instance.emit('add', {
          memberId: '10.0.0.1:56001',
          url: 'http://10.0.0.1:55001'
        });

        setTimeout(function () {

          // not emitted on new member
          emitted.should.eql({});
          Object.keys(o.peers).should.eql(['local-happn-instance']);

          // but is emitted once new member fully connected (per login back)
          MockPubsub.instance.emit('authentic', {
            info: {
              name: '10-0-0-1_55001',
              clusterName: 'cluster-name',
              memberId: '10.0.0.1:56001',
              url: 'http://10.0.0.1:55001'
            }
          });

          emitted.should.eql({
            name: '10-0-0-1_55001',
            member: o.peers['10-0-0-1_55001']
          });
          done();

        }, 20);
      });

    });

    context('event peer/remove', function () {

      it('is emitted when a peer socket disconnects from us', function (done) {

        MockMembership.instance.emit('add', {
          memberId: '10.0.0.1:56001',
          url: 'http://10.0.0.1:55001'
        });

        MockPubsub.instance.emit('authentic', {
          info: {
            name: '10-0-0-1_55001',
            clusterName: 'cluster-name',
            memberId: '10.0.0.1:56001',
            url: 'http://10.0.0.1:55001'
          }
        });

        // wait for login
        setTimeout(function () {

          should.exist(o.peers['10-0-0-1_55001']);

          var happnClient = MockHappnClient.instances['10-0-0-1_55001'];

          o.on('peer/remove', function (name, member) {

            name.should.equal('10-0-0-1_55001');

            // it remains a member (reconnect loop) ...
            member.should.equal(o.members['10.0.0.1:56001']);

            // ...until our client disconnects
            MockHappnClient.instances['10-0-0-1_55001'].emitDisconnect();
            should.exist(o.members['10.0.0.1:56001']);

            // ...and swim confirms
            MockMembership.instance.emit('remove', {
              memberId: '10.0.0.1:56001'
            });

            setTimeout(function () {
              should.not.exist(o.members['10.0.0.1:56001']);
              happnClient.destroyed.should.equal(true);
              done();
            }, 20);

          });

          MockPubsub.instance.emit('disconnect', {
            info: {
              name: '10-0-0-1_55001',
              clusterName: 'cluster-name',
              memberId: '10.0.0.1:56001',
              url: 'http://10.0.0.1:55001'
            }
          });

        }, 20);
      });


      it('is emitted when our socket to the peer disconnects', function (done) {

        MockMembership.instance.emit('add', {
          memberId: '10.0.0.1:56001',
          url: 'http://10.0.0.1:55001'
        });

        MockPubsub.instance.emit('authentic', {
          info: {
            name: '10-0-0-1_55001',
            clusterName: 'cluster-name',
            memberId: '10.0.0.1:56001',
            url: 'http://10.0.0.1:55001'
          }
        });

        setTimeout(function () {

          should.exist(o.peers['10-0-0-1_55001']);

          o.on('peer/remove', function (name, member) {

            name.should.equal('10-0-0-1_55001');
            member.should.equal(o.members['10.0.0.1:56001']);
            done();

          });

          MockHappnClient.instances['10-0-0-1_55001'].emitDisconnect();

        }, 20);
      });

      it('is NOT emitted when swim reports departure but sockets are connected', function (done) {
        // swim flaps when large numbers of new members get added at once
        // so it gets ignored if peer (happn client) sockets are still connected
        // (ws pingpong will pick up the slack)

        MockMembership.instance.emit('add', {
          memberId: '10.0.0.1:56001',
          url: 'http://10.0.0.1:55001'
        });

        MockPubsub.instance.emit('authentic', {
          info: {
            name: '10-0-0-1_55001',
            clusterName: 'cluster-name',
            memberId: '10.0.0.1:56001',
            url: 'http://10.0.0.1:55001'
          }
        });

        setTimeout(function () {

          should.exist(o.peers['10-0-0-1_55001']);

          var removed = false;
          o.on('peer/remove', function () {
            removed = true;
          });

          MockMembership.instance.emit('remove', {
            memberId: '10.0.0.1:56001'
          });

          setTimeout(function () {
            removed.should.equal(false);
            done();
          }, 20);
        }, 20);
      });
    });


    context('errors', function () {

      it('on login error stabilise also fails', function (done) {

        MockHappnClient.queueLoginError(new Error('oh no login'));

        MockMembership.instance.emit('add', {
          memberId: '10.0.0.1:56001',
          url: 'http://10.0.0.1:55001'
        });

        o.stabilised()
          .then(function () {
            throw new Error('not this');
          })
          .catch(function (error) {
            error.message.should.equal('oh no login');
            done();
          })
          .catch(done);
      });


      it('on subscription error stabilise also fails', function (done) {

        MockHappnClient.queueSubscriptionError(new Error('oh no subscribe'));

        MockMembership.instance.emit('add', {
          memberId: '10.0.0.1:56001',
          url: 'http://10.0.0.1:55001'
        });

        o.stabilised()
          .then(function () {
            throw new Error('not this');
          })
          .catch(function (error) {
            error.message.should.equal('oh no subscribe');
            done();
          });
      });


      it('on ECONNREFUSED the member is removed as departed', function (done) {

        var e = new Error('connection refused');
        e.code = 'ECONNREFUSED';
        MockHappnClient.queueLoginError(e);

        MockMembership.instance.emit('add', {
          memberId: '10.0.0.1:56001',
          url: 'http://10.0.0.1:55001'
        });

        o.stabilised()
          .then(function () {
            // stabilises, unaffected by ECONNREFUSED (member is gone)
            done()
          })
          .catch(done);
      });
    });

  });


  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
  });

});
