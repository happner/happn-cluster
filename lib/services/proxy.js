/**
 * Created by grant on 2016/09/26.
 */

var Promise = require('bluebird');
var format = require('util').format;
var getAddress = require('../utils/get-address');
var bouncy = require('bouncy');
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

    // property(this, '__targetAddress', this.__getTargetAddress());
    property(this, '__onProxyErrorListener', this.__onProxyError.bind(this));
    property(this, '__onServerErrorListener', this.__onServerError.bind(this));

    callback();

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
    port = typeof this.config.port !== 'undefined' ? this.config.port : defaultPort();
    host = dface(this.config.host);
  } catch (err) {
    callback(err);
  }

  var protocol = this.happn.services.transport.config.mode;

  if (!protocol) protocol = 'http';

  var address = this.happn.server.address();

  var targetHost = address.address;
  var targetPort = address.port;

  if (targetHost == '0.0.0.0') targetHost = getAddress();
  var target = format('%s://%s:%d', protocol, targetHost, targetPort);

  var ssl = typeof this.config.keyPath !== 'undefined' ? {
    key: require('fs').readFileSync(this.config.keyPath),
    cert: require('fs').readFileSync(this.config.certPath)
  } : null;

  var listening = (ssl == null) ?
    format('http://%s:%d', host, port) :
    format('https://%s:%d', host, port);

  this.__proxyServer = bouncy(ssl, function (req, res, bounce) {
    // somehow bouncy websocket connections remain paused in node v0.12 and higher
    if (req.connection._bouncyStream && req.connection._bouncyStream.resume) {
      req.connection._bouncyStream.resume();
    }
    bounce(targetHost, targetPort);
  });


  var onError = function (error) {
    self.__proxyServer.removeListener('listening', onListening);
    callback(error);
  };

  var onListening = function () {
    var address = self.__proxyServer.address();
    self.log.info('forwarding %s to %s', listening, target);
    self.__proxyServer.removeListener('error', onError);

    self.__proxyServer.on('error', self.__onProxyErrorListener);
    self.__proxyServer.on('error', self.__onServerErrorListener);
    callback();
  };

  this.__proxyServer.once('error', onError);
  this.__proxyServer.once('listening', onListening);

  this.__proxyServer.listen(port, host);

});

Proxy.prototype.stop = function (options, callback) {

  this.log.info('stopping proxy');

  if (typeof options == 'function') callback = options;

  if (this.__proxyServer) {

    try {
      this.__proxyServer.close();
      callback();
    } catch (err) {
      callback(err);
    }
    finally {
      this.__proxyServer.removeListener('error', this.__onProxyErrorListener);
      if (this.__proxyServer) {
        this.__proxyServer.removeListener('error', this.__onServerErrorListener);
      }
    }
  } else callback();
};

Proxy.prototype.__onProxyError = function (error) {
  this.log.error('proxy error', error);
};

Proxy.prototype.__onServerError = function (error) {
  this.log.error('server error', error);
};

module.exports = Proxy;
