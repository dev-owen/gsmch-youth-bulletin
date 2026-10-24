import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const inputPath = join(projectRoot, 'deployment/config.free.local.json');

function fail(message) {
  console.error(`무료 배포 설정 오류: ${message}`);
  process.exit(1);
}

let config;
try { config = JSON.parse(await readFile(inputPath, 'utf8')); }
catch { fail('deployment/config.free.example.json을 config.free.local.json으로 복사해 실제 값을 채워 주세요.'); }

let url;
try { url = new URL(config.publicOrigin); }
catch { fail('publicOrigin에 실제 Workers HTTPS 주소를 입력해 주세요.'); }
if (url.protocol !== 'https:' || url.origin !== config.publicOrigin.replace(/\/$/, '') ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    !/^gsmch-youth-bulletin\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname)) {
  fail('publicOrigin은 https://gsmch-youth-bulletin.<계정 서브도메인>.workers.dev 형식이어야 합니다.');
}
const publicOrigin = url.origin;
if (typeof config.hyperdriveId !== 'string' || !/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(config.hyperdriveId) ||
    /^0+$/.test(config.hyperdriveId.replaceAll('-', ''))) fail('실제 Hyperdrive ID를 입력해 주세요.');
if (typeof config.mediaBucket !== 'string' || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(config.mediaBucket)) {
  fail('R2 버킷 이름을 확인해 주세요.');
}

const workerConfig = {
  $schema: '../../node_modules/wrangler/config-schema.json',
  name: 'gsmch-youth-bulletin',
  main: 'src/index.ts',
  compatibility_date: '2026-10-25',
  compatibility_flags: ['nodejs_compat'],
  workers_dev: true,
  upload_source_maps: true,
  observability: { enabled: true, head_sampling_rate: 1 },
  secrets: { required: ['BETTER_AUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
  vars: {
    WEB_ORIGIN: publicOrigin,
    BETTER_AUTH_URL: publicOrigin,
    PUBLIC_MEDIA_BASE_URL: `${publicOrigin}/v1/media`,
  },
  assets: {
    directory: '../web/dist',
    not_found_handling: 'single-page-application',
    run_worker_first: ['/api/*', '/v1/*'],
  },
  hyperdrive: [{ binding: 'HYPERDRIVE', id: config.hyperdriveId }],
  r2_buckets: [{ binding: 'MEDIA', bucket_name: config.mediaBucket }],
};
await writeFile(join(projectRoot, 'apps/api/wrangler.free.jsonc'), `${JSON.stringify(workerConfig, null, 2)}\n`);
console.log('웹·API·이미지를 한 Workers 주소에서 제공하는 Wrangler 설정을 생성했습니다.');
