## Replication Service

Happn cluster provides a native replication interface for announcing events/data into the cluster.

### To replicate event/data

Call the `send()` function on the replicator service. 

```javascript
happn.services.replicator.send(eventName, payload, function (err) {
    // ...
});
```

### To subscribe to event/data being replicated

Subscribe the replicator service's `EventEmitter` using the `eventName` being replicated. The event handler includes the `isLocal` flag to indicate if the event came from "self" as well as the `origin` containing the name of the emitting cluster peer.

```javascript
happn.services.replicator.on(eventName, function (payload, isLocal, origin) {
    // ...
});
```

