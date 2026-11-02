export function progressInfo() {
  const d = document.createElement("dialog");
  d.className = "progress-dialog";
  d.setAttribute("aria-labelledby", "progress-title");
  const title = document.createElement("h2");
  title.id = "progress-title";
  title.textContent = "Progress Info";
  const copy = document.createElement("div");
  copy.innerHTML =
    "<p>Your points and equipped skin follow you across every connected Robot Alerts channel.</p><p>Tier 1 sub: <strong>1 point</strong> · Tier 2: <strong>2 points</strong> · Tier 3: <strong>5 points</strong> · <strong>500 bits = 1 point</strong>. Gifted subs credit the gifter by sub tier; recipients and anonymous gifts earn no points. Resubs award points when the resub alert is shared.</p><p>Tier thresholds: <strong>1 · 100 · 250 · 500 · 1,000 points</strong>.</p><p>Entering a tier grants one random unowned pattern from that tier. Below Tier 5, each additional (next tier threshold − current tier threshold) ÷ patterns in your tier earns another. At Tier 5, earn another pattern every 100 points until the collection is complete. Tier 0 earns no patterns.</p>";
  const close = document.createElement("button");
  close.className = "quiet";
  close.textContent = "Got it";
  close.onclick = () => d.close();
  d.append(title, copy, close);
  document.body.append(d);
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  });
  return d;
}
