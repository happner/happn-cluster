const generateName = require("happn-sillyname");
const getAddress = require("./get-address");

module.exports = function(config) {
  if (config.name) return config.name;
  if (config.port === 0) {
    // starting with random port uses random name
    return generateName()
      .split(" ")[0]
      .toLowerCase();
  }

  let name;

  if (config.host === "0.0.0.0") {
    name = getAddress()();
  } else {
    name = config.host;
  }
  // name is used in happn paths, cannot contain '.'s
  name = name.replace(/\./g, "-");
  if (config.port) {
    name += "_" + config.port;
  } else {
    name += "_55000";
  }
  return name;
};
