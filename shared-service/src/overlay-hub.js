// Public, read-only display events. Never include credentials or private payloads.
export class OverlayHub {
  constructor() {
    this.channels = new Map();
    this.total = 0;
    this.heartbeat = setInterval(() => {
      for (const clients of this.channels.values())
        for (const res of clients) {
          if (!res.write(": heartbeat\n\n")) res.destroy();
        }
    }, 25000);
    this.heartbeat.unref();
  }
  connect(channel, req, res, settings) {
    const clients = this.channels.get(channel) || new Set();
    if (clients.size >= 3 || this.total >= 200) {
      res.writeHead(429).end();
      return;
    }
    this.channels.set(channel, clients);
    clients.add(res);
    this.total++;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify({ kind: "settings", settings })}\n\n`);
    res.on("close", () => {
      clients.delete(res);
      this.total--;
      if (!clients.size) this.channels.delete(channel);
    });
  }
  send(channel, message) {
    for (const res of this.channels.get(channel) || [])
      if (!res.write(`data: ${JSON.stringify(message)}\n\n`)) res.destroy();
  }
  disconnect(channel) {
    for (const res of this.channels.get(channel) || []) res.end();
  }
  close() {
    clearInterval(this.heartbeat);
    for (const id of this.channels.keys()) this.disconnect(id);
  }
}
