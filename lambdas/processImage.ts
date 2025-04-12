import { SQSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const ddb = new AWS.DynamoDB();
const s3 = new AWS.S3();

const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log('Received SQS Event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    const s3Info = message.Records[0].s3;
    const bucketName = s3Info.bucket.name;
    const objectKey = decodeURIComponent(s3Info.object.key.replace(/\+/g, ' '));

    console.log(`Processing file: ${objectKey}`);

    if (!(objectKey.endsWith('.jpeg') || objectKey.endsWith('.png'))) {
      console.error(`Invalid file type: ${objectKey}`);
      throw new Error('Unsupported file type'); 
    }

    // write DynamoDB table
    await ddb.putItem({
      TableName: tableName,
      Item: {
        id: { S: objectKey },
      }
    }).promise();

    console.log(`File ${objectKey} logged in database.`);
  }
};
