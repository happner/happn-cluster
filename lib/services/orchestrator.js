//____________________________ ORCHESTRATOR_________________
const _ = require("lodash");
const clone = require("clone");
const EventEmitter = require("events").EventEmitter;
const ServiceEntry = require("./orchestrator/serviceEntry");
const getAddress = require("../utils/get-address");
const CONSTANTS = require("./orchestrator/constants");
const goodInt = 6e3;
const cloneMember = require("../utils/cloneMember");
var property = require("../utils/property");

module.exports = class Orchestrator extends EventEmitter {
  constructor(opts) {
    super();
    this.log = opts.logger.createLogger("Orchestrator");
    this.constants = CONSTANTS.STATES;
    this.state = this.constants.WARMUP;
    return this;
  }

  static create(opts) {
    return new Orchestrator(opts);
  }

  initialize(config, callback) {
    this.config = config;
    console.log({ config });
    this.serviceName = this.config.serviceName;
    this.deployment = this.config.deployment;
    this.ip = getAddress()();
    this.url = this.ip + ":" + this.happn.config.port;
    this.registry = {};
    this.peers = {};
    this.clusterName = this.config.clusterName;
    // _.get(this.happn, "services.membership.config.clusterName") || //For backwards compatibility
    // _.get(
    //   this.happn,
    //   "services.orchestrator.config.clusterName",
    //   "happn-cluster" //Default
    // );
    for (let [service, expected] of Object.entries(this.config.cluster))
      this.registry[service] = ServiceEntry.create(service, expected, this);

    this.secure = this.happn.config.secure;

    this.loginConfig = {
      // used to login to remote cluster members as a cluster peer
      info: {
        name: this.happn.name, // a.k.a. mesh.name
        clusterName: this.clusterName,
        serviceName: this.serviceName,
        // memberId: this.happn.services.membership.memberId,
        url: this.url
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

    this.__onConnectionFromHandler = this.__onConnectionFrom.bind(this);
    this.happn.services.session.on("authentic", this.__onConnectionFromHandler);
    this.__onDisconnectionFromHandler = this.__onDisconnectionFrom.bind(this);
    this.happn.services.session.on(
      "disconnect",
      this.__onDisconnectionFromHandler
    );
    this.configureIntervals();
    this.startIntervals();
  }

  configureIntervals() {
    this.intervals = CONSTANTS.DEFAULTS.INTERVALS;
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

  async stabilised() {
    if (this.stableTimeout) return;
    if (this.config.stabiliseTimeout) {
      this.stableTimeout = setTimeout(() => {
        var error = new Error("failed to stabilise in time");
        error.name = "StabiliseTimeout";
        throw error;
      }, this.config.stabiliseTimeout);
    }
    this.updateState();
  }

  async stop(opts, cb) {
    if (typeof options === "function") cb = options;
    for (let info of Object.values(this.intervals)) {
      clearInterval(info.interval);
    }
    await Promise.all(
      Object.values(this.registry).map(service => service.stop())
    );
    if (cb) cb();
  }

  async memberCheck() {
    this.lookup();
    this.addMembers();
    this.connect();
    this.subscribe();
    this.updateState();
  }

  async lookup() {
    let addresses = await this.fetchIps();
    Object.entries(this.registry).forEach(([name, service]) =>
      service.setIps(addresses[name] || [])
    );
  }

  async fetchIps(service) {
    // Doing this in a seperate function so that we can alter it to allow for non-aws cases if desired.
    let data = await this.happn.services.data.get(
      `/SYSTEM/DEPLOYMENT/${this.deployment}/**`,
      { criteria: { "_meta.modified": { $gte: Date.now() - goodInt } } }
    );

    return data
      .map(entry => entry.data)
      .reduce((addressMap, { service, address }) => {
        addressMap[service] = addressMap[service] || [];
        addressMap[service].push(address);
        return addressMap;
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
    let keepAlivePath = `/SYSTEM/DEPLOYMENT/${this.deployment}/${this.serviceName}/${this.url}`;
    let keepAliveData = {
      service: this.serviceName,
      address: this.url
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

  addPeer(member) {
    if (this.peers[member.name]) return;

    this.peers[member.name] = member; // includes self by name
    if (member.self) property(this.peers, "__self", member); // non enumerable __self
    this.emit("peer/add", member.name, member);

    if (this.stableAwaitingMinimumPeers) {
      this.log.info(
        "cluster size %d/%d (%s arrived)",
        Object.keys(this.peers).length,
        this.config.minimumPeers,
        member.name
      );
      return;
    }
    this.log.info(
      "cluster size %d (%s arrived)",
      Object.keys(this.peers).length,
      member.name
    );
  }

  removePeer(member) {
    if (!this.peers[member.name]) return;

    delete this.peers[member.name];
    if (member.self) delete this.peers.__self;
    this.emit("peer/remove", member.name, member);

    if (this.stableAwaitingMinimumPeers) {
      this.log.info(
        "cluster size %d/%d (%s left)",
        Object.keys(this.peers).length,
        this.config.minimumPeers,
        member.name
      );
      return;
    }
    this.log.info(
      "cluster size %d (%s left)",
      Object.keys(this.peers).length,
      member.name
    );
  }

  updateState(member) {
    if (member) this.peerStatusUpdate(member);
    if (
      Object.values(this.registry).every(service => {
        return service.isConnected;
      })
    ) {
      if (this.state !== this.constants.STABLE)
        console.log(
          "SERVICE",
          this.serviceName,
          this.happn.name,
          " STABILIZED"
        ); //Leving this in as it is useful for testing, could be changed to a log.
      this.state = this.constants.STABLE;
      clearTimeout(this.stableTimeout);
      return;
    }
    if (
      Object.values(this.registry).every(service => service.foundEnoughPeers)
    ) {
      this.state = this.constants.CONNECTING;
      return;
    }
    if (Object.values(this.registry).some(service => service.foundOthers)) {
      this.state = this.constants.WARMUP_CONNECTING;
      return;
    }
    // ADD STATES FOR RECONNECTING
  }

  peerStatusUpdate(member) {
    if (member.peer) return this.addPeer(member);
    return this.removePeer(member);
  }

  __onConnectionFrom(data) {
    this.log.debug(
      "connect from (<-) %s/%s",
      data.info.clusterName,
      data.info.name
    );
    let { serviceName, url } = data.info;
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
};
