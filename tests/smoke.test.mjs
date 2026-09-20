import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Spawn an isolated instance on a random port with its own SHARE_DIR so tests
// run independently of any developer's local share.
const PORT = 4700 + Math.floor(Math.random() * 500);
const SHARE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-share-test-'));
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'test-password';
let spawned;
let cookieJar = '';
let sessionToken = '';

function withAuth(headers = {}) {
  return { ...headers, Cookie: cookieJar };
}

before(async () => {
  spawned = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'server.ts'],
      {
        cwd: path.resolve(process.cwd()),
        env: { ...process.env, PORT: String(PORT), SHARE_DIR, SHARE_PASSWORD: PASSWORD },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let log = '';
    let errBuf = '';
    child.stdout.on('data', (d) => { log += d.toString(); });
    child.stderr.on('data', (d) => { errBuf += d.toString(); });

    let settled = false;
    const finish = (ok, err) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      ok ? resolve(child) : reject(err);
    };
    const poll = setInterval(() => {
      fetch(`${BASE}/api/status`)
        .then((r) => r.json())
        .then(() => finish(true))
        .catch(() => {});
    }, 150);
    setTimeout(() => finish(false, new Error(`server did not start\n${log}\n${errBuf}`)), 20000);
    child.on('exit', (code) => finish(false, new Error(`server exited early (${code})\n${log}\n${errBuf}`)));
  });

  // Establish a single shared session (respects the 5-per-minute login limiter).
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  const body = await res.json();
  cookieJar = (res.headers.get('set-cookie') || '').split(';')[0];
  sessionToken = body.token || '';
});

after(() => {
  if (spawned) spawned.kill('SIGTERM');
  try { fs.rmSync(SHARE_DIR, { recursive: true, force: true }); } catch {}
});

test('status is reachable and unauthenticated', async () => {
  const res = await fetch(`${BASE}/api/status`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.authorized, false);
  assert.equal(body.share_password, undefined);
});

test('login rejects wrong password, accepts correct one', async () => {
  const wrong = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'nope' }),
  });
  assert.equal(wrong.status, 401);

  // The shared session established in before() proves correct-password login works.
  assert.ok(sessionToken.length > 20);
  const status = await fetch(`${BASE}/api/status`, { headers: { Authorization: `Bearer ${sessionToken}` } });
  const statusBody = await status.json();
  assert.equal(statusBody.authorized, true);
});

test('upload, list, preview round-trip (including non-ascii filename)', async () => {
  const form = new FormData();
  form.append('file', new File(['hello world'], 'café.txt', { type: 'text/plain' }));
  const upRes = await fetch(`${BASE}/api/upload`, { method: 'POST', body: form, headers: withAuth() });
  const up = await upRes.json();
  assert.equal(upRes.status, 200);
  assert.equal(up.file.name, 'café.txt');

  const listRes = await fetch(`${BASE}/api/files`, { headers: withAuth() });
  const list = await listRes.json();
  assert.equal(listRes.status, 200);
  assert.ok(list.files.some((f) => f.name === 'café.txt'));

  const previewRes = await fetch(`${BASE}/api/preview/caf%C3%A9.txt`, { headers: withAuth() });
  const preview = await previewRes.json();
  assert.equal(previewRes.status, 200);
  assert.equal(preview.type, 'text');
  assert.equal(preview.content, 'hello world');
});

test('download sets safe content type and correct disposition', async () => {
  const dl = await fetch(`${BASE}/download/caf%C3%A9.txt`, { headers: withAuth() });
  assert.equal(dl.status, 200);
  assert.equal(dl.headers.get('content-type'), 'application/octet-stream');
  const disposition = dl.headers.get('content-disposition') || '';
  assert.ok(disposition.includes("filename*=UTF-8''caf%C3%A9.txt"));
  assert.equal(await dl.text(), 'hello world');
});

test('SVG is served as an opaque forced download, never inline', async () => {
  const form = new FormData();
  form.append('file', new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], 'x.svg', { type: 'image/svg+xml' }));
  await fetch(`${BASE}/api/upload`, { method: 'POST', body: form, headers: withAuth() });

  const previewRes = await fetch(`${BASE}/api/preview/x.svg`, { headers: withAuth() });
  const preview = await previewRes.json();
  assert.equal(preview.svg, true);

  const dl = await fetch(`${BASE}/download/x.svg`, { headers: withAuth() });
  assert.equal(dl.headers.get('content-type'), 'application/octet-stream');
  assert.ok((dl.headers.get('content-disposition') || '').startsWith('attachment'));
});

test('ZIP endpoints return valid archives', async () => {
  const allRaw = await fetch(`${BASE}/download-all`, { headers: withAuth() });
  const allBuf = Buffer.from(await allRaw.arrayBuffer());
  assert.equal(allRaw.status, 200);
  assert.equal(allBuf[0], 0x50);
  assert.equal(allBuf[1], 0x4b);

  const selRaw = await fetch(`${BASE}/api/download-selected`, {
    method: 'POST',
    headers: withAuth({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ names: ['café.txt'] }),
  });
  assert.equal(selRaw.status, 200);
  const selBuf = Buffer.from(await selRaw.arrayBuffer());
  assert.equal(selBuf[0], 0x50);
  assert.equal(selBuf[1], 0x4b);
});

test('bulk delete removes listed files only', async () => {
  const delRes = await fetch(`${BASE}/api/files/bulk-delete`, {
    method: 'POST',
    headers: withAuth({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ names: ['café.txt', 'missing.txt'] }),
  });
  const del = await delRes.json();
  assert.equal(delRes.status, 200);
  assert.deepEqual(del.deleted, ['café.txt']);
  assert.equal(del.errors.length, 1);

  const listRes = await fetch(`${BASE}/api/files`, { headers: withAuth() });
  const list = await listRes.json();
  assert.ok(!list.files.some((f) => f.name === 'café.txt'));
});

test('owner model: single-admin mode by default', async () => {
  const statusRes = await fetch(`${BASE}/api/status`, { headers: { Authorization: `Bearer ${sessionToken}` } });
  const status = await statusRes.json();
  assert.equal(status.authorized, true);
  assert.equal(status.is_owner, true);
  assert.ok(status.share_password);

  // Owner login is disabled without OWNER_SESSION_SECRET.
  const ownerLogin = await fetch(`${BASE}/api/login-owner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: 'whatever' }),
  });
  assert.equal(ownerLogin.status, 404);
});

test('unauthenticated access to protected endpoints is rejected', async () => {
  const probes = [
    ['GET', '/api/files'],
    ['POST', '/api/upload'],
    ['POST', '/stop-share'],
    ['POST', '/api/restart'],
    ['POST', '/api/smopi/chat'],
    ['DELETE', '/api/files/x'],
  ];
  for (const [method, p] of probes) {
    const res = await fetch(`${BASE}${p}`, { method });
    assert.ok([401].includes(res.status), `${method} ${p} -> ${res.status}`);
  }
});

test('path traversal is rejected even with a valid session', async () => {
  const res = await fetch(`${BASE}/download/..%2F..%2Fetc%2Fpasswd`, { headers: withAuth() });
  assert.equal(res.status, 404);
});

test('same-origin request guard rejects cross-site POST without explicit token', async () => {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  assert.equal(res.status, 403);

  // Same-origin (no Origin header at all, as browsers send for same-origin
  // form posts) must be allowed.
  const ok = await fetch(`${BASE}/api/status`);
  assert.equal(ok.status, 200);
});
