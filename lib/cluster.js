global.PRIMUS_DODGE_MISSING_OPTIONS = true; // see happner/primus /dist/primus
const _ = require("lodash");
const Happn = require("happn-3");
const dface = require("dface");
const path = require("path");

const defaultName = require("./utils/default-name");

module.exports.create = async function(config) {
  let happn;
  if (!config) throw new Error("missing config");
  config = _.defaultsDeep({}, config, getDefaultConfig(config));
  delete config.services.membership; //backwards compatibility
  config.host = dface(config.host);
  config.name = defaultName(config);

  config.services.orchestrator.config = generateOrchestratorClusterConfig(
    config.services.orchestrator.config
  ); // backwards compatibility
  if (config.services.data.config.datastores.length > 0) {
    // check that a mongodb store is present
    var present = false;
    config.services.data.config.datastores.forEach(function(ds) {
      if (ds.provider === "happn-service-mongo-2") {
        present = true;
      }
    });
    if (!present) addMongoDb(config.services.data);
  } else {
    addMongoDb(config.services.data);
  }
  try {
    let happn = await Happn.service.create(config);
    await happn.services.orchestrator.start();
    await happn.services.replicator.start();

    // .then(function () {
    //   return happn.services.health.start();
    // })

    // .then(function () {
    //   return happn.services.membership.bootstrap();
    // })

    await happn.services.orchestrator.stabilised();
    if (config.services.proxy.config.defer) return happn;
    await happn.services.proxy.start();
    return happn;
  } catch (error) {
    if (!happn) throw error;
    happn.log.fatal(error);
    happn.stop(function(e) {
      if (e) happn.log.error(e);
      throw error;
    });
  }

  function getDefaultConfig(config) {
    return {
      port: 57000,
      transport: {
        mode: "http"
      },
      services: {
        data: {
          config: {
            datastores: []
          }
        },
        orchestrator: {
          path:
            __dirname + path.sep + "services" + path.sep + "orchestrator.js",
          config: {
            serviceName: "happn-cluster-node",
            deployment: "Test-Deploy",
            clusterName: _.get(
              config,
              "services.membership.clusterName",
              "happn-cluster"
            ),
            stabiliseTimeout: 15e3
          }
        },
        replicator: {
          path: __dirname + path.sep + "services" + path.sep + "replicator.js",
          config: {}
        },
        proxy: {
          path: __dirname + path.sep + "services" + path.sep + "proxy.js",
          config: {}
        }
      }
    };
  }
  function generateOrchestratorClusterConfig(config) {
    if (config.cluster) return config;
    config.cluster = { "happn-cluster-node": config.minimumPeers || 1 };
    return config;
  }
  function addMongoDb(cursor) {
    cursor.config.datastores.push({
      name: "mongo",
      provider: "happn-service-mongo-2",
      isDefault: true,
      settings: {
        collection: "happn-cluster-test",
        database: "happn-cluster-test",
        url: "mongodb://127.0.0.1:27017"
      }
    });
  }
};
