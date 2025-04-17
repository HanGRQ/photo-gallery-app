import { SNSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const ses = new AWS.SES();
const ddb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log('Received SNS Email Event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const body = JSON.parse(record.Sns.Message);
    const id = body.id;
    const update = body.update;

    if (!id || !update) {
      console.error('Invalid message format: missing id or update');
      continue;
    }

    try {
      const result = await ddb.get({
        TableName: tableName,
        Key: { id }
      }).promise();

      const item = result.Item;
      if (!item || !item.name) {
        console.error(`No photographer name found for image ${id}`);
        continue;
      }

      const photographerName = item.name;
      
      const emailParams = {
        Source: 'masihan0303@gmail.com',  
        Destination: {
          ToAddresses: ['masihan0303@gmail.com'], 
        },
        Message: {
          Subject: {
            Data: `Photo ${id} Status Update`,
          },
          Body: {
            Text: {
              Data: `${photographerName},\n\nYour photo has been reviewed.\nStatus: ${update.status}\nReason: ${update.reason || 'None'}\n\nBest wishes,\nThe Photo Gallery Team`,
            },
          },
        },
      };

      await ses.sendEmail(emailParams).promise();
      console.log(`The status update email was sent successfully, the image ID：${id}`);
    } catch (error) {
      console.error(`Failed to get photographer information or send email: ${error}`);
    }
  }
};