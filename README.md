[![npm](https://img.shields.io/npm/v/happn-cluster.svg)](https://www.npmjs.com/package/happn-cluster)
[![Build Status](https://travis-ci.org/happner/happn-cluster.svg?branch=master)](https://travis-ci.org/happner/happn-cluster)
[![Coverage Status](https://coveralls.io/repos/happner/happn-cluster/badge.svg?branch=master&service=github)](https://coveralls.io/github/happner/happn-cluster?branch=master)

# happn-cluster

Extends happn with cluster ability.

Requires that each cluster member mounts the same shared data service. See [happn-service-mongo](https://github.com/happner/happn-service-mongo).

## Getting Started

`npm install happn-cluster happn-service-mongo --save`

### Minimum Config

### Starting Seed Node

TODO

```javacsript

```

### Starting Other Nodes

TODO

```javascript

```

## Full Configuration

See [happn](https://github.com/happner/happn) for full complement of happn config.

```javascript
var HappnCluster = require('happn-cluster');
var defaultConfig = {

  services: {
  
    // shared data plugin sub-config (defaults displayed)
    data: {
      path: 'happn-service-mongo',
      config: {
        collection: 'happn-cluster',
        url: 'mongodb://127.0.0.1:27017/happn-cluster'
      }
    },
    
    // proxy sub-config (defaults displayed)
    proxy: {
      config: {
        listenPort: 57000,
        // listenHost: '0.0.0.0' // <--- not implemented
      }
    },
    
    // orchestrator sub-config (defaults displayed)
    orchestrator: {
      config: {
        minimumPeers: 1,
        replicate: ['/*'],
        stableReportInterval: 5000
      }
    },
    
    // membership sub-config (defaults displayed)
    membership: {
      config: {
        clusterName: 'happn-cluster',
        seed: false,
        seedWait: 0,
        // host: undefined, // defaults to first public IPv4 address
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

HappnCluster.create(defaultConfig)
  .then(function(server) {
    // ...
  })
  .catch(function(error) {
    process.exit(1);
  });
  
```

## Shared Data Sub-Config

By configuring a shared data service all nodes in the cluster can serve the same data to clients. The
default uses the [happn mongo plugin](https://github.com/happner/happn-service-mongo). The localhost
url is porbably not what you want.

## Proxy Sub-Config

A starting cluster node immediately starts the happn service listening to allow the orchestrator to
establish the inter-cluster replication bridges.
  
Clients attaching to this happn service port will therefore be connecting before the node is ready.

Instead, clients should connect through the proxy port, whose start is pended until the node is ready.

#### config.[listenPort, listenHost]

The socket address where the proxy listens for clients.

TODO: remaining proxy config


## Orchestrator Sub-Config

#### config.minimumPeers

This pends the starting of the proxy until there are this many known peers in the cluster. This prevents
the `thundering herd` (of clients) from attacking the first started node.

#### config.replicate

Array of happn paths or path masks that will be replicated throughout the cluster.

#### config.stableReportInterval

Having received the membership list (other cluster nodes), the orchestrator stalls the startup
procedure (pending the proxy start) until fully connected (stabilised). This interval controls
the frequency with which the outstanding connection states are reported into the log.

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

#### config.seedWait

Members that are not the seed member pause this long before starting. This allows for a booting host that
contains multiple cluster member instances all starting concurrently where one is the seed member. By waiting,
the seed member will be up and running before the others attempt to join it in the cluster.

#### config.[host, port]

The host and port on which this member's SWIM service should listen. Host should be an actual ip address
or hostname, not '0.0.0.0'. It can also be specified using [interface](https://github.com/happner/dface) (eg 'eth0')

Default: 'eth0', 11000

#### config.hosts

The list of initial cluster members via which this member joins the cluster. This should include the
seed member and a selection of other members likely to be online.

Items in the list are composed of `host:port` as configured on the remote members' **config.host**
and **config.port** above.

Example: `['10.0.0.1:56000', '10.0.0.2:56000', '10.0.0.3:56000']`

It is **strongly recommended** that all nodes in the cluster use the same **config.hosts** list to avoid 
the posibility of orphaned subclusters arising. It must therefore also be ensured that at least one of
the hosts in the list is online at all times. They can be upgraded one at a time but not all together.

In the event of all nodes in the **config.hosts** going down simultaneously the remaining nodes in the
cluster will be orphaned and require a restart.

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
