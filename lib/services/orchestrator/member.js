module.exports = Member;

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Happn = require('happn');
var Promise = require('bluebird');
var clone = require('clone');

var property = require('../../utils/property');
var getter = require('../../utils/getter');

function Member(parameters) {
  var _this = this;

  var member = parameters.member;
  var orchestrator = parameters.orchestrator;
  var localClient = parameters.localClient;
  var mapper = parameters.eventMapper;
  var clusterName = parameters.clusterName;

  property(this, 'orchestrator', orchestrator);
  property(this, 'log', orchestrator.log);
  property(this, 'eventMapper', mapper);
  property(this, 'clusterName', clusterName);

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
  this.subscribedFrom = true; // (not possible detect yet)

  if (localClient) {
    this.self = true;
    this.name = this.orchestrator.happn.name;
    this.connectedTo = true; // member does not connect to...
    this.connectedFrom = true; // ...or from itself
    this.connectingTo = false;
    this.subscribedTo = true; // member does not replicate itself
    getter(this, 'client', localClient);
  }

  // orchestrator.stabilized() discovers this error and this
  // whole cluster node fails to start because it could not
  // login to one of the other members
  //
  // populate it with happn login error or subscribe error
  this.error = null;

  // member present only if SWIM got first notice of new member
  if (member) {
    this.memberId = member.memberId;
    this.member = true;
    this.connect(member);
  }

}

util.inherits(Member, EventEmitter);

Member.prototype.connect = function (member) {
  var _this = this;
  var login = clone(this.orchestrator.loginConfig);

  this.log.debug('connect to %j', member);

  login.config.url = member.url;

  // login.config.username = '_ADMIN';
  // login.config.password = 'xxx';

  Happn.client.create(login, function (error, client) {

    _this.connectingTo = false;
    _this.connectedTo = true;

    if (error) {
      _this.error = error;
      _this.log.error('could not login to %s', login.config.url, error);
      return;
    }

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

    // TODO: handle error
    // TODO: subscribe to connection events

    console.log('## Creating member client: ' + _this.name);
    console.log(_this.orchestrator.config);

    console.log('## MEMBER COUNT: ' + Object.keys(_this.orchestrator.members).length);
    console.log('## MEMBER NAME: ' + _this.name);

    /*
     SUBSCRIBE TO PATHS ON REMOTE:
     A back channel client is created for each new member that is added to the member list.
     We need to do the following:
     - subscribe to events on the remote member
     - any events that are detected on the remote member must be propagated up to any clients listening on the
     local member
     - however the event propagation must EXCLUDE the remote listening member that initiated the event (as this is
     also a listening client due to the 2-way nature of the cluster members)
     */

    // lets try and do WILDCARD subscription to paths on remote
    client.on('/*', null, _this.__getClientEventHandler(), _this.__handleClientCallback);


    // TODO: set this.subscribedTo to true on success of ALL subscriptions
    // TODO: set this.error with error on failure to subscribe
    // TODO: call orchestrator.__stateUpdate after subscription success

    _this.subscribedTo = true;
    _this.orchestrator.__stateUpdate();
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

  if (this.connectedTo) return this.client.disconnect(function(e) {
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
  console.log('connection-ended/reconnect-scheduled', this.name);
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
  if (this.connectedTo) return;
  this.connectedTo = true;
  this.log.warn('TODO: (stabilize) connectedTo', this.name);
  this.orchestrator.__stateUpdate();
};

Member.prototype.__getClientEventHandler = function () {

  var self = this;

  return function (data, meta) {

    // only propagate if the event origin is NOT from the cluster
    if (meta.eventOrigin == undefined || meta.eventOrigin == null) {

      self.eventMapper.mapMemberEventToPubSubData(data, meta, self.clusterName, function (err, result) {

        if (err)
          return console.log('ERROR: ' + err);

        console.log('PUBLISHING EVENT....');
        self.orchestrator.happn.services.pubsub.publish(result.message, result.payload);
      })
    }
  };
};

Member.prototype.__handleClientCallback = function (err) {
  if (err)
    console.log('## Error on subscribing to event: ' + err)
};

