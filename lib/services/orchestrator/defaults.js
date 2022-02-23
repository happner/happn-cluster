module.exports = function() {
  return {
    INTERVALS: {
      keepAlive: {
        time: 1e3,
        method: "keepAlive"
      },
      membership: {
        time: 4e3,
        method: "memberCheck"
      },
      health: {
        time: 5e3,
        method: "healthReport"
      }
    },
    KEEPALIVE_THRESHOLD: 2e3
  };
};
