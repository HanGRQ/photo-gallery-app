import { SNSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const ddb = new AWS.DynamoDB();
const sns = new AWS.SNS();
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log('Received SNS Event for status update:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const body = JSON.parse(record.Sns.Message);
    const id = body.id;
    const date = body.date;
    const update = body.update;

    if (!id || !update || !date) {
      console.error('Invalid message format: missing id, date or update');
      continue;
    }

    if (!['Pass', 'Reject'].includes(update.status)) {
      console.error(`Invalid status: ${update.status}. Must be 'Pass' or 'Reject'`);
      continue;
    }

    await ddb.updateItem({
      TableName: tableName,
      Key: { id: { S: id } },
      UpdateExpression: 'SET #st = :status, #rs = :reason, #dt = :date',
      ExpressionAttributeNames: {
        '#st': 'status',
        '#rs': 'reason',
        '#dt': 'review_date'
      },
      ExpressionAttributeValues: {
        ':status': { S: update.status },
        ':reason': { S: update.reason || '' },
        ':date': { S: date }
      },
    }).promise();

    console.log(`Status updated for item ${id}`);
    
    await sns.publish({
      TopicArn: record.Sns.TopicArn,
      Message: JSON.stringify(body),
      MessageAttributes: {
        'eventType': {
          DataType: 'String',
          StringValue: 'Review'
        }
      }
    }).promise();
    
    console.log(`Published status update notification for ${id}`);
  }
};