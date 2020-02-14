
# open five terminal windows

# start nginx if you haven started it, here is [how to install it](https://medium.com/@ThomasTan/installing-nginx-in-mac-os-x-maverick-with-homebrew-d8867b7e8a5a);
```
sudo nginx
```

# run seed in one, allow 300 connections per 20 seconds
```
node test/test-stress/cluster-node.js --cleanup 10000
```
# run the 2 other cluster nodes to stabilise
```
node test/test-stress/cluster-node.js --seq 2 --cleanup 10000
node test/test-stress/cluster-node.js --seq 3 --cleanup 10000
```

# run the client connect script, 100 connections, with some inter client sets and subscriptions switched on
```
node test/test-stress/clients --clients 100 --activity true
```