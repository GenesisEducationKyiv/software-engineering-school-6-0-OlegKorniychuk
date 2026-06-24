import { Router } from 'express';
import { z } from 'zod';
import type { EmailQueueClient } from './queue/email-queue.service.interface.js';
import type { NotificationDispatcher } from './notifier/notification-dispatcher.interface.js';

const confirmationSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
});

const dispatchSchema = z.object({
  subscribers: z.array(
    z.object({
      email: z.string().email(),
      unsubscribeToken: z.string().min(1),
    }),
  ),
  repoName: z.string().min(1),
  releaseTag: z.string().min(1),
});

export function createNotificationRouter(
  emailQueue: EmailQueueClient,
  dispatcher: NotificationDispatcher,
): Router {
  const router = Router();

  router.post('/confirmation', async (req, res, next) => {
    try {
      const parsed = confirmationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      await emailQueue.queueConfirmationEmail(parsed.data);
      res.status(202).end();
    } catch (err) {
      next(err);
    }
  });

  router.post('/dispatch', async (req, res, next) => {
    try {
      const parsed = dispatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const { subscribers, repoName, releaseTag } = parsed.data;
      const queued = await dispatcher.dispatchNotifications(
        subscribers,
        repoName,
        releaseTag,
      );
      res.status(202).json({ queued });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
