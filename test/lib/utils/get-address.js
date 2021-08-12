const expect = require("expect.js");
const ip = require("ip");

describe("tests /utils/get-address, with addition of NETWORK_INTERFACE environment variable", function() {
  it("tests get-address with NETWORK_ENVIRONMENT not set, no interfaces passed in", done => {
    const getAddress = require("../../../lib/utils/get-address");
    expect(getAddress()()).to.eql(ip.address());
    done();
  });

  it("tests get-address with NETWORK_ENVIRONMENT too high will default to 0", done => {
    process.env["NETWORK_INTERFACE"] = "1";
    delete require.cache[require.resolve("../../../lib/utils/get-address")];
    const getAddress = require("../../../lib/utils/get-address");
    expect(getAddress()()).to.eql(ip.address());
    done();
  });
});
