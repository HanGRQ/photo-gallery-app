import { SQSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const s3 = new AWS.S3();

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log('Received DLQ Event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    const s3Info = message.Records[0].s3;
    const bucketName = s3Info.bucket.name;
    const objectKey = decodeURIComponent(s3Info.object.key.replace(/\+/g, ' '));

    console.log(`Deleting invalid file: ${objectKey} from bucket: ${bucketName}`);

    await s3.deleteObject({
      Bucket: bucketName,
      Key: objectKey,
    }).promise();
  }
};
