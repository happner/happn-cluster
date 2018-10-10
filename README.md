[![npm](https://img.shields.io/npm/v/happn-cluster.svg)](https://www.npmjs.com/package/happn-cluster)
[![Build Status](https://travis-ci.org/happner/happn-cluster.svg?branch=master)](https://travis-ci.org/happner/happn-cluster)
[![Coverage Status](https://coveralls.io/repos/happner/happn-cluster/badge.svg?branch=master&service=github)](https://coveralls.io/github/happner/happn-cluster?branch=master)

# happn-cluster

Extends happn with cluster ability.

Requires that each cluster member mounts the same shared data service. See [happn-service-mongo](https://github.com/happner/happn-service-mongo).

See also [happn cluster aws example](https://github.com/happner/happn-cluster-aws-example)

## Install

`npm install happn-cluster happn-service-mongo-2 --save`

Note data service installed separately.

## Configure

See [happn](https://github.com/happner/happn) for full complement of happn config.

```javascript
var HappnCluster = require('happn-cluster');
var defaultConfig = {
  // name: undefined,  // defaults from happn service host:port (10-0-0-1_55000)
  // host: '0.0.0.0', // happn service ip
  // port: 57000,    // happn service port
  // secure: true,  // to enable security
  // announceHost: 'externally-visible-ip-or-hostname', // eg. when docker
  services: {

    // // security sub-config (to enable security)
    // security: {
    //   config: {
    //     adminUser: {
    //       username: '_ADMIN', // <---- leave this as _ADMIN
    //       password: 'happn'
    //     }
    //   }
    // },

    // shared data plugin sub-config (defaults displayed)
    data: {
      config: {
        datastores: [
          {
            name: 'mongo',
            provider: 'happn-service-mongo-2',
            isDefault: true,
            settings: {
              collection: 'happn-cluster',
              database: 'happn-cluster',
              url: 'mongodb://127.0.0.1:27017'
              // url: 'mongodb://username:password@127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/happn?replicaSet=test-set&ssl=true&authSource=admin'
            }
          }
        ]
      }
    },

    // proxy sub-config (defaults displayed)
    proxy: {
      config: {
        port: 55000,
        host: '0.0.0.0',
        allowSelfSignedCerts: false,
        // timeout: 20 * 60 * 1000, // request socket idle timeout
        // defer: false,
        // keyPath: 'path/to/key',
        // certPath: 'path/to/cert'
      }
    },

    // orchestrator sub-config (defaults displayed)
    orchestrator: {
      config: {
        minimumPeers: 1,
        replicate: ['*'],
        stableReportInterval: 5000,
        stabiliseTimeout: 120 * 1000 // 0 disables
      }
    },

    // membership sub-config (defaults displayed)
    membership: {
      config: {
        clusterName: 'happn-cluster',
        seed: false,
        seedWait: 0,
        randomWait: 0,
        // host: undefined, // defaults to first public IPv4 address
        port: 56000,
        // hosts: [],
        joinTimeout: 2000,
        pingInterval: 1000,
        pingTimeout: 200,
        pingReqTimeout: 600,
        pingReqGroupSize: 3,
        udp: {
          maxDgramSize: 512
        }
        disseminationFactor: 15,
        persistMembers:false //if you want to remember members updated by swim and
                             //concatenate them to the hosts on startup
      }
    }
  }
}

HappnCluster.create(defaultConfig)
  .then(function(server) {
    // ...
  })
  .catch(function(error) {
    process.exit(0);
  });

```

## NB: by default replicate will replicate all events across the cluster (see above config.replcate is ['\*']) - because we are now using happn-3 version 8.0.0 the / and \* characters have stricter rules, ie: to replicate all events for a set or remove with path /my/test/event you need to set replicate to ['/my/\*/\*'], /my/\* and /my\* or /my/te\*/event will no longer work.

### Happn Config

#### name

Each happn node in the cluster requires a unique name. The name will default from the host:port below to produce something like '10-0-0-1_55000'. If happn is configured to listen at 0.0.0.0 then the name will default instead from the first public IPv4 address found in interfaces.

#### host

The host/ip that the happn service should listen on. Also supports [dface](https://github.com/happner/dface) spec for cloning nodes into a DHCP environment.

#### port

The port that the happn service should listen on.

#### secure

Set true to enable security.

**If one cluster node is secure, they all need to be secure.**

#### announceHost

When using docker the internal container ip is announced into the cluster for remote members to connect to. But that ip is not accessible, use this config to specify the ip or hostname of the accessible external interface. Note that a similar issue occurs with the ports so all ports require a **same-to-same mapping when using docker**.

### Security Sub-Config

Inter-cluster connections are made using the admin user. All nodes in the cluster will need the same
admin username and password configured.

**Once created, the admin user's password cannot be changed from config.**

To change the admin password.

* Stop all cluster nodes.
* Put the new password into all cluster node configs.
* Delete the old \_ADMIN user and \_ADMIN group membership from the shared database.

```bash
mongo mongodb://127.0.0.1:27017/happn-cluster
> use happn-cluster
> db['happn-cluster'].remove({path: {$in: ['/_SYSTEM/_SECURITY/_USER/_ADMIN', '/_SYSTEM/_SECURITY/_USER/_ADMIN/_USER_GROUP/_ADMIN']}});
```
* Restart the cluster (admin user will be regenerated with new password)

**The above also applies after starting a cluster with security unconfigured. The admin user is still created with the default password 'happn'. Upon turning on security later the password will then need to be changed as described above.**

### Shared Data Sub-Config

By configuring a shared data service all nodes in the cluster can serve the same data to clients. The
default uses the [happn mongo plugin](https://github.com/happner/happn-service-mongo). The localhost
url is porbably not what you want.

### Proxy Sub-Config

A starting cluster node immediately starts the happn service listening to allow the orchestrator to
establish the inter-cluster replication bridges.

Clients attaching to this happn service port will therefore be connecting before the node is ready.

Instead, clients should connect through the proxy port, whose start is pended until the node is ready.

#### config.[port, host]

The socket address where the proxy listens for clients.

#### config.[keyPath, certPath]

Specify key and cert filenames to switch switch on https

#### config.allowSelfSignedCerts

Allow connecting to local happn which is listening with https and self signed cert.

#### config.defer

Set to true to not start the proxy service. If set the `services.proxy.start()` will need to be called externally.

#### config.timeout

Configure proxy's request-side socket's idle timeout. Default 20 minutes.

### Orchestrator Sub-Config

#### config.minimumPeers

This pends the starting of the proxy until there are this many known peers in the cluster. This prevents
the `thundering herd` (of clients) from settling all their sockets permanently onto the first started node.

#### config.replicate

Array of happn paths or path masks that will be replicated throughout the cluster.

#### config.stableReportInterval

Having received the membership list (other cluster nodes), the orchestrator stalls the startup
procedure (pending the proxy start) until fully connected (stabilised). This interval controls
the frequency with which the outstanding connection states are reported into the log.

#### config.stabiliseTimeout

Defines how long to wait for this starting node to become fully connected (stabilised) before giving up and stopping the node. In all known cases a starting node will either reach stability or fail explicitly with an error. This is a failsafe (for unknown cases) to prevent endlessly awaiting stability where it would be better to stop and try joining the cluster again.

**Note that this acts in opposition to `minimumPeers` - A starting node awaiting minimum peers will still time out.**

### Membership Sub-Config

#### config.clusterName

Every member of the cluster should have the same configured `clusterName`.
The name is limited to characters acceptable in happn paths, namely '\_*-', numbers and letters.
Joining members with a different clusterName will be ignored by the orchestrator.

#### config.seed

Boolean flag sets this member as the cluster seed member. If `true` this member will not terminate
upon failing to join any other cluster members and can therefore enter a cluster successfully as
the first member.

Each other member should include the seed member, among others, in their **config.hosts**
list of hosts to join when starting.

#### config.seedWait

Members that are not the seed member pause this long before starting. This allows for a booting host that
contains multiple cluster member instances all starting concurrently where one is the seed member. By waiting, the seed member will be up and running before the others attempt to join it in the cluster.

#### config.randomWait

Members that are not the seed member pause a random amount of milliseconds from this range before starting. This is to alleviate the problem of SWIM not handling large numbers of concurrent cluster joins.

Be sure to set this value to less than the stabiliseTimeout.

#### config.[host, port]

The host and port on which this member's SWIM service should listen. Host should be an actual ip address
or hostname, not '0.0.0.0'. It can also be specified using [dface](https://github.com/happner/dface) spec.

**Important: The membership service protocol is currently insecure. These ports need to be protected in a private cluster.** [issues/1](https://github.com/happner/happn-cluster/issues/1)

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

#### config.persistMembers

if you want to remember members updated by swim and concatenate them to the hosts on startup.
This is useful if your seed node(s) don't know about your additional cluster nodes via the hosts config setting (above). This will use happn to persist all members that are updated via SWIM, and will concatenate them to the hosts config on startup so the cluster does not split.

#### config.joinTimeout

The bootstrapping SWIM member waits this long to accumulate the full membership list from the network.

#### config.pingInterval

The running SWIM member `cycles` through it's member list sending a ping to determine if the member is still there. A ping is sent once every interval. The default 1000ms results in a noticable delay in detecting departed members. It's a tradeoff between cluster-size/detection-time/ping-bandwidth. Keep in mind that all members are doing the cyclic ping so worst-case discovery time is not `1000ms * memberCount`.

#### config.pingTimeout

The running SWIM member expects a reply to its ping. Receiving none within this time results in the pinged member coming under suspicion of being faulty/offline. At this point secondary ping requests are sent to a random selection of other members to ping the suspect themselves to confirm the suspicion.

#### config.pingReqTimeout

The running SWIM member expects a reply from those secondary ping requests within this time. If not received the suspect is declared faulty/offline and this information is disseminated into the cluster.

#### config.pingReqGroupSize

Secondary ping requests are sent to this many other members.

#### config.[udp, disseminationFactor]

Members updates (arrived/departed) are disseminated throughout the cluster on the back of the pings already being sent. **udp.maxDgramSize** limits the size of those payloads. **disseminationFactor** combined logarithmically with cluster size determines for how many pings in the `cycle` any given membership update remains eligible for dissemination. All eligible updates are sent with every ping up to the available **maxDgramSize**.

See [swim.js](https://github.com/happner/swim-js)

## Deployment orchestration and automation

Details of automating happn-cluster using Docker and Ansible can be found here: [https://github.com/happner/happner-ansible-orchestration](https://github.com/happner/happner-ansible-orchestration).
