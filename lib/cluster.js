var Promise = require('bluebird');
var Happn = require('happn');
var dface = require('dface');
var path = require('path');

var defaultName = require('./utils/default-name');

module.exports.create = Promise.promisify(function (config, callback) {
  var happn, cursor;

  if (typeof config == 'function') {
    callback = config;
    return callback(new Error('missing config'));
  }

  config.host = dface(config.host);

  defaultName(config);

  config.services = config.services || {};

  config.services.data = config.services.data || {};
  config.services.membership = config.services.membership || {};
  config.services.orchestrator = config.services.orchestrator || {};
  config.services.proxy = config.services.proxy || {};

  cursor = config.services.data;
  cursor.path = cursor.path || 'happn-service-mongo';
  cursor.config = cursor.config || {};
  cursor.config.collection = cursor.config.collection || 'happn-cluster';
  cursor.config.url = cursor.config.url || 'mongodb://127.0.0.1:27017/happn-cluster';

  cursor = config.services.orchestrator;
  cursor.path = cursor.path || __dirname + path.sep + 'services' + path.sep + 'orchestrator';
  cursor.config = cursor.config || {};

  cursor = config.services.membership;
  cursor.path = cursor.path || __dirname + path.sep + 'services' + path.sep + 'membership';
  cursor.config = cursor.config || {};
  cursor = cursor.config;
  cursor.clusterName = cursor.clusterName || 'happn-cluster';

  cursor = config.services.proxy;
  cursor.path = cursor.path || __dirname + path.sep + 'services' + path.sep + 'proxy';
  cursor.config = cursor.config || {};

  Happn.service.create(config)

    .then(function (_happn) {
      happn = _happn;
    })

    .then(function () {
      return happn.services.orchestrator.prepare();
    })

    .then(function () {
      return happn.services.membership.bootstrap();
    })

    .then(function () {
      return happn.services.orchestrator.stabilized();
    })

    .then(function () {
      return happn.services.proxy.start();
    })

    .then(function () {
      callback(null, happn);
    })

    .catch(function (error) {
      if (!happn) return callback(error);

      happn.log.fatal(error);
      happn.stop(function (e) {
        if (e) happn.log.error(e);
        callback(error);
      });
    });

});
