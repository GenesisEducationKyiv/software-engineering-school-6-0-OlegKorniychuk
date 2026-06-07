import { EmailTemplates } from './email-templates.js';
import type { MailClient } from './mail-client.types.js';
import type { NotifierStrategy } from './notifier.strategy.js';

export class EmailNotifierStrategy implements NotifierStrategy {
  constructor(
    private readonly mailClient: MailClient,
    private readonly appDomain: string,
  ) {}

  public async sendSubscriptionConfirmation(
    email: string,
    token: string,
  ): Promise<void> {
    const confirmUrl = `${this.appDomain}/confirm/${token}`;

    await this.mailClient.sendMail({
      to: [email],
      subject: 'Confirm your GitHub Release Subscription',
      html: EmailTemplates.confirmSubscribe(confirmUrl),
    });
  }

  public async sendNotification(
    emails: string[],
    repoName: string,
    releaseTag: string,
    unsubscribeToken: string,
  ): Promise<void> {
    const unsubscribeUrl = `${this.appDomain}/unsubscribe/${unsubscribeToken}`;

    await this.mailClient.sendMail({
      to: emails,
      subject: `New Release: ${repoName} ${releaseTag}`,
      html: EmailTemplates.notification(repoName, releaseTag, unsubscribeUrl),
    });
  }
}
