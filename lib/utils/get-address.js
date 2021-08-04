// return specific address on specific NIC, or first external ipv4 address on on specific NIC or eth0 (default)
// os and env arguments make the code testable
module.exports = function(logger, env, os) {
  logger = logger || console;
  os = os || require("os");
  env = env || process.env;
  return function(interfaces) {
    let networkInterfaceId = env["NETWORK_INTERFACE_ID"] || "eth0";
    interfaces = interfaces || os.networkInterfaces();
    if (!interfaces[networkInterfaceId]) {
      return getFirstAvailableAddress(networkInterfaceId, logger, os);
    }
    let interfaceItemIndex = parseInt(env["NETWORK_INTERFACE"] || 0);
    if (
      isNaN(interfaceItemIndex) ||
      interfaceItemIndex >= interfaces[networkInterfaceId].length
    ) {
      return getFirstAvailableAddress(networkInterfaceId, logger, os);
    }
    return interfaces[networkInterfaceId][interfaceItemIndex].address;
  };
};

function getFirstAvailableAddress(interfaceId, logger, os) {
  const interfaces = os.networkInterfaces();
  const candidates = Object.keys(interfaces).reduce(
    (candidates, interfaceKey) => {
      let found = interfaces[interfaceKey];
      found.forEach((interfaceItem, interfaceItemIndex) => {
        if (
          !interfaceItem.internal &&
          interfaceItem.family === "IPv4" &&
          interfaceItem.address.indexOf("169.254") !== 0
        ) {
          candidates.push({
            nic: interfaceKey,
            index: interfaceItemIndex,
            address: interfaceItem.address
          });
        }
      });
      return candidates;
    },
    []
  );

  if (candidates.length > 0) {
    logger.warn(
      `get address for SWIM or cluster: interface with id [${interfaceId}] not found or address index out of bounds - dynamically resolved to address [${candidates[0].address}] on NIC [${candidates[0].nic}]`
    );
    return candidates[0].address;
  }

  throw new Error(
    `get address for SWIM or cluster: interface with id [${interfaceId}] not found`
  );
}
