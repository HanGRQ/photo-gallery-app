import { SQSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const ddb = new AWS.DynamoDB();
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log('Received SQS Event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const snsMessage = JSON.parse(body.Message);
    const s3Info = snsMessage.Records[0].s3;

    const bucketName = s3Info.bucket.name;
    const objectKey = decodeURIComponent(s3Info.object.key.replace(/\+/g, ' '));

    console.log(`Processing file: ${objectKey}`);

    if (!(objectKey.toLowerCase().endsWith('.jpeg') || objectKey.toLowerCase().endsWith('.png'))) {
      console.error(`Invalid file type: ${objectKey}`);
      throw new Error('Unsupported file type'); 
    }

    await ddb.putItem({
      TableName: tableName,
      Item: {
        id: { S: objectKey },
      }
    }).promise();

    console.log(`File ${objectKey} logged in database.`);
  }
};