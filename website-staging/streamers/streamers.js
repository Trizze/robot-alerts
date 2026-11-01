import { API_BASE } from "../config.js?v=shared-service-1";
const list = document.querySelector("#streamer-list"),
  status = document.querySelector("#directory-status"),
  search = document.querySelector("#streamer-search");
let channels = [];
function render() {
  list.removeAttribute("aria-busy");
  list.replaceChildren();
  const query = search.value.trim().toLowerCase();
  const matches = channels.filter((c) =>
    c.displayName.toLowerCase().includes(query),
  );
  for (const [test, label] of [
    [(c) => c.live === true, "Live"],
    [(c) => c.live === false, "Offline"],
    [(c) => typeof c.live !== "boolean", "Streamers"],
  ]) {
    const group = matches.filter(test);
    if (!group.length) continue;
    const section = document.createElement("section");
    section.className = "directory-group";
    const title = document.createElement("h2");
    title.textContent = label;
    const grid = document.createElement("div");
    grid.className = "streamer-list";
    for (const c of group) {
      const a = document.createElement("a");
      a.className = "streamer-link";
      a.href = `https://www.twitch.tv/${encodeURIComponent(c.login || c.displayName)}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      const image = document.createElement("img");
      image.src = c.avatar || "/robot/assets/twitch-default.webp";
      image.alt = "";
      image.width = image.height = 48;
      image.loading = "lazy";
      image.onerror = () => {
        image.onerror = null;
        image.src = "/robot/assets/twitch-default.webp";
      };
      const copy = document.createElement("span");
      copy.className = "streamer-copy";
      const name = document.createElement("span");
      name.textContent = c.displayName;
      copy.append(name);
      const games = document.createElement("small");
      games.textContent = c.games?.length
        ? c.games.join(" · ")
        : c.category
          ? `${c.live ? "Playing" : "Last streamed"}: ${c.category}`
          : "Categories not set";
      copy.append(games);
      a.append(image, copy);
      grid.append(a);
    }
    section.append(title, grid);
    list.append(section);
  }
  status.textContent = matches.length
    ? `${matches.length} participating ${matches.length === 1 ? "streamer" : "streamers"}`
    : "No matching connected streamers.";
}
search.oninput = render;
const base = new URL(API_BASE.replace(/\/?$/, "/"), location.origin);
async function get(path) {
  const r = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw Error();
  return r.json();
}
try {
  channels = (await get("api/streamers")).streamers;
  render();
  void get("api/streamers/status")
    .then((data) => {
      if (!Array.isArray(data.streamers)) return;
      channels = data.streamers;
      render();
    })
    .catch(() => {});
} catch {
  status.textContent = "Could not load streamers. Refresh to try again.";
}
