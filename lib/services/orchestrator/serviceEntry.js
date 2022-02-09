//____________________________ SERVICE-REGISTRY ENTRY_____________
const Member = require("./member");
const cloneMember = require("../../utils/cloneMember");
module.exports = class ServiceEntry {
  constructor(name, expected, orchestrator) {
    this.name = name;
    this.expected = expected;
    this.ip = orchestrator.ip;
    this.orchestrator = orchestrator;
    this.addresses = [];
    this.members = {};
  }

  static create(name, expected, orchestrator) {
    return new ServiceEntry(name, expected, orchestrator);
  }

  get found() {
    return this.addresses.length;
  }

  get peers() {
    return Object.values(this.members).filter(member => member.peer);
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
    return this.addresses.includes(this.ip)
      ? this.addresses.length > 1
      : this.addresses.length > 0;
  }

  setIps(foundIps) {
    this.addresses = foundIps || [];
    Object.keys(this.members).forEach(address => {
      if (!this.addresses.includes(address)) {
        this.orchestrator.removePeer(this.members[address]);
        delete this.members[address];
      }
    });
  }

  addMembers() {
    for (let address of this.addresses) {
      this.members[address] =
        this.members[address] ||
        new Member({ url: address }, this.orchestrator, this);
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
      if (member.readyToSubscribe) await member.subscribe();
    }
  }

  async connectionFrom(member) {
    if (!this.members[member.url]) {
      this.members[member.url] = new Member(member, this.orchestrator);
    }
    this.members[member.url].connectionFrom(member);
    await this.members[member.url].connect(this.orchestrator.getLoginConfig());
    return this.orchestrator.updateState(this.members[member.url]);
  }

  async disconnectionFrom(member) {
    if (!this.members[member.url]) return;
    this.members[member.url].connectedFrom = false;
    return this.orchestrator.updateState(this.members[member.url]);
  }
};
