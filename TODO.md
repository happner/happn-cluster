* finalise replicate
* stabilise timeout
* update member, eg. remote restarted and changed happn port or cluster name (remove)
* document the importance of starting the seed member alone and first


* should we stop the proxy on error?
* proxy to implement listenHost
* proxy to have own key/cert such that proxy can be https independently of what happn is doing
* make proxy listen at default 55000 so that default client does through it


* prevent happn login with clusterName into other clusterName?
* hole in stabalize, don't know when the remote has subscribed
* handle /_SYSTEM/_NETWORK/_SETTINGS/NAME overwrite from each cluster member


* expire faulty from swim after long long time
* msgpack5 into swim for dissemination payload compression
