module.exports = Membership;

var Promise = require('bluebird');

function Membership(config) {}

Membership.prototype.bootstrap = Promise.promisify(function(callback) {
  console.log('\n\nbootstrap\n\n');
  setTimeout(function() {
    callback(null);
  });
});
