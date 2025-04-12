import { SNSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const ddb = new AWS.DynamoDB();
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log('Received SNS Event for status update:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const body = JSON.parse(record.Sns.Message);
    const id = body.id;
    const update = body.update;

    if (!id || !update) {
      console.error('Invalid message format: missing id or update');
      continue;
    }

    await ddb.updateItem({
      TableName: tableName,
      Key: { id: { S: id } },
      UpdateExpression: 'SET #st = :status, #rs = :reason',
      ExpressionAttributeNames: {
        '#st': 'status',
        '#rs': 'reason',
      },
      ExpressionAttributeValues: {
        ':status': { S: update.status },
        ':reason': { S: update.reason || '' },
      },
    }).promise();

    console.log(`Status updated for item ${id}`);
  }
};