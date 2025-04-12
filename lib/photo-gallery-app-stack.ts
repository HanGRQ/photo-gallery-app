import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as s3_notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda_event_sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';


export class PhotoGalleryAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1-S3 Bucket
    const photoBucket = new s3.Bucket(this, 'PhotoBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 2-SNS Topic
    const photoTopic = new sns.Topic(this, 'PhotoTopic');

    // 3-Dead Letter Queue (DLQ)
    const deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue');

    // 4-Queue, connect DLQ
    const photoQueue = new sqs.Queue(this, 'PhotoQueue', {
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      }
    });

    // 11-DynamoDB ImageTable
    const imageTable = new dynamodb.Table(this, 'ImageTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, 
    });

    // 7-Lambda：LogImageFunction
    const logImageFunction = new lambda.Function(this, 'LogImageFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'processImage.handler',
      code: lambda.Code.fromAsset('lambdas'),
      environment: {
        TABLE_NAME: imageTable.tableName,
      }      
    });

    // 8-Lambda：StatusUpdateMailerFunction
    const statusUpdateMailerFunction = new lambda.Function(this, 'StatusUpdateMailerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'mailer.handler',
      code: lambda.Code.fromAsset('lambdas'),
    });

    // 12-Lambda:Remove
    const removeImageFunction = new lambda.Function(this, 'RemoveImageFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'removeImage.handler',
      code: lambda.Code.fromAsset('lambdas'),
    });

    // 5-SNS Topic, SQS Queue
    photoTopic.addSubscription(new sns_subscriptions.SqsSubscription(photoQueue));

    // 6-S3 Bucket object upload -> trigger SNS Topic
    photoBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3_notifications.SnsDestination(photoTopic)
    );

    photoBucket.grantDelete(removeImageFunction);

    // 9-Allow Lambda to read messages from SQS
    photoQueue.grantConsumeMessages(logImageFunction);

    // 10-Set LogImageFunction to listen to the SQS queue
    logImageFunction.addEventSource(new lambda_event_sources.SqsEventSource(photoQueue));

    removeImageFunction.addEventSource(new lambda_event_sources.SqsEventSource(deadLetterQueue));

    // Authorize Lambda to access the table
    imageTable.grantWriteData(logImageFunction);

    
    // Output
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
