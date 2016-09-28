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

  this.happn.log.info('### initialising proxy...');

  try {
    property(this, 'happn', this.happn);
    property(this, 'config', config);

    this.__targetAddress = this.__getTargetAddress();
    var protocol = this.__targetAddress.protocol;
    var isSecure = this.__targetAddress.protocol.indexOf('https') > -1;

    var opts = {
      target: this.__targetAddress.address,
      ws: protocol.toLowerCase() == 'ws',
      secure: isSecure,
      ssl: isSecure == 'true' ? {
        key: this.config.key,
        cert: this.config.cert
      } : null
    };

    this.__proxyServer = proxy.createProxyServer(opts);

    this.__proxyServer.on('error', function (err, req, res) {
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      });

      res.end('The proxy encountered an error: ' + err);
    });

    callback(null, this.__proxyServer);

  } catch (err) {
    console.log(err);
    return callback(err);
  }
};

Proxy.prototype.start = Promise.promisify(function (callback) {

  this.happn.log.info('### starting proxy...');

  try {
    var listenPort = this.config.listenPort;
    var result = this.__proxyServer.listen(listenPort);

    this.happn.log.info('### proxy listening on: ' + listenPort + '; internal target address: ' + this.__targetAddress.address);

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

  // TODO: get this to detect the protocol correctly when not using websockets
  var protocol = 'ws'; //this.happn.config.transport.mode;
  var address = getAddress();
  var port = this.happn.config.port;
  var result = protocol + '://' + address + ':' + port;

  return {address: result, protocol: protocol};
};

module.exports = Proxy;
