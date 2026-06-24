import client from 'prom-client';
import type { Express } from 'express';

export function startPrometheus(app: Express) {
  client.collectDefaultMetrics();

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });
}
