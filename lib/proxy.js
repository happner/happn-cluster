/**
 * Created by grant on 2016/09/26.
 */

function Proxy() {
}

Proxy.prototype.initialize = function (config, callback) {

  try {
    var proxy = require('http-proxy');
    this.__config = config;

    var opts = {
      target: config.protocol + '://' + config.targetHost + ':' + config.targetPort,
      ws: config.protocol.toLowerCase() == 'ws',
      secure: config.secure,
      ssl: config.secure == 'true' ? {
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

module.exports = Proxy;
