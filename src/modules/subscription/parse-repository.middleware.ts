import type { Request, Response, NextFunction } from 'express';
import type { SubscribeInput } from './subscription.schema.js';

export const parseRepositoryString = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const body = req.body as SubscribeInput;

  if (body?.repo) {
    const [owner, repoName] = body.repo.split('/');
    res.locals.owner = owner;
    res.locals.repoName = repoName;
  }

  next();
};
