import express from 'express';

import { pinoHttp } from 'pino-http';
import router from './routes.js';
import { makeHandleError } from './utils/error-handling/handle-error.js';
import { logger } from './utils/logger.js';

const app = express();

if (process.env.NODE_ENV !== 'test') {
  app.use(pinoHttp({ logger }));
}
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

app.use(router);

app.use(makeHandleError(logger));

export default app;
