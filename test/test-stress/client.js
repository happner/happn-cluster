const {EventEmitter} = require('events');
const HappnClient = require('happn-3').client;

module.exports = class Client extends EventEmitter {
  constructor(){
    super();
  }

  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async connect(url, clientsController){
    this.emit('connecting', url);
    var connectedStarted = Date.now();
    HappnClient.create({
      config: {
        url,
        username: '_ADMIN',
        password: 'happn'
      },
      secure: true
    }).then(client => {
      this.connected = true;
      this.client = client;
      this.client.onEvent('reconnect-scheduled', () => {
        this.emit('reconnect-scheduled', this);
      });
      this.client.onEvent('reconnect-successful', () => {
        this.emit('connected', this);
      });
      this.emit('connected', this);
      this.clientsController = clientsController;
    }).catch((e) => {
      this.emit(`error`, `connection-failure: ${e.message}, after ${Date.now() - connectedStarted}`);
      setTimeout(() => {
        this.connect(url, clientsController);
      }, this.getRandomInt(30000, 60000));
    });
  }

  disconnect(){
    return new Promise((resolve, reject) => {
      if (this.connected) return resolve();
      this.client.disconnect((e) => {
        if (e) {
          this.emit(`error`, `disconnect failed: ${e.message}`);
          return reject(e);
        }
        this.connected = false;
        this.client = undefined;
        this.emit('disconnected', this);
        resolve();
      });
    });
  }

  stopActivity(){
    if (this.__activityInterval) {
      clearInterval(this.__activityInterval);
      this.client.offPath('test/1/*', (e) => {
        if (e) this.clientsController.activityStats.unsubscribeerrors++;
      });
    }
  }

  doActivity(interval) {
    this.client.on('test/1/*', () => {
      this.clientsController.activityStats.events++;
    }, (e) => {
      if (e) this.clientsController.activityStats.subscribeerrors++;
    });
    var requestCount = 0;
    this.__activityInterval = setInterval(() => {
      requestCount++;
      this.client.set(`test/1/${this.client.session.id}`, { from:this.client.session.id, count: requestCount}, (e) => {
        if (e) return this.clientsController.activityStats.errors++;
        return this.clientsController.activityStats.sets++;
      });
    }, interval || 10000);
  }

  subscribe(path, options, handler){
    if (typeof options == 'function'){
      handler = options;
      options = {};
    }
    return new Promise((resolve, reject) => {
      if (!this.connected) return reject(new Error('not connected'));
      this.client.on(path, options, handler, (e, data) => {
        if (e) return reject(e);
        resolve(data);
      });
    });
  }

  publish(path, data, options){
    return new Promise((resolve, reject) => {
      if (!this.connected) return reject(new Error('not connected'));
      this.client.set(path, data, options, (e, response) => {
        if (e) return reject(e);
        resolve(response);
      });
    });
  }
};
