/**
 * Created by grant on 2016/09/30.
 */


module.exports.generateCertificate = function (certDir, keyName, certName, callback) {

  var pem = require('pem');

  pem.createCertificate({selfSigned: true}, function (err, keys) {

    if (err)
      callback(err);

    var fs = require('fs');
    var keyPath = certDir + keyName;
    var certPath = certDir + certName;

    fs.exists(certDir, function (exists) {

      if (!exists)
        fs.mkdirSync(certDir);

      fs.writeFileSync(keyPath, keys.serviceKey);
      fs.writeFileSync(certPath, keys.certificate);

      callback();
    });
  });
};
