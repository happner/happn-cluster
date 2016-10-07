* force include seed member in dynamic host to join
* append dynamic to already specified hosts to join
* document the importance of starting the seed member alone and first
* handle /_SYSTEM/_NETWORK/_SETTINGS/NAME overwrite from each cluster member
* update member, eg. remote restarted and changed happn port or cluster name (remove)
* handle returned member not fully departed yet Member.resume()
* orchestrator subscribes to configurable list of happn paths
* prevent happn login with clusterName into other clusterName?
* hole in stabalize, don't know when the remote has subscribed
* secure it
* missing pubsub.on('reconnect')
* make proxy listen at default 55000 so that default client does through it
* stabilise timeout
* stabilise errors
