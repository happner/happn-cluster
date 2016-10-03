/**
 * Created by grant on 2016/09/26.
 */

var Promise = require('bluebird');
var getAddress = require('./get-address');
var proxy = require('http-proxy');
var property = require('./property');

function Proxy() {
}

Proxy.prototype.initialize = function (config, callback) {

  var self = this;

  this.happn.log.info('### initialising proxy...');

  try {
    property(this, 'happn', this.happn);
    property(this, 'config', config);

    this.__targetAddress = this.__getTargetAddress();
    var address = this.__targetAddress.address;
    var port = this.__targetAddress.port;
    var isSecure = this.__targetAddress.secure;

    var opts = {
      target: address + ':' + port,
      ws: true,
      secure: isSecure,
      ssl: isSecure == 'true' ? {
        key: this.happn.config.transport.keyPath,
        cert: this.happn.config.transport.certPath
      } : null
    };

    this.__proxyServer = proxy.createProxyServer(opts);

    this.__proxyServer.on('error', function (err, req, res) {
      self.happn.log.error('Proxy error: ' + err);
      self.__proxyServer.close();
    });

    this.__proxyServer.on('open', function () {
      self.happn.log.info('Proxy connection opened...');
    });

    callback(null, this.__proxyServer);

  } catch (err) {
    self.happn.log.error(err);
    return callback(err);
  }
};

Proxy.prototype.start = Promise.promisify(function (callback) {

  this.happn.log.info('### starting proxy...');

  try {
    var listenPort = this.config.listenPort;
    var result = this.__proxyServer.listen(listenPort);

    this.happn.log.info('### proxy listening on: ' + listenPort +
      '; internal target address: ' + this.__targetAddress.address + ':' + this.__targetAddress.port);

    callback(null, result);
  } catch (err) {
    callback(err);
  }
});

Proxy.prototype.stop = function (config, callback) {

  this.happn.log.info('### stopping proxy...');

  try {
    this.__proxyServer.close();
    callback();
  } catch (err) {
    callback(err)
  }
};

Proxy.prototype.__getTargetAddress = function () {

  var httpMode = this.happn.config.transport.mode;
  var allowSelfSignedCerts = this.config.allowSelfSignedCerts;
  var secure = httpMode == 'https';
  var wsMode = secure ? 'wss' : 'ws';
  var address = getAddress();
  var port = this.happn.config.port;

  return {
    secure: (allowSelfSignedCerts != null ? !allowSelfSignedCerts : secure),
    httpMode: httpMode,
    wsMode: wsMode,
    address: wsMode + '://' + address,
    port: port
  };
};

module.exports = Proxy;
