var MongoClient = require('mongodb').MongoClient;

module.exports.clearCollection = function (url, collection, callback) {
  MongoClient.connect(url, function (err, db) {
    if (err) return callback(err);
    db.collection(collection).deleteMany({}, function (err) {
      if (err) return callback(err);
      setTimeout(callback, 600);
    });
  });
};
