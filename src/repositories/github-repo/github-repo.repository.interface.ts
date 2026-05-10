import type { CreateGithubRepo, GithubRepo } from './github-repo.types.js';

export interface GithubRepoRepository {
  findByName(name: string): Promise<GithubRepo | null>;
  findById(id: string): Promise<GithubRepo | null>;
  createOne(data: CreateGithubRepo): Promise<GithubRepo>;
  findAll(): Promise<GithubRepo[]>;
  updateTag(id: string, tag: string): Promise<GithubRepo | null>;
}
