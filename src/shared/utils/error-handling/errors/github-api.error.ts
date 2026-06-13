import type { EnumFromRecord } from '../../enum-from-record.js';

export const GithubApiErrorTypesEnum = {
  notFound: 'notFound',
  rateLimitExceeded: 'ratelimitExceeded',
  other: 'other',
} as const;

export type GithubApiErrorTypesEnum = EnumFromRecord<
  typeof GithubApiErrorTypesEnum
>;

export type GitHubApiErrorDetails = {
  retryAfterMs?: number | undefined;
  entity?: string;
  status?: number;
};

export class GithubApiError extends Error {
  public readonly type: GithubApiErrorTypesEnum;
  public readonly details: GitHubApiErrorDetails;

  constructor(
    type: GithubApiErrorTypesEnum,
    message: string,
    details?: GitHubApiErrorDetails,
  ) {
    super(message);
    this.type = type;
    this.name = 'GithubApiError';
    this.details = details || {};

    Error.captureStackTrace(this, this.constructor);
  }
}
