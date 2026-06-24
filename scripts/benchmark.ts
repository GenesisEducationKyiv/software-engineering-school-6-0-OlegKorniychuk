import autocannon from 'autocannon';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { NotificationService } from '../src/generated/notification/v1/notification_pb.js';

const HTTP_URL = process.env['HTTP_URL'] ?? 'http://localhost:3002';
const GRPC_URL = process.env['GRPC_URL'] ?? 'http://localhost:50051';
const DURATION = 10;
const CONNECTIONS = 10;

async function benchmarkHttp(): Promise<autocannon.Result> {
  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url: `${HTTP_URL}/emails/confirmation`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bench@test.com', token: 'bench-token' }),
        duration: DURATION,
        connections: CONNECTIONS,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      },
    );
    autocannon.track(instance, { renderProgressBar: false });
  });
}

async function benchmarkGrpc(): Promise<{
  requests: number;
  duration: number;
  errors: number;
  p50: number;
  p99: number;
}> {
  const transport = createGrpcTransport({ baseUrl: GRPC_URL });
  const client = createClient(NotificationService, transport);

  const start = Date.now();
  const deadline = start + DURATION * 1000;
  let requests = 0;
  let errors = 0;
  const latencies: number[] = [];

  while (Date.now() < deadline) {
    const batch = Array.from({ length: CONNECTIONS }, async () => {
      const t0 = Date.now();
      try {
        await client.queueConfirmationEmail({
          email: 'bench@test.com',
          token: 'bench-token',
        });
        requests++;
        latencies.push(Date.now() - t0);
      } catch {
        errors++;
      }
    });
    await Promise.all(batch);
  }

  const duration = (Date.now() - start) / 1000;
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] ?? 0;

  return { requests, duration, errors, p50, p99 };
}

function printHttpResult(label: string, r: autocannon.Result): void {
  console.log(`\n--- ${label} ---`);
  console.log(`  Requests/sec : ${r.requests.average.toFixed(0)}`);
  console.log(`  Throughput   : ${(r.throughput.average / 1024).toFixed(1)} KB/s`);
  console.log(`  Latency p50  : ${r.latency.p50} ms`);
  console.log(`  Latency p99  : ${r.latency.p99} ms`);
  console.log(`  Errors       : ${r.errors}`);
}

function printGrpcResult(label: string, r: {
  requests: number;
  duration: number;
  errors: number;
  p50: number;
  p99: number;
}): void {
  console.log(`\n--- ${label} ---`);
  console.log(`  Requests/sec : ${(r.requests / r.duration).toFixed(0)}`);
  console.log(`  Total reqs   : ${r.requests}`);
  console.log(`  Latency p50  : ${r.p50} ms`);
  console.log(`  Latency p99  : ${r.p99} ms`);
  console.log(`  Errors       : ${r.errors}`);
}

async function run(): Promise<void> {
  console.log('Benchmark: HTTP (REST) vs gRPC (ConnectRPC)');
  console.log(`Duration: ${DURATION}s | Connections: ${CONNECTIONS}`);
  console.log(`HTTP target  : ${HTTP_URL}`);
  console.log(`gRPC target  : ${GRPC_URL}`);

  console.log('\nRunning HTTP benchmark...');
  const httpResult = await benchmarkHttp();

  console.log('\nRunning gRPC benchmark...');
  const grpcResult = await benchmarkGrpc();

  printHttpResult('HTTP REST (autocannon)', httpResult);
  printGrpcResult('gRPC ConnectRPC (custom loop)', grpcResult);

  const httpRps = httpResult.requests.average;
  const grpcRps = grpcResult.requests / grpcResult.duration;
  const diff = ((grpcRps - httpRps) / httpRps) * 100;
  console.log(`\nΔ gRPC vs HTTP: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`);
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
