import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { githubRepositories } from '../../db/schema/repositories.js';

export type GithubRepo = InferSelectModel<typeof githubRepositories>;
export type CreateGithubRepo = InferInsertModel<typeof githubRepositories>;
