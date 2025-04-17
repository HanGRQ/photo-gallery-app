import { SQSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const s3 = new AWS.S3();

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log('Received SQS Event for removal:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      const snsMessage = JSON.parse(body.Message);
      const s3Info = snsMessage.Records[0].s3;

      const bucketName = s3Info.bucket.name;
      const objectKey = decodeURIComponent(s3Info.object.key.replace(/\+/g, ' '));

      console.log(`Removing invalid file: ${objectKey}`);

      if (!(objectKey.toLowerCase().endsWith('.jpeg') || objectKey.toLowerCase().endsWith('.png'))) {
        await s3.deleteObject({
          Bucket: bucketName,
          Key: objectKey,
        }).promise();
        console.log(`Successfully deleted invalid file from S3 ${objectKey}`);
      } else {
        console.log(`The file ${objectKey} is a valid image format and does not need to be deleted`);
      }
    } catch (error) {
      console.error('Error processing DLQ message:', error);
    }
  }
};