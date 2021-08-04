const HappnCluster = require("../../");
const testUtils = require("./test-utils");
const mongoUrl = "mongodb://127.0.0.1:27017";
const mongoCollection = "happn-cluster-test";
const getAddress = require("../../lib/utils/get-address");
const { delay } = require("bluebird");

module.exports = class ClusterManager {
  constructor(options) {
    this.options = options || {};
    this.servers = [];
    this.memberCount = 0;
  }
  static create(options) {
    return new ClusterManager(options);
  }
  initialize() {
    return new Promise((resolve, reject) => {
      testUtils.clearMongoCollection(e => {
        if (e) return reject(e);
        resolve();
      });
    });
  }
  async setLogLevelOnSeed(level) {
    this.servers[0].services.health.log.setLevel(level || "off");
  }
  async addSeed() {
    return await this.addMember(true);
  }
  async addMember(seed) {
    const config = this.createConfig(seed);
    HappnCluster.create(config, (e, instance) => {
      this.servers.push(instance);
    });
    await delay(3000);
    this.memberCount++;
    return this.memberCount - 1;
  }
  async stopCluster() {
    for (let i = this.memberCount; i >= 0; i--) {
      if (this.servers[i]) await this.servers[i].stop({ reconnect: false });
    }
  }
  disconnectPeer(memberId) {
    delete this.servers[0].services.orchestrator.peers[
      `${getAddress()().replace(/\./g, "-")}_${55000 + memberId}`
    ];
    this.servers[0].services.health.reportClusterHealth();
  }
  disconnectMember(memberId) {
    delete this.servers[0].services.orchestrator.members[
      `${getAddress()()}:${56000 + memberId}`
    ];
    this.servers[0].services.health.reportClusterHealth();
  }

  createConfig(seed) {
    const host = getAddress()();
    const config = {
      port: 55000 + this.memberCount,
      transport: {
        mode: "https",
        certPath: "test/keys/happn.com.cert",
        keyPath: "test/keys/happn.com.key"
      },
      services: {
        data: {
          config: {
            datastores: [
              {
                name: "mongo",
                provider: "happn-service-mongo-2",
                isDefault: true,
                settings: {
                  collection: mongoCollection,
                  database: mongoCollection,
                  url: mongoUrl
                }
              }
            ]
          }
        },
        orchestrator: {
          config: {
            minimumPeers: this.options.minimumPeers
          }
        },
        membership: {
          config: {
            clusterName: "cluster1",
            seed,
            seedWait: 1000,
            joinType: "static",
            host,
            port: 56000 + this.memberCount,
            hosts: seed
              ? [`${host}:56001`, `${host}:56003`]
              : [...Array(this.memberCount).keys()].map(arrIndex => {
                  return `${host}:5600${arrIndex}`;
                }),
            joinTimeout: 1000,
            pingInterval: 1000,
            pingTimeout: 200,
            pingReqTimeout: 600
          }
        },
        proxy: {
          config: {
            host: "0.0.0.0",
            port: 57000 + this.memberCount,
            allowSelfSignedCerts: true
          }
        },
        health: {
          config: {
            healthInterval: this.options.healthInterval
          }
        }
      }
    };

    config.secure = true;
    config.services.security = {
      config: {
        adminUser: {
          username: "_ADMIN",
          password: "secret"
        }
      }
    };
    return config;
  }
};
