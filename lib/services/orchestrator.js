//____________________________ ORCHESTRATOR_________________
const _ = require("lodash");
const clone = require("clone");
const EventEmitter = require("events").EventEmitter;
const ServiceEntry = require("./orchestrator/serviceEntry");
const getAddress = require("../utils/get-address");
const CONSTANTS = require("./orchestrator/constants");
// const cloneMember = require("../utils/cloneMember");
const defaults = require("./orchestrator/defaults");
var property = require("../utils/property");
const service = require("happn-3/lib/service");
const NodeUtil = require("util");
// const { Promise } = require("bluebird");

module.exports = class Orchestrator extends EventEmitter {
  constructor(opts) {
    super();
    this.log = opts.logger.createLogger("Orchestrator");
    this.constants = CONSTANTS.STATES;
    this.state = this.constants.WARMUP;
    this.unstable = false;
    return this;
  }

  static create(opts) {
    return new Orchestrator(opts);
  }

  get peers() {
    let peers = Object.values(this.registry).reduce(
      (peers, service) => ({ ...peers, ...service.peers }),
      {}
    );
    let self = _.get(this.registry, `${this.servicename}.${this.endpoint}`);
    if (self && self.peer) property(peers, "__self", self);
    return peers;
  }
  get members() {
    return Object.values(this.registry).reduce(
      (members, service) => ({ ...members, ...service.members }),
      {}
    );
  }

  initialize(config, callback) {
    this.config = config;
    this.serviceName = this.config.serviceName;
    this.deployment = this.config.deployment;
    this.ip = getAddress()();
    this.endpoint = this.ip + ":" + this.happn.config.port;
    this.registry = {};
    this.clusterName = this.config.clusterName;
    this.keepaliveThreshold =
      config.keepaliveThreshold || defaults().KEEPALIVE_THRESHOLD;
    this.stabiliseWaiting = [];
    this.stabilised = NodeUtil.promisify(this.stabilised);
    for (let [service, expected] of Object.entries(this.config.cluster))
      this.registry[service] = ServiceEntry.create(service, expected, this);

    this.secure = this.happn.config.secure;

    this.config.replicate = this.config.replicate || ["*"];
    this.config.replicate.push("/__REPLICATE");
    this.config.replicate = this.__reducePaths(this.config.replicate);

    this.loginConfig = {
      // used to login to remote cluster members as a cluster peer
      info: {
        name: this.happn.name, // a.k.a. mesh.name
        clusterName: this.clusterName,
        serviceName: this.serviceName,
        // memberId: this.happn.services.membership.memberId,
        endpoint: this.endpoint
      }
    };

    if (this.secure) {
      this.adminUser = this.happn.services.security.config.adminUser;
      this.loginConfig.username = this.adminUser.username;
      this.loginConfig.password = this.adminUser.password;
    }

    callback();
  }

  async start() {
    var localLoginConfig = clone(this.loginConfig);
    delete localLoginConfig.info.clusterName;
    this.localClient = await this.happn.services.session.localClient(
      localLoginConfig
    );

    this.happn.services.session.on(
      "authentic",
      this.__onConnectionFrom.bind(this)
    );

    this.happn.services.session.on(
      "disconnect",
      this.__onDisconnectionFrom.bind(this)
    );

    this.configureIntervals();
    this.startIntervals();
  }

  configureIntervals() {
    this.intervals = defaults().INTERVALS;
    if (!this.config.intervals) return;
    for (let name of this.config.intervals) {
      if (this.intervals[name])
        this.intervals[name].time =
          this.config.intervals[name] || this.intervals[name].time;
    }
  }

  startIntervals() {
    for (let info of Object.values(this.intervals)) {
      this[info.method].call(this);
      info.interval = setInterval(this[info.method].bind(this), info.time);
    }
  }

  stabilised(callback) {
    if (this.stableTimeout) return;
    if (typeof callback === "function") this.stabiliseWaiting.push(callback);
    if (this.config.stabiliseTimeout) {
      this.stableTimeout = setTimeout(() => {
        var error = new Error("failed to stabilise in time");
        error.name = "StabiliseTimeout";
        while ((callback = this.stabiliseWaiting.shift()) !== undefined)
          callback(error);
        this.stop();
      }, this.config.stabiliseTimeout);
    }
    this.__stateUpdate();
  }

  async stop(opts, cb) {
    if (typeof options === "function") cb = opts;
    for (let info of Object.values(this.intervals)) {
      await clearInterval(info.interval);
    }

    await Promise.all(
      Object.values(this.registry).map(service => service.stop())
    );
    if (cb) cb();
  }

  memberCheck() {
    this.lookup();
    this.addMembers();
    this.connect();
    this.subscribe();
    this.__stateUpdate();
  }

  async lookup() {
    let endpoints = await this.fetchEndpoints();
    Object.entries(this.registry).forEach(([name, service]) =>
      service.setEndpoints(endpoints[name] || [])
    );
  }

  async fetchEndpoints() {
    // Doing this in a seperate function so that we can alter it to allow for non-aws cases if desired.
    let data = await this.happn.services.data.get(
      `/SYSTEM/DEPLOYMENT/${this.deployment}/**`,
      {
        criteria: {
          "_meta.modified": { $gte: Date.now() - this.keepaliveThreshold }
        }
      }
    );
    return data
      .map(entry => entry.data)
      .reduce((endpointMap, { service, endpoint }) => {
        endpointMap[service] = endpointMap[service] || [];
        endpointMap[service].push(endpoint);
        return endpointMap;
      }, {});
  }

  async connect() {
    for (let service of Object.values(this.registry)) {
      service.connect(this.getLoginConfig());
    }
  }
  async subscribe() {
    for (let service of Object.values(this.registry)) {
      service.subscribe();
    }
  }

  addMembers() {
    for (let service of Object.values(this.registry)) {
      service.addMembers();
    }
  }

  keepAlive() {
    let keepAlivePath = `/SYSTEM/DEPLOYMENT/${this.deployment}/${this.serviceName}/${this.endpoint}`;
    let keepAliveData = {
      service: this.serviceName,
      endpoint: this.endpoint
    };
    this.happn.services.data.upsert(keepAlivePath, keepAliveData);
  }

  getLoginConfig() {
    if (!this.loginConfig) return null;
    var config = {
      info: clone(this.loginConfig.info)
    };
    if (this.loginConfig.username)
      config.username = this.loginConfig.username.toString();
    if (this.loginConfig.password)
      config.password = this.loginConfig.password.toString();
    config.protocol = this.happn.services.transport.config.mode;
    return config;
  }

  peerStatusUpdate(member) {
    if (!member.serviceName) return;
    if (member.peer) return this.addPeer(member);
    return this.removePeer(member);
  }

  addPeer(member) {
    member.listedPeer = true;
    this.emit("peer/add", member.name, member);
    this.log.info(
      "cluster size %d (%s arrived)",
      Object.keys(this.peers).length,
      member.name
    );
  }

  removePeer(member) {
    member.listedPeer = false;
    // if (member.self) delete this.peers.__self;
    this.emit("peer/remove", member.name, member);

    this.log.info(
      "cluster size %d (%s left)",
      Object.keys(this.peers).length,
      member.name
    );
  }

  __stateUpdate(member) {
    if (member && member.listedAsPeer !== member.peer)
      this.peerStatusUpdate(member);
    if (
      Object.values(this.registry).every(service => {
        return service.peersFulfilled;
      })
    ) {
      if (this.state !== this.constants.STABLE) {
        this.log.info(
          `Node ${this.happn.name} in service ${this.serviceName} stabilized`
        );
      }
      let callback;
      while ((callback = this.stabiliseWaiting.shift()) !== undefined)
        callback();
      this.state = this.constants.STABLE;
      this.unstable = false;
      clearTimeout(this.stableTimeout);
      return;
    }

    if (this.state === this.constants.STABLE) this.unstable = true; //System was stable, but is no longer.

    if (Object.values(this.registry).every(service => service.isConnected)) {
      this.state = this.unstable
        ? this.constants.UNSTABLE_RESUBSCRIBING
        : this.constants.SUBSCRIBING;
      return;
    }
    if (
      Object.values(this.registry).every(service => service.foundEnoughPeers)
    ) {
      this.state = this.unstable
        ? this.constants.UNSTABLE_RECONNECTING
        : this.constants.CONNECTING;
      return;
    }
    if (Object.values(this.registry).some(service => service.foundOthers)) {
      this.state = this.unstable
        ? this.constants.UNSTABLE_INSUFFICIENT_PEERS
        : this.constants.WARMUP_CONNECTING;
      return;
    }
    this.state = this.constants.ISOLATED;
  }

  healthReport() {
    this.log.info(
      `Member: name ${this.happn.name}, endpoint: ${this.endpoint}, service: ${this.serviceName}, state: ${this.state}`
    );

    let peerReport = Object.values(this.registry)
      .map(service => {
        return `\tService ${service.name} has ${service.numPeers} peers of ${service.expected} required`;
      })
      .join("\n");
    this.log.info(`Node: ${this.happn.name} breakdown: \n` + peerReport);
  }

  __onConnectionFrom(data) {
    if (!data.info) return;
    if (!data.info.clusterName) return;
    this.log.debug(
      "connect from (<-) %s/%s",
      data.info.clusterName,
      data.info.name
    );
    const { serviceName } = data.info;
    this.registry[serviceName].connectionFrom(data.info);
  }

  __onDisconnectionFrom(data) {
    if (!data.info || !data.info.clusterName || !data.info.serviceName) return;
    this.log.debug(
      "disconnect from (<-) %s/%s",
      data.info.clusterName,
      data.info.name
    );
    if (data.info.clusterName !== this.clusterName) return;
    this.registry[data.info.serviceName].disconnectionFrom(data.info);
  }

  __reducePaths = function(paths) {
    if (paths.length === 1) return paths;

    //* means match anything
    if (
      paths.some(path => path === "*") )
      return ["*"];

    //remove any duplicates
    let returnPaths = paths.filter((v, i) => paths.indexOf(v) === i);

    let wildPaths = returnPaths.reduce((arr, path) => {
      if (path.indexOf("*") > -1) arr.push(path.split("/"));
      return arr;
    }, []);

    let tamePaths = returnPaths.reduce((arr, path) => {
      if (path.indexOf("*") === -1) arr.push(path.split("/"));
      return arr;
    }, []);

    for (let wildPathArr of wildPaths) {
      for (let tamePathArr of tamePaths) {
        if (tamePathArr.length === wildPathArr.length) {
          //same amount of segments
          let wildPath = wildPathArr.join("/");
          let tamePath = tamePathArr.join("/");
          if (
            tamePath.match(new RegExp(wildPath.replace(/\*/g, ".*"))) != null
          ) {
            returnPaths.splice(returnPaths.indexOf(tamePath), 1);
          }
        }
      }
    }

    return returnPaths;
  };
};
