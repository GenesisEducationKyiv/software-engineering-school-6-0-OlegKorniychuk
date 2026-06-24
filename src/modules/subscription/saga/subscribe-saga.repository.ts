import { and, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../../../shared/db/client.js';
import { subscribeSagas } from '../../../shared/db/schema/subscribe-sagas.js';
import type {
  CreateSubscribeSaga,
  SubscribeSaga,
} from './subscribe-saga.types.js';
import type { SubscribeSagaRepository } from './subscribe-saga.repository.interface.js';

export class SubscribeSagaRepositoryImplementation implements SubscribeSagaRepository {
  constructor(private readonly db: DrizzleClient) {}

  public async create(data: CreateSubscribeSaga): Promise<SubscribeSaga> {
    const [result] = await this.db
      .insert(subscribeSagas)
      .values(data)
      .returning();
    return result!;
  }

  public async findById(id: string): Promise<SubscribeSaga | null> {
    const result = await this.db.query.subscribeSagas.findFirst({
      where: { id },
    });
    return result ?? null;
  }

  public async findAwaitingByRepoName(
    repoName: string,
  ): Promise<SubscribeSaga[]> {
    return this.db
      .select()
      .from(subscribeSagas)
      .where(
        and(
          eq(subscribeSagas.repoName, repoName),
          eq(subscribeSagas.status, 'awaiting_repo'),
        ),
      );
  }

  public async markCompleted(id: string): Promise<void> {
    await this.db
      .update(subscribeSagas)
      .set({ status: 'completed' })
      .where(eq(subscribeSagas.id, id));
  }

  public async markFailed(id: string, reason: string): Promise<void> {
    await this.db
      .update(subscribeSagas)
      .set({ status: 'failed', failureReason: reason })
      .where(eq(subscribeSagas.id, id));
  }
}
