const NS = 'http://www.w3.org/2000/svg';
let counter = 0;
export const SCREEN = Object.freeze({ x: 20, y: 18, size: 40 });
export const FINISH = Object.freeze({ metal: '#b7c9c4', shade: '#718b88', light: '#b8efac' });
export function setAvatar(svg, viewer) {
  const screen = svg.querySelector('[data-layer="screen"]'); screen.replaceChildren();
  if (!/^\/(?:avatars\/\d+\.(?:png|jpg|webp)|assets\/avatars\/[a-zA-Z0-9_-]+\.svg)$/.test(viewer?.avatar || '')) return;
  const image = document.createElementNS(NS, 'image');
  for (const [key, value] of Object.entries({ x: 20, y: 18, width: 40, height: 40, preserveAspectRatio: 'xMidYMid meet', href: viewer.avatar, class: 'avatar' })) image.setAttribute(key, value);
  image.addEventListener('error', () => image.remove()); screen.append(image);
}
// One baseline robot for everyone. Only the avatar changes; no look, palette, hats or effects are read.
export function robot(viewer, { silhouette = false } = {}) {
  const svg = document.createElementNS(NS, 'svg'), id = `baseline-${++counter}`;
  svg.setAttribute('viewBox', '0 0 80 104'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${viewer?.name || 'Viewer'}’s robot`); svg.classList.add('robot');
  if (silhouette) svg.classList.add('silhouette');
  svg.innerHTML = `<defs><clipPath id="${id}"><rect x="20" y="18" width="40" height="40"/></clipPath></defs>
  <g data-layer="pose"><g class="leg-left"><path d="M28 86h10v10H24v-4h4z" fill="#1b2b32"/><path d="M30 88h6v6h-6z" fill="#b7c9c4"/><path d="M24 94h14v4H22v-2h2z" fill="#718b88"/><path d="M24 94h10v2H24z" fill="#b7c9c4"/></g><g class="leg-right"><path d="M44 86h10v6h4v4H44z" fill="#1b2b32"/><path d="M46 88h6v6h-6z" fill="#b7c9c4"/><path d="M44 94h14v2h2v2H44z" fill="#718b88"/><path d="M48 94h10v2H48z" fill="#b7c9c4"/></g><g class="arm-left"><path d="M22 70h8v8h-6v10h-4v4h-8V82h4V72h6z" fill="#1b2b32"/><path d="M20 74h6v4h-6zm-2 4h4v8h-4zm-4 8h8v4h-2v-2h-4v2h-2z" fill="#b7c9c4"/></g></g>
  <g data-layer="paint"><path d="M34 64h12v8H34z" fill="#1b2b32"/><path d="M36 66h8v4h-8z" fill="#718b88"/><path d="M28 68h24v4h4v14h-4v4H28v-4h-4V72h4z" fill="#1b2b32"/><path d="M28 72h24v12H28z" fill="#b7c9c4"/><path d="M28 84h24v2H28zM50 74h2v10h-2z" fill="#718b88"/><path d="M28 72h20v2H28z" fill="#d7e3dc"/><path d="M28 82h2v2h-2zm22 0h2v2h-2z" fill="#1b2b32"/></g>
  <g data-layer="chest"><rect x="32" y="75" width="16" height="7" fill="#1b2b32"/><rect x="34" y="77" width="12" height="3" fill="#b8efac"/></g>
  <g data-layer="head"><path d="M16 8h48v4h4v48h-4v4H16v-4h-4V12h4z" fill="#1b2b32"/><path d="M16 12h48v48H16z" fill="#b7c9c4"/><path d="M16 12h48v3H16z" fill="#d7e3dc"/><path d="M62 15h2v45H16v-3h46z" fill="#718b88"/><rect x="18" y="16" width="44" height="44" fill="#1b2b32"/><rect x="20" y="18" width="40" height="40" fill="#14242b"/><g data-layer="screen" clip-path="url(#${id})"></g><path d="M22 61h8m2 0h3" stroke="#1b2b32" stroke-width="1"/><rect x="57" y="61" width="3" height="1" fill="#b8efac"/></g>
  <g class="arm-right"><path d="M54 70h8v-4h4V54h8v10h-4v12H54z" fill="#1b2b32"/><path d="M56 72h10v-8h4v-4h-4v-4h6v6h-4v12H56z" fill="#b7c9c4"/><rect x="56" y="72" width="4" height="2" fill="#718b88"/></g><g data-layer="hat"></g><g data-layer="entrance"></g>`;
  setAvatar(svg, viewer); return svg;
}
