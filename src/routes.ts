import { Router } from 'express';
import { validateRequest } from './utils/middlewares/validateRequest.js';
import {
  subscriptionTokenSchema,
  subscribeSchema,
  listSubscriptionsSchema,
} from './modules/subscription/subscription.schema.js';
import {
  cacheService,
  subscriptionController,
  subscriptionService,
} from './dependencies-container.js';
import { routeCache } from './services/cache/cache.middleware.js';
import { requireApiKey } from './auth/api-key.middleware.js';
import { parseRepositoryString } from './modules/subscription/parse-repository.middleware.js';

const router = Router();

router
  .route('/confirm/:token')
  .get(
    validateRequest(subscriptionTokenSchema),
    subscriptionController.confirmSubscription.bind(subscriptionController),
  );

router
  .route('/unsubscribe/:token')
  .get(
    validateRequest(subscriptionTokenSchema),
    subscriptionController.unsubscribe.bind(subscriptionController),
  );

router.use(requireApiKey);

router
  .route('/subscribe')
  .post(
    validateRequest(subscribeSchema),
    parseRepositoryString,
    subscriptionController.subscribe.bind(subscriptionController),
  );

router.route('/subscriptions').get(
  validateRequest(listSubscriptionsSchema),
  routeCache(
    cacheService,
    (req) => subscriptionService.getCacheKey(req.query.email as string),
    600,
  ),
  subscriptionController.getSubscriptions.bind(subscriptionController),
);

export default router;
