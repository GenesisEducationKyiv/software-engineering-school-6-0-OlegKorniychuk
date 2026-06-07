export type SendMailOptions = {
  to: string[];
  subject: string;
  html: string;
};

export interface MailClient {
  sendMail(options: SendMailOptions): Promise<void>;
}
