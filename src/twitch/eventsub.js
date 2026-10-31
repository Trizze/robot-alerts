import { WebSocket } from 'ws';
const ENDPOINT = 'wss://eventsub.wss.twitch.tv/ws';
export function validReconnect(value) {
  try { const url = new URL(value); return url.protocol === 'wss:' && url.hostname === 'eventsub.wss.twitch.tv' && !url.username && !url.password && (!url.port || url.port === '443') && url.pathname === '/ws'; } catch { return false; }
}
export class EventSub {
  constructor({ api, role, subscriptions, onEvent, onStatus, Socket = WebSocket }) { Object.assign(this, { api, role, subscriptions, onEvent, onStatus, Socket }); this.socket = null; this.stopped = true; this.retry = 0; this.watchdog = null; this.retryTimer = null; this.candidate = null; }
  start() { this.stopped = false; this.connect(); }
  connect(url = ENDPOINT, handoff = false) {
    if (this.stopped || (handoff && this.candidate)) return;
    this.onStatus(this.role, handoff ? 'Reconnecting' : 'Connecting');
    const old = this.socket, socket = new this.Socket(url); let welcomed = false, interval = 15000, watchdog;
    const reset = () => { clearTimeout(watchdog); watchdog = setTimeout(() => socket.terminate(), interval + 5000); };
    if (handoff) this.candidate = socket; else this.socket = socket;
    reset();
    socket.on('message', async data => {
      reset();
      try {
        if (data.length > 1024 * 1024) return socket.terminate();
        const message = JSON.parse(data); const type = message.metadata?.message_type;
        if (type === 'session_welcome' && !welcomed) {
          welcomed = true; interval = Math.max(10000, Math.min(600000, (message.payload.session.keepalive_timeout_seconds || 10) * 1000)); reset();
          if (this.stopped) return socket.close();
          if (handoff) { this.socket = socket; this.candidate = null; old?.close(); }
          else {
            for (const subscription of this.subscriptions) {
              try { await this.api.request(this.role, 'eventsub/subscriptions', { method: 'POST', body: { ...subscription, transport: { method: 'websocket', session_id: message.payload.session.id } } }); }
              catch { this.onStatus(this.role, `Subscription unavailable: ${subscription.type}`); socket.terminate(); return; }
            }
          }
          this.retry = 0; this.onStatus(this.role, 'Connected');
        } else if (type === 'session_reconnect') {
          if (validReconnect(message.payload?.session?.reconnect_url)) this.connect(message.payload.session.reconnect_url, true);
          else { this.onStatus(this.role, 'Invalid reconnect destination rejected'); socket.terminate(); }
        } else if (type === 'notification') await this.onEvent(message);
        else if (type === 'revocation') { this.onStatus(this.role, 'Permission revoked. Reauthorize with npm run setup.'); this.stop(); }
      } catch { this.onStatus(this.role, 'Event processing failed'); }
    });
    socket.on('error', () => this.onStatus(this.role, 'Connection interrupted'));
    socket.on('close', () => {
      clearTimeout(watchdog);
      if (socket === this.candidate) { this.candidate = null; if (!this.stopped) this.socket?.terminate(); }
      if (socket !== this.socket || this.stopped) return;
      this.onStatus(this.role, 'Disconnected; retrying'); clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.connect(), Math.min(60000, 1000 * 2 ** Math.min(this.retry++, 6)) + Math.floor(Math.random() * 500));
    });
  }
  stop() { this.stopped = true; clearTimeout(this.retryTimer); this.socket?.terminate(); this.candidate?.terminate(); }
}
