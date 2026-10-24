import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

// The Pages _redirects rule loops when uploaded to Workers, which already
// handles SPA routes through assets.not_found_handling = 'single-page-application'.
await rm(join(projectRoot, 'apps/web/dist/_redirects'), { force: true });
console.log('Workers 배포 자산에서 Pages 전용 _redirects 파일을 제외했습니다.');
