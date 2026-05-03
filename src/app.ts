import express from 'express';

import morgan from 'morgan';
import router from './routes.js';
import { handleError } from './utils/error-handling/handle-error.js';

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

app.use(router);

app.use(handleError);

export default app;
