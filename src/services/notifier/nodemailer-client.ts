import nodemailer from 'nodemailer';
import type { TransportOptions } from 'nodemailer';
import type { MailClient, SendMailOptions } from './mail-client.types.js';

export type NodemailerConfig = {
  auth: {
    user: string;
    pass: string;
  };
} & (
  | {
      service: string;
    }
  | {
      host: string;
      port: number;
    }
);

export class NodemailerClient implements MailClient {
  private transporter: nodemailer.Transporter;

  constructor(config: NodemailerConfig) {
    this.transporter = nodemailer.createTransport(config as TransportOptions);
  }

  public async sendMail(options: SendMailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: '"Releases API" <noreply@releases-api.app>',
      ...options,
    });
  }
}
