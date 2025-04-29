import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as s3_notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_event_sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';   

export class PhotoGalleryAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1 - S3 Bucket
    const photoBucket = new s3.Bucket(this, 'PhotoBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 2 - SNS Topic
    const photoTopic = new sns.Topic(this, 'PhotoTopic');

    // 3 - Dead Letter Queue (DLQ)
    const deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue');

    // 4 - SQS Queue, connect to DLQ
    const photoQueue = new sqs.Queue(this, 'PhotoQueue', {
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      }
    });

    // 5 - DynamoDB Table
    const imageTable = new dynamodb.Table(this, 'ImageTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 6 - Lambda Functions
    const logImageFunction = new lambdaNodejs.NodejsFunction(this, 'LogImageFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'lambdas/processImage.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: imageTable.tableName,
      }
    });

    const statusUpdateMailerFunction = new lambdaNodejs.NodejsFunction(this, 'StatusUpdateMailerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'lambdas/mailer.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: imageTable.tableName,
      }
    });

    const removeImageFunction = new lambdaNodejs.NodejsFunction(this, 'RemoveImageFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'lambdas/removeImage.ts',
      handler: 'handler',
    });

    const addMetadataFunction = new lambdaNodejs.NodejsFunction(this, 'AddMetadataFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'lambdas/addMetadata.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: imageTable.tableName,
      }
    });

    const updateStatusFunction = new lambdaNodejs.NodejsFunction(this, 'UpdateStatusFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'lambdas/updateStatus.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: imageTable.tableName,
      }
    });

    // 7 - SNS Subscriptions with filtering
    photoTopic.addSubscription(new sns_subscriptions.SqsSubscription(photoQueue));
    
    photoTopic.addSubscription(new sns_subscriptions.LambdaSubscription(addMetadataFunction, {
      filterPolicy: {
        metadata_type: sns.SubscriptionFilter.stringFilter({
          allowlist: ['Caption', 'Date', 'Name'],
        }),
      }
    }));
    
    photoTopic.addSubscription(new sns_subscriptions.LambdaSubscription(updateStatusFunction));
    
    photoTopic.addSubscription(new sns_subscriptions.LambdaSubscription(statusUpdateMailerFunction, {
      filterPolicy: {
        eventType: sns.SubscriptionFilter.stringFilter({
          allowlist: ['Review'],
        }),
      }
    }));

    // 8 - S3 Upload -> SNS Notification
    photoBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3_notifications.SnsDestination(photoTopic)
    );

    // 9 - Grant Permissions
    photoBucket.grantDelete(removeImageFunction);
    photoBucket.grantRead(logImageFunction);

    photoQueue.grantConsumeMessages(logImageFunction);
    logImageFunction.addEventSource(new lambda_event_sources.SqsEventSource(photoQueue));

    deadLetterQueue.grantConsumeMessages(removeImageFunction);
    removeImageFunction.addEventSource(new lambda_event_sources.SqsEventSource(deadLetterQueue));

    imageTable.grantWriteData(logImageFunction);
    imageTable.grantWriteData(addMetadataFunction);
    imageTable.grantWriteData(updateStatusFunction);
    imageTable.grantReadWriteData(statusUpdateMailerFunction);

    photoTopic.grantPublish(updateStatusFunction);

    statusUpdateMailerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: ['*'],
    }));    

    // 10 - Output Resources
    new cdk.CfnOutput(this, 'PhotoBucketName', {
      value: photoBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'PhotoTopicArn', {
      value: photoTopic.topicArn,
    });
    new cdk.CfnOutput(this, 'PhotoQueueUrl', {
      value: photoQueue.queueUrl,
    });
  }
}