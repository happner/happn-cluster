var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');
var Promise = require('bluebird');
var HappnCluster = require('../../');

describe(filename, function () {

  this.timeout(60000);
  var seedNode;
  var clientNodes = [];
  var messages = {};

  afterEach(function(){
    if (seedNode) seedNode.kill();
    clientNodes.forEach(function(node){
      node.kill();
    });
  });

  function startProcess(params){

    return new Promise(function(resolve, reject){

      try{
        var cp = require('child_process');
        var paramsSplit = params.split('membername=');
        var memberName = paramsSplit[1];
        var processParams = paramsSplit[0] + 'host=127.0.0.1';
        messages[memberName] = [];

        var forkPath = path.resolve(['test', 'cli', 'cluster-node.js'].join(path.sep));

        var startedProcess = cp.fork(forkPath, processParams.split(' '), { silent: true });

        startedProcess.stdout.on('data', function(data){
          //if (memberName == 'seedNode')
          //console.log(memberName + ' out: ', data.toString());
        });

        //console.log('forked: ' + forkPath + ' ' + processParams);

        startedProcess.on('message', function(message){

          //console.log('MESSAGE:::', JSON.stringify(message, null, 2), memberName);
          if (this.memberName == 'seedNode') return messages[this.memberName].push(message);
          if (message.operation == 'update') messages[this.memberName].push(message);
        }.bind({memberName:memberName}));

        return setTimeout(function(){
          resolve(startedProcess);
        }, 2000);

      }catch(e){
        reject(e);
      }
    });
  }

  it('test persistMembers', function (done) {

    //node run/cluster-node hosts=127.0.0.1:56001 host=127.0.0.1
    startProcess('hosts=127.0.0.1:58000 persistMembers=true membername=seedNode')
    .then(function(node){
      seedNode = node;
      return startProcess('hosts=127.0.0.1:56000 port=55001 proxyport=57001 membershipport=56001 seed=false membername=member1');
    })
    .then(function(node){
      clientNodes.push(node);
      return startProcess('hosts=127.0.0.1:56000 port=55002 proxyport=57002 membershipport=56002 seed=false membername=member2');
    })
    .then(function(node){
      clientNodes.push(node);
      return startProcess('hosts=127.0.0.1:56000 port=55003 proxyport=57003 membershipport=56003 seed=false membername=member3');
    })
    .then(function(node){
      clientNodes.push(node);

      expect(messages.seedNode
        .filter(function(logMessage){
          return logMessage.operation == 'add';
        })
        .sort()
      ).to.eql([
        {operation:'add', data:{memberId: '127.0.0.1:56001'}},
        {operation:'add', data:{memberId: '127.0.0.1:56002'}},
        {operation:'add', data:{memberId: '127.0.0.1:56003'}}
      ]);

      seedNode.kill();

      setTimeout(function(){

        messages.seedNode = [];
        messages.member1 = [];
        messages.member2 = [];
        messages.member3 = [];

        startProcess('hosts=127.0.0.1:58000 persistMembers=true membername=seedNode')
          .then(function(node){
            seedNode = node;
            setTimeout(function(){
              expect(messages.member1[0]).to.eql(
                {operation:'update', data:{memberId: '127.0.0.1:56000'}}
              );
              expect(messages.member2[0]).to.eql(
                {operation:'update', data:{memberId: '127.0.0.1:56000'}}
              );
              expect(messages.member3[0]).to.eql(
                {operation:'update', data:{memberId: '127.0.0.1:56000'}}
              );
              done();
            }, 2000);
          });
      }, 2000);
    });
  });

  it('test persistMembers, negative', function (done) {

    //node run/cluster-node hosts=127.0.0.1:56001 host=127.0.0.1
    startProcess('hosts=127.0.0.1:58000 membername=seedNode')
    .then(function(node){
      seedNode = node;
      return startProcess('hosts=127.0.0.1:56000 port=55001 proxyport=57001 membershipport=56001 seed=false membername=member1');
    })
    .then(function(node){
      clientNodes.push(node);
      return startProcess('hosts=127.0.0.1:56000 port=55002 proxyport=57002 membershipport=56002 seed=false membername=member2');
    })
    .then(function(node){
      clientNodes.push(node);
      return startProcess('hosts=127.0.0.1:56000 port=55003 proxyport=57003 membershipport=56003 seed=false membername=member3');
    })
    .then(function(node){
      clientNodes.push(node);

      expect(messages.seedNode
        .filter(function(logMessage){
          return logMessage.operation == 'add';
        })
        .sort()
      ).to.eql([
        {operation:'add', data:{memberId: '127.0.0.1:56001'}},
        {operation:'add', data:{memberId: '127.0.0.1:56002'}},
        {operation:'add', data:{memberId: '127.0.0.1:56003'}}
      ]);

      seedNode.kill();

      setTimeout(function(){

        messages.seedNode = [];
        messages.member1 = [];
        messages.member2 = [];
        messages.member3 = [];

        startProcess('hosts=127.0.0.1:58000 membername=seedNode')
          .then(function(node){
            seedNode = node;
            setTimeout(function(){
              expect(messages.member1[0]).to.eql(
                undefined
              );
              expect(messages.member2[0]).to.eql(
                undefined
              );
              expect(messages.member3[0]).to.eql(
                undefined
              );
              done();
            }, 5000);
          });
      }, 5000);
    });
  });
});
