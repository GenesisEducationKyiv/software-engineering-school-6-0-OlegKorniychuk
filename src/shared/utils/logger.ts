import fs from 'fs';
import pino from 'pino';
import { ecsFormat } from '@elastic/ecs-pino-format';

function buildStream() {
  if (process.env.NODE_ENV === 'test') return undefined;

  const streams: pino.StreamEntry[] = [{ stream: process.stdout }];

  if (process.env.LOG_FILE) {
    streams.push({
      stream: fs.createWriteStream(process.env.LOG_FILE, { flags: 'a' }),
    });
  }

  return streams.length > 1 ? pino.multistream(streams) : process.stdout;
}

export const logger = pino(
  {
    ...ecsFormat(),
    level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
  },
  buildStream(),
);
