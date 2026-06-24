import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { EmptySchema } from '@bufbuild/protobuf/wkt';
import { NotificationService } from '../../../generated/notification/v1/notification_pb.js';
import type { EmailQueueClient } from '../queue/email-queue.service.interface.js';
import type { NotificationDispatcher } from '../notifier/notification-dispatcher.interface.js';

export function registerNotificationGrpcHandler(
  router: ConnectRouter,
  emailQueue: EmailQueueClient,
  dispatcher: NotificationDispatcher,
): void {
  router.service(NotificationService, {
    async queueConfirmationEmail(req) {
      try {
        await emailQueue.queueConfirmationEmail({
          email: req.email,
          token: req.token,
        });
        return create(EmptySchema);
      } catch {
        throw new ConnectError(
          'Failed to queue confirmation email',
          Code.Internal,
        );
      }
    },

    async dispatchToSubscribers(req) {
      try {
        const queued = await dispatcher.dispatchNotifications(
          req.subscribers,
          req.repoName,
          req.releaseTag,
        );
        return { queued };
      } catch {
        throw new ConnectError(
          'Failed to dispatch to subscribers',
          Code.Internal,
        );
      }
    },
  });
}
