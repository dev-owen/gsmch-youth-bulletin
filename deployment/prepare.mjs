import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const inputPath = join(projectRoot, 'deployment/config.local.json');

function fail(message) {
  console.error(`운영 설정 오류: ${message}`);
  process.exit(1);
}

function origin(value, name) {
  if (typeof value !== 'string') fail(`${name}을 입력해 주세요.`);
  let url;
  try { url = new URL(value); } catch { fail(`${name}은 https 주소여야 합니다.`); }
  if (url.protocol !== 'https:' || url.origin !== value.replace(/\/$/, '') || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || /(^|\.)example\.(com|org|net)$/.test(url.hostname) ||
      ['localhost', '127.0.0.1'].includes(url.hostname)) fail(`${name}에 실제 운영 https 원본 주소를 입력해 주세요.`);
  return url.origin;
}

let config;
try { config = JSON.parse(await readFile(inputPath, 'utf8')); }
catch { fail('deployment/config.example.json을 config.local.json으로 복사해 실제 값을 채워 주세요.'); }

const publicOrigin = origin(config.publicOrigin, 'publicOrigin');
const apiOrigin = origin(config.apiOrigin, 'apiOrigin');
const mediaOrigin = origin(config.mediaOrigin, 'mediaOrigin');
if (new Set([publicOrigin, apiOrigin, mediaOrigin]).size !== 3) fail('웹·API·미디어 주소는 서로 달라야 합니다.');
if (typeof config.hyperdriveId !== 'string' || !/^[a-f0-9-]{32,36}$/i.test(config.hyperdriveId) ||
    /^0+$/.test(config.hyperdriveId.replaceAll('-', ''))) fail('실제 Hyperdrive ID를 입력해 주세요.');
if (typeof config.mediaBucket !== 'string' || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(config.mediaBucket)) fail('R2 버킷 이름을 확인해 주세요.');

const workerConfig = {
  $schema: '../../node_modules/wrangler/config-schema.json',
  name: 'gsmch-youth-bulletin-api',
  main: 'src/index.ts',
  compatibility_date: '2026-10-25',
  compatibility_flags: ['nodejs_compat'],
  upload_source_maps: true,
  observability: { enabled: true, head_sampling_rate: 1 },
  secrets: { required: ['BETTER_AUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
  vars: {
    WEB_ORIGIN: publicOrigin,
    BETTER_AUTH_URL: apiOrigin,
    PUBLIC_MEDIA_BASE_URL: mediaOrigin,
  },
  routes: [{ pattern: new URL(apiOrigin).hostname, custom_domain: true }],
  hyperdrive: [{ binding: 'HYPERDRIVE', id: config.hyperdriveId }],
  r2_buckets: [{ binding: 'MEDIA', bucket_name: config.mediaBucket }],
};
await writeFile(join(projectRoot, 'apps/api/wrangler.production.jsonc'), `${JSON.stringify(workerConfig, null, 2)}\n`);
await writeFile(join(projectRoot, 'apps/web/.env.production.local'), `VITE_API_BASE_URL=${apiOrigin}\nVITE_MEDIA_BASE_URL=${mediaOrigin}\n`);
console.log('운영용 Workers 설정과 Pages 빌드 환경 파일을 생성했습니다.');
