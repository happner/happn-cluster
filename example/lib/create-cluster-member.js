

var HappnCluster = require('../../');
var createConfig = require('./create-config');

module.exports = function(seq) {

  var config = createConfig(seq);

  // console.log(JSON.stringify(config, null, 2));

  HappnCluster.create(config)

    .then(function(server) {

      // console.log(server.services.orchestrator.peers);

      // server.services.orchestrator.on('peer/add', function(member) {
      //   console.log('arriving peer\n', member);
      // });

      // server.services.orchestrator.on('peer/remove', function(member) {
      //   console.log('departing peer\n', member);
      // });

      process.on('SIGINT', function() {
        server.stop( /*{kill: true, wait: 2000},*/ function() {
          // if (seq == 9) {
          //   console.log('kill', process.pid);
          //   return;
          // }
          process.exit(0);
        });
      })
    })

    .catch(function(error) {
      console.error('\n', error.stack ? error.stack : error);
      process.exit(1);
    });
};
