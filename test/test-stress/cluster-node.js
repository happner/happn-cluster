const HappnCluster = require("../..");
const baseConfig = require("../lib/base-config");
const commander = require('commander');

commander
.option('--seq [number]', 'sequence number')
.option('--min [number]', 'minimum peers')
.option('--secure [boolean]', 'secure')
.option('--seed [number]', 'is seed')
.option('--hosts [string]', 'comma separated hosts')
.option('--cleanup [number]', 'cleanup unconfigured sessions interval')
.option('--cleanup-threshold [number]', 'sessions marked as unconfigured, due for cleanup')
.parse(process.argv);

commander.seq = parseInt(commander.seq || 1);
if (commander.secure === undefined) commander.secure = true;

return HappnCluster.create(baseConfig(commander.seq, commander.min, commander.secure, commander.seed, commander.hosts, commander.cleanup, commander.cleanupThreshold));
