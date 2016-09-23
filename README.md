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
  
  // cluster sub-config
  cluster: {
    name: 'cluster-name',
    membership: {
      seed: false,
      joinType: 'dynamic'
      host: 'eth0',
      port: 11000
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

##### config.cluster.membership.seed

Boolean flag sets this member as the cluster seed member. If `true` this member will not terminate
upon failing to join any other cluster members and can therefore enter a cluster as the first member.

Each other member should include the seed member among their **config.cluster.membership.hosts**
list of hosts to join when starting.

The seed member should include a selection of other members certain to be online in it's 
**config.cluster.membership.hosts** so that it can rejoin an already running cluster in case
of an unscheduled reboot.

##### config.cluster.membership.joinType

This refers to the method used obtain/configure the sub-list of hosts to join in the cluster. 

If joinType is 'static' the list should be hardcoded into **config.cluster.membership.hosts**

If joinType is 'dynamic' the list is obtained from the most recent membership records in the shared database.

Both 'dynamic' and 'static' require **exactly one** seed member in the cluster.

### Static Membership Join Config

With static membership config the seed list of hosts-to-join is predefined in config.

```javascript

```

### Dynamic Membership Join Config

With dynamic membership config the seed list of hosts-to-join is populated from membership records in the shared database.

```javascript

```
