/**
 * Created by grant on 2016/10/05.
 */

function EventMapper() {
}

EventMapper.prototype.mapMemberEventToPubSubData = function (eventData, eventMeta, clusterName, callback) {

  console.log('## PRE-MAPPED EVENT DATA: ' + JSON.stringify(eventData));
  console.log('## PRE-MAPPED EVENT META: ' + JSON.stringify(eventMeta));

  /* Samples:

   PubSubService expected MESSAGE: {"action":"set","eventId":3,"path":"/EVENT_PROPAGATION_DATA/test1","data":{"testField":"testValue"},"sessionId":"b9f72c4e-b17b-458f-b109-0092a51351f5","protocol":"1.1.0","options":{}}
   PubSubService expected PAYLOAD: {"data":{"testField":"testValue"},"_meta":{"created":1475681381390,"modified":1475681381390,"path":"/EVENT_PROPAGATION_DATA/test1","type":"response","status":"ok","published":false,"eventId":3,"sessionId":"b9f72c4e-b17b-458f-b109-0092a51351f5","action":"set"}}

   Incoming eventData: {"testField":"testValue"}
   Incoming eventMeta: {"created":1475681648606,"modified":1475681648606,"path":"/EVENT_PROPAGATION_DATA/test1","type":"data","sessionId":"40e5f13c-cd4f-413e-96c8-7815d4189ec0","action":"/SET@/EVENT_PROPAGATION_DATA/test1","channel":"/ALL@/*"}

   */


  // add a new field to the meta to describe the origin of the event as being from the cluster
  eventMeta['eventOrigin'] = clusterName;

  try {
    var payload = {_meta: eventMeta, data: eventData, action: eventMeta.action};
    var action = eventMeta.action.substr(eventMeta.action.indexOf('/') + 1, eventMeta.action.indexOf('@') - 1);
    var path = eventMeta.action.substr(eventMeta.action.indexOf('@/') + 1);
    var message = {action: action, path: path, data: eventData, sessionId: eventMeta.sessionId};

    callback(null, {message: message, payload: payload});
  } catch (err) {
    callback(err);
  }
};

module.exports = EventMapper;
