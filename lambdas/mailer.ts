import { SNSEvent } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const ses = new AWS.SES();

export const handler = async (event: SNSEvent): Promise<void> => {
  console.log('Received SNS Email Event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const body = JSON.parse(record.Sns.Message);
    const id = body.id;
    const status = body.update.status;
    const reason = body.update.reason;

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
            Data: `Your photo has been reviewed.\nStatus: ${status}\nReason: ${reason}`,
          },
        },
      },
    };

    await ses.sendEmail(emailParams).promise();
    console.log(`Sent status update email for image ${id}`);
  }
};
