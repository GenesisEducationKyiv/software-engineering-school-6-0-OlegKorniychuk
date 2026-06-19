import type { DrizzleClient } from '../../../shared/db/client.js';
import { subscriptionRepositories } from '../../../shared/db/schema/subscription-repositories.js';
import type { CreateSubscriptionRepo, SubscriptionRepo } from './subscription-repo.types.js';
import type { SubscriptionRepoRepository } from './subscription-repo.repository.interface.js';

export class SubscriptionRepoRepositoryImplementation implements SubscriptionRepoRepository {
  constructor(private readonly db: DrizzleClient) {}

  public async findByName(name: string): Promise<SubscriptionRepo | null> {
    const result = await this.db.query.subscriptionRepositories.findFirst({
      where: { name },
    });
    return result ?? null;
  }

  public async findById(id: string): Promise<SubscriptionRepo | null> {
    const result = await this.db.query.subscriptionRepositories.findFirst({
      where: { id },
    });
    return result ?? null;
  }

  public async createOne(data: CreateSubscriptionRepo): Promise<SubscriptionRepo> {
    const [result] = await this.db
      .insert(subscriptionRepositories)
      .values(data)
      .onConflictDoNothing()
      .returning();

    if (!result) {
      const existing = await this.findById(data.id);
      return existing!;
    }

    return result;
  }
}
