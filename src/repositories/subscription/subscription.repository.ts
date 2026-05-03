import { and, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../../db/client.js';
import { subscriptions } from '../../db/schema/subscriptions.js';
import type { CreateSubscription, Subscription } from './subscription.types.js';

export class SubscriptionRepository {
  constructor(private readonly db: DrizzleClient) {}

  public async createOne(data: CreateSubscription): Promise<Subscription> {
    const [result] = await this.db
      .insert(subscriptions)
      .values(data)
      .returning();

    return result!;
  }

  public async confirm(id: string): Promise<Subscription | null> {
    const [result] = await this.db
      .update(subscriptions)
      .set({ confirmed: true })
      .where(and(eq(subscriptions.id, id), eq(subscriptions.confirmed, false)))
      .returning();

    return result || null;
  }

  public async findByEmailWithRepo(email: string) {
    return await this.db.query.subscriptions.findMany({
      where: { email },
      with: { githubRepository: true },
    });
  }

  public async findOneByRepoAndEmail(
    email: string,
    githubRepositoryId: string,
  ): Promise<Subscription | null> {
    const result = await this.db.query.subscriptions.findFirst({
      where: {
        email,
        githubRepositoryId,
      },
    });

    return result || null;
  }

  public async deleteOne(id: string): Promise<Subscription | null> {
    const [result] = await this.db
      .delete(subscriptions)
      .where(eq(subscriptions.id, id))
      .returning();

    return result || null;
  }

  public async findConfirmedByRepoId(
    githubRepositoryId: string,
  ): Promise<Subscription[]> {
    return await this.db.query.subscriptions.findMany({
      where: {
        githubRepositoryId,
        confirmed: true,
      },
    });
  }
}
