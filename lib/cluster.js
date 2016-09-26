var Promise = require('bluebird');
var Happn = require('happn');
var dface = require('dface');
var path = require('path');

var defaultName = require('./default-name');

module.exports.create = Promise.promisify(function(config, callback) {
  var happn, cursor;

  if (typeof config == 'function') {
    callback = config;
    return callback(new Error('missing config'));
  }

  config.host = dface(config.host);

  defaultName(config);

  config.services = config.services || {};
  config.services.membership = config.services.membership || {};
  config.services.orchestrator = config.services.orchestrator || {};

  cursor = config.services.membership;
  cursor.path = cursor.path || __dirname + path.sep + 'membership';
  cursor.config = cursor.config || {};
  cursor = cursor.config;
  cursor.clusterName = cursor.clusterName || 'cluster-name';

  cursor = config.services.orchestrator;
  cursor.path = cursor.path || __dirname + path.sep + 'orchestrator';
  cursor.config = cursor.config || {};

  Happn.service.create(config)

    .then(function(_happn) {
      happn = _happn;
    })

    .then(function() {
      return happn.services.orchestrator.prepare();
    })

    .then(function() {
      return happn.services.membership.bootstrap();
    })

    .then(function() {
      return happn.services.orchestrator.stabilized();
    })

    .then(function() {
      callback(null, happn);
    })

    .catch(function(error) {
      if (happn) {
        happn.log.fatal(error);
        return happn.stop(function() {
          callback(error);
        });
      }
      callback(error);
    });

});
