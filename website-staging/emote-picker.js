// Public catalog data is rendered with DOM text and a fixed Twitch CDN origin.
export function createEmotePicker(root, onChoose) {
  const search = root.querySelector("[data-emote-search]"),
    animated = root.querySelector("[data-emote-animated]"),
    grid = root.querySelector("[data-emote-grid]"),
    count = root.querySelector("[data-emote-count]"),
    more = root.querySelector("[data-emote-more]");
  let items = [],
    selected = "",
    limit = 100;
  function render() {
    const term = search.value.trim().toLowerCase();
    const matches = items.filter(
      (e) =>
        (!animated.checked || e.animated) &&
        e.name.toLowerCase().includes(term),
    );
    grid.replaceChildren();
    for (const emote of matches.slice(0, limit)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "emote-choice" + (emote.id === selected ? " selected" : "");
      button.setAttribute(
        "aria-label",
        `Choose ${emote.name}${emote.animated ? " (animated)" : ""}`,
      );
      button.setAttribute("aria-pressed", String(emote.id === selected));
      button.title = emote.name;
      const image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.width = 48;
      image.height = 48;
      image.src = `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(emote.id)}/${emote.animated ? "animated" : "static"}/dark/2.0`;
      image.onerror = () => {
        if (image.src.includes("/animated/"))
          image.src = image.src.replace("/animated/", "/static/");
        else image.hidden = true;
      };
      const label = document.createElement("span");
      label.textContent = emote.name;
      button.append(image, label);
      if (emote.animated) {
        const badge = document.createElement("small");
        badge.textContent = "ANIMATED";
        button.append(badge);
      }
      button.onclick = () => {
        selected = emote.id;
        render();
        onChoose(emote);
      };
      grid.append(button);
    }
    count.textContent = matches.length
      ? `Showing ${Math.min(limit, matches.length)} of ${matches.length} emotes`
      : "No matching emotes";
    more.hidden = matches.length <= limit;
  }
  search.oninput = animated.onchange = () => {
    limit = 100;
    render();
  };
  more.onclick = () => {
    limit += 100;
    render();
  };
  return {
    update(catalog, value = "") {
      items = catalog.filter(
        (e) => typeof e.name === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(e.id),
      );
      selected = value;
      render();
    },
  };
}
