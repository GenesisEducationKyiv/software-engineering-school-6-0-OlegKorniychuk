import type { PartialBy } from '../utils/partial-by.js';

export type Repo = {
  id: string;
  name: string;
  lastSeenTag: string | null;
};

export type CreateRepo = PartialBy<Repo, 'id' | 'lastSeenTag'>;

export interface RepoRepository {
  findByName(name: string): Promise<Repo | null>;
  findById(id: string): Promise<Repo | null>;
  createOne(data: CreateRepo): Promise<Repo>;
  findAll(): Promise<Repo[]>;
  updateTag(id: string, tag: string): Promise<Repo | null>;
}
