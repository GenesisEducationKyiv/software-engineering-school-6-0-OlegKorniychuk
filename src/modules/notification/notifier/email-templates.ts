export const EmailTemplates = {
  notification(repoName: string, releaseTag: string, unsubscribeUrl: string) {
    return `
      <h2>Good news!</h2>
      <p>The repository <strong>${repoName}</strong> just released version <strong>${releaseTag}</strong>.</p>
      <br>
      <p style="font-size: 12px; color: gray;">
        To stop receiving these emails, <a href="${unsubscribeUrl}">unsubscribe here</a>.
      </p>
    `;
  },
  confirmSubscribe(confirmUrl: string) {
    return `
      <h2>Almost there!</h2>
      <p>Please confirm your subscription by clicking the link below:</p>
      <a href="${confirmUrl}">Confirm Subscription</a>
    `;
  },
};
