var path = require('path');
var filename = path.basename(__filename);
var benchmarket = require('benchmarket');

xdescribe(filename, function () {

  benchmarket.start();


  xit('joining member fails to start if login to existing member fails before stabilized() is called');

  xit('joining member fails to start if login to existing member fails while stabilized() is waiting');

  xit('joining member succeeds while simultaneously another member departs');


  after(benchmarket.store());
  benchmarket.stop();

});
