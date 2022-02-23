//____________________________ SERVICE-REGISTRY ENTRY_____________
const Member = require("./member");
// const cloneMember = require("../../utils/cloneMember");
module.exports = class ServiceEntry {
  constructor(name, expected, orchestrator) {
    this.name = name;
    this.expected = expected;
    this.myEndpoint = orchestrator.endpoint;
    this.orchestrator = orchestrator;
    this.endpoints = [];
    this.members = {};
  }

  static create(name, expected, orchestrator) {
    return new ServiceEntry(name, expected, orchestrator);
  }

  get found() {
    return this.endpoints.length;
  }

  get peers() {
    return Object.values(this.members).filter(member => member.peer);
  }

  get numPeers() {
    return this.peers.length;
  }

  get peersFulfilled() {
    return this.numPeers >= this.expected;
  }

  get connected() {
    return Object.values(this.members).filter(member => member.connected)
      .length;
  }

  get foundEnoughPeers() {
    return this.found >= this.expected;
  }

  get isConnected() {
    return this.connected >= this.expected;
  }

  get isSatisfied() {
    return this.peers.length >= this.expected;
  }

  get foundOthers() {
    return this.endpoints.includes(this.myEndpoint)
      ? this.endpoints.length > 1
      : this.endpoints.length > 0;
  }

  setEndpoints(found) {
    this.endpoints = found || [];
    Object.keys(this.members).forEach(endpoint => {
      if (!this.endpoints.includes(endpoint)) {
        this.members[endpoint].stop();
        this.orchestrator.removePeer(this.members[endpoint]);
        delete this.members[endpoint];
      }
    });
  }

  addMembers() {
    for (let endpoint of this.endpoints) {
      this.members[endpoint] =
        this.members[endpoint] ||
        new Member({ endpoint }, this.orchestrator, this);
    }
  }

  async connect(loginConfig) {
    for (let member of Object.values(this.members)) {
      member.connect(loginConfig);
    }
  }

  async stop() {
    return Promise.all(
      Object.values(this.members).map(member => member.stop())
    );
  }

  async subscribe() {
    for (let member of Object.values(this.members)) {
      member.subscribe();
    }
  }

  async connectionFrom(member) {
    if (!this.members[member.endpoint]) {
      this.members[member.endpoint] = new Member(member, this.orchestrator);
    }
    this.members[member.endpoint].connectionFrom(member);
    await this.members[member.endpoint].connect(
      this.orchestrator.getLoginConfig()
    );
    return this.orchestrator.__stateUpdate(this.members[member.endpoint]);
  }

  async disconnectionFrom(member) {
    if (!this.members[member.endpoint]) return;
    this.members[member.endpoint].connectedFrom = false;
    return this.orchestrator.__stateUpdate(this.members[member.endpoint]);
  }
};
