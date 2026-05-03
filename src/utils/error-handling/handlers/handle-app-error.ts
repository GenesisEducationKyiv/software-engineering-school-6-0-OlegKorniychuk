import { AppErrorTypesEnum, type AppError } from '../errors/app.error.js';
import type { Response } from 'express';

export function handleAppError(err: AppError, res: Response): void {
  const handlersMap: Record<
    AppErrorTypesEnum,
    (err: AppError, res: Response) => void
  > = {
    [AppErrorTypesEnum.invalidNotificationToken]: (err, res) =>
      res.status(400).json({ message: 'Invalid notification token' }),
    [AppErrorTypesEnum.entityExists]: (err, res) => {
      const entity = err.details.entity || 'entity';
      res.status(409).json({ message: `This ${entity} already exists` });
    },
    [AppErrorTypesEnum.entityNotFound]: (err, res) => {
      const entity = err.details.entity || 'entity';
      res.status(404).json({ message: `This ${entity} does not exists` });
    },
    [AppErrorTypesEnum.other]: (err, res) => {
      console.error(err);
      res.status(500).json({ message: 'Unexpected server error' });
    },
  };

  return handlersMap[err.type](err, res);
}
