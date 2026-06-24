import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),
  NOTIFICATION_TOKEN_SECRET: z
    .string()
    .min(1, 'NOTIFICATION_TOKEN_SECRET is required'),
  NOTIFICATION_SERVICE_URL: z.string().default(''),
  NOTIFICATION_GRPC_URL: z.string().default(''),
  NOTIFICATION_TRANSPORT: z.enum(['http', 'grpc']).default('grpc'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),
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
