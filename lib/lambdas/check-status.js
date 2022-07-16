exports.handler = async function (event, context) {
  console.log(`Check status event: ${JSON.stringify(event)}`);

  // Check to see if event.expectedState has been reached
  // raise event.alarmName if expected state isn't there
  return {
    status: Math.round(Math.random()) ? 'FAILED' : 'PASSED'
  };
};