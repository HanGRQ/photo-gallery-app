import { SNSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const ddb = new AWS.DynamoDB();
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log('Received SNS Event for metadata update:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const body = JSON.parse(record.Sns.Message);
    const id = body.id;
    const update = body.update;

    if (!id || !update) {
      console.error('Invalid message format: missing id or update');
      continue;
    }

    const updateExpressionParts: string[] = [];
    const expressionAttributeNames: { [key: string]: string } = {};
    const expressionAttributeValues: { [key: string]: AWS.DynamoDB.AttributeValue } = {};

    for (const [key, value] of Object.entries(update)) {
      const attrName = `#${key}`;
      const attrValue = `:${key}`;
      updateExpressionParts.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = { S: value as string };
    }

    if (updateExpressionParts.length === 0) {
      console.error('No valid metadata to update.');
      continue;
    }

    await ddb.updateItem({
      TableName: tableName,
      Key: { id: { S: id } },
      UpdateExpression: 'SET ' + updateExpressionParts.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }).promise();

    console.log(`Metadata updated for item ${id}`);
  }
};
