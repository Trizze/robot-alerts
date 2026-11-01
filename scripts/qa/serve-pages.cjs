const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../../website-staging");
http
  .createServer((q, s) => {
    let p = decodeURIComponent(new URL(q.url, "http://localhost").pathname);
    if (p.startsWith("/robots/")) p = "/landing/" + p.slice(8);
    else if (p.startsWith("/robot/")) p = p.slice(6);
    else if (p === "/robot") p = "/";
    let target = path.resolve(root, "." + p);
    if (target !== root && !target.startsWith(root + "/"))
      return s.writeHead(403).end();
    try {
      if (fs.statSync(target).isDirectory())
        target = path.join(target, "index.html");
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".json": "application/json",
        ".glb": "model/gltf-binary",
        ".mp4": "video/mp4",
      };
      s.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      fs.createReadStream(target).pipe(s);
    } catch {
      s.writeHead(404).end();
    }
  })
  .listen(3902, "127.0.0.1");
