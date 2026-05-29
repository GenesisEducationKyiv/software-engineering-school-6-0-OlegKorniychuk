export interface MailpitMessage {
  Subject: string;
  To: { Address: string }[];
  ID: string;
}

export interface MailpitMessagesResponse {
  total: number;
  messages: MailpitMessage[];
}
