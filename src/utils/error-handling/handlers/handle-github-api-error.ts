import {
  GithubApiError,
  GithubApiErrorTypesEnum,
} from '../errors/github-api.error.js';
import type { Response } from 'express';

export function handleGithubApiError(err: GithubApiError, res: Response): void {
  const handlersMap: Record<
    GithubApiErrorTypesEnum,
    (err: GithubApiError, res: Response) => void
  > = {
    [GithubApiErrorTypesEnum.notFound]: (err, res) => {
      const entity = err.details.entity || 'entity';
      res.status(404).json({ message: `${entity} not found on Github` });
    },
    [GithubApiErrorTypesEnum.rateLimitExceeded]: (err, res) => {
      const retryAfterMin = err.details.retryAfterMs
        ? 'in' + Math.floor(err.details.retryAfterMs / 1000 / 60)
        : undefined;
      res.status(400).json({
        message: `Github API rate limit exceeded. Try again ${retryAfterMin || 'later'}`,
      });
    },
    [GithubApiErrorTypesEnum.other]: (err, res) => {
      console.error(err);
      res.status(500).json({ message: 'Unexpected server error' });
    },
  };

  return handlersMap[err.type](err, res);
}
