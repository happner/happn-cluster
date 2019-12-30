// cluster node
// called by hooks.startMultiProcessCluster

var HappnCluster = require("../../");
var config = JSON.parse(process.argv[2]);

HappnCluster.create(config)
  .then(function() {
    if (typeof process.send === "function") process.send("ready");
  })
  .catch(function() {
    process.exit(1);
  });
