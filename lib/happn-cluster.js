var Promise = require('bluebird');
var Happn = require('happn');

module.exports.create = Promise.promisify(function(config, callback) {
  var happn;

  Happn.service.create(config)

    .then(function(_happn) {
      var originalStop;

      happn = _happn;
      originalStop = happn.stop;

      // extended cluster.stop that also calls original happn.stop
      happn.stop = function() {
        originalStop.apply(happn, arguments);
      }
    })

    .then(function() {
      callback(null, happn);
    })

    .catch(callback);
});
