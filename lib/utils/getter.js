module.exports = function(object, propertyName, value) {
  Object.defineProperty(object, propertyName, {
    get: function() {
      return value;
    },
    enumerable: true
  });
};
