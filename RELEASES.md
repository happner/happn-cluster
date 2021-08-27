2.5.5 2017-03-21
----------------
  - activated primus destroy bug dodging

2.5.6 2017-03-21
----------------
  - activated primus destroy bug dodging

2.5.7 2017-03-23
----------------
  - onward release happn-3

2.6.0 2017-04-06
----------------
  - onward release happn-3

2.6.1 2017-04-18
----------------
  - onward release of happn-3

2.7.0 2017-05-20
----------------
  - added `config.services.proxy.config.defer` to not start proxy for use with happner-cluster

3.0.0 2017-08-19
----------------
  - update to happn-3 ^3.0.0
  - test node version 8

4.0.0 2017-11-08
----------------
  - update to happn-3 ^5.0.0

4.1.0 2017-11-25
----------------
  - update to happn-3 ^5.1.1
  - add happn-stats

non-release 2017-12-14
----------------------
  - expanded 19-restart-peer test to more aggressively test stabilize
  - removed benchmarket

4.2.0 2018-01-09
----------------
  - added configurable cluster proxy socket idle timeout

4.3.0 2018-03-27
----------------
  - add replication service

5.0.0 2018-04-12
----------------
  - onward release happn-3

6.0.0 2018-05-24
----------------
  - onward release happn-3

6.0.1 2018-06-28 - unpublished
------------------------------
  - issue #36 - replace http-proxy with bouncy. Enables handling non-standard binary payloads.

6.0.2 2018-06-29
----------------
  - rolling back bouncy update

6.1.0 2018-06-29
----------------
  - persistMembers membership service change

7.0.0 2018-19-10
----------------
  - happn-3 version 8.0.0

7.0.1 2018-09-16
----------------
  - happn-3 version 8.0.1

7.0.2 2018-10-27
----------------
  - happn-3 version 8.0.3

7.1.0 2018-10-27
----------------
  - happn-3 version 8.1.1

7.2.0 2018-11-17
----------------
  - happn-3 version 8.2.1

7.2.1 2018-11-17
----------------
  - happn-3 version 8.2.7

8.0.0 2019-03-01
----------------
  - happn-3 version 9.0.0

8.0.1 2019-03-01
----------------
  - happn-3 version 9.0.1

8.0.2 2019-03-01
----------------
  - happn-3 version 9.0.2

8.0.3 2019-04-26
----------------
  - happn-3 version 9.0.4
  - extended tests around cluster member persistence

8.1.0 2019-04-26
----------------
  - happn-3 version 10.0.0

8.1.1 2019-04-26
----------------
  - ws 7 fix

8.1.2 2019-04-26
----------------
  - ws error bubble fix
  - happner and happn upgrades

8.1.3 2019-08-21
----------------
  - issue with stable timeout not being cleared on stop

8.1.4 2019-09-27
----------------
  - updated happn-3 dependency

9.0.0 2019-11-28
----------------
  - happn-3 version 11.0.0, breaking: client disconnection on token revocation

9.0.1 2019-01-25
----------------
  - linting

9.0.2 2020-02-24
----------------
  - happn-3 version 11.2.0, zombie socket cleanup

9.0.3 2020-02-24
----------------
  - fix: member client will not double disconnect if server is stopped more than once
  - cleanup - removed dead code and comment from orchestrator

9.0.4 2020-06-24
----------------
  - dep: bumped happn-3 version 11.5.2
  - dep: changed sillyname dependency to happn-sillyname

9.0.5 2020-07-07
----------------
  - Added ability to set NETWORK_INTERFACE for utils/get-address

9.0.6 2020-10-04
----------------
  - happn-3 patch: selective security cache clearing and concurrency 1 queue on dataChanged event - SMC-1189
  - patch: SMC-1252 - cluster member restarts cause leak of peer admin

10.0.0 2020-11-04
-----------------
  - happn-cluster upgrade - SMC-1356 - batching of security updates

10.1.0 2020-11-04
-----------------
  - SMC-1285 - periodic health state logging
  - SMC-1284 - re-establishment of cluster member on socket failure

10.1.1 2021-03-31
-----------------
  - SMC-1808 - user permissions dependencies updated

10.2.0 2021-07-20
-----------------
  - SMC-1810 - nested permissions for set and on

10.3.0 2021-08-04
-----------------
  - SMC-3611 - getAddress now a closure with logger passed in, also allows nic id and address index to be defined - will resolve to an address with a warning if nic or address index does not match an existing item
  - SMC-3646 - set up coveralls and github actions

10.3.1 2021-08-27
------------------
- SMC-3242: happn-3 update fixed onBehalfOf and nested permissions issue