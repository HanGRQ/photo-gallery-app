import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as s3_notifications from 'aws-cdk-lib/aws-s3-notifications';

export class PhotoGalleryAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const photoBucket = new s3.Bucket(this, 'PhotoBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const photoTopic = new sns.Topic(this, 'PhotoTopic');

    const deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue');

    const photoQueue = new sqs.Queue(this, 'PhotoQueue', {
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      }
    });

    photoTopic.addSubscription(new sns_subscriptions.SqsSubscription(photoQueue));

    photoBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3_notifications.SnsDestination(photoTopic)
    );

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
