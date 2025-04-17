import { SNSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const ddb = new AWS.DynamoDB();
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log('Received SNS Event for metadata update:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const body = JSON.parse(record.Sns.Message);
    const id = body.id;
    const value = body.value;
    
    const metadataType = record.Sns.MessageAttributes.metadata_type.Value;

    if (!id || !value || !metadataType) {
      console.error('Invalid message format: missing id, value or metadata_type');
      continue;
    }

    if (!['Caption', 'Date', 'Name'].includes(metadataType)) {
      console.error(`Invalid metadata type: ${metadataType}`);
      continue;
    }

    const updateParams = {
      TableName: tableName,
      Key: { id: { S: id } },
      UpdateExpression: `SET #attr = :value`,
      ExpressionAttributeNames: {
        '#attr': metadataType.toLowerCase(),
      },
      ExpressionAttributeValues: {
        ':value': { S: value },
      },
    };

    await ddb.updateItem(updateParams).promise();
    console.log(`Metadata ${metadataType} updated for item ${id}`);
  }
};