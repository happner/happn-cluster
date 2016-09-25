module.exports = Orchestrator;

var property = require('./property');

function Orchestrator(happn) {
  this.clusterName = happn.config.cluster.name;
  property(this, 'membership', happn.membership);
  property(this, 'log', happn.log.createLogger('Orchestrator'));
}
