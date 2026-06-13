import { z } from 'zod';

const trackerEnvSchema = z.object({
  TRACKER_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),
  API_KEY: z.string().min(1, 'API_KEY is required'),
});

const parsed = trackerEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid tracker environment variables:');
  console.error(z.treeifyError(parsed.error).errors?.join('\n'));
  process.exit(1);
}

export const trackerEnv = parsed.data;
