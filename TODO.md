* finalise replicate
* stabilise timeout?
* update member, eg. remote restarted and changed happn port or cluster name (remove)
* document the importance of starting the seed member alone and first
* document **swim is insecure, protect the port, otherwise anyone can join the cluster and and we would login to them, exposing the admin password**
* make proxy listen at default 55000 for default client

### proxy

* should we stop the proxy on error?
* proxy to implement listenHost
* proxy to have own key/cert such that proxy can be https independently of what happn is doing

### later

* hole in stabalize, don't know when the remote has subscribed
* handle /_SYSTEM/_NETWORK/_SETTINGS/NAME overwrite from each cluster member

### swim issues (later)

* expire faulty from swim after long long time (otherwise faulty list lives on forever)
* msgpack5 into swim for dissemination payload compression (minor size improvement, much slower)
* encrypt swim payloads?
