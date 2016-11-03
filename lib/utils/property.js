// keep internal (not for consumption) properties out of sight

module.exports = function (object, propertyName, value) {
  Object.defineProperty(object, propertyName, {
    value: value,
    enumerable: false,
    writable: true
  })
};
