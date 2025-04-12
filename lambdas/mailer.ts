import { SQSEvent } from 'aws-lambda';

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log('Received Status Update Event:', JSON.stringify(event, null, 2));

};
