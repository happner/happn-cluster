

var HappnCluster = require('../../');
var createConfig = require('./create-config');

module.exports = function(seq) {

  var config = createConfig(seq);

  console.log(JSON.stringify(config, null, 2));

  HappnCluster.create(config)

    .then(function(server) {
      process.on('SIGINT', function() {
        server.stop({kill: true, wait: 2000}, function() {
          process.exit(0);
        });
      })
    })

    .catch(function(error) {
      console.error(error.stack);
      process.exit(1);
    });
};
