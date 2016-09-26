[![npm](https://img.shields.io/npm/v/happn-cluster.svg)](https://www.npmjs.com/package/happn-cluster)
[![Build Status](https://travis-ci.org/happner/happn-cluster.svg?branch=master)](https://travis-ci.org/happner/happn-cluster)
[![Coverage Status](https://coveralls.io/repos/happner/happn-cluster/badge.svg?branch=master&service=github)](https://coveralls.io/github/happner/happn-cluster?branch=master)

# happn-cluster

Extends happn with cluster ability.

Requires that each cluster member mounts the same shared data service. See [happn-service-mongo](https://github.com/happner/happn-service-mongo).

## Getting Started

`npm install happn-cluster happn-service-mongo --save`

See [happn](https://github.com/happner/happn) for full complement of config.

```javascript
var HappnCluster = require('happn-cluster');
var config = {

  services: {
  
    // shared data plugin sub-config
    data: {
      path: 'happn-service-mongo',
      config: {
        collection: 'happn-cluster',
        url: 'mongodb://mongodb.mydomain.com:27017/happn-cluster'
      }
    },
    
    // orchestrator sub-config (defaults displayed)
    orchestrator: {
      config: {
        replicate: ['/*']
      }
    },
    
    // membership sub-config (defaults displayed)
    membership: {
      config: {
        clusterName: 'cluster-name',
        seed: false,
        seedWait: 0,
        joinType: 'dynamic',
        host: 'eth0',
        port: 11000,
        // hosts: [],
        joinTimeout: 2000,
        pingInterval: 1000,
        pingTimeout: 200,
        pingReqTimeout: 600,
        pingReqGroupSize: 3,
        udp: {
          maxDgramSize: 512
        }
        disseminationFactor: 15
      }
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

## Orchestrator Sub-Config

#### config.replicate

Array of happn paths or path masks that will be replicated throughout the cluster.

## Membership Sub-Config

#### config.clusterName

Every member of the cluster should have the same configured name.
Name is limited to characters acceptable in happn paths, namely '_*-', numbers and letters.
Joining members with a different clusterName will be ignored by the orchestrator.

#### config.seed

Boolean flag sets this member as the cluster seed member. If `true` this member will not terminate
upon failing to join any other cluster members and can therefore enter a cluster successfully as
the first member.

Each other member should include the seed member, among others, in their **config.hosts**
list of hosts to join when starting.

The seed member should include a selection of other members certain to be online in it's 
**membership.hosts** so that it can rejoin an already running cluster in case
of an unscheduled reboot.

#### config.seedWait

Members that are not the seed member pause this long before starting. This allows for a booting host that
contains multiple cluster member instances all starting concurrently where one is the seed member. By waiting,
the seed member will be up and running before the others attempt to join it in the cluster.

#### config.joinType

This refers to the method used to obtain/configure the sub-list of hosts to join in the cluster. 

If joinType is 'static' the list should be hardcoded into **config.hosts**

If joinType is 'dynamic' the list is obtained from the most recent membership records in the shared database.

Both 'dynamic' and 'static' require **exactly one** seed member in the cluster.

#### config.[host, port]

The host and port on which this member's SWIM service should listen. Host should be an actual ip address
or hostname, not '0.0.0.0'. It can also be specified using [interface](https://github.com/happner/dface) (eg 'eth0')

Default: 'eth0', 11000

#### config.hosts

The list of initial cluster members via which this member joins the cluster. This should include the
seed member and a selection of other members likely to be online.

Items in the list are composed of `host:port` as configured on the remote members' **config.host**
and **config.port** above.

Example: `['10.0.0.1:11000', '10.0.0.2:11000', '10.0.0.3:11000']`

#### config.joinTimeout

The bootstrapping SWIM member waits this long to accumulate the full membership list from the network.

#### config.pingInterval

The running SWIM member `cycles` through it's member list sending a ping to determine if the member is still there.
A ping is sent once every interval. The default 1000ms results in a noticable delay in detecting departed members.
It's a tradeoff between cluster-size/detection-time/ping-bandwidth. Keep in mind that all members are doing the
cyclic ping so worst-case discovery time is not `1000ms * memberCount`.

#### config.pingTimeout

The running SWIM member expects a reply to its ping. Receiving none within this time results in the pinged member
coming under suspicion of being faulty/offline. At this point secondary ping requests are sent to a random selection
of other members to ping the suspect themselves to confirm the suspicion.

#### config.pingReqTimeout

The running SWIM member expects a reply from those secondary ping requests within this time. If not received the
suspect is declared faulty/offline and this information is disseminated into the cluster.

#### config.pingReqGroupSize

Secondary ping requests are sent to this many other members.

#### config.[udp, disseminationFactor]

Members updates (arrived/departed) are disseminated throughout the cluster on the back of the pings already
being sent. **udp.maxDgramSize** limits the size of those payloads. **disseminationFactor** combined logarithmically
with cluster size determines for how many pings in the `cycle` any given membership update remains eligible for
dissemination. All eligible updates are sent with every ping up to the available **maxDgramSize**.

See [swim.js](https://github.com/happner/swim-js)








### Static Membership Join Config

With static membership config the seed list of hosts-to-join is predefined in config.

```javascript

```

### Dynamic Membership Join Config

With dynamic membership config the seed list of hosts-to-join is populated from membership records in the shared database.

```javascript

```
