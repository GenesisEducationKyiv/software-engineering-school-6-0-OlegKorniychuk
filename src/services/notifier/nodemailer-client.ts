import nodemailer from 'nodemailer';
import type { MailClient, SendMailOptions } from './mail-client.types.js';

export class NodemailerClient implements MailClient {
  private transporter: nodemailer.Transporter;

  constructor(service: string, user: string, pass: string) {
    this.transporter = nodemailer.createTransport({
      service,
      auth: {
        user,
        pass,
      },
    });
  }

  public async sendMail(options: SendMailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: '"Releases API" <noreply@releases-api.app>',
      ...options,
    });
  }
}
