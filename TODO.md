* example subscribe/replicate
* install behind realworld aws load balancer and spawn from images

### proxy

* should we stop the proxy on error?
* proxy to implement listenHost
* proxy to have own key/cert such that proxy can be https independently of what happn is doing
* make proxy listen at default 55000 for default clients, move happn default to 57000
* remove setTimeout(3000) from proxy tests where possible to speed up test runs
* support dface for listenHost
* finish proxy section in main readme

### later

* hole in stabalize, don't know when the remote has subscribed
* handle /_SYSTEM/_NETWORK/_SETTINGS/NAME overwrite from each cluster member
* ensure support remote stops and changes happn port or cluster name and restarts

### swim issues (later)

* expire faulty from swim after long long time (otherwise faulty list lives on forever)
* msgpack5 into swim for dissemination payload compression (minor size improvement, much slower)
* encrypt swim payloads?
