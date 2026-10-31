import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstat, unlink } from 'node:fs/promises';

export const CALLBACK = 'http://localhost:3211/callback';
export const CONSOLE = 'https://dev.twitch.tv/console/apps/create';
export const permissions = Object.freeze({
  broadcaster: ['channel:read:subscriptions', 'bits:read', 'moderator:read:followers'],
  bot: ['user:read:chat', 'user:write:chat']
});
export class SetupError extends Error {}
export function normalizeLogin(value) {
  const login = String(value || '').trim().toLowerCase().replace(/^@/, '');
  if (!/^[a-z0-9_]{3,25}$/.test(login)) throw new SetupError('Enter a Twitch username, not a channel URL (3–25 letters, numbers or underscores).');
  return login;
}
export function validateCredential(value) {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(value || '')) throw new SetupError('That credential format is not valid. Paste just the value from Twitch Manage.');
  return value;
}
export function equalState(expected, actual) {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false;
  const a = Buffer.from(expected), b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function assertNewEnv(path) {
  try { await lstat(path); } catch (error) { if (error.code === 'ENOENT') return; throw new SetupError('Cannot check the .env destination.'); }
  throw new SetupError('A .env already exists. Setup will not read or overwrite it. Move it somewhere private yourself before running setup again.');
}
export async function saveEnv(path, values) {
  // Fixed key names and restricted values prevent newlines or dotenv injection.
  let text = '# Created by Robot Alerts interactive setup. Private: do not share.\n';
  for (const [key, value] of Object.entries(values)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || !/^[A-Za-z0-9_,.-]*$/.test(String(value))) throw new SetupError('Cannot save invalid configuration.');
    text += `${key}=${value}\n`;
  }
  let created = false;
  try {
    const { open } = await import('node:fs/promises');
    const file = await open(path, 'wx', 0o600); created = true;
    try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
  } catch (error) {
    if (created) await unlink(path).catch(() => {});
    if (error.code === 'EEXIST') throw new SetupError('A .env now exists. It was not read or overwritten.');
    throw new SetupError('Could not save .env securely. No credentials were printed.');
  }
}
export function openBrowser(url) {
  // URLs here are console/local launcher links, never token-bearing URLs.
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) return Promise.resolve(false);
  let command, args;
  if (process.platform === 'win32') {
    command = 'rundll32.exe'; args = ['url.dll,FileProtocolHandler', url];
  } else if (process.platform === 'darwin') { command = 'open'; args = [url]; }
  else { if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return Promise.resolve(false); command = 'xdg-open'; args = [url]; }
  return new Promise(resolve => {
    try {
      const child = spawn(command, args, { shell: false, stdio: 'ignore' });
      const timer = setTimeout(() => resolve(true), 1500);
      child.once('error', () => { clearTimeout(timer); resolve(false); });
      child.once('exit', code => { clearTimeout(timer); resolve(code === 0); });
    } catch { resolve(false); }
  });
}
async function twitchJson(fetcher, url, options) {
  let response;
  try { response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) }); }
  catch { throw new SetupError('Could not reach Twitch securely. Check your connection and retry setup.'); }
  if (!response.ok) throw new SetupError(`Twitch rejected authorization (HTTP ${response.status}). Check the app secret, redirect URL and granted permissions.`);
  try { return await response.json(); } catch { throw new SetupError('Twitch returned an invalid authorization response.'); }
}
export async function exchangeCode({ clientId, clientSecret, code, expectedLogin, role, fetcher = fetch }) {
  const token = await twitchJson(fetcher, 'https://id.twitch.tv/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: CALLBACK })
  });
  if (typeof token.access_token !== 'string' || typeof token.refresh_token !== 'string') throw new SetupError('Twitch did not return both required credentials.');
  const validation = await twitchJson(fetcher, 'https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${token.access_token}` } });
  if (validation.client_id !== clientId || !/^\d+$/.test(validation.user_id || '')) throw new SetupError('Twitch returned an unexpected application or account.');
  if (String(validation.login).toLowerCase() !== expectedLogin) throw new SetupError(`The wrong Twitch account authorized the ${role}. Sign into the expected account and retry its local link.`);
  if (!permissions[role].every(scope => validation.scopes?.includes(scope))) throw new SetupError('Required permissions were not granted. Retry authorization and accept the listed permissions.');
  return { accessToken: token.access_token, refreshToken: token.refresh_token, userId: validation.user_id, login: validation.login };
}
function page(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" });
  // All text passed to this page is fixed, not an API response or user input.
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Robot Alerts setup</title><style>body{background:#17221f;color:#e4eadb;font:18px system-ui;max-width:650px;margin:15vh auto;padding:24px}h1{color:#b8f36e}p{line-height:1.7}</style><h1>Robot Alerts</h1><p>${text}</p></html>`);
}
export class OAuthSetup {
  constructor({ clientId, clientSecret, fetcher = fetch, port = 3211, timeoutMs = 600000 }) {
    this.clientId = clientId; this.clientSecret = clientSecret; this.fetcher = fetcher; this.port = port; this.timeoutMs = timeoutMs; this.pending = null;
    this.server = http.createServer((req, res) => { this.handle(req, res).catch(() => { if (!res.headersSent) page(res, 500, 'Authorization could not finish. Return to your terminal and retry.'); else res.end(); }); });
    this.server.requestTimeout = 30000; this.server.headersTimeout = 10000;
  }
  async listen() {
    await new Promise((resolve, reject) => { this.server.once('error', () => reject(new SetupError('Setup port 3211 is busy or unavailable. Close the other setup process and retry.'))); this.server.listen(this.port, '127.0.0.1', resolve); });
    this.port = this.server.address().port;
  }
  begin(role, expectedLogin) {
    if (!permissions[role] || this.pending) throw new SetupError('An authorization is already in progress.');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new SetupError('Authorization timed out after ten minutes. Run setup again.')), this.timeoutMs);
      this.pending = { role, expectedLogin, resolve, reject, timer, state: null, busy: false };
    });
  }
  fail(error) { if (!this.pending) return; clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; }
  async handle(req, res) {
    if (![ `localhost:${this.port}`, `127.0.0.1:${this.port}` ].includes(req.headers.host)) return page(res, 403, 'Only local setup requests are accepted.');
    if (req.method !== 'GET') return page(res, 405, 'Open the setup link in your browser.');
    const url = new URL(req.url, `http://localhost:${this.port}`);
    if (url.pathname === '/done') return page(res, 200, 'This authorization is complete. Return to the terminal for the next step.');
    const pending = this.pending;
    if (!pending) return page(res, 404, 'No authorization is waiting. Return to your terminal.');
    if (url.pathname === `/start/${pending.role}`) {
      if (pending.busy) return page(res, 409, 'Authorization is already being checked. Return to the terminal.');
      pending.state = randomBytes(32).toString('hex');
      const authorize = new URL('https://id.twitch.tv/oauth2/authorize');
      authorize.search = new URLSearchParams({ client_id: this.clientId, redirect_uri: CALLBACK, response_type: 'code', scope: permissions[pending.role].join(' '), state: pending.state, force_verify: 'true' }).toString();
      res.writeHead(302, { Location: authorize.href, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); return res.end();
    }
    if (url.pathname !== '/callback') return page(res, 404, 'Open the exact link shown in your terminal.');
    if (!pending.state || !equalState(pending.state, url.searchParams.get('state')) || pending.busy) return page(res, 400, 'This callback is invalid or expired. Use the current terminal link.');
    if (url.searchParams.has('error')) { pending.state = null; return page(res, 400, 'Permission was declined. Return to your terminal, then reopen the local link to try again.'); }
    const code = url.searchParams.get('code');
    if (!code || code.length > 1000) return page(res, 400, 'The authorization code is missing. Reopen the local link.');
    pending.state = null; pending.busy = true;
    try {
      const result = await exchangeCode({ clientId: this.clientId, clientSecret: this.clientSecret, code, expectedLogin: pending.expectedLogin, role: pending.role, fetcher: this.fetcher });
      if (this.pending !== pending) return page(res, 400, 'Authorization expired. Return to your terminal.');
      clearTimeout(pending.timer); this.pending = null;
      res.writeHead(303, { Location: '/done', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); res.end(); pending.resolve(result);
    } catch (error) {
      pending.busy = false;
      page(res, 400, error instanceof SetupError && error.message.startsWith('The wrong Twitch') ? 'The wrong account signed in. Sign into the expected broadcaster or bot account, then reopen the terminal link. Nothing was saved.' : 'Twitch authorization failed. Check the app secret, redirect URL and permissions, then reopen the terminal link. Nothing was saved.');
    }
  }
  async close() { this.fail(new SetupError('Setup cancelled. Nothing was saved.')); this.server.closeAllConnections(); await new Promise(resolve => this.server.close(resolve)); this.clientSecret = null; }
}
