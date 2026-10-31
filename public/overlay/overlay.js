import { robot } from '/shared/robot.js';
import { alertCopy } from '/shared/alert-copy.js';
const stage = document.querySelector('#stage'); let socket, timer, active, audio, currentAlert; const crtTimers = [];
const node = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text) el.textContent = text; return el; };
function clear() { clearTimeout(timer); crtTimers.splice(0).forEach(clearTimeout); stage.replaceChildren(); active = null; currentAlert = null; }
function settings(value) {
  const theme = value.theme === 'gaming' ? 'gaming' : 'default';
  stage.dataset.theme = theme; stage.style.setProperty('--accent', value.accent); stage.style.setProperty('--scale', value.scale);
  const alert = stage.querySelector('.alert');
  if (alert) { alert.classList.remove('default', 'gaming'); alert.classList.add(theme); }
  if (currentAlert) currentAlert.settings = { ...currentAlert.settings, theme };
}
function sound(value, type) {
  if (value.sound === 'mute' || !value.volume) return;
  try {
    audio ||= new AudioContext(); if (audio.state !== 'running') return;
    const notes = type === 'cheer' ? [392, 523.25, 783.99] : [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => { const oscillator = audio.createOscillator(), gain = audio.createGain(); const at = audio.currentTime + i * .11; oscillator.type = value.sound === 'arcade' ? 'triangle' : 'sine'; oscillator.frequency.value = freq; gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(value.volume * .16, at + .015); gain.gain.exponentialRampToValueAtTime(.001, at + .3); oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(at); oscillator.stop(at + .31); });
  } catch { /* Browsers may require an interaction before sound. */ }
}
window.addEventListener('pointerdown', () => { try { audio ||= new AudioContext(); audio.resume(); } catch {} });
function joinRaid(viewer) {
  const candidates = stage.querySelectorAll('.parade-bots .bot-wrap');
  for (const wrap of candidates) if (wrap.querySelector('.silhouette')) { wrap.replaceChildren(robot(viewer)); return; }
}
function show(alert) {
  if (!alert || active === alert.key) return;
  clear(); active = alert.key; currentAlert = alert; settings(alert.settings);
  const remaining = alert.settings.duration * 1000 - (Date.now() - alert.startedAt);
  if (remaining <= 0) return finish(alert.key);
  const container = node('section', `alert ${alert.animation} ${alert.settings.position} ${alert.settings.theme}`); container.dataset.event = alert.type;
  const wrap = node('div', 'bot-wrap'); wrap.append(robot(alert.viewer));
  if (alert.animation === 'parade') {
    const bots = node('div', 'parade-bots'); wrap.style.setProperty('--i', 0); bots.append(wrap);
    for (let i = 1; i < 6; i++) { const extra = node('div', 'bot-wrap'); extra.style.setProperty('--i', i); const participant = alert.participants?.[i - 1]; extra.append(robot(participant || null, { silhouette: !participant })); bots.append(extra); }
    container.append(bots);
  } else { if (alert.animation === 'surge') wrap.append(node('span', 'energy-ring'), node('span', 'energy-ring')); container.append(wrap); }
  const card = node('div', 'card');
  const copy = alertCopy(alert), eyebrow = node('div', 'eyebrow');
  const icon = node('span', 'event-icon', copy.icon); icon.setAttribute('aria-hidden', 'true'); eyebrow.append(icon, node('span', 'event-type', copy.label));
  const name = alert.viewer?.name || 'Anonymous supporter', nameNode = node('div', 'viewer-name'), typed = node('span', 'name-typed', name);
  nameNode.setAttribute('aria-label', name); typed.setAttribute('aria-hidden', 'true'); nameNode.style.setProperty('--letters', Math.max(1, Array.from(name).length));
  nameNode.style.setProperty('--name-size', `${name.length > 30 ? 40 : name.length > 22 ? 50 : name.length > 15 ? 62 : 76}px`); nameNode.append(typed);
  card.append(eyebrow, nameNode, node('div', 'detail', copy.detail));
  for (let i = 0; i < 3; i++) { const deco = node('span', `deco deco-${i}`); deco.setAttribute('aria-hidden', 'true'); card.append(deco); }
  if (alert.unlocked?.length) { const badge = node('span', 'unlock-badge', `+${alert.unlocked.length} ✦`); badge.setAttribute('aria-label', `Earned ${alert.unlocked.map(p => p.name).join(', ')}`); card.append(badge); }
  if (alert.demo) { const demo = node('span', 'demo-label', 'DEMO'); demo.setAttribute('aria-label', 'Synthetic test alert'); container.append(demo); }
  container.append(card); stage.append(container); sound(alert.settings, alert.type);
  timer = setTimeout(() => { container.classList.add('exiting'); timer = setTimeout(() => finish(alert.key), 650); }, Math.max(0, remaining - 650));
}
function finish(key) { clear(); if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ kind: 'complete', key })); }
function connect() {
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=overlay`);
  socket.onopen = () => { document.querySelector('#connection').hidden = true; };
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.kind === 'state') { settings(message.state.settings); if (message.state.current) show(message.state.current); else clear(); }
    if (message.kind === 'alert') show(message.alert);
    if (message.kind === 'idle') clear();
    if (message.kind === 'settings') settings(message.settings);
    if (message.kind === 'raid-join' && message.key === active) joinRaid(message.viewer);
  };
  socket.onclose = () => { document.querySelector('#connection').hidden = false; setTimeout(connect, 2000); };
}
connect();
