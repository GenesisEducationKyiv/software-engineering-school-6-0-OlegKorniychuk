import { eq } from 'drizzle-orm';
import type { DrizzleClient } from '../../db/client.js';
import { githubRepositories } from '../../db/schema/repositories.js';
import type { CreateGithubRepo, GithubRepo } from './github-repo.types.js';
import type { GithubRepoRepository } from './github-repo.repository.interface.js';

export class GithubRepoRepositoryImplementation implements GithubRepoRepository {
  constructor(private readonly db: DrizzleClient) {}

  public async findByName(name: string): Promise<GithubRepo | null> {
    const result = await this.db.query.githubRepositories.findFirst({
      where: { name },
    });

    return result || null;
  }

  public async findById(id: string): Promise<GithubRepo | null> {
    const result = await this.db.query.githubRepositories.findFirst({
      where: { id },
    });

    return result || null;
  }

  public async createOne(data: CreateGithubRepo): Promise<GithubRepo> {
    const [result] = await this.db
      .insert(githubRepositories)
      .values(data)
      .returning();

    return result!;
  }

  public async findAll(): Promise<GithubRepo[]> {
    return await this.db.query.githubRepositories.findMany();
  }

  public async updateTag(id: string, tag: string): Promise<GithubRepo | null> {
    const [result] = await this.db
      .update(githubRepositories)
      .set({ id, lastSeenTag: tag })
      .where(eq(githubRepositories.id, id))
      .returning();

    return result || null;
  }
}
