var generateName = require('sillyname');

var getAddress = require('./get-address');

module.exports = function(config) {
  if (config.name) return;

  if (config.port == 0) {
    // starting with random port uses random name
    config.name = generateName().split(' ')[0].toLowerCase();
    return;
  }

  if (config.host == '0.0.0.0') {
    config.name = getAddress();
  }

  // name is used in happn paths, cannot contain '.'s
  config.name = config.name.replace(/\./g, '-');
  config.name = config.name.replace(/\:/g, '-'); // ipv6
  config.port ? config.name += '_' + config.port : config.name += '_55000';
};