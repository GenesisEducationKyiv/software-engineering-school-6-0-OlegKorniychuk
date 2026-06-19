export const REPOSITORIES_EXCHANGE = 'repositories';

export const REPO_CREATE_REQUESTED_KEY = 'repo.create.requested';
export const REPO_CREATED_KEY = 'repo.created';
export const REPO_CREATE_FAILED_KEY = 'repo.create.failed';

export const REPO_CREATE_REQUESTED_QUEUE = 'repo.create.requested';
export const REPO_EVENTS_QUEUE = 'repo.events';

export interface RepoCreateRequestedCommand {
  sagaId: string;
  owner: string;
  repoName: string;
}

export interface RepoCreatedEvent {
  sagaId: string;
  repoId: string;
  repoName: string;
}

export interface RepoCreateFailedEvent {
  sagaId: string;
  reason: 'not_found' | 'rate_limited' | 'unknown';
  message: string;
  retryAfterMs?: number;
}
