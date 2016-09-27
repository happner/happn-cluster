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

  property(this, 'happn', this.happn);
  property(this, 'config', config);

  try {
    this.happn.log.info('### initialising proxy...');

    var targetAddress = this.__getTargetAddress();
    var protocol = targetAddress.protocol;
    var isSecure = targetAddress.protocol.indexOf('https') > -1;

    var opts = {
      target: targetAddress.address,
      ws: protocol.toLowerCase() == 'ws',
      secure: isSecure,
      ssl: isSecure == 'true' ? {
        key: this.config.key,
        cert: this.config.cert
      } : null
    };

    this.__proxyServer = proxy.createProxyServer(opts);

    callback(null, this.__proxyServer);

  } catch (err) {
    console.log(err);
    return callback(err);
  }
};

// for testing
Proxy.prototype.init = Promise.promisify(function (callback) {
  return this.initialize(callback);
});

Proxy.prototype.start = Promise.promisify(function (callback) {

  var self = this;
  this.happn.log.info('### starting proxy...');

  var listenPort = this.config.listenPort;

  try {
    var result = this.__proxyServer.listen(listenPort);
    this.happn.log.info('### proxy listening on: ' + listenPort);

    //TODO: add listening proxy ports to member list so that we can iterate and send messages
    //self.__members[](listenPort);

    callback(null, result);
  } catch (err) {
    callback(err);
  }
});

Proxy.prototype.stop = Promise.promisify(function (callback) {

  this.happn.log.info('### stopping proxy...');

  try {
    this.__proxyServer.close();
    callback();
  } catch (err) {
    callback(err)
  }
});

Proxy.prototype.__getTargetAddress = function () {

  var protocol = this.happn.config.transport.mode;
  var address = getAddress();
  var port = this.happn.port;
  var result = protocol + '://' + address + ':' + port;

  return {address: result, protocol: protocol};
};

module.exports = Proxy;
