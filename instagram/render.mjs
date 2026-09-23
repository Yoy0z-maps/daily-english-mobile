#!/usr/bin/env node
/**
 * 오늘의 문장 — 인스타 에셋 렌더러
 * 외부 패키지 없이 headless Chrome(DevTools Protocol)만 사용합니다.
 *
 *   node render.mjs daily      content/sentences.json 의 모든 문장 → 커버+본문 PNG
 *   node render.mjs daily 2    2번째 항목만
 *   node render.mjs promo      피드 그리드 9칸 + 줄별 배너 + 전체 미리보기
 *   node render.mjs all        전부 (기본값)
 *
 * 결과물 → instagram/out/
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(import.meta.dirname);
const OUT = join(ROOT, 'out');
const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
].find(existsSync);
if (!CHROME) { console.error('Google Chrome 이 필요합니다.'); process.exit(1); }

/* ── 정적 서버 (file:// 은 폰트/이미지 제약이 있어 로컬 서버로 띄웁니다) ── */
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2', '.svg':'image/svg+xml' };

const serve = () => new Promise(ok => {
  const s = createServer(async (req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    const f = join(ROOT, p === '/' ? '/daily-template.html' : p);
    if (!f.startsWith(ROOT)) return res.writeHead(403).end();
    let buf;
    try { buf = await readFile(f); } catch { return res.writeHead(404).end(); }
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
                         'Cache-Control': 'no-store' }).end(buf);
  });
  s.listen(0, '127.0.0.1', () => ok([s, s.address().port]));
});

/* ── Chrome + DevTools Protocol ───────────────────────────────────── */
async function launchChrome() {
  const profile = join(tmpdir(), 'ig-render-' + Date.now());
  const proc = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--mute-audio',
    '--force-device-scale-factor=1', 'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const wsUrl = await new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error('Chrome 시작 시간 초과')), 30000);
    let buf = '';
    proc.stderr.on('data', d => {
      buf += d;
      const m = buf.match(/ws:\/\/[^\s]+/);
      if (m) { clearTimeout(t); ok(m[0]); }
    });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise(ok => ws.addEventListener('open', ok, { once: true }));

  let id = 0;
  const pending = new Map(), waiters = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) waiters.slice().forEach(w => w(m));
  });
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => {
    const mid = ++id;
    pending.set(mid, m => m.error ? no(new Error(method + ': ' + m.error.message)) : ok(m.result));
    ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId && { sessionId }) }));
  });
  const once = pred => new Promise(ok => {
    const w = m => { if (pred(m)) { waiters.splice(waiters.indexOf(w), 1); ok(m); } };
    waiters.push(w);
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);

  const close = async () => {
    try { ws.close(); } catch {}
    proc.kill();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  };
  return { send, once, sessionId, close };
}

async function shoot(cdp, url, w, h, out) {
  const { send, once, sessionId } = cdp;
  await send('Emulation.setDeviceMetricsOverride',
    { width: w, height: h, deviceScaleFactor: 1, mobile: false }, sessionId);
  const loaded = once(m => m.method === 'Page.loadEventFired' && m.sessionId === sessionId);
  await send('Page.navigate', { url }, sessionId);
  await loaded;

  // 폰트 로딩 + 자동 맞춤 완료 대기
  for (let i = 0; i < 80; i++) {
    const { result } = await send('Runtime.evaluate', {
      expression: `(document.fonts.status === 'loaded') &&
                   (document.documentElement.dataset.ready === '1')`,
      returnByValue: true
    }, sessionId);
    if (result.value) break;
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 250));

  const { data } = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: w, height: h, scale: 1 }
  }, sessionId);
  await writeFile(out, Buffer.from(data, 'base64'));
  console.log('  ✓', out.replace(ROOT + '/', ''));
}

/* ── 렌더 작업 ────────────────────────────────────────────────────── */
const b64 = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const pad = n => String(n).padStart(3, '0');

async function renderDaily(cdp, port, only) {
  const dir = join(OUT, 'daily');
  await mkdir(dir, { recursive: true });
  const list = JSON.parse(await readFile(join(ROOT, 'content/sentences.json'), 'utf8'));
  const items = only ? [[only - 1, list[only - 1]]] : list.entries();

  for (const [i, it] of items) {
    if (!it) continue;
    const d = { day: `DAY ${pad(i + 1)}`, handle: '@daily.english',
                theme: 'light', ratio: '4x5', ...it };
    const h = d.ratio === '1x1' ? 1080 : 1350;
    const base = d.day.replace(/[^\w가-힣]+/g, '-');
    for (const [sheet, sfx] of [['cover', '1-cover'], ['full', '2-detail']]) {
      const url = `http://127.0.0.1:${port}/daily-template.html`
                + `?export=1&sheet=${sheet}&data=${encodeURIComponent(b64(d))}`;
      await shoot(cdp, url, 1080, h, join(dir, `${base}-${sfx}.png`));
    }
  }
}

async function renderPromo(cdp, port) {
  const dir = join(OUT, 'promo');
  await mkdir(dir, { recursive: true });
  const u = q => `http://127.0.0.1:${port}/promo-grid.html?export=1&${q}`;

  await shoot(cdp, u('view=mural'), 1080, 1350, join(dir, '_전체미리보기.png'));
  for (let r = 1; r <= 3; r++)
    await shoot(cdp, u(`view=row&r=${r}`), 3240, 1350, join(dir, `_줄${r}-배너.png`));
  for (let i = 1; i <= 9; i++)
    await shoot(cdp, u(`view=tile&i=${i}`), 1080, 1350, join(dir, `tile-${i}.png`));

  console.log('\n  ※ 업로드 순서: tile-9 → 8 → … → 1 (인스타는 최신 글이 좌상단)');
}

/* ── 실행 ─────────────────────────────────────────────────────────── */
(async () => {
  const [cmd = 'all', arg] = process.argv.slice(2);
  const [server, port] = await serve();
  const cdp = await launchChrome();
  try {
    if (cmd === 'daily' || cmd === 'all') {
      console.log('\n▸ 데일리 게시글');
      await renderDaily(cdp, port, arg ? Number(arg) : null);
    }
    if (cmd === 'promo' || cmd === 'all') {
      console.log('\n▸ 피드 그리드 홍보');
      await renderPromo(cdp, port);
    }
    console.log('\n완료 → instagram/out/\n');
  } finally { await cdp.close(); server.close(); }
})();
