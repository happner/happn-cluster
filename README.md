[![npm](https://img.shields.io/npm/v/happn-cluster.svg)](https://www.npmjs.com/package/happn-cluster)
[![Build Status](https://travis-ci.org/happner/happn-cluster.svg?branch=master)](https://travis-ci.org/happner/happn-cluster)
[![Coverage Status](https://coveralls.io/repos/happner/happn-cluster/badge.svg?branch=master&service=github)](https://coveralls.io/github/happner/happn-cluster?branch=master)

# happn-cluster

Extends happn with cluster ability.

Requires that each cluster member mounts a shared data service. See [happn-service-mongo](https://github.com/happner/happn-service-mongo).

## Getting Started

`npm install happn-cluster happn-service-mongo --save`

See [happn](https://github.com/happner/happn) for full complement of config.

```javascript
var HappnCluster = require('happn-cluster');
var config = {

  // shared data plugin sub-config
  services: {
    data: {
      path: 'happn-service-mongo',
      config: {
        collection: 'happn-cluster',
        url: 'mongodb://mongodb.mydomain.com:27017/happn-cluster'
      }
    }
  },
  
  // cluster sub-config (defaults displayed)
  cluster: {
    name: 'cluster-name',
    membership: {
      seed: false,
      seedWait: 0,
      joinType: 'dynamic',
      host: 'eth0',
      port: 11000,
      // hosts: [],
      joinTimeout: 2000,
      probeInterval: 1000,
      probeTimeout: 200,
      probeReqTimeout: 600,
      probeReqGroupSize: 3,
      udp: {
        maxDgramSize: 512
      }
      codec: 'msgpack',
      disseminationFactor: 15
    }
  }
}

HappnCluster.create(config)
  .then(function(server) {
    // ...
  })
  .catch(function(error) {
    process.exit(1);
  });
```

## Cluster Sub-Config

#### config.cluster.name

Every member of the cluster should have the same configured name.
Name is limited to characters acceptable in happn paths, namely '_*-', numbers and letters.

#### config.cluster.membership

This configures the membership discovery service.
Using [this implementation](https://github.com/mrhooray/swim-js) of the SWIM protocol.

#### config.cluster.membership.seed

Boolean flag sets this member as the cluster seed member. If `true` this member will not terminate
upon failing to join any other cluster members and can therefore enter a cluster successfully as
the first member.

Each other member should include the seed member, among others, in their **config.cluster.membership.hosts**
list of hosts to join when starting.

The seed member should include a selection of other members certain to be online in it's 
**config.cluster.membership.hosts** so that it can rejoin an already running cluster in case
of an unscheduled reboot.

#### config.cluster.membership.seedWait

Members that are not the seed member pause this long before starting. This allows for a booting host that
contains multiple cluster member instances all starting concurrently where one is the seed member. By waiting,
the seed member will be up and running before the others attempt to join it in the cluster.

#### config.cluster.membership.joinType

This refers to the method used to obtain/configure the sub-list of hosts to join in the cluster. 

If joinType is 'static' the list should be hardcoded into **config.cluster.membership.hosts**

If joinType is 'dynamic' the list is obtained from the most recent membership records in the shared database.

Both 'dynamic' and 'static' require **exactly one** seed member in the cluster.

#### config.cluster.membership.[host, port]

The host and port on which this member's SWIM service should listen. Host should be an actual ip address
or hostname, not '0.0.0.0'. It can also be specified using [interface](https://github.com/happner/dface) (eg 'eth0')

Default: 'eth0', 11000

#### config.cluster.membership.hosts

The list of initial cluster members via which this member joins the cluster. This should include the
seed member and a selection of other members likely to be online.

Items in the list are composed of `host:port` as configured on the remote members' **membership.host**
and **membership.port** above.

Example: `['10.0.0.1:11000', '10.0.0.2:11000', '10.0.0.3:11000']`

#### config.cluster.membership.joinTimeout

The bootstrapping SWIM member waits this long to accumulate the full membership list from the network.

#### config.cluster.membership.probeInterval

The running SWIM member cycles through it's member list sending a probe to determine if the member is still there.
A probe is sent once every interval. The default 1000ms results in a noticable delay in detecting departed members.
It's a tradeoff between cluster-size/detection-time/probe-bandwidth. Keep in mind that all members are doing the
cyclic probe so worst-case discovery time is not `1000ms * memberCount`.

#### config.cluster.membership.probeTimeout

The running SWIM member expects a reply to its probe. Receiving none within this time results in the probed member
coming under suspicion of being faulty/offline. At this point secondary probe requests are sent to a random selection
of other members to probe the suspect themselves to confirm the suspicion.

#### config.cluster.membership.probeReqTimeout

The running SWIM member expects a reply from those secondary probe requests within this time. If not received the
suspect is declared faulty/offline and this information is disseminated into the cluster.

#### config.cluster.membership.probeReqGroupSize

Secondary probe requests are sent to this many other members.

#### config.cluster.membership.[udp, codec, disseminationFactor]

See [swim.js](https://github.com/mrhooray/swim-js)





### Static Membership Join Config

With static membership config the seed list of hosts-to-join is predefined in config.

```javascript

```

### Dynamic Membership Join Config

With dynamic membership config the seed list of hosts-to-join is populated from membership records in the shared database.

```javascript

```
