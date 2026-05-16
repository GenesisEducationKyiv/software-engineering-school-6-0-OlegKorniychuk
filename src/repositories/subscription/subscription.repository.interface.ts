import type { CreateSubscription, Subscription } from './subscription.types.js';
import type { GithubRepo } from '../github-repo/github-repo.types.js';

export interface SubscriptionWithRepository extends Subscription {
  githubRepository: GithubRepo;
}

export interface SubscriptionRepository {
  createOne(data: CreateSubscription): Promise<Subscription>;
  confirm(id: string): Promise<Subscription | null>;
  findByEmailWithRepo(email: string): Promise<SubscriptionWithRepository[]>;
  findOneByRepoAndEmail(
    email: string,
    githubRepositoryId: string,
  ): Promise<Subscription | null>;
  deleteOne(id: string): Promise<Subscription | null>;
  findConfirmedByRepoId(githubRepositoryId: string): Promise<Subscription[]>;
}
