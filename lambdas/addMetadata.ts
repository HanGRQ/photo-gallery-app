import { SNSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const ddb = new AWS.DynamoDB();
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log('Received SNS Event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const metadataType = record.Sns.MessageAttributes?.metadata_type?.Value;
    const body = JSON.parse(record.Sns.Message);
    const id = body.id;
    const value = body.value;

    if (!['Caption', 'Date', 'Name'].includes(metadataType)) {
      console.error('Invalid metadata type:', metadataType);
      continue;
    }

    await ddb.updateItem({
      TableName: tableName,
      Key: { id: { S: id } },
      UpdateExpression: `SET ${metadataType} = :value`,
      ExpressionAttributeValues: {
        ':value': { S: value },
      },
    }).promise();

    console.log(`Updated ${metadataType} for image ${id}`);
  }
};
