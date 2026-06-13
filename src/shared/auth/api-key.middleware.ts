import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/envs.js';

export const requireApiKey = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const providedKey = req.header('x-api-key');
  const expectedKey = env.API_KEY;

  if (!providedKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing x-api-key header',
    });
    return;
  }

  try {
    const providedBuffer = Buffer.from(providedKey);
    const expectedBuffer = Buffer.from(expectedKey as string);

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new Error('Key mismatch');
    }
    next();
  } catch (error) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API Key',
    });
    return;
  }
};
