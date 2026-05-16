export interface NotificationDispatcher {
  dispatchNotifications(
    repoId: string,
    repoName: string,
    releaseTag: string,
  ): Promise<number>;
}
