module.exports = Member;

var Promise = require('bluebird');
var clone = require('clone');

var property = require('../../utils/property');
var getter = require('../../utils/getter');

function Member(parameters) {
  var _this = this;

  var member = parameters.member;
  var memberFromLogin = parameters.memberFromLogin;
  var orchestrator = parameters.orchestrator;
  var localClient = parameters.localClient;
  var mapper = parameters.eventMapper;
  var clusterName = parameters.clusterName;

  property(this, 'orchestrator', orchestrator);
  property(this, 'log', orchestrator.log);
  property(this, 'eventMapper', mapper);
  property(this, 'clusterName', clusterName);
  property(this, 'HappnClient', orchestrator.HappnClient);

  // this member represents self in the cluster
  this.self = false;

  // happn.name
  this.name = null;

  // this member's id (remote swim host)
  this.memberId = null;

  // true when swim discovers
  this.member = false;

  // login in progress
  this.connectingTo = true;

  // got happn connection to remote happn
  this.connectedTo = false;

  // got happn connection from remote happn
  this.connectedFrom = false;

  // set to false on subscription success
  this.subscribedTo = false;

  // TODO: not truly stabilised until we know the remote has subscribed to us
  this.subscribedFrom = true; // (not possible to detect yet)

  // orchestrator.stabilized() discovers this error and this
  // whole cluster node fails to start because it could not
  // login to one of the other members
  //
  // populate it with happn login error or subscribe error
  this.error = null;

  if (localClient) {
    this.self = true;
    this.name = this.orchestrator.happn.name;
    this.connectedTo = true; // member does not connect to...
    this.connectedFrom = true; // ...or from itself
    this.connectingTo = false;
    this.subscribedTo = true; // member does not replicate itself
    getter(this, 'client', localClient);
  }

  // member present only if SWIM got first notice of new member
  if (member) {
    this.memberId = member.memberId;
    this.member = true;
    this.connect(member);
  }

  // memberFromLogin present only if happn got first notice of new member (via inbound login)
  if (memberFromLogin) {
    this.memberId = memberFromLogin.memberId;
    this.name = memberFromLogin.name;
    this.connect(memberFromLogin);
  }

}

Member.prototype.connect = function (member) {
  var _this = this;
  var login = clone(this.orchestrator.loginConfig);

  this.log.debug('connect to (->) %s', member.url);

  login.config.url = member.url;

  // login.config.username = '_ADMIN';
  // login.config.password = 'xxx';

  this.HappnClient.create(login, function (error, client) {

    if (error) {

      if (error.code == 'ECONNREFUSED') {
        // This happens when we join, get list of remotes and simultaneously
        // one of them shuts down. We don't get the notification from swim
        // in time to know not to login.
        //
        // And we don't want to fail starting this node because another shut down
        // at the same time as we joined.
        _this.log.warn('FAILED connection to departed %s', login.config.url);
        _this.orchestrator.__removeMember(_this);
        return;
      }

      // ignore second error after ECONNREFUSED
      // https://github.com/happner/happn/issues/138
      if (!_this.orchestrator.members[_this.memberId]) return;

      _this.error = error;
      _this.log.fatal('could not login to %s', login.config.url, error);
      _this.orchestrator.__stateUpdate();
      return;
    }

    _this.connectingTo = false;
    _this.connectedTo = true;

    getter(_this, 'client', client);
    _this.name = client.serverInfo.name;

    property(_this, '__disconnectSubscriptionId',
      client.onEvent('connection-ended', _this.__onHappnDisconnect.bind(_this))
    );

    property(_this, '__retryConnectSubscriptionId',
      client.onEvent('reconnect-scheduled', _this.__onHappnDisconnect.bind(_this))
    );

    property(_this, '__reconnectSubscriptionId',
      client.onEvent('reconnect-successful', _this.__onHappnReconnect.bind(_this))
    );

    Promise.resolve(_this.orchestrator.config.replicate)

      .map(_this.__subscribe.bind(_this))

      .catch(function (error) {
        _this.error = error;
        _this.orchestrator.__stateUpdate();
      })

      .then(function () {
        _this.subscribedTo = true;
        _this.orchestrator.__stateUpdate();
      });

  });
};

Member.prototype.removeMembership = function (info) {
  this.member = false; // swim detected faulty
};

Member.prototype.addMembership = function (info) {
  this.member = true; // swim detected join
};

Member.prototype.stop = Promise.promisify(function (callback) {
  if (!this.client) return callback();
  var _this = this;

  if (typeof this.__disconnectSubscriptionId !== 'undefined') {
    this.client.offEvent(this.__disconnectSubscriptionId);
  }

  if (typeof this.__retryConnectSubscriptionId !== 'undefined') {
    this.client.offEvent(this.__retryConnectSubscriptionId);
  }

  if (typeof this.__reconnectSubscriptionId !== 'undefined') {
    this.client.offEvent(this.__reconnectSubscriptionId);
  }

  if (this.connectedTo) return this.client.disconnect(function (e) {
    delete _this.client;
    callback(e);
  });

  // can't logout/disconnect without remote server, do it manually

  this.client.pubsub.on('destroy', function () {
    _this.client.session = null;
    _this.client.initialized = false;
    delete _this.client;
    callback();
  });

  this.client.pubsub.destroy();
});

Member.prototype.__onHappnDisconnect = function () {
  this.log.debug('disconnected/reconnecting to (->) %s/%s', this.clusterName, this.name);

  if (!this.connectedTo) return;
  this.connectedTo = false;

  if (!this.member) { // swim also has this as departed the cluster, remove it
    this.orchestrator.__removePeer(this);
    this.orchestrator.__removeMember(this);
    return;
  }

  // otherwise, leave it in reconnect loop until swim confirms
  // but remove from peers as unusable
  this.orchestrator.__removePeer(this);
};

Member.prototype.__onHappnReconnect = function () {
  this.log.debug('reconnected to (->) %s/%s', this.clusterName, this.name);
  if (this.connectedTo) return;
  this.connectedTo = true;
  this.orchestrator.__stateUpdate();
};

Member.prototype.__subscribe = function (path) {
  var _this = this;
  return new Promise(function(resolve, reject) {

    _this.client.on(path, null, _this.__getClientEventHandler(), function(error) {
      if (error) {
        _this.log.fatal('could not subscribe to %s', path, error);
        return reject(error);
      }
      resolve();
    });
  });
};

Member.prototype.__getClientEventHandler = function () {
  var _this = this;

  return function (data, meta) {

    // only propagate if the event origin is NOT from the cluster
    if (meta.eventOrigin == undefined || meta.eventOrigin == null) {

      _this.eventMapper.mapMemberEventToPubSubData(data, meta, _this.clusterName, function (err, result) {

        if (err)
          return console.log('ERROR: ' + err);

        console.log('PUBLISHING EVENT....');
        _this.orchestrator.happn.services.pubsub.publish(result.message, result.payload);
      })
    }
  };
};
