export interface SendConfirmationEmailPayload {
  email: string;
  token: string;
}

export interface SendNotificationEmailPayload {
  email: string;
  token: string;
  repo: string;
  release: string;
}

export interface EmailQueueClient {
  queueConfirmationEmail(payload: SendConfirmationEmailPayload): Promise<void>;
  queueNotificationEmail(payload: SendNotificationEmailPayload): Promise<void>;
}
