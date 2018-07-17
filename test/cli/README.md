# first run seed:
node test/cli/cluster-node hosts=127.0.0.1:56001 host=127.0.0.1 persistMembers=true
# then run members
node test/cli/cluster-node host=127.0.0.1 hosts=127.0.0.1:56000 port=55001 proxyport=57001 membershipport=56001 seed=false
node test/cli/cluster-node host=127.0.0.1 hosts=127.0.0.1:56000 port=55002 proxyport=57002 membershipport=56002 seed=false
node test/cli/cluster-node host=127.0.0.1 hosts=127.0.0.1:56000 port=55003 proxyport=57003 membershipport=56003 seed=false
