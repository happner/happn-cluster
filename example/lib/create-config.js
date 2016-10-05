
var ipAddress = require('../../lib/get-address')();

module.exports = function(seq) {
  var config = {
    services: {
      data: {
        path: 'happn-service-mongo',
        config: {
          collection: 'static-happn-cluster',
          url: 'mongodb://127.0.0.1:27017/static-happn-cluster'
        }
      },
      orchestrator: {
        config: {
          // replicate: ['/*']
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
          listenPort: 57000 + seq
        }
      }
    },
    port: 55000 + seq
  };

  return config;
};
