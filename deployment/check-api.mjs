const urlInput = process.argv[2];
const countInput = Number(process.argv[3] || 100);
const concurrencyInput = Number(process.argv[4] || 5);
if (!urlInput || !Number.isInteger(countInput) || countInput < 1 || countInput > 1000 ||
    !Number.isInteger(concurrencyInput) || concurrencyInput < 1 || concurrencyInput > 20) {
  console.error('사용법: npm run check:api -- https://api.example.org [요청 수 1~1000] [동시 요청 1~20]');
  process.exit(1);
}
let origin;
try { origin = new URL(urlInput).origin; } catch { console.error('API 주소가 올바르지 않습니다.'); process.exit(1); }
if (!['https:', 'http:'].includes(new URL(origin).protocol)) { console.error('API 주소는 http 또는 https여야 합니다.'); process.exit(1); }

const statusCounts = new Map();
const durations = [];
let next = 0;
async function request(path) {
  const start = performance.now();
  let status = 'NETWORK_ERROR';
  try {
    const response = await fetch(`${origin}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    status = String(response.status);
    await response.arrayBuffer();
  } catch { /* network and timeout errors count as failures */ }
  durations.push(performance.now() - start);
  statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
}
await request('/v1/health');
if (statusCounts.get('200') !== 1) { console.error('헬스 체크에 실패했습니다.', Object.fromEntries(statusCounts)); process.exit(1); }
async function worker() {
  while (next < countInput) {
    next += 1;
    await request('/v1/bulletins/current');
  }
}
await Promise.all(Array.from({ length: Math.min(concurrencyInput, countInput) }, worker));
durations.sort((a, b) => a - b);
const percentile = (p) => Math.round(durations[Math.ceil(p * durations.length) - 1]);
const errorCount = durations.length - (statusCounts.get('200') || 0);
console.log(JSON.stringify({ origin, requests: durations.length, concurrency: concurrencyInput,
  statusCounts: Object.fromEntries(statusCounts), errorRatePercent: Math.round(errorCount / durations.length * 10000) / 100,
  latencyMs: { p50: percentile(0.5), p95: percentile(0.95), max: Math.round(durations.at(-1)) } }, null, 2));
if ([...statusCounts.keys()].some((status) => status !== '200')) process.exitCode = 1;
