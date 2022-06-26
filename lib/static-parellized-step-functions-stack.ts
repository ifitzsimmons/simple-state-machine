import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { join } from 'path';

// Maps state type to timeout (in seconds)
const statusCheckStateMachines = [
  {stateName: 'State1', timeoutInSeconds: 30, alarmName: 'MissedState1' },
  {stateName: 'State2', timeoutInSeconds: 36, alarmName: 'MissedState2' },
  {stateName: 'State3', timeoutInSeconds: 42, alarmName: 'MissedState3' },
  {stateName: 'State4', timeoutInSeconds: 48, alarmName: 'MissedState4' },
  {stateName: 'State5', timeoutInSeconds: 54, alarmName: 'MissedState5' },
];

export class StaticParellizedStepFunctionsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const checkTimeout = new lambda.Function(this, 'CheckOrderStatus', {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'check-status.handler',
      code: lambda.Code.fromAsset(join(__dirname, 'lambdas')),
    });

    const successState = new sfn.Succeed(this, 'Timers Checked');

    // Create wait states and task states for each workflow we want to run
    const paralellelStateBranches = statusCheckStateMachines.map(
      ({ stateName, timeoutInSeconds, alarmName }) => {
        const waitState = new sfn.Wait(this, `Wait for ${stateName}`, {
          time: sfn.WaitTime.duration(Duration.seconds(timeoutInSeconds)),
        });
        const taskState = new sfnTasks.LambdaInvoke(this, `Check ${stateName} Exists`, {
          lambdaFunction: checkTimeout,
          payload: sfn.TaskInput.fromObject({
            orderId: sfn.JsonPath.stringAt('$.orderId'),
            expectedState: stateName,
            alarmName,
          }),
          resultPath: "$"
        });

        return { waitState, taskState };
    });

    // Create Parallel State
    const parallelChecks = new sfn.Parallel(this, 'Check States at Timeout SLAs');

    // Add branched for the different status checks
    paralellelStateBranches.forEach(({ waitState, taskState }) => {
      parallelChecks.branch(waitState.next(taskState));
    });

    const definition = parallelChecks.next(successState);

    new sfn.StateMachine(this, 'OmsTimeoutAlerts-Static', {
      definition,
    });
  }
}
