// return first external ipv4 address

var os = require("os");

const NETWORK_INTERFACE = parseInt(process.env['NETWORK_INTERFACE']) || 0

module.exports = function(interfaces) {
  interfaces = interfaces || os.networkInterfaces();
  let addresses = Object.keys(interfaces)
              .reduce((acc,current) => [...acc, ...interfaces[current]], [])
              .filter(iface => !iface.internal && iface.family == 'IPv4')
              .map(iface => iface.address);
  if (NETWORK_INTERFACE && addresses.length >= NETWORK_INTERFACE + 1) return addresses[NETWORK_INTERFACE]
  return addresses[0]
};
