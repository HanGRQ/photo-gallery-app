import { SQSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const ddb = new AWS.DynamoDB();
const s3 = new AWS.S3();
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log('Received SQS Event for removal:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    const s3Info = message?.Records?.[0]?.s3;

    if (!s3Info) {
      console.error('Invalid message format: missing s3 info');
      continue;
    }

    const bucketName = s3Info.bucket.name;
    const objectKey = decodeURIComponent(s3Info.object.key.replace(/\+/g, ' '));

    console.log(`Removing file: ${objectKey}`);

    try {
      await s3.deleteObject({
        Bucket: bucketName,
        Key: objectKey,
      }).promise();
      console.log(`Deleted file ${objectKey} from S3.`);
    } catch (error) {
      console.error(`Failed to delete file ${objectKey} from S3:`, error);
    }

    try {
      await ddb.deleteItem({
        TableName: tableName,
        Key: { id: { S: objectKey } },
      }).promise();
      console.log(`Deleted file ${objectKey} from DynamoDB.`);
    } catch (error) {
      console.error(`Failed to delete file ${objectKey} from DynamoDB:`, error);
    }
  }
};
