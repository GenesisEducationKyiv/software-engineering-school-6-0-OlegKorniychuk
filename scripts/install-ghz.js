import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { platform, arch } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ghzBin = resolve(__dirname, '../node_modules/.bin/ghz');

if (existsSync(ghzBin)) process.exit(0);

const VERSION = '0.121.0';
const os = platform();
const cpu = arch();

const platformMap = { linux: 'linux', darwin: 'darwin', win32: 'windows' };
const archMap = { x64: 'x86_64', arm64: 'arm64' };

const osPart = platformMap[os];
const archPart = archMap[cpu];

if (!osPart || !archPart) {
  console.warn(`[install-ghz] Unsupported platform ${os}/${cpu} — skip`);
  process.exit(0);
}

const ext = os === 'win32' ? 'zip' : 'tar.gz';
const url = `https://github.com/bojand/ghz/releases/download/v${VERSION}/ghz-${osPart}-${archPart}.${ext}`;
const tmp = `/tmp/ghz-${VERSION}.${ext}`;

console.log(`[install-ghz] Downloading ghz v${VERSION}...`);
try {
  execSync(`curl -fsSL "${url}" -o "${tmp}"`, { stdio: 'inherit' });
  execSync(`tar -xzf "${tmp}" -C /tmp ghz`, { stdio: 'inherit' });
  execSync(`cp /tmp/ghz "${ghzBin}" && chmod +x "${ghzBin}"`, { stdio: 'inherit' });
  console.log('[install-ghz] Done.');
} catch (err) {
  console.warn('[install-ghz] Failed to download ghz — run benchmark manually:', err.message);
}
