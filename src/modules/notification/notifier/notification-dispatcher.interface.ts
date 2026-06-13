export type SubscriberInfo = { email: string; unsubscribeToken: string };

export interface NotificationDispatcher {
  dispatchNotifications(
    subscribers: SubscriberInfo[],
    repoName: string,
    releaseTag: string,
  ): Promise<number>;
}
