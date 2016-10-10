
var lastLoginConfig;

module.exports.getLastLoginConfig = function() {
  return lastLoginConfig;
};

module.exports.create = function(config, callback) {
  lastLoginConfig = config;
  callback(null, {});
};
