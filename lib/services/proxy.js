/**
 * Created by grant on 2016/09/26.
 */

var Promise = require('bluebird');
var format = require('util').format;
var getAddress = require('../utils/get-address');
var proxy = require('http-proxy');
var dface = require('dface');
var property = require('../utils/property');
var http = require('http');
var https = require('https');

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

Proxy.prototype.__startRateLimit = function(config){
  this.__currentRateLimitConnections = 0;
  this.__rateLimitInterval = setInterval(() => {
    this.__currentRateLimitConnections = 0;
  }, config.interval);
};

Proxy.prototype.__stopRateLimit = function(){
  if (this.__rateLimitInterval) clearInterval(this.__rateLimitInterval);
};

Proxy.prototype.__checkRateLimit = function(config){
  if (this.__currentRateLimitConnections < config.allowedConnections){
    this.__currentRateLimitConnections++;
    return true;
  }
  return false;
};

Proxy.prototype.start = Promise.promisify(function (callback) {

  let port, host, self = this;

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

  const protocolHappn = this.happn.services.transport.config.mode || 'http';
  const protocolProxy = this.config.keyPath != null? 'https':'http';

  const address = this.happn.server.address();

  var targetHost = address.address;
  var targetPort = address.port;

  if (targetHost == '0.0.0.0') targetHost = getAddress() || '0.0.0.0';


  const allowSelfSigned = typeof this.config.allowSelfSignedCerts == 'boolean' ? this.config.allowSelfSignedCerts : false;
  let key, cert;

  if (typeof this.config.keyPath !== 'undefined') {
    key = require('fs').readFileSync(this.config.keyPath),
    cert = require('fs').readFileSync(this.config.certPath);
  }

  const target = format('%s://%s:%d', protocolHappn, targetHost, targetPort);
  const listening = format(`${protocolProxy}://%s:%d`, host, port);

  const opts = {
    timeout: typeof this.config.timeout == 'number' ? this.config.timeout : 20 * 60 * 1000,
    target: target,
    ws: true,
    secure: !allowSelfSigned,
    ssl: protocolHappn === 'https' ? {
      key,
      cert
    } : null
  };

  const httpOpts = {
    key,
    cert
  };

  this.__proxyServer = proxy.createProxyServer(opts);
  const implementation = protocolProxy === 'https'?https:http;

  this.__httpServer = implementation.createServer(httpOpts, function (req, res) {
    self.__proxyServer.web(req, res);
  });

  var onError = function (error) {
    if (self.__httpServer)
      self.__httpServer.removeListener('listening', onListening);
    callback(error);
  };

  if (this.config.rateLimit)
    this.__startRateLimit(this.config.rateLimit);

  var onUpgrade = function(req, socket, head){
    if (self.config.rateLimit){
      if (!self.__checkRateLimit(self.config.rateLimit)) {
        socket.write('HTTP/1.1 429 Too Many Requests\r\n' +
               `Retry-After: ${self.config.rateLimit.retryAfter || 30000}\r\n` +
               '\r\n');
        return socket.end();
      }
    }
    self.__proxyServer.ws(req, socket, head);
  };

  var onListening = function () {
    self.log.info('forwarding %s to %s', listening, target);
    self.__httpServer.removeListener('error', onError);
    self.__proxyServer.on('error', self.__onProxyErrorListener);
    self.__httpServer.on('error', self.__onServerErrorListener);
    callback();
  };

  this.__httpServer.on('upgrade', onUpgrade);
  this.__httpServer.once('error', onError);
  this.__httpServer.once('listening', onListening);
  this.__httpServer.listen(port, host); // need to listen() first, it creates the internal _server (odd)
});

Proxy.prototype.stop = function (options, callback) {

  this.log.info('stopping proxy');
  this.__stopRateLimit();

  if (typeof options == 'function') callback = options;

  if (this.__httpServer) {
    try {
      this.__httpServer.close();
      callback();
    }catch(err){
      callback(err);
    }
    finally {
      this.__proxyServer.removeListener('error', this.__onProxyErrorListener);
      this.__httpServer.removeListener('error', this.__onServerErrorListener);
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
