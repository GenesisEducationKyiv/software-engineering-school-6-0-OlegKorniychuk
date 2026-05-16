import { z } from 'zod';

const envSchema = z
  .object({
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),

    EMAIL_SERVICE_USERNAME: z
      .string()
      .min(1, 'EMAIL_SERVICE_USERNAME is required'),
    EMAIL_SERVICE_PASSWORD: z
      .string()
      .min(1, 'EMAIL_SERVICE_PASSWORD is required'),

    NOTIFICATION_TOKEN_SECRET: z
      .string()
      .min(1, 'NOTIFICATION_TOKEN_SECRET is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    API_KEY: z.string().min(1, 'API_KEY is required'),
  })
  .and(
    z.union([
      z.object({
        EMAIL_SERVICE: z.string().min(1, 'EMAIL_SERVICE is required'),
      }),
      z.object({
        EMAIL_HOST: z.string().min(1, 'EMAIL_HOST is required'),
        EMAIL_PORT: z.coerce
          .number()
          .int()
          .positive('EMAIL_PORT must be a positive integer'),
      }),
    ]),
  );

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:');

  const errors = z.treeifyError(parsedEnv.error);

  console.error(errors.errors.join('\n'));

  process.exit(1);
}

export const env = parsedEnv.data;
