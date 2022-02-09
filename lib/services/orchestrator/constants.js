module.exports = {
  STATES: {
    WARMUP: "warmup",
    WARMUP_CONNECTING: "warmup/connecting",
    CONNECTING: "connecting",
    STABLE: "stable",
    STABLE_CONNECTING: "stable/connecting", //The cluster's minimum requirements are satisfied, but it is connecting to newly added nodes
    UNSTABLE: "unstable", //minimum requirements were satisfied, no longer are.
    UNSTABLE_CONNECTING: "unstable/connecting"
  },
  DEFAULTS: {
    INTERVALS: {
      keepAlive: {
        time: 5e3,
        method: "keepAlive"
      },
      membership: {
        time: 1e3,
        method: "memberCheck"
      }
      //health: {
      //   60e3,
      //   method: "heatlhReport"
      // }
    }
  }
};
