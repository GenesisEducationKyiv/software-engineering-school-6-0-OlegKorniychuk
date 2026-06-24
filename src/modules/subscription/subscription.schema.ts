import { z } from 'zod';

const githubRepoRegex = /^[a-zA-Z0-9-]+\/[a-zA-Z0-9-_.]+$/;

export const subscribeSchema = z.object({
  body: z.object({
    email: z.email('Please provide a valid email address'),
    repo: z
      .string()
      .regex(
        githubRepoRegex,
        "Invalid format. Must be 'owner/repository' (e.g., 'golang/go')",
      ),
  }),
});

export const subscriptionTokenSchema = z.object({
  params: z.object({
    token: z.jwt('Token must be a JWT'),
  }),
});

export const listSubscriptionsSchema = z.object({
  query: z.object({
    email: z.email('Please provide a valid email address'),
  }),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>['body'];
export type SubscriptionTokenInput = z.infer<
  typeof subscriptionTokenSchema
>['params'];
export type GetSubscriptionsInput = z.infer<
  typeof listSubscriptionsSchema
>['query'];
