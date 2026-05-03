import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.url('DATABASE_URL must be a valid URL'),
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),

  EMAIL_SERVICE: z.string().min(1, 'EMAIL_SERVICE is required'),
  EMAIL_SERVICE_USERNAME: z.email(
    'EMAIL_SERVICE_USERNAME must be a valid email',
  ),
  EMAIL_SERVICE_PASSWORD: z
    .string()
    .min(1, 'EMAIL_SERVICE_PASSWORD is required'),

  NOTIFICATION_TOKEN_SECRET: z
    .string()
    .min(1, 'NOTIFICATION_TOKEN_SECRET is required'),
  REDIS_URL: z.url('REDIS_URL must be a valid URL'),
  API_KEY: z.string().min(1, 'API_KEY is required'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:');

  const errors = z.treeifyError(parsedEnv.error);

  console.error(errors.errors.join('\n'));

  process.exit(1);
}

export const env = parsedEnv.data;
