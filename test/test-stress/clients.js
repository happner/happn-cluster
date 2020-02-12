const Client = require('./client');
const commander = require('commander');
const delay = require('await-delay');

commander
.option('--hosts [string]', 'comma separated hosts')
.option('--clients [number]')
.option('--activity [boolean]')
.parse(process.argv);

if (commander.hosts == null) commander.hosts = 'http://127.0.0.1:60000';
commander.hosts = commander.hosts.split(',');
commander.clients = commander.clients || 10;

var connectedCount = 0;

const clients = [];

function getHost(){
  return commander.hosts[0];
}

var connectionAttempts = 0;

function onClientConnecting(){
  connectionAttempts++;
  console.log(`client connecting: ${connectionAttempts++}`);
}

function onClientError(reason){
  console.log('client error: ', reason);
}

function onClientDisconnected(clientWrapper){
  connectedCount--;
  console.log(`client disconnected: ${clientWrapper.client.session.id}, connected count: ${connectedCount}`);
  if (commander.activity) {
    clientWrapper.stopActivity();
  }
}

const scheduledAlready = {};

function onClientReconnectScheduled(clientWrapper){

  if (!scheduledAlready[clientWrapper.client.session.id]) {
    onClientDisconnected(clientWrapper);
    scheduledAlready[clientWrapper.client.session.id] = true;
  }
}

function onClientConnected(clientWrapper){
  delete scheduledAlready[clientWrapper.client.session.id];
  connectedCount++;
  console.log(`client connected: ${clientWrapper.client.session.id}, connected count: ${connectedCount}`);
  if (connectedCount == commander.clients) console.log('all connected now');

  if (commander.activity) {
    clientWrapper.stopActivity();
    clientWrapper.doActivity();
  }
}

async function outputStats(){
  this.activityStats = {
    events:0,
    sets:0
  };
  setInterval(() => {

    console.log(`client activity stats, events: ${this.activityStats.events}, sets: ${this.activityStats.sets}`, );

    this.activityStats = {
      events:0,
      sets:0
    };
  }, 10000);
}

async function connectClients(){
  for (var client of clients){
    client.connect(getHost(), this);
    await delay(10);
  }
}

for (var i = 0; i < commander.clients; i++){
  const client = new Client();
  client.on('connecting', onClientConnecting);
  client.on('error', onClientError);
  client.on('disconnected', onClientDisconnected);
  client.on('reconnect-scheduled', onClientReconnectScheduled);
  client.on('connected', onClientConnected);
  clients.push(client);
}

outputStats();

connectClients();
