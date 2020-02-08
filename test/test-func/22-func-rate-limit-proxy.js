const path = require('path');
const filename = path.basename(__filename);
var expect = require('expect.js');
var Promise = require('bluebird');
const HappnClient = require('happn-3').client;
const hooks = require('../lib/hooks');
const utils = require('../lib/test-utils');

var testSequence = parseInt(filename.split('-')[0]);
var clusterSize = 1;
var happnSecure = true;
var proxySecure = true;

describe(filename, function () {

  this.timeout(30000);

  before(function () {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'off';
  });

  hooks.startCluster({
    testSequence: testSequence,
    size: clusterSize,
    happnSecure: happnSecure,
    proxySecure: proxySecure,
    proxyRateLimit:{
      interval:10000,
      allowedConnections:5
    }
  });

  var port;

  before(function () {
    var address = this.servers[0].services.proxy.__httpServer.address();
    port = address.port;
  });

  var getClient = function() {
    return new Promise((resolve, reject) => {
      HappnClient.create({
        config: {
          url: 'https://127.0.0.1:' + port,
          username: '_ADMIN',
          password: 'secret'
        },
        secure: true
      }).then((client) => {
        resolve(client);
      }).catch(reject);
    });
  };


  it('can do client', async () => {
    let connectionErrors = [];
      let connectedClients = [];
      for (let connectionAttempt = 0; connectionAttempt < 8; connectionAttempt++){
        try{
          let testClient = await getClient();
          connectedClients.push(testClient);
          console.log('pushed client:::');
        }catch(e){
          connectionErrors.push(e);
        }
        await utils.delay(500);
      }
      connectedClients.forEach((client) => {
        client.disconnect();
      });
      expect(connectedClients.length).to.be(5);
      expect(connectionErrors.length > 0).to.be(true);
  });

  hooks.stopCluster();

  after(function () {
    process.env.LOG_LEVEL = this.logLevel;
    //utils.whyIsNodeRunning(5000);
  });
});
