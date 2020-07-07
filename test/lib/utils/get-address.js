const expect = require('expect.js')
const ip = require('ip')

describe('tests /utils/get-address, with addition of NETWORK_INTERFACE environment variable', function(){
  it('tests get-address with NETWORK_ENVIRONMENT not set, no interfaces passed in', (done) => {
    const getAddress = require('../../../lib/utils/get-address')
    expect(getAddress()).to.eql(ip.address());
    done();
  })

  it('tests get-address with NETWORK_INTERFACE set to 1, interfaces passed in', (done) =>{
  const interfaces = {
    lo: [
      {
        address: '127.0.0.1',
        netmask: '255.0.0.0',
        family: 'IPv4',
        mac: '00:00:00:00:00:00',
        internal: true,
        cidr: '127.0.0.1/8'
      }
    ],
    'ecs-eth0': [
      {
        address: '169.254.173.96',
        netmask: '255.255.252.0',
        family: 'IPv4',
        mac: '0a:58:a9:fe:ad:60',
        internal: false,
        cidr: '169.254.173.96/22'
      }
    ],
    eth0: [
      {
        address: '10.30.2.204',
        netmask: '255.255.255.0',
        family: 'IPv4',
        mac: '06:1e:5c:3a:52:94',
        internal: false,
        cidr: '10.30.2.204/24'
      }
    ]
  }  //Taken from docker container on AWS
  process.env['NETWORK_INTERFACE'] = "1"
  delete require.cache[require.resolve('../../../lib/utils/get-address')];
  const getAddress = require('../../../lib/utils/get-address')
  expect(getAddress(interfaces)).to.eql('10.30.2.204')
  done()
  })

  it('tests get-address with NETWORK_ENVIRONMENT too high will default to 0', (done) => {
    process.env['NETWORK_INTERFACE'] = "1"
    delete require.cache[require.resolve('../../../lib/utils/get-address')];
    const getAddress = require('../../../lib/utils/get-address')
    expect(getAddress()).to.eql(ip.address());
    done();
  })
})
