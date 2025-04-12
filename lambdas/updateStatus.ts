import { SNSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const ddb = new AWS.DynamoDB();
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log('Received SNS Status Update Event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const body = JSON.parse(record.Sns.Message);
    const id = body.id;
    const date = body.date;
    const status = body.update.status;
    const reason = body.update.reason;

    if (!['Pass', 'Reject'].includes(status)) {
      console.error('Invalid status:', status);
      continue;
    }

    await ddb.updateItem({
      TableName: tableName,
      Key: { id: { S: id } },
      UpdateExpression: `SET Status = :status, DecisionDate = :date, Reason = :reason`,
      ExpressionAttributeValues: {
        ':status': { S: status },
        ':date': { S: date },
        ':reason': { S: reason },
      },
    }).promise();

    console.log(`Updated status for image ${id}`);
  }
};
