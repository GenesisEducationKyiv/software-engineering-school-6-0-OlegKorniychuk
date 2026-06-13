export interface NotifierStrategy {
  sendSubscriptionConfirmation(email: string, token: string): Promise<void>;
  sendNotification(
    emails: string[],
    repoName: string,
    releaseTag: string,
    unsubscribeToken: string,
  ): Promise<void>;
}
