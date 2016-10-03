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
  config.services.proxy = config.services.proxy || {};

  cursor = config.services.orchestrator;
  cursor.path = cursor.path || __dirname + path.sep + 'orchestrator';
  cursor.config = cursor.config || {};

  cursor = config.services.membership;
  cursor.path = cursor.path || __dirname + path.sep + 'membership';
  cursor.config = cursor.config || {};
  cursor = cursor.config;
  cursor.clusterName = cursor.clusterName || 'cluster-name';

  cursor = config.services.proxy;
  cursor.path = cursor.path || __dirname + path.sep + 'proxy';
  cursor.config = cursor.config || {};

  cursor = config.services.proxy;
  cursor.path = cursor.path || __dirname + path.sep + 'proxy';
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

    // .then(function() {
    //   setTimeout(function() {
    //     console.log(happn.services.orchestrator);
    //   }, 1000);
    // })

    .then(function() {
      return happn.services.orchestrator.stabilized();
    })

    .then(function() {
      return happn.services.proxy.start();
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
