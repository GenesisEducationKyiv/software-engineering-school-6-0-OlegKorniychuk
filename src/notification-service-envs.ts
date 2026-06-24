import { z } from 'zod';

const envSchema = z
  .object({
    NOTIFICATION_PORT: z.coerce.number().default(3002),
    NOTIFICATION_GRPC_PORT: z.coerce.number().default(50051),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    APP_DOMAIN: z.string().min(1, 'APP_DOMAIN is required'),
    EMAIL_SERVICE_USERNAME: z
      .string()
      .min(1, 'EMAIL_SERVICE_USERNAME is required'),
    EMAIL_SERVICE_PASSWORD: z
      .string()
      .min(1, 'EMAIL_SERVICE_PASSWORD is required'),
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

export const notificationEnv = parsedEnv.data;
