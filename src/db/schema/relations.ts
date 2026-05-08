import { defineRelations } from 'drizzle-orm';
import { subscriptions } from './subscriptions.js';
import { githubRepositories } from './repositories.js';

export const relations = defineRelations(
  { subscriptions, githubRepositories },
  (r) => ({
    githubRepositories: {
      subscriptions: r.many.subscriptions({
        from: r.githubRepositories.id,
        to: r.subscriptions.githubRepositoryId,
      }),
    },
    subscriptions: {
      githubRepository: r.one.githubRepositories({
        from: r.subscriptions.githubRepositoryId,
        to: r.githubRepositories.id,
        optional: false,
      }),
    },
  }),
);
