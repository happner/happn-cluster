// return first external ipv4 address

var os = require("os");
const AWS_FLAG= process.env['AWS_FLAG'] || false

module.exports = function() {
  var interfaces = os.networkInterfaces();
  let ifaces = Object.keys(interfaces).reduce((acc,current) => [...acc, ...interfaces[current]], [])
  let addresses = ifaces.filter(iface=> !iface.internal && iface.family == 'IPv4').map(iface=> iface.address);
  if (AWS_FLAG) return addresses[1]
  return addresses[0]
  // var keys = Object.keys(interfaces);
  // var iface, address;
  // for (var i = 0; i < keys.length; i++) {
  //   iface = interfaces[keys[i]];
  //   for (var j = 0; j < iface.length; j++) {
  //     address = iface[j];
  //     if (address.internal) continue;
  //     if (address.family !== "IPv4") continue;
  //     return address.address;
  //   }
  // }
};
