var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');

function LocalClient(){
  this._local = true;
}

util.inherits(LocalClient, EventEmitter);

LocalClient.prototype.write = function(message){
  console.log('did write:>', message);
};

//needs to be here
LocalClient.prototype.removeAllListeners = function(instruction){

};

LocalClient.prototype.__disconnect = function(event, data){
  // var _this = this;
  //
  // _this.context.services.session.clientDisconnect(_this, function(e){
  //
  //   if (e) _this.context.services.error.handleSystem(e);
  //
  //   if (data) _this.write(data);
  //
  //   //instead of doing a check every time we try do a write
  //   _this.write = function(){
  //     throw new Error('client is disconnected');
  //   };
  //
  //   _this.emit(event, data);
  // })

  console.log('did __disconnect:>', message);
};

LocalClient.prototype.end = function(data){
  return this.__disconnect('end', data);
};

LocalClient.prototype.destroy = function(data){
  return this.__disconnect('destroy', data);
};

//events open, error, data, reconnected, reconnect timeout, reconnect scheduled

function LocalClientWrapper(){

  this.clientType = 'eventemitter';

  this.__getConnection = function (callback) {

    var client = new LocalClient();

    // Object.defineProperty(client, 'context', {value:this.context});
    // Object.defineProperty(client, 'handle_publication', {value:this.handle_publication.bind(this)});
    // Object.defineProperty(client, 'handle_response', {value:this.handle_response.bind(this)});
    //
    // client.sessionProtocol = 'happn_' + require('../../../package.json').protocol;

    this.context.services.session.onConnect(client);

    this.__client = client;

    return callback(null, client);
  };

}

module.exports = new LocalClientWrapper();
