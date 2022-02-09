// Function for testing, returns salient details about a member
module.exports = function(member) {
  let memberClone = {
    ...member,
    orchestrator: "",
    log: "",
    HappnClient: "",
    client: ""
  };
  delete memberClone.orchestrator;
  delete memberClone.log;
  delete memberClone.HappnClient;
  delete memberClone.client;
  return memberClone;
};
