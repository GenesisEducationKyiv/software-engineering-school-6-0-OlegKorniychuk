import type { Request, Response, NextFunction } from 'express';
import { GithubApiError } from './errors/github-api.error.js';
import { handleGithubApiError } from './handlers/handle-github-api-error.js';
import { AppError } from './errors/app.error.js';
import { handleAppError } from './handlers/handle-app-error.js';

export function handleError(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof GithubApiError) {
    return handleGithubApiError(err, res);
  }

  if (err instanceof AppError) {
    return handleAppError(err, res);
  }

  console.error(err);
  res.status(500).json({ message: 'Unexpected server error' });
  return;
}
