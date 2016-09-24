var Promise = require('bluebird');
var Happn = require('happn');
var dface = require('dface');

var Membership = require('./membership');
var getAddress = require('./get-address');


module.exports.create = Promise.promisify(function(config, callback) {
  var happn, error, membership, dataPlugin, happnAddress;

  if (typeof config == 'function') {
    callback = config;
    return callback(new Error('missing config'));
  }

  try {
    // cluster requires shared database (for now)
    // the only shared database plugin is happn-service-mongo
    // (missing some way to test isDatabasePluginShared)
    dataPlugin = config.services.data.path;
    if (dataPlugin !== 'happn-service-mongo') {
      return callback(new Error('cluster requires shared data service'));
    }
  } catch (e) {
    return callback(new Error('cluster requires shared data service'));
  }

  config.host = dface(config.host);
  config.cluster = config.cluster || {};
  config.cluster.membership = config.cluster.membership || {};
  config.cluster.name = config.cluster.name || 'cluster-name';

  Happn.service.create(config)

    .then(function(_happn) {
      var originalStop;

      happn = _happn;
      originalStop = happn.stop;

      // extended cluster.stop that also calls original happn.stop
      happn.stop = function() {
        if (membership) membership.stop();
        return originalStop.apply(happn, arguments);
      }
    })

    .then(function() {
      // membership service disseminates this happn servers address
      // for other cluster members to connect,
      // 0.0.0.0 won't do
      var address = happn.server.address();
      if (address.address == '0.0.0.0') {
        happnAddress = getAddress();
      } else {
        happnAddress = address.address;
      }
      happnAddress += ':' + address.port;
      happnAddress = 'http://' + happnAddress;
    })

    .then(function() {
      if (!config.cluster.membership) return;
      if (config.cluster.membership.seed) return;
      if (typeof config.cluster.membership.seedWait !== 'number') return;
      if (config.cluster.membership.seedWait == 0) return;

      // when starting an entire cluster concurrently,
      // pause all but the seed member momentarily to
      // give the seed member time to complete bootstrap
      return Promise.delay(config.cluster.membership.seedWait);
    })

    .then(function() {
      membership = new Membership(happn, happnAddress);
      happn.membership = membership;
      return membership.bootstrap();
    })

    .then(function() {
      membership.on('add', function(member) {
        console.log('---> add', member);
      });

      membership.on('remove', function(member) {
        console.log('---> remove', member);
      });
    })

    .catch(function(_error) {
      error = _error;
      if (happn) return happn.stop();
    })

    .then(function() {
      if (error) happn.log.fatal('failed to start cluster', error);
      callback(error || null, happn);
    })

    .catch(function(stopError) {
      happn.log.fatal('failed to stop happn', stopError);
      happn.log.fatal('failed to start cluster', error);
      callback(error, happn);
    });
});
