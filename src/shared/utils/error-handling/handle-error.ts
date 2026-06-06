import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from 'express';
import type { Logger } from 'pino';
import { GithubApiError } from './errors/github-api.error.js';
import { handleGithubApiError } from './handlers/handle-github-api-error.js';
import { AppError } from './errors/app.error.js';
import { handleAppError } from './handlers/handle-app-error.js';

export function makeHandleError(logger: Logger): ErrorRequestHandler {
  return function handleError(
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (err instanceof GithubApiError) {
      return handleGithubApiError(err, res, logger);
    }

    if (err instanceof AppError) {
      return handleAppError(err, res, logger);
    }

    logger.error({ err }, 'Unexpected server error');
    res.status(500).json({ message: 'Unexpected server error' });
    return;
  };
}
