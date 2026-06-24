import autocannon from 'autocannon';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);

const HTTP_URL = process.env['HTTP_URL'] ?? 'http://localhost:3002';
const GRPC_ADDR = process.env['GRPC_ADDR'] ?? 'localhost:50051';
const DURATION = 10;
const CONNECTIONS = 10;

const PROTO_PATH = resolve(
  import.meta.dirname,
  '../proto/notification/v1/notification.proto',
);
const PROTO_DIR = resolve(import.meta.dirname, '../proto');
const GHZ_BIN = resolve(import.meta.dirname, '../node_modules/.bin/ghz');

interface GhzResult {
  count: number;
  total: number;
  average: number;
  fastest: number;
  slowest: number;
  rps: number;
  errorDistribution: Record<string, number>;
  statusCodeDistribution: Record<string, number>;
  latencyDistribution: Array<{ percentage: number; latency: number }>;
}

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

async function benchmarkGrpc(): Promise<GhzResult> {
  const outFile = resolve(tmpdir(), `ghz-result-${Date.now()}.json`);
  await execFileAsync(GHZ_BIN, [
    '--proto', PROTO_PATH,
    '--import-paths', PROTO_DIR,
    '--call', 'notification.v1.NotificationService.QueueConfirmationEmail',
    '--data', JSON.stringify({ email: 'bench@test.com', token: 'bench-token' }),
    `--duration=${DURATION}s`,
    `--concurrency=${CONNECTIONS}`,
    '--format=json',
    `--output=${outFile}`,
    '--insecure',
    GRPC_ADDR,
  ]);
  const raw = await readFile(outFile, 'utf8');
  await unlink(outFile).catch(() => undefined);
  return JSON.parse(raw) as GhzResult;
}

function nsToMs(ns: number): string {
  return (ns / 1_000_000).toFixed(2);
}

function printHttpResult(r: autocannon.Result): void {
  console.log('\n--- HTTP REST (autocannon, HTTP/1.1) ---');
  console.log(`  Requests/sec : ${r.requests.average.toFixed(0)}`);
  console.log(`  Throughput   : ${(r.throughput.average / 1024).toFixed(1)} KB/s`);
  console.log(`  Latency p50  : ${r.latency.p50} ms`);
  console.log(`  Latency p99  : ${r.latency.p99} ms`);
  console.log(`  Errors       : ${r.errors}`);
}

function printGrpcResult(r: GhzResult): void {
  const p50 = r.latencyDistribution.find((d) => d.percentage === 50);
  const p99 = r.latencyDistribution.find((d) => d.percentage === 99);
  const errors = Object.values(r.errorDistribution).reduce((s, v) => s + v, 0);

  console.log('\n--- gRPC ConnectRPC (ghz, HTTP/2) ---');
  console.log(`  Requests/sec : ${r.rps.toFixed(0)}`);
  console.log(`  Total reqs   : ${r.count}`);
  console.log(`  Latency avg  : ${nsToMs(r.average)} ms`);
  console.log(`  Latency p50  : ${nsToMs(p50?.latency ?? 0)} ms`);
  console.log(`  Latency p99  : ${nsToMs(p99?.latency ?? 0)} ms`);
  console.log(`  Errors       : ${errors}`);
}

async function run(): Promise<void> {
  console.log('Benchmark: HTTP (REST) vs gRPC (ConnectRPC + ghz)');
  console.log(`Duration: ${DURATION}s | Concurrency: ${CONNECTIONS}`);
  console.log(`HTTP target  : ${HTTP_URL}`);
  console.log(`gRPC target  : ${GRPC_ADDR}`);

  console.log('\nRunning HTTP benchmark...');
  const httpResult = await benchmarkHttp();

  console.log('Running gRPC benchmark (ghz)...');
  const grpcResult = await benchmarkGrpc();

  printHttpResult(httpResult);
  printGrpcResult(grpcResult);

  const httpRps = httpResult.requests.average;
  const grpcRps = grpcResult.rps;
  const diff = ((grpcRps - httpRps) / httpRps) * 100;
  console.log(`\nΔ gRPC vs HTTP: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`);
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
