* example subscribe/replicate
* install behind realworld aws load balancer and spawn from images
* finalise aws example once released

### proxy

* should we stop the proxy on error?
* handle server error
* proxy to have own key/cert such that proxy can be https independently of what happn is doing
* support dface for listenHost
* finish proxy section in main readme
* allowSelfSignedCerts config huh?

### later

* hole in stabalize, don't know when the remote has subscribed
* handle /_SYSTEM/_NETWORK/_SETTINGS/NAME overwrite from each cluster member
* ensure support for remote member stopping and changing happn port or cluster name and restarting within reconnect loop

### swim issues (later)

* expire faulty from swim after long long time (otherwise faulty list lives on forever)
* msgpack5 into swim for dissemination payload compression (minor size improvement, much slower)
* encrypt swim payloads?
