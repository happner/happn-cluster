[![npm](https://img.shields.io/npm/v/happn-cluster.svg)](https://www.npmjs.com/package/happn-cluster)
[![Build Status](https://travis-ci.org/happner/happn-cluster.svg?branch=master)](https://travis-ci.org/happner/happn-cluster)
[![Coverage Status](https://coveralls.io/repos/happner/happn-cluster/badge.svg?branch=master&service=github)](https://coveralls.io/github/happner/happn-cluster?branch=master)

# happn-cluster

Extends happn with cluster ability.

Requires that each cluster member mounts a shared data service [happn-service-mongo](https://github.com/happner/happn-service-mongo).

## Getting Started

`npm install happn-cluster happn-service-mongo --save`

See [happn](https://github.com/happner/happn) for full complement of config.

### Static Membership Join Config

With static membership config the seed list of hosts-to-join is predefined in config.

```javascript

```

### Dynamic Membership Join Config

With dynamic membership config the seed list of hosts-to-join is populated from membership records in the shared database.

```javascript

```
