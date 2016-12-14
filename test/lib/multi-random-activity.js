var RandomActivity = require('happn-random-activity-generator');
var Promise = require('bluebird');
var clone = require('clone');

module.exports = MultiRandomActivityGenerator;

function MultiRandomActivityGenerator(clients, config) {
  // multiple clients, one for each peer in cluster
  var generators = this.generators = [];
  clients.forEach(function (client) {
    generators.push(new RandomActivity(client, config));
  });
}

MultiRandomActivityGenerator.prototype.generateActivityStart = function (name, callback) {
  var generators = this.generators;
  Promise.resolve(generators).map(function (generator) {
    return new Promise(function (resolve, reject) {
      generator.generateActivityStart(name, function (e) {
        if (e) return reject(e);
        resolve();
      });
    });
  })
    .then(function () {
      callback(null);
    })
    .catch(function (e) {
      callback(e);
    });
};

MultiRandomActivityGenerator.prototype.generateActivityEnd = function (name, callback) {
  var generators = this.generators;
  Promise.resolve(generators).map(function (generator) {
    return new Promise(function (resolve) {
      generator.generateActivityEnd(name, resolve);
    });
  })
    .then(function (results) {
      callback(results);
    });
};

MultiRandomActivityGenerator.prototype.verify = function (callback, name) {
  var generators = this.generators;
  Promise.resolve(generators).map(function (generator) {
    return new Promise(function (resolve, reject) {
      generator.verify(function (e, log) {
        if (e) return reject(e);
        resolve(log);
      }, name);
    });
  })
    .then(function (results) {
      callback(null, results);
    })
    .catch(function (error) {
      callback(error);
    });
};
