module.exports = Member;

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Happn = require('happn');
var Promise = require('bluebird');
var clone = require('clone');

var property = require('../../utils/property');

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

  // got happn connection to remote happn
  this.connectedTo = false;

  // got happn connection from remote happn
  this.connectedFrom = false;

  // login / subscribe in progress
  this.connecting = false;

  if (localClient) {
    this.self = true;
    this.name = this.orchestrator.happn.name;
    this.connectedTo = true;
    this.connectedFrom = true;
    this.connecting = false;
    property(this, 'client', localClient);
  }

  // orchestrator.stabilized() discovers this error and this
  // whole cluster node fails to start because it could not
  // login to one of the other members
  //
  // populate it with happn login error or subscribe error
  this.error = null;

  // member present only if SWIM got first notice of new member
  if (member) this.connect(member);

}

util.inherits(Member, EventEmitter);

Member.prototype.connect = function (member) {
  var _this = this;
  var login = clone(this.orchestrator.loginConfig);

  this.log.info('connect to %j', member);

  this.memberId = member.memberId;
  login.info.memberId = this.memberId;
  login.config.url = member.url;

  // login.config.username = '_ADMIN';
  // login.config.password = 'xxx';

  this.connecting = true;

  Happn.client.create(login, function (error, client) {

    // TODO: move these to after subscribe success
    _this.connecting = false;
    _this.connectedTo = true;

    if (error) {
      _this.error = error;
      _this.emit('error', error);
      return;
    }

    property(_this, 'client', client);
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

  });
};

Member.prototype.depart = function (info) {
  // console.log('depart', this);
};

Member.prototype.resume = function (info) {
  // console.log('resume', this);
};

Member.prototype.stop = Promise.promisify(function (callback) {
  if (!this.client) return callback();

  if (typeof this.__disconnectSubscriptionId !== 'undefined') {
    this.client.offEvent(this.__disconnectSubscriptionId);
  }

  if (typeof this.__retryConnectSubscriptionId !== 'undefined') {
    this.client.offEvent(this.__retryConnectSubscriptionId);
  }

  if (typeof this.__reconnectSubscriptionId !== 'undefined') {
    this.client.offEvent(this.__reconnectSubscriptionId);
  }

  this.client.disconnect(callback);
});

Member.prototype.__onHappnDisconnect = function () {
  console.log('connection-ended/reconnect-scheduled', this.name);
};

Member.prototype.__onHappnReconnect = function () {
  console.log('reconnect-successful', this.name);
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

