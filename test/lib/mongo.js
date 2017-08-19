var MongoClient = require('mongodb').MongoClient;

module.exports.clearCollection = function (url, collectionName, callback) {
  // url assumes databaseName is the same collectionName
  MongoClient.connect(url + '/' + collectionName, function (err, db) {
    if (err) return callback(err);
    db.collection(collectionName, function (err, collection) {
      if (err) {
        db.close();
        return callback(err);
      }
      collection.drop(function (err) {
        db.close();
        if (err && err.message == 'ns not found') {
          return callback(null); // no such collection to delete
        }
        callback(err);
      });
    });
  });
};

/*

var MongoClient = require('mongodb').MongoClient;

module.exports = function (url, collectionName, callback) {
  // url assumes databaseName is the same collectionName
  MongoClient.connect(url + '/' + collectionName, function (err, db) {
    if (err) return callback(err);
    db.collection(collectionName, function (err, collection) {
      if (err) {
        db.close();
        return callback(err);
      }
      collection.drop(function (err) {
        db.close();
        if (err && err.message == 'ns not found') {
          return callback(null); // no such collection to delete
        }
        callback(err);
      });
    });
  });
};



*/
