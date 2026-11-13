#!/usr/bin/env node
/**
 * 오늘의 문장 — Google Play 휴대전화 스크린샷 렌더러
 * 외부 패키지 없이 headless Chrome(DevTools Protocol)만 사용합니다.
 *
 *   node store-assets/play/screenshots/render.mjs
 *
 * 입력  → store-assets/play/screenshots/raw/  (에뮬레이터 실행화면 캡쳐, 1080×2400)
 * 결과물 → store-assets/play/screenshots/out/  (1080×1920, 9:16 — Play 권장 비율)
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const HERE = resolve(import.meta.dirname);
const REPO = resolve(HERE, '../../..');
const OUT = join(HERE, 'out');
const PAGE = '/store-assets/play/screenshots/play-screenshots.html';
// 정적 서버에서 열어줄 경로 (폰트는 instagram 키트와 공유)
const ALLOWED = ['/store-assets/play/screenshots/', '/instagram/fonts/'];

const W = 1080, H = 1920;
// play-screenshots.html 의 <section data-slide="…"> 와 같은 이름
const SLIDES = ['home', 'detail', 'widget', 'saved', 'review', 'wrong-note', 'settings'];

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
].find(existsSync);
if (!CHROME) { console.error('Google Chrome 이 필요합니다.'); process.exit(1); }

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml' };

const serve = () => new Promise(ok => {
  const s = createServer(async (req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    if (!ALLOWED.some(a => p.startsWith(a)) || p.includes('..')) return res.writeHead(403).end();
    let buf;
    try { buf = await readFile(join(REPO, p)); } catch { return res.writeHead(404).end(); }
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream',
                         'Cache-Control': 'no-store' }).end(buf);
  });
  s.listen(0, '127.0.0.1', () => ok([s, s.address().port]));
});

async function launchChrome() {
  const profile = join(tmpdir(), 'play-render-' + Date.now());
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

async function shoot(cdp, url, out) {
  const { send, once, sessionId } = cdp;
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);
  // Play 는 알파 채널 없는 이미지를 요구하므로 기본 배경을 불투명하게 고정
  await send('Emulation.setDefaultBackgroundColorOverride',
    { color: { r: 255, g: 255, b: 255, a: 1 } }, sessionId);
  const loaded = once(m => m.method === 'Page.loadEventFired' && m.sessionId === sessionId);
  await send('Page.navigate', { url }, sessionId);
  await loaded;

  for (let i = 0; i < 100; i++) {
    const { result } = await send('Runtime.evaluate', {
      expression: `(document.fonts.status === 'loaded') &&
                   (document.documentElement.dataset.ready === '1')`,
      returnByValue: true
    }, sessionId);
    if (result.value) break;
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 300));

  const { data } = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: W, height: H, scale: 1 }
  }, sessionId);
  await writeFile(out, Buffer.from(data, 'base64'));
  console.log('  ✓', out.replace(REPO + '/', ''));
}

(async () => {
  await mkdir(OUT, { recursive: true });
  const [server, port] = await serve();
  const cdp = await launchChrome();
  try {
    for (const [i, slide] of SLIDES.entries()) {
      const url = `http://127.0.0.1:${port}${PAGE}?slide=${slide}`;
      const name = `${String(i + 1).padStart(2, '0')}-${slide}-${W}x${H}.png`;
      await shoot(cdp, url, join(OUT, name));
    }
    console.log('\n완료 → store-assets/play/screenshots/out/\n');
  } finally { await cdp.close(); server.close(); }
})();
