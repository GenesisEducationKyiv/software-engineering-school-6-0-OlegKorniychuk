import { ZodObject, ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export const validateRequest =
  (schema: ZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          message: 'Request validation failed',
          details: validationErrors,
        });
        return;
      }

      return next(error);
    }
  };
