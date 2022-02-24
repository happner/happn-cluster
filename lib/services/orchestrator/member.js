var Happn = require("happn-3");
//____________________MEMBER____________
module.exports = class Member {
  constructor(info, orchestrator) {
    this.listedAsPeer = false;
    this.orchestrator = orchestrator;
    this.log = this.orchestrator.log;
    this.updateOwnInfo(info);

    this.self = false;
    this.connectingTo = false;
    this.connectedTo = false;
    this.connectedFrom = false;
    this.client = null;
    this.subscribingTo = false;
    this.subscribedTo = false;

    // // TODO: not truly stabilised until we know the remote has subscribed to us
    // this.subscribedFrom = true; // (not possible to detect yet)

    this.HappnClient = Happn.client;
    if (this.endpoint === this.orchestrator.endpoint) {
      this.self = true;
      this.name = this.orchestrator.happn.name;
      this.connectedTo = true; // member does not connect to...
      this.connectedFrom = true; // ...or from itselfurl
      this.subscribedTo = true;
      this.connectingTo = false;
      this.client = this.orchestrator.localClient;
    }
    this.orchestrator.__stateUpdate(this);
  }

  static create(info, orchestrator) {
    return new Member(info, orchestrator);
  }

  updateOwnInfo(info) {
    let { endpoint, name, serviceName } = info;
    this.name = name || this.name;
    this.endpoint = endpoint || this.endpoint;
    [this.address, this.port] = this.endpoint.split(":");
    this.serviceName = serviceName || this.serviceName;
  }

  get connected() {
    return this.connectedTo && this.connectedFrom;
  }

  get peer() {
    return (
      this.name &&
      this.connectedTo &&
      this.connectedFrom &&
      this.subscribedTo &&
      !this.error
    );
  }

  get readyToSubscribe() {
    return this.connectedTo && !this.subscribingTo && !this.subscribedTo;
  }

  async connect(loginConfig) {
    if (this.connectingTo || this.connectedTo) return;
    this.connectingTo = true;
    loginConfig.url = loginConfig.protocol + "://" + this.endpoint;

    this.log.debug("connect to (->) %s", this.endpoint);
    if (!loginConfig.connectTimeout) loginConfig.connectTimeout = 5000;
    let client;
    try {
      client = await this.HappnClient.create(loginConfig);
    } catch (error) {
      let thisError = error.error || error;
      this.connectingTo = false;
      this.log.warn("FAILED connection to  %s", loginConfig.url);
      this.log.warn(thisError.toString());
      this.orchestrator.removeMember(this);
      return;
    }
    this.connectingTo = false;
    this.connectedTo = true;
    this.client = client;
    this.name = client.serverInfo.name;
    this.orchestrator.__stateUpdate(this);
    this.reservedMeta = [
      "created",
      "modified",
      "path",
      "type",
      "status",
      "published",
      "eventId",
      "sessionId",
      "action",
      "channel",
      "sessionId",
      "consistency",
      "publicationId"
    ];

    // return this.subscribe();
  }

  connectionFrom(member) {
    this.connectedFrom = true;
    this.updateOwnInfo(member);
    if (!this.connectedTo)
      return this.connect(this.orchestrator.getLoginConfig());
    this.orchestrator.__stateUpdate(this);
    // return this.subscribe();
  }

  async subscribe() {
    if (!this.readyToSubscribe) return;
    try {
      this.subscribingTo = true;
      await Promise.all(
        this.orchestrator.config.replicate.map(this.__subscribe.bind(this))
      );
      this.subscribingTo = false;
      this.subscribedTo = true;
    } catch (error) {
      this.error = error;
      this.subscribingTo = false;
      this.subscribedTo = false;
    } finally {
      this.orchestrator.__stateUpdate(this);
    }
  }

  async __subscribe(path) {
    if (!path) return;
    try {
      await this.client.on(path, null, this.__createReplicationEventHandler());
    } catch (error) {
      this.log.fatal("could not subscribe to %s at %s", path, this.name, error);
      throw error;
    }
  }

  async stop() {
    if (this.client == null || this.client.status === 2) return; //dont try disconnect again
    return this.client.disconnect();
  }

  __onHappnDisconnect() {
    this.log.debug(
      "disconnected/reconnecting to (->) %s/%s",
      this.clusterName,
      this.name
    );
    this.connectedFrom = false;
    if (!this.connectedTo) return;
    this.connectedTo = false;
    this.orchestrator.__stateUpdate(this);
    // leave it in reconnect loop until DB confirms
  }

  onHappnReconnect() {
    this.log.debug("reconnected to (->) %s/%s", this.clusterName, this.name);
    if (this.connectedTo) return;
    this.connectedTo = true;
    this.orchestrator.__stateUpdate(this);
  }

  __createReplicationEventHandler() {
    let rePublisher = (data, meta) => {
      let subscription = this.orchestrator.happn.services.subscription;
      let publisher = this.orchestrator.happn.services.publisher;
      let action, payload, message, eventId;

      try {
        action = meta.action.substr(
          meta.action.indexOf("/") + 1,
          meta.action.indexOf("@") - 1
        );
        action = action.toLowerCase();

        meta.action = action;
        delete meta.type;

        eventId = meta.publicationId.split("-").pop();

        payload = { data: data, _meta: meta, action: action };
        message = {
          session: {
            id: meta.sessionId
          },
          request: {
            action: action,
            path: meta.path,
            data: data,
            eventId: eventId,
            options: {
              noCluster: true, // don't emit back into cluster
              meta: {}
            }
          },
          response: payload
        };

        Object.keys(meta).forEach(key => {
          if (this.reservedMeta.indexOf(key) >= 0) return;
          message.request.options.meta = message.request.options.meta || {};
          message.request.options.meta[key] = meta[key];
        });
      } catch (error) {
        // happn changed meta format, unable to replicate, make big noise
        return this.__emitReplicationError(
          error,
          "unexpected meta format, cannot replicate"
        );
      }

      try {
        message.recipients = subscription.getRecipients(message);
        publisher.processPublish(message, function(error) {
          if (error)
            return this.__emitReplicationError(
              error,
              "error doing processPublish, cannot replicate"
            );
        });
      } catch (error) {
        return this.__emitReplicationError(
          error,
          "error doing getRecipients, cannot replicate"
        );
      }
    };
    return rePublisher.bind(this);
  }
  // Convert event received by subscription to remote peer into the format
  // necessary to re publish directly to local clients !ONLY!
  // (not publishing back into the cluster to prevent infinite loop)
  //
  // Samples:
  //
  // Incoming data: {
  //   "testField": "testValue"
  // }
  //
  // Incoming meta: {
  //   "created": 1475681648606,
  //   "modified": 1475681648606,
  //   "path": "/EVENT_PROPAGATION_DATA/test1",
  //   "type": "data",
  //   "sessionId": "40e5f13c-cd4f-413e-96c8-7815d4189ec0",
  //   "action": "/SET@/EVENT_PROPAGATION_DATA/test1",
  //   "channel": "/ALL@/*"
  // }
  //
  // ... convert to ...
  //
  // For publishing: expected MESSAGE: {
  //   "action": "set",
  //   "eventId": 3, <------------------------------------------------- unable to map (appears to not matter)
  //   "path": "/EVENT_PROPAGATION_DATA/test1",
  //   "data": {
  //     "testField": "testValue"
  //   },
  //   "sessionId": "b9f72c4e-b17b-458f-b109-0092a51351f5",
  //   "protocol": "1.1.0", <------------------------------------------ ?
  //   "options": {}
  // }
  //
  // For publishing: expected PAYLOAD: {
  //   "data":{
  //     "testField": "testValue"
  //   },
  //   "_meta": {
  //     "created": 1475681381390,
  //     "modified": 1475681381390,
  //     "path": "/EVENT_PROPAGATION_DATA/test1",
  //     "type": "response", <----------------------------------------- unable to map (appears to not matter)
  //     "status": "ok", <--------------------------------------------- unable to map (appears to not matter)
  //     "published": false, <----------------------------------------- unable to map (appears to not matter)
  //     "eventId": 3, <----------------------------------------------- unable to map (appears to not matter)
  //     "sessionId": "b9f72c4e-b17b-458f-b109-0092a51351f5",
  //     "action": "set"
  //
  //     "channel"
  //     "sessionId"
  //     "consistency"
  //     "publicationId"
  //
  //   }
  // }
  //
  //

  __emitReplicationError(error, message) {
    if (!this.orchestrator._events || !this.orchestrator._events.error) {
      // only log fatal if there is no error handler
      this.log.fatal(message, error);
    }
    // will crash process unless there is an error listener
    return this.orchestrator.emit("error", error);
  }
};
