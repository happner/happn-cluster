const path = require("path");
const filename = path.basename(__filename);
const expect = require("expect.js");
const Health = require("../../lib/services/health");
const mockOpts = require("../mocks/mock-opts");

describe(filename, function() {
  before(function() {
    this.logLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "off";
  });

  context("initialise", function() {
    it("initializes and stops the health service", function(done) {
      const health = new Health(mockOpts);
      health.reportClusterHealth = () => {};
      health.initialize({}, e => {
        if (e) return done(e);
        health.start({}).then(() => {
          health.stop(null, done);
        });
      });
    });

    it("tests the statsHaveChanged function", function() {
      const health = new Health(mockOpts);
      const stats = {
        TOTAL_SWIM_MEMBERS: 5,
        TOTAL_CLUSTER_MEMBERS: 5,
        TOTAL_CONFIGURED_HOSTS: 5,
        STATUS: "HEALTHY"
      };
      expect(health.statsHaveChanged(stats)).to.be(true);
      expect(health.statsHaveChanged(stats)).to.be(false);
      stats.STATUS = "UNHEALTHY";
      expect(health.statsHaveChanged(stats)).to.be(true);
    });

    it("tests the findMissingClusterMembers function", function() {
      const health = new Health(mockOpts);
      const testPeer = {
        memberId: "testMember"
      };
      expect(
        health.findMissingClusterMembers({
          peers: {
            testPeer
          },
          members: {}
        })
      ).to.eql(["testMember"]);

      expect(
        health.findMissingClusterMembers({
          peers: {
            testPeer
          },
          members: {
            testMember: {}
          }
        })
      ).to.eql([]);
    });
  });

  it("tests the findMissingSwimMembers function", function() {
    const health = new Health(mockOpts);
    const testMember = {
      name: "testPeer"
    };
    expect(
      health.findMissingSwimMembers({
        peers: {},
        members: {
          testMember
        }
      })
    ).to.eql(["testPeer"]);

    expect(
      health.findMissingSwimMembers({
        peers: {
          testPeer: {}
        },
        members: {
          testMember
        }
      })
    ).to.eql([]);
  });

  it("tests the findMissingHosts function", function() {
    const health = new Health(mockOpts);
    const mockMembership = {
      config: {
        hosts: ["host1", "host2"]
      },
      members: {
        host3: {}
      }
    };
    expect(health.findMissingHosts(mockMembership)).to.eql(["host1", "host2"]);

    mockMembership.members = {
      host1: {},
      host2: {}
    };
    expect(health.findMissingHosts(mockMembership)).to.eql([]);
  });

  after(function() {
    process.env.LOG_LEVEL = this.logLevel;
  });
});
