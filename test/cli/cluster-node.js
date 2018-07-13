var HappnCluster = require('../..');

var processarguments = {};

if (process.argv.length > 2) {
  for (var i = 2; i < process.argv.length; i++) {
    var arg = process.argv[i];
    processarguments[arg.split('=')[0]] = arg.split('=')[1];
  }
}

if (!processarguments.domain) processarguments.domain = 'DOMAIN_NAME';

if (processarguments.hosts) processarguments.hosts = processarguments.hosts.split(',');
else processarguments.hosts = [];

if (!processarguments.port) processarguments.port = 55000;
else processarguments.port = parseInt(processarguments.port);

if (!processarguments.membershipport) processarguments.membershipport = 56000;
else processarguments.membershipport = parseInt(processarguments.membershipport);

if (!processarguments.proxyport) processarguments.proxyport = 57000;
else processarguments.proxyport = parseInt(processarguments.proxyport);

if (!processarguments.clusterName) processarguments.clusterName = 'happn-cluster';
if (processarguments.seed == null) processarguments.seed = true;
else processarguments.seed = processarguments.seed == 'true';

processarguments.persistMembers = processarguments.persistMembers == 'true';

if (processarguments.seedWait == null) processarguments.seedWait = 0;
if (processarguments.randomWait == null) processarguments.randomWait = 0;
if (processarguments.joinTimeout == null) processarguments.joinTimeout = 1000;
if (processarguments.pingInterval == null) processarguments.pingInterval = 1000;
if (processarguments.pingTimeout == null) processarguments.pingTimeout = 200;
if (processarguments.pingReqTimeout == null) processarguments.pingReqTimeout = 600;
if (processarguments.pingReqGroupSize == 3) processarguments.pingReqGroupSize = 3;
if (processarguments.maxDgramSize == null) processarguments.maxDgramSize = 512;
if (processarguments.disseminationFactor == null) processarguments.disseminationFactor = 15;

var modulesConfig = {};
var componentsConfig = {};

if (processarguments.modulesConfigPath) modulesConfig = require(processarguments.modulesConfigPath);
if (processarguments.componentsConfigPath) componentsConfig = require(processarguments.componentsConfigPath);

var config = { // was "datalayer"
  port: processarguments.port,
  services: {
    data: {
      // see data sub-config in happn-cluster docs
      config: {
        datastores: []
      }
    },
    membership: {
      config: {
        persistMembers: processarguments.persistMembers,
        clusterName: processarguments.clusterName,
        seed: processarguments.seed,
        seedWait: processarguments.seedWait,
        randomWait: processarguments.randomWait,
        host: processarguments.host, // defaults to first public IPv4 address
        port: processarguments.membershipport,
        hosts: processarguments.hosts,
        joinTimeout: processarguments.joinTimeout,
        pingInterval: processarguments.pingInterval,
        pingTimeout: processarguments.pingTimeout,
        pingReqTimeout: processarguments.pingReqTimeout,
        pingReqGroupSize: processarguments.pingReqGroupSize,
        udp: {
          maxDgramSize: processarguments.maxDgramSize
        },
        disseminationFactor: processarguments.disseminationFactor
      }
    },
    proxy: {
      config: {
        host: '0.0.0.0',
        port: processarguments.proxyport,
        allowSelfSignedCerts: true
      }
    }
  }
};

HappnCluster.create(config)
  .then(function(server) {

    server.services.membership.on('update', function(memberInfo){
      if (process.send) process.send({operation:'update', data:{memberId: memberInfo.memberId}});
    });

    server.services.membership.on('add', function(memberInfo){
      if (process.send) process.send({operation:'add', data:{memberId: memberInfo.memberId}});
    });

    console.log('cluster node started...');
  })
  .catch(function(e){
    console.log('cluster node start failed: ', e);
  });
