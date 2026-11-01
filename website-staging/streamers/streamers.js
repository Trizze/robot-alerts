import { API_BASE } from "../config.js?v=shared-service-1";
const list = document.querySelector("#streamer-list"),
  status = document.querySelector("#directory-status"),
  search = document.querySelector("#streamer-search");
let channels = [];
function render() {
  list.replaceChildren();
  const query = search.value.trim().toLowerCase();
  const matches = channels.filter((c) =>
    c.displayName.toLowerCase().includes(query),
  );
  for (const c of matches) {
    const a = document.createElement("a");
    a.className = "streamer-link";
    a.href = `https://www.twitch.tv/${encodeURIComponent(c.displayName)}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = c.displayName;
    list.append(a);
  }
  status.textContent = matches.length
    ? `${matches.length} participating ${matches.length === 1 ? "streamer" : "streamers"}`
    : "No matching connected streamers.";
}
search.oninput = render;
try {
  const base = new URL(API_BASE.replace(/\/?$/, "/"), location.origin);
  const r = await fetch(new URL("api/streamers", base), {
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error();
  const data = await r.json();
  channels = data.streamers;
  render();
} catch {
  status.textContent = "Could not load streamers. Refresh to try again.";
}
