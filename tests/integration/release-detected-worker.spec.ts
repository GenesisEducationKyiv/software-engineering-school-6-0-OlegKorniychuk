import { jest } from '@jest/globals';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { GenericContainer } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import amqplib from 'amqplib';
import { subscriptionRepositories } from '../../src/shared/db/schema/subscription-repositories.js';
import { subscriptions } from '../../src/shared/db/schema/subscriptions.js';
import type { DrizzleClient } from '../../src/shared/db/client.js';
import type { SubscriberInfo } from '../../src/modules/notification/notifier/notification-dispatcher.interface.js';
import {
  RELEASES_EXCHANGE,
  RELEASE_DETECTED_ROUTING_KEY,
  type ReleaseDetectedEvent,
} from '../../src/shared/messaging/release-detected.event.js';

const mockQueueConfirmationEmail = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockDispatchToSubscribers = jest.fn<() => Promise<number>>().mockResolvedValue(0);

jest.unstable_mockModule(
  '../../src/modules/notification/http-notification-facade.js',
  () => ({
    HttpNotificationFacade: jest.fn().mockImplementation(() => ({
      queueConfirmationEmail: mockQueueConfirmationEmail,
      dispatchToSubscribers: mockDispatchToSubscribers,
    })),
  }),
);

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;
let rabbitmqContainer: StartedTestContainer;
let drizzleClient: DrizzleClient;
let shutdownDependencies: () => Promise<void>;

async function publishReleaseEvent(
  payload: ReleaseDetectedEvent,
): Promise<void> {
  const conn = await amqplib.connect(process.env.RABBITMQ_URL!);
  const ch = await conn.createChannel();
  await ch.assertExchange(RELEASES_EXCHANGE, 'topic', { durable: true });
  ch.publish(
    RELEASES_EXCHANGE,
    RELEASE_DETECTED_ROUTING_KEY,
    Buffer.from(JSON.stringify(payload)),
    { persistent: true },
  );
  await ch.close();
  await conn.close();
}

async function waitForDispatch(timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (mockDispatchToSubscribers.mock.calls.length > 0) return;
    await new Promise((r) => setTimeout(r, 200));
  }
}

beforeAll(async () => {
  jest.setTimeout(120000);

  pgContainer = await new PostgreSqlContainer('postgres:13-alpine')
    .withDatabase('test')
    .withUsername('test')
    .withPassword('test')
    .start();

  redisContainer = await new RedisContainer('redis:7-alpine').start();
  rabbitmqContainer = await new GenericContainer('rabbitmq:3-alpine')
    .withExposedPorts(5672)
    .start();

  const dbUrl = pgContainer.getConnectionUri();
  process.env.DATABASE_URL = dbUrl;
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
  process.env.RABBITMQ_URL = `amqp://guest:guest@${rabbitmqContainer.getHost()}:${rabbitmqContainer.getMappedPort(5672)}`;
  process.env.API_KEY = 'test-api-key';
  process.env.NOTIFICATION_TOKEN_SECRET = 'test-secret';
  process.env.GITHUB_TOKEN = 'test-github-token';
  process.env.NOTIFICATION_SERVICE_URL = 'http://localhost:9999';

  const migrationPool = new pg.Pool({ connectionString: dbUrl });
  const migrationDb = drizzle({ client: migrationPool });
  await migrate(migrationDb, { migrationsFolder: './drizzle' });
  await migrationPool.end();

  const dbClient = await import('../../src/shared/db/client.js');
  drizzleClient = dbClient.drizzleClient;

  const deps = await import('../../src/dependencies-container.js');
  shutdownDependencies = deps.shutdownDependencies;

  await deps.initNotificationRabbitMQ();
}, 120000);

afterAll(async () => {
  if (shutdownDependencies) await shutdownDependencies();
  if (pgContainer) await pgContainer.stop();
  if (redisContainer) await redisContainer.stop();
  if (rabbitmqContainer) await rabbitmqContainer.stop();
  jest.restoreAllMocks();
});

beforeEach(async () => {
  jest.clearAllMocks();
  await drizzleClient.execute(
    sql`TRUNCATE TABLE subscriptions, subscription_repositories, subscribe_sagas RESTART IDENTITY CASCADE`,
  );
});

describe('ReleaseDetectedWorker Integration Tests', () => {
  it('calls dispatchToSubscribers for confirmed subscriber', async () => {
    const [repo] = await drizzleClient
      .insert(subscriptionRepositories)
      .values({ id: '00000000-0000-0000-0000-000000000001', name: 'owner/repo' })
      .returning();
    if (!repo) throw new Error('Failed to insert repo');

    await drizzleClient.insert(subscriptions).values({
      email: 'confirmed@example.com',
      githubRepositoryId: repo.id,
      confirmed: true,
    });

    await publishReleaseEvent({
      repoId: repo.id,
      repoName: 'owner/repo',
      releaseTag: 'v1.2.0',
    });

    await waitForDispatch();

    expect(mockDispatchToSubscribers).toHaveBeenCalledWith(
      expect.arrayContaining<SubscriberInfo>([
        expect.objectContaining({ email: 'confirmed@example.com' }),
      ]),
      'owner/repo',
      'v1.2.0',
    );
  }, 30000);

  it('does not call dispatchToSubscribers when subscriber is unconfirmed', async () => {
    const [repo] = await drizzleClient
      .insert(subscriptionRepositories)
      .values({ id: '00000000-0000-0000-0000-000000000001', name: 'owner/repo' })
      .returning();
    if (!repo) throw new Error('Failed to insert repo');

    await drizzleClient.insert(subscriptions).values({
      email: 'unconfirmed@example.com',
      githubRepositoryId: repo.id,
      confirmed: false,
    });

    await publishReleaseEvent({
      repoId: repo.id,
      repoName: 'owner/repo',
      releaseTag: 'v2.0.0',
    });

    await new Promise((r) => setTimeout(r, 3000));

    expect(mockDispatchToSubscribers).not.toHaveBeenCalled();
  }, 15000);

  it('calls dispatchToSubscribers with all confirmed subscribers', async () => {
    const [repo] = await drizzleClient
      .insert(subscriptionRepositories)
      .values({ id: '00000000-0000-0000-0000-000000000001', name: 'owner/multi-repo' })
      .returning();
    if (!repo) throw new Error('Failed to insert repo');

    const emails = ['alice@example.com', 'bob@example.com', 'carol@example.com'];
    await drizzleClient.insert(subscriptions).values(
      emails.map((email) => ({
        email,
        githubRepositoryId: repo.id,
        confirmed: true,
      })),
    );

    await publishReleaseEvent({
      repoId: repo.id,
      repoName: 'owner/multi-repo',
      releaseTag: 'v3.0.0',
    });

    await waitForDispatch();

    expect(mockDispatchToSubscribers).toHaveBeenCalledWith(
      expect.arrayContaining(
        emails.map((email) => expect.objectContaining({ email })),
      ),
      'owner/multi-repo',
      'v3.0.0',
    );
  }, 30000);
});
