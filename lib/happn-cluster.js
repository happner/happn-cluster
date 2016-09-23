var Promise = require('bluebird');
var Happn = require('happn');

var Membership = require('./membership');

module.exports.create = Promise.promisify(function(config, callback) {
  var happn, membership, dataPlugin;

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

  config.cluster = config.cluster || {};
  config.cluster.domain = config.cluster.domain || 'happn';
  config.cluster.membership = config.cluster.membership || {};
  config.cluster.membership.join = config.cluster.membership.join || 'dynamic';
  if (typeof config.cluster.membership.seed !== 'boolean') {
    config.cluster.membership.seed = false;
  }



  Happn.service.create(config)

    .then(function(_happn) {
      var originalStop;

      happn = _happn;
      originalStop = happn.stop;

      // extended cluster.stop that also calls original happn.stop
      happn.stop = function() {
        originalStop.apply(happn, arguments);
      }
    })

    .then(function() {
      membership = new Membership(happn, config.cluster.membership);
      return membership.bootstrap();
    })

    .then(function() {
      callback(null, happn);
    })

    .catch(callback);
});
