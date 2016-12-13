var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');
var expect = require('expect.js');
var Promise = require('bluebird');
var Happn = require('happn-3');

var hooks = require('./lib/hooks');

var testSequence = parseInt(filename.split('-')[0]);
var clusterSize = 3;
var happnSecure = true;

describe(filename, function () {

  this.timeout(30000);

  benchmarket.start();

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  hooks.startCluster({
    testSequence: testSequence,
    size: clusterSize,
    happnSecure: happnSecure
  });

  before('connect a client to each server', function (done) {
    var _this = this;
    Promise.resolve(this.__configs).map(function (config) {
      var loginConfig = {
        config: {
          secure: happnSecure,
          host: config.services.proxy.config.host,
          port: config.services.proxy.config.port,
          protocol: 'http',
          username: config.services.security.config.adminUser.username,
          password: config.services.security.config.adminUser.password
        }
      };

      return Happn.client.create(loginConfig);
    })
      .then(function (clients) {
        clients.forEach(function (client) {
          client.onAsync = Promise.promisify(client.on);
        });
        _this.clients = clients;
        done();
      })
      .catch(done);
  });

  after('disconnect all clients', function (done) {
    if (!this.clients) return done();
    Promise.resolve(this.clients).map(function (client) {
      return client.disconnect();
    })
      .then(function () {
        done();
      })
      .catch(done);
  });

  context('on set events', function () {

    it('replicates with wildcards', function (done) {

      // first client is the "control", it does the emits so its events appear the
      // way all other client's events should appear: If properly replicated!

      var _this = this;
      var unpause, fail;
      var controlEvent, replicatedEvents = [];

      Promise.resolve()

        .then(function () {
          return Promise.resolve(_this.clients).map(function (client, i) {
            return client.onAsync('/some/*/set', function (data, meta) {
              delete meta.sessionId; // not the same across events
              if (i == 0) {
                controlEvent = {
                  data: data,
                  meta: meta
                };
              } else {
                replicatedEvents.push({
                  data: data,
                  meta: meta
                });
              }
              if (controlEvent && replicatedEvents.length == clusterSize - 1) {
                setTimeout(function () {
                  unpause();
                }, 100);
              }
            });
          });
        })

        .then(function () {
          return _this.clients[0].set('/some/path/to/set', {some: 'data'});
        })

        .then(function () {
          return new Promise(function (resolve, reject) {
            unpause = resolve;
            fail = reject;
          });
        })

        .then(function () {
          for (var i = 0; i < replicatedEvents.length; i++) {
            expect(replicatedEvents[i]).to.eql(controlEvent);
          }
        })

        .then(done).catch(done);

    });

    it('replicates without wildcards', function (done) {

      var _this = this;
      var unpause, fail;
      var controlEvent, replicatedEvents = [];

      Promise.resolve()

        .then(function () {
          return Promise.resolve(_this.clients).map(function (client, i) {
            return client.onAsync('/some/path/to/set/on', function (data, meta) {
              delete meta.sessionId;
              if (i == 0) {
                controlEvent = {
                  data: data,
                  meta: meta
                };
              } else {
                replicatedEvents.push({
                  data: data,
                  meta: meta
                });
              }
              if (controlEvent && replicatedEvents.length == clusterSize - 1) {
                setTimeout(function () {
                  unpause();
                }, 100);
              }
            });
          });
        })

        .then(function () {
          return _this.clients[0].set('/some/path/to/set/on', {some: 'data'});
        })

        .then(function () {
          return new Promise(function (resolve, reject) {
            unpause = resolve;
            fail = reject;
          });
        })

        .then(function () {
          for (var i = 0; i < replicatedEvents.length; i++) {
            expect(replicatedEvents[i]).to.eql(controlEvent);
          }
        })

        .then(done).catch(done);

    });

  });

  context('on remove events', function () {

    it('replicates', function (done) {

      var _this = this;
      var unpause, fail;
      var controlEvent, replicatedEvents = [];

      Promise.resolve()

        .then(function () {
          return _this.clients[0].set('/some/path/to/remove/on', {some: 'data'});
        })

        .then(function () {
          return Promise.resolve(_this.clients).map(function (client, i) {
            return client.onAsync('/some/path/to/remove/*', function (data, meta) {
              delete meta.sessionId;
              if (i == 0) {
                controlEvent = {
                  data: data,
                  meta: meta
                };
              } else {
                replicatedEvents.push({
                  data: data,
                  meta: meta
                });
              }
              if (controlEvent && replicatedEvents.length == clusterSize - 1) {
                setTimeout(function () {
                  unpause();
                }, 100);
              }
            });
          });
        })

        .then(function () {
          return _this.clients[0].remove('/some/path/to/remove/on');
        })

        .then(function () {
          return new Promise(function (resolve, reject) {
            unpause = resolve;
            fail = reject;
          });
        })

        .then(function () {
          for (var i = 0; i < replicatedEvents.length; i++) {
            expect(replicatedEvents[i]).to.eql(controlEvent);
          }
        })

        .then(done).catch(done);

    });

  });

  context('on tag events', function () {

    it('replicates', function (done) {

      var _this = this;
      var unpause, fail;
      var controlEvent, replicatedEvents = [];

      Promise.resolve()

        .then(function () {
          return _this.clients[0].set('/some/path/to/tag/on', {some: 'data'});
        })

        .then(function () {
          return Promise.resolve(_this.clients).map(function (client, i) {
            return client.onAsync('/*', function (data, meta) {
              delete meta.sessionId;
              delete meta.action; // <---------------------------------- can't replicate .action in tag operations

              /*

               should look like this
               ---------------------

               data = { // raw data, including stored meta being "tagged"
               data: { some: 'data' },
               _meta: {
               created: 1476388008625,
               modified: 1476388008625,
               path: '/some/path/to/tag/on',
               _id: '/some/path/to/tag/on'
               }
               }
               meta = {
               path: '/_TAGS/some/path/to/tag/on/62c70bc4927e48ba893daca24e716d02',
               tag: 'TAGNAME',
               type: 'data',
               action: '/SET@/some/path/to/tag/on',
               channel: '/ALL@/*'
               }

               after replication it looks like this
               ------------------------------------

               data = {
               data: { some: 'data' },
               _meta: {
               created: 1476388375945,
               modified: 1476388375945,
               path: '/some/path/to/tag/on',
               _id: '/some/path/to/tag/on'
               }
               }

               meta = {
               path: '/_TAGS/some/path/to/tag/on/62c70bc4927e48ba893daca24e716d02',
               tag: 'TAGNAME',
               action: '/SET@/_TAGS/some/path/to/tag/on/62c70bc4927e48ba893daca24e716d02', <--- different
               channel: '/ALL@/*',
               type: 'data'
               }

               */

              if (i == 0) {
                controlEvent = {
                  data: data,
                  meta: meta
                };
              } else {
                replicatedEvents.push({
                  data: data,
                  meta: meta
                });
              }
              if (controlEvent && replicatedEvents.length == clusterSize - 1) {
                setTimeout(function () {
                  unpause();
                }, 100);
              }
            });
          });
        })

        .then(function () {
          return _this.clients[0].set('/some/path/to/tag/on', null, {tag: 'TAGNAME'});
        })

        .then(function () {
          return new Promise(function (resolve, reject) {
            unpause = resolve;
            fail = reject;
          });
        })

        .then(function () {

          // console.log(controlEvent);
          // console.log(replicatedEvents[0]);

          for (var i = 0; i < replicatedEvents.length; i++) {
            expect(replicatedEvents[i]).to.eql(controlEvent);
          }
        })

        .then(done).catch(done);

    });

  });

  context('on merge events', function () {

    it('replicates', function (done) {

      var _this = this;
      var unpause, fail;
      var controlEvent, replicatedEvents = [];

      Promise.resolve()

        .then(function () {
          return _this.clients[0].set('/some/path/to/merge/on', {some: 'data'});
        })

        .then(function () {
          return Promise.resolve(_this.clients).map(function (client, i) {
            return client.onAsync('/some/path/to/merge/on', function (data, meta) {
              delete meta.sessionId;
              if (i == 0) {
                controlEvent = {
                  data: data,
                  meta: meta
                };
              } else {
                replicatedEvents.push({
                  data: data,
                  meta: meta
                });
              }
              if (controlEvent && replicatedEvents.length == clusterSize - 1) {
                setTimeout(function () {
                  unpause();
                }, 100);
              }
            });
          });
        })

        .then(function () {
          return _this.clients[0].set('/some/path/to/merge/on', {more: 'data'}, {merge: true});
        })

        .then(function () {
          return new Promise(function (resolve, reject) {
            unpause = resolve;
            fail = reject;
          });
        })

        .then(function () {
          for (var i = 0; i < replicatedEvents.length; i++) {
            expect(replicatedEvents[i]).to.eql(controlEvent);
          }
        })

        .then(done).catch(done);

    });

  });


  hooks.stopCluster();

  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
  });

  after(benchmarket.store());
  benchmarket.stop();

});
