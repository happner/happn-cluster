var ipAddress = require('../../lib/utils/get-address')();

module.exports = function (seq, name) {
  var config = {
    name: name,
    secure: true,
    services: {
      security: {
        config: {
          adminUser: {
            username: '_ADMIN',
            password: 'happn'
          }
        }
      },
      data: {
        path: 'happn-service-mongo',
        config: {
          collection: 'happn-cluster',
          url: 'mongodb://127.0.0.1:27017/happn-cluster'
        }
      },
      orchestrator: {
        config: {
          // minimumPeers: 6,
          // replicate: ['/*'], //  ['/something/*', '/else'],
          // stableReportInterval: 2000,
          // stabiliseTimeout: 10 * 1000,
        }
      },
      membership: {
        config: {
          join: 'static',
          seed: seq == 0,
          port: 56000 + seq,
          hosts: [ipAddress + ':56000', ipAddress + ':56001', ipAddress + ':56002', ipAddress + ':56003']
        }
      },
      proxy: {
        config: {
          port: 55000 + seq
        }
      }
    },
    port: 57000 + seq
  };

  return config;
};
