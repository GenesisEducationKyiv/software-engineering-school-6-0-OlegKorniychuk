import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { timingSafeEqual } from 'crypto';
import {
  GithubApiError,
  GithubApiErrorTypesEnum,
} from '../../shared/utils/error-handling/errors/github-api.error.js';
import type { RepositoryScanner } from './scanner/repository-scanner.service.interface.js';

export function createTrackerRouter(
  repoScanner: RepositoryScanner,
  apiKey: string,
): Router {
  const router = Router();

  const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
    const provided = req.header('x-api-key');
    if (!provided) {
      res.status(401).json({ message: 'Missing x-api-key header' });
      return;
    }
    try {
      const a = Buffer.from(provided);
      const b = Buffer.from(apiKey);
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error();
      next();
    } catch {
      res.status(403).json({ message: 'Invalid API key' });
    }
  };

  router.get(
    '/repos/:owner/:repo/verify',
    requireApiKey,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { owner, repo } = req.params as { owner: string; repo: string };
        await repoScanner.verifyRepository(owner, repo);
        res.status(200).json({ ok: true });
      } catch (err) {
        if (err instanceof GithubApiError) {
          if (err.type === GithubApiErrorTypesEnum.notFound) {
            res.status(404).json({ type: err.type, message: err.message });
            return;
          }
          if (err.type === GithubApiErrorTypesEnum.rateLimitExceeded) {
            res.status(429).json({
              type: err.type,
              message: err.message,
              retryAfterMs: err.details.retryAfterMs,
            });
            return;
          }
          res.status(502).json({ type: err.type, message: err.message });
          return;
        }
        next(err);
      }
    },
  );

  return router;
}
