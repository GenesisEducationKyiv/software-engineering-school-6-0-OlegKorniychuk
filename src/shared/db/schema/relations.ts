import { defineRelations } from 'drizzle-orm';
import { subscriptions } from './subscriptions.js';
import { githubRepositories } from './repositories.js';
import { subscriptionRepositories } from './subscription-repositories.js';
import { subscribeSagas } from './subscribe-sagas.js';

export const relations = defineRelations(
  {
    subscriptions,
    githubRepositories,
    subscriptionRepositories,
    subscribeSagas,
  },
  (r) => ({
    githubRepositories: {},
    subscribeSagas: {},
    subscriptionRepositories: {
      subscriptions: r.many.subscriptions({
        from: r.subscriptionRepositories.id,
        to: r.subscriptions.githubRepositoryId,
      }),
    },
    subscriptions: {
      githubRepository: r.one.subscriptionRepositories({
        from: r.subscriptions.githubRepositoryId,
        to: r.subscriptionRepositories.id,
        optional: false,
      }),
    },
  }),
);
