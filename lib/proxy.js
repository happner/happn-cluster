/**
 * Created by grant on 2016/09/26.
 */

var getAddress = require('./get-address');
var proxy = require('http-proxy');

function Proxy() {
}

Proxy.prototype.initialize = function (config, callback) {

  try {

    this.__config = config;

    var targetAddress = this.__getTargetAddress();
    var protocol = targetAddress.protocol;
    var isSecure = targetAddress.protocol.indexOf('https') > -1;

    var opts = {
      target: targetAddress.address,
      ws: protocol.toLowerCase() == 'ws',
      secure: isSecure,
      ssl: isSecure == 'true' ? {
        key: config.key,
        cert: config.cert
      } : null
    };

    this.__proxyServer = proxy.createProxyServer(opts);

    callback(null, this.__proxyServer);

  } catch (err) {
    callback(err);
  }
};

Proxy.prototype.start = function (callback) {
  var self = this;

  try {
    var result = self.__proxyServer.listen(self.__config.listenPort);
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};

Proxy.prototype.stop = function (callback) {
  var self = this;

  try {
    self.__proxyServer.close();
    callback();
  } catch (err) {
    callback(err)
  }
};

Proxy.prototype.__getTargetAddress = function () {

  var protocol = this.happn.config.transport.mode;
  var address = this.happn.server.address();

  var result = address.address == '0.0.0.0' ? getAddress() : address.address;
  result += ':' + address.port;
  result = protocol + '://' + result;

  return {address: result, protocol: protocol};
};

module.exports = Proxy;
