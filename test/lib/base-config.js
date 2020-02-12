module.exports = function (seq, minPeers, secure, seed, hosts, cleanup, cleanupThreshold) {

  if (typeof hosts === 'string') hosts = hosts.split(',');
  if (!hosts) hosts = ['127.0.0.1:56001', '127.0.0.1:56002', '127.0.0.1:56003'];

  const config = {
    port: 57000 + seq,
    secure: secure,
    services: {
      data:{
        config:{
          autoUpdateDBVersion:true
        }
      },
      membership: {
        config: {
          host: '127.0.0.1',
          port: 56000 + seq,
          seed: seq == 1 || seed == true,
          seedWait: 300,
          hosts
        }
      },
      proxy: {
        config: {
          port: 55000 + seq
        }
      },
      orchestrator: {
        config: {
          minimumPeers: minPeers || 3
        }
      },
      connect: {
        config: {
          middleware: {
            security: {
              exclusions: ['/test/excluded/specific', '/test/excluded/wildcard/*']
            }
          }
        }
      }
    }
  };

  if (secure) {
    config.secure = true;
    config.services.security = {
      config: {
        adminUser: {
          sessionTokenSecret:'TEST-SESSION-TOKEN-SECRET',
          username: '_ADMIN',
          password: 'happn'
        }
      }
    };
  }

  if (cleanup > 0) {
    if (!config.services.session) config.services.session = {};
    if (!config.services.session.config) config.services.session.config = {};
    config.services.session.config.unconfiguredSessionCleanup = {
      interval: cleanup, //check every N milliseconds
      threshold: cleanupThreshold || 10e3, //sessions are cleaned up if they remain unconfigured for 10 seconds
      verbose:true //cleanups are logged
    };
  }

  return config;
};
