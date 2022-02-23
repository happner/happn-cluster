module.exports = {
  STATES: {
    WARMUP: "warmup",
    WARMUP_CONNECTING: "warmup/connecting",
    CONNECTING: "connecting",
    SUBSCRIBING: "subscribing",
    STABLE: "stable",
    STABLE_CONNECTING: "stable/connecting", //The cluster's minimum requirements are satisfied, but it is connecting to newly added nodes
    UNSTABLE: "unstable", //minimum requirements were satisfied, no longer are.
    UNSTABLE_RECONNECTING: "unstable/reconnecting",
    UNSTABLE_RESUBSCRIBING: "unstable/resubscribing",
    ISOLATED: "isolated",
    UNSTABLE_INSUFFICIENT_PEERS: "unstable/insufficient peers"
  }
};
