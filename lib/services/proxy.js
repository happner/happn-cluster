/**
 * Created by grant on 2016/09/26.
 */

var Promise = require('bluebird');
var getAddress = require('../utils/get-address');
var proxy = require('http-proxy');
var dface = require('dface');
var property = require('../utils/property');

function Proxy(opts) {
  property(this, 'log', opts.logger.createLogger('Proxy'));
}

Proxy.prototype.initialize = function (config, callback) {

  var self = this;

  self.log.info('initialising proxy');

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
      self.log.error('proxy error: ' + err);
      self.__proxyServer.close();
    });

    this.__proxyServer.on('open', function () {
      self.log.info('proxy connection opened');
    });

    callback(null, this.__proxyServer);

  } catch (err) {
    self.log.error(err);
    return callback(err);
  }
};

Proxy.prototype.start = Promise.promisify(function (callback) {
  var port, host, self = this;

  this.log.info('starting proxy');

  var defaultPort = function () {
    // Listen on default happn port (if available) so that unmodified happn clients default to the proxy
    var address = self.happn.server.address();
    if (address.port == 55000) {
      return 57000;
    }
    return 55000;
  };

  try {
    port = typeof this.config.port !== 'undefined' // incase 0
      ? this.config.port
      : defaultPort();

    host = dface(this.config.host);
  } catch (err) {
    callback(err);
  }

  var onError = function (error) {
    self.__proxyServer._server.removeListener('listening', onListening);
    callback(error);
  };

  var onListening = function () {
    var address = self.__proxyServer._server.address();
    self.log.info('proxy forwarding %s:%s to %s:%s',
      address.address, address.port, self.__targetAddress.address, self.__targetAddress.port
    );
    self.__proxyServer._server.removeListener('error', onError);
    callback();
  };

  this.__proxyServer.listen(port, host); // need to listen() first, it creates the internal _server (odd)
  this.__proxyServer._server.once('error', onError);
  this.__proxyServer._server.once('listening', onListening);
});

Proxy.prototype.stop = function (options, callback) {

  this.log.info('stopping proxy');

  if (typeof options == 'function') callback = options;

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
