var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');

var Membership = require('../../lib/services/membership');
var MockSwim = require('../mocks/mock-swim');
var MockHappn = require('../mocks/mock-happn');
var mockOpts = require('../mocks/mock-opts');
var address = require('../../lib/utils/get-address')();

describe(filename, function() {

  before(function() {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  context('initialize', function() {

    it('defaults all but config.hosts', function(done) {

      var m = new Membership(mockOpts);
      m.happn = new MockHappn('http', 9000);

      m.initialize({
        hosts: ['10.10.10.10:11111']
      }, function(e) {
        if (e) return done(e);

        expect(m.config).to.eql({
          clusterName: 'happn-cluster',
          hosts: ['10.10.10.10:11111'],
          seed: false,
          seedWait: 0,
          randomWait: 0,
          host: address,
          port: 56000,
          joinTimeout: 1000,
          pingInterval: 1000,
          pingTimeout: 200,
          pingReqTimeout: 600,
          pingReqGroupSize: 3,
          udp: {
            maxDgramSize: 512
          },
          disseminationFactor: 15
        });
        done();
      });
    });


    it('can assign all config', function(done) {

      var m = new Membership(mockOpts);
      m.happn = new MockHappn('http', 9000);

      m.initialize({
        clusterName: 'seven-sisters',
        hosts: ['10.10.10.10:11111'],
        seed: true,
        seedWait: 200,
        randomWait: 1999,
        host: address + '1',
        port: 9000,
        joinTimeout: 100,
        pingInterval: 100,
        pingTimeout: 20,
        pingReqTimeout: 60,
        pingReqGroupSize: 2,
        udp: {
          maxDgramSize: 768
        },
        disseminationFactor: 13
      }, function(e) {
        if (e) return done(e);

        expect(m.config).to.eql({
          clusterName: 'seven-sisters',
          hosts: ['10.10.10.10:11111'],
          seed: true,
          seedWait: 200,
          randomWait: 1999,
          host: address + '1',
          port: 9000,
          joinTimeout: 100,
          pingInterval: 100,
          pingTimeout: 20,
          pingReqTimeout: 60,
          pingReqGroupSize: 2,
          udp: {
            maxDgramSize: 768
          },
          disseminationFactor: 13
        });
        done();
      });
    });
  });

  context('bootstrap', function() {

    beforeEach(function(done) {
      this.membership = new Membership(mockOpts);
      this.membership.happn = new MockHappn('http', 9000);
      this.membership.Swim = MockSwim;
      this.membership.initialize({
        hosts: ['10.10.10.10:11111']
      }, done);
    });

    beforeEach(function() {
      this.membership.happn = new MockHappn('http', 9000);
    });


    it('assigns host (memberId) and populates meta for remote peers to connect to us',
      function(done) {

        m = this.membership;
        m.bootstrap()
          .then(function() {
            expect(m.swim.__config.local).to.eql({
              host: address + ':56000',
              meta: {
                cluster: 'happn-cluster',
                url: 'http://' + address + ':9000'
              }
            });
            done();
          })
          .catch(done);
      }
    );

    it('rejects the promise on error', function(done) {

      m = this.membership;
      MockSwim.__queueError(new Error('JoinFailedError'));
      m.bootstrap()
        .then(function() {
          throw new Error('not this');
        })
        .catch(function(error) {
          expect(error.message).to.equal('JoinFailedError');
          done();
        })
        .catch(done);
    });


    it('adds and emits all discovered members', function(done) {

      MockSwim.__discoveredMembers = [{
          meta: {
            cluster: 'happn-cluster',
            url: 'http://10.0.0.1:55000'
          },
          host: '10.0.0.1:56000',
          state: 0,
          incarnation: 0
        },
        {
          meta: {
            cluster: 'happn-cluster',
            url: 'http://10.0.0.2:55000'
          },
          host: '10.0.0.2:56000',
          state: 0,
          incarnation: 0
        }
      ];

      var m = this.membership;

      var added = [];

      this.membership.on('add', function(member) {
        added.push(member);
      });

      this.membership.bootstrap()
        .then(function() {
          expect(added).to.eql([{
              memberId: '10.0.0.1:56000',
              url: 'http://10.0.0.1:55000'
            },
            {
              memberId: '10.0.0.2:56000',
              url: 'http://10.0.0.2:55000'
            }
          ]);

          expect(m.members).to.eql({
            '10.0.0.1:56000': {
              url: 'http://10.0.0.1:55000'
            },
            '10.0.0.2:56000': {
              url: 'http://10.0.0.2:55000'
            }
          });

          done();
        })
        .catch(done);

    });

  });

  context('ongoing discovery', function() {

    beforeEach(function(done) {
      this.membership = new Membership(mockOpts);
      this.membership.Swim = MockSwim;
      this.membership.happn = new MockHappn('http', 9000);
      this.membership.initialize({
        hosts: ['10.10.10.10:11111']
      }, done);
    });

    beforeEach(function(done) {
      MockSwim.__discoveredMembers = [{
          meta: {
            cluster: 'happn-cluster',
            url: 'http://10.0.0.1:55000'
          },
          host: '10.0.0.1:56000',
          state: 0,
          incarnation: 0
        },
        {
          meta: {
            cluster: 'happn-cluster',
            url: 'http://10.0.0.2:55000'
          },
          host: '10.0.0.2:56000',
          state: 0,
          incarnation: 0
        }
      ];

      this.membership.happn = new MockHappn('http', 9000);
      this.membership.bootstrap()
        .then(done)
        .catch(done);
    });


    it('removes and emits as members depart', function(done) {

      var m = this.membership;

      this.membership.on('remove', function(member) {
        expect(member).to.eql({
          memberId: '10.0.0.1:56000'
        });

        expect(m.members).to.eql({
          '10.0.0.2:56000': {
            url: 'http://10.0.0.2:55000'
          }
        });

        done();
      });

      this.membership.swim.__emitUpdate({
        meta: {
          cluster: 'happn-cluster',
          url: 'http://10.0.0.1:55000'
        },
        host: '10.0.0.1:56000',
        state: 2, // <-------------- faulty
        incarnation: 0
      });
    });


    it('adds and emits as members arrive', function(done) {

      var m = this.membership;

      this.membership.on('add', function(member) {
        expect(member).to.eql({
          memberId: '10.0.0.3:56000',
          url: 'http://10.0.0.3:55000'
        });

        expect(m.members).to.eql({
          '10.0.0.1:56000': {
            url: 'http://10.0.0.1:55000'
          },
          '10.0.0.2:56000': {
            url: 'http://10.0.0.2:55000'
          },
          '10.0.0.3:56000': {
            url: 'http://10.0.0.3:55000'
          },
        });

        done();
      });

      this.membership.swim.__emitUpdate({
        meta: {
          cluster: 'happn-cluster',
          url: 'http://10.0.0.3:55000'
        },
        host: '10.0.0.3:56000', // <--- new
        state: 0, // <----------------- online
        incarnation: 0
      });
    });


    it('ignores self', function(done) {

      var added = false,
        m = this.membership;

      this.membership.on('add', function() {
        added = true;
      });

      this.membership.swim.__emitUpdate({
        meta: {
          cluster: 'happn-cluster',
          url: 'http://' + address + ':55000'
        },
        host: address + ':56000', // <--- self
        state: 0,
        incarnation: 0
      });

      setTimeout(function() {
        expect(Object.keys(m.members).length).to.equal(2);
        expect(added).to.equal(false);
        done();
      }, 10);
    });


    it('ignore wrong cluster', function(done) {

      var added = false,
        m = this.membership;

      this.membership.on('add', function() {
        added = true;
      });

      this.membership.swim.__emitUpdate({
        meta: {
          cluster: 'wrong-cluster-name',
          url: 'http://10.0.0.4:55000'
        },
        host: '10.0.0.4:56000',
        state: 0,
        incarnation: 0
      });

      setTimeout(function() {
        expect(Object.keys(m.members).length).to.equal(2);
        expect(added).to.equal(false);
        done();
      }, 10);
    });


    it('ignores already removed members', function(done) {

      var removed = false,
        m = this.membership;
      this.membership.on('remove', function() {
        removed = true;
      });

      this.membership.swim.__emitUpdate({
        meta: {
          cluster: 'happn-cluster',
          url: 'http://10.0.0.9:55000'
        },
        host: '10.0.0.9:56000',
        state: 2,
        incarnation: 0
      });

      setTimeout(function() {
        expect(Object.keys(m.members).length).to.equal(2);
        expect(removed).to.equal(false);
        done();
      }, 10);
    });


    it('ignores already added members', function(done) {

      var added = false,
        m = this.membership;

      this.membership.on('add', function() {
        added = true;
      });

      this.membership.swim.__emitUpdate({
        meta: {
          cluster: 'happn-cluster',
          url: 'http://10.0.0.1:55000'
        },
        host: '10.0.0.1:56000',
        state: 0,
        incarnation: 0
      });

      setTimeout(function() {
        expect(Object.keys(m.members).length).to.equal(2);
        expect(added).to.equal(false);
        done();
      }, 10);
    });

  });


  context('stop', function() {

    beforeEach(function(done) {
      this.membership = new Membership(mockOpts);
      this.membership.Swim = MockSwim;
      this.membership.happn = new MockHappn('http', 9000);
      this.membership.initialize({
        hosts: ['10.10.10.10:11111']
      }, done);
    });

    beforeEach(function(done) {
      MockSwim.__discoveredMembers = [];
      this.membership.happn = new MockHappn('http', 9000);
      this.membership.bootstrap()
        .then(done)
        .catch(done);
    });

    it('stops swim', function(done) {

      var left = false;

      this.membership.swim.leave = function() {
        left = true;
      };

      this.membership.stop(function() {
        expect(left).to.equal(true);
        done();
      });
    });

  });

  context('persist members', function() {

    it('intializes with persistMembers:true, persists a member, then fetches members', function(done) {

      var membership = new Membership(mockOpts);
      var persistedMember = null;

      membership.happn = new MockHappn('http', 9000, {
        upsert: function(path, data, callback) {
          if (path.indexOf('/_SYSTEM/_CLUSTER/MEMBERS') == 0) {
            persistedMember = data;
          }
          callback(null);
        },
        get: function(path, callback) {
          return callback(null, [{
            data: persistedMember
          }]);
        }
      });

      membership.initialize({
        persistMembers: true
      }, function(e) {

        membership.persistMember({
          host: '127.0.0.1:12000'
        });

        setTimeout(function() {
          membership.fetchPersistedMembers(function(e, members) {
            expect(e).to.be(null);
            expect(members).to.eql([{
              data: {
                host: '127.0.0.1:12000'
              }
            }]);
            done();
          });
        }, 1000);
      });
    });

    it('intializes with persistMembers:true, persists a member, then concats members', function(done) {

      var membership = new Membership(mockOpts);
      var persistedMember = null;

      membership.happn = new MockHappn('http', 9000, {
        upsert: function(path, data, callback) {
          if (path.indexOf('/_SYSTEM/_CLUSTER/MEMBERS') == 0) {
            persistedMember = data;
          }
          callback(null);
        },
        get: function(path, callback) {
          return callback(null, [{
            data: persistedMember
          }]);
        }
      });

      membership.initialize({
        persistMembers: true,
        hosts: ['127.0.0.1:12001']
      }, function(e) {

        membership.persistMember({
          host: '127.0.0.1:12000'
        });

        setTimeout(function() {
          membership.concatPersistedHosts(function(e, hosts) {
            expect(e).to.be(null);
            expect(hosts.sort()).to.eql(['127.0.0.1:12000', '127.0.0.1:12001']);
            done();
          });
        }, 1000);
      });
    });

    it('intializes with persistMembers:true, persists a member, then concats members, checks we dedup already configured hosts', function(done) {

      var membership = new Membership(mockOpts);
      var persistedMembers = [];

      membership.happn = new MockHappn('http', 9000, {
        upsert: function(path, data, callback) {
          if (path.indexOf('/_SYSTEM/_CLUSTER/MEMBERS') == 0) {
            persistedMembers.push({data:data});
          }
          callback(null);
        },
        get: function(path, callback) {
          return callback(null, persistedMembers);
        }
      });

      membership.initialize({
        persistMembers: true,
        hosts: ['127.0.0.1:12001', '127.0.0.1:12002']
      }, function(e) {

        membership.persistMember({
          host: '127.0.0.1:12000'
        });

        membership.persistMember({
          host: '127.0.0.1:12002'
        });

        setTimeout(function() {
          membership.concatPersistedHosts(function(e, hosts) {
            expect(e).to.be(null);
            expect(hosts.sort()).to.eql(['127.0.0.1:12000', '127.0.0.1:12001', '127.0.0.1:12002']);
            done();
          });
        }, 1000);
      });
    });

    it('intializes with persistMembers:undefined, persists a member, then concats no extra members', function(done) {

      var membership = new Membership(mockOpts);
      var persistedMember = null;

      membership.happn = new MockHappn('http', 9000, {
        upsert: function(path, data, callback) {
          if (path.indexOf('/_SYSTEM/_CLUSTER/MEMBERS') == 0) {
            persistedMember = data;
          }
          callback(null);
        },
        get: function(path, callback) {
          return callback(null, [{
            data: persistedMember
          }]);
        }
      });

      membership.initialize({
        hosts: ['127.0.0.1:12001']
      }, function(e) {

        membership.persistMember({
          host: '127.0.0.1:12000'
        });

        setTimeout(function() {
          membership.concatPersistedHosts(function(e, hosts) {
            expect(e).to.be(null);
            expect(hosts.sort()).to.eql(['127.0.0.1:12001']);
            done();
          });
        }, 1000);
      });
    });

    it('intializes with persistMembers:false, persists a member, then concats no extra members', function(done) {

      var membership = new Membership(mockOpts);
      var persistedMember = null;

      membership.happn = new MockHappn('http', 9000, {
        upsert: function(path, data, callback) {
          if (path.indexOf('/_SYSTEM/_CLUSTER/MEMBERS') == 0) {
            persistedMember = data;
          }
          callback(null);
        },
        get: function(path, callback) {
          return callback(null, [{
            data: persistedMember
          }]);
        }
      });

      membership.initialize({
        persistMembers: false,
        hosts: ['127.0.0.1:12001']
      }, function(e) {
        membership.persistMember({
          host: '127.0.0.1:12000'
        });

        setTimeout(function() {
          membership.concatPersistedHosts(function(e, hosts) {
            expect(e).to.be(null);
            expect(hosts.sort()).to.eql(['127.0.0.1:12001']);
            done();
          });
        }, 1000);
      });
    });

    it('intializes with persistMembers:true, persists duplicate members, we ensure that the members are deduplicated by address', function(done) {

      var membership = new Membership(mockOpts);
      var dedupPersistedMembers = {};
      var persistedMembers = [];

      membership.happn = new MockHappn('http', 9000, {
        upsert: function(path, data, callback) {
          if (path.indexOf('/_SYSTEM/_CLUSTER/MEMBERS') == 0 && !dedupPersistedMembers[path]) {
            dedupPersistedMembers[path] = true;
            persistedMembers.push({data:data});
          }
          callback(null);
        },
        get: function(path, callback) {
          return callback(null, persistedMembers);
        }
      });

      membership.initialize({
        swimAddress: '127.0.0.1:11000',
        persistMembers: true,
        hosts: ['127.0.0.1:12001', '127.0.0.1:12002']
      }, function(e) {

        membership.persistMember({
          host: '127.0.0.1:12000'
        });

        membership.persistMember({
          host: '127.0.0.1:12000'
        });

        membership.persistMember({
          host: '127.0.0.1:12000'
        });

        setTimeout(function() {
          membership.fetchPersistedMembers(function(e, members) {
            expect(e).to.be(null);
            expect(members).to.eql([{data:{host:'127.0.0.1:12000'}}]);
            done();
          });
        }, 1000);
      });
    });

    it('bootstraps with persistMembers:true, database failure on fetching members', function(done) {

      var membership = new Membership(mockOpts);
      var dedupPersistedMembers = {};
      var persistedMembers = [];

      membership.happn = new MockHappn('http', 9000, {
        upsert: function(path, data, callback) {
          if (path.indexOf('/_SYSTEM/_CLUSTER/MEMBERS') == 0 && !dedupPersistedMembers[path]) {
            dedupPersistedMembers[path] = true;
            persistedMembers.push({data:data});
          }
          callback(null);
        },
        get: function(path, callback) {
          return callback(new Error('test error: ' + path));
        }
      });

      membership.initialize({
        swimAddress: '127.0.0.1:11000',
        persistMembers: true,
        hosts: ['127.0.0.1:12001', '127.0.0.1:12002']
      }, function(e) {
        if (e) return done(e);
        membership.bootstrap(function(e){
          expect(e.toString()).to.be('Error: test error: /_SYSTEM/_CLUSTER/MEMBERS/192.168.1.163:9000/*');
          done();
        });
      });
    });
  });

  after(function() {
    process.env.LOG_LEVEL = this.logLevel;
  });

});
