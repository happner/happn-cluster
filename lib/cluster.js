global.PRIMUS_DODGE_MISSING_OPTIONS = true; // see happner/primus /dist/primus

var Promise = require('bluebird');
var Happn = require('happn-3');
var dface = require('dface');
var path = require('path');

var defaultName = require('./utils/default-name');

module.exports.create = Promise.promisify(function (config, callback) {
  var happn, cursor;

  if (typeof config == 'function') {
    callback = config;
    return callback(new Error('missing config'));
  }

  // move default happn port, proxy listens here instead
  if (typeof config.port == 'undefined') config.port = 57000;

  config.host = dface(config.host);

  defaultName(config);

  // Build default configs

  config.services = config.services || {};
  config.services.data = config.services.data || {};
  config.services.membership = config.services.membership || {};
  config.services.orchestrator = config.services.orchestrator || {};
  config.services.replicator = config.services.replicator || {};
  config.services.proxy = config.services.proxy || {};

  // cursor.path = cursor.path || 'happn-service-mongo-2';
  // cursor.config = cursor.config || {};
  // cursor.config.collection = cursor.config.collection || 'happn-cluster';
  // cursor.config.url = cursor.config.url || 'mongodb://127.0.0.1:27017/happn-cluster';

  cursor = config.services.data;
  cursor.config = cursor.config || {};
  cursor.config.datastores = cursor.config.datastores || [];

  function addMongoDb(cursor) {
    cursor.config.datastores.push({
      name: 'mongo',
      provider: 'happn-service-mongo-2',
      isDefault: true,
      settings: {
        collection: 'happn-cluster',
        database: 'happn-cluster',
        url: 'mongodb://127.0.0.1:27017'
      }
    });
  }

  if (cursor.config.datastores.length > 0) {
    // check that a mongodb store is present
    var present = false;
    cursor.config.datastores.forEach(function (ds) {
      if (ds.provider == 'happn-service-mongo-2') {
        present = true;
      }
    });
    if (!present) addMongoDb(cursor);
  } else {
    addMongoDb(cursor);
  }

  cursor = config.services.orchestrator;
  cursor.path = cursor.path || __dirname + path.sep + 'services' + path.sep + 'orchestrator';
  cursor.config = cursor.config || {};

  cursor = config.services.membership;
  cursor.path = cursor.path || __dirname + path.sep + 'services' + path.sep + 'membership';
  cursor.config = cursor.config || {};
  cursor = cursor.config;

  cursor = config.services.replicator;
  cursor.path = cursor.path || __dirname + path.sep + 'services' + path.sep + 'replicator';
  cursor.config = cursor.config || {};

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
      return happn.services.replicator.start();
    })

    .then(function () {
      return happn.services.membership.bootstrap();
    })

    .then(function () {
      return happn.services.orchestrator.stabilised();
    })

    .then(function () {
      if (config.services.proxy.config.defer) return;
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
