var util = require('util');

module.exports = {
  logger: {
    createLogger: function (name) {
      return {
        debug: function () {
          if (process.env.LOG_LEVEL == 'off') return;
          console.log('debug (%s) -', name, util.format.apply(this, arguments));
        },
        info: function () {
          if (process.env.LOG_LEVEL == 'off') return;
          console.log('info (%s) -', name, util.format.apply(this, arguments));
        },
        warn: function () {
          if (process.env.LOG_LEVEL == 'off') return;
          console.log('warn (%s) -', name, util.format.apply(this, arguments));
        },
        error: function () {
          if (process.env.LOG_LEVEL == 'off') return;
          console.log('error (%s) -', name, util.format.apply(this, arguments));
        }
      };
    }
  }
};
