// Original design studies. Animation describes intended motion, not yet rendered in-app.
const swatches = [
 ['candy-stripe','Candy Stripe','<path d="M-128 64L0 -64M-112 64L16 -64M-96 64L32 -64M-80 64L48 -64M-64 64L64 -64M-48 64L80 -64M-32 64L96 -64M-16 64L112 -64M0 64L128 -64M16 64L144 -64M32 64L160 -64M48 64L176 -64M64 64L192 -64M80 64L208 -64M96 64L224 -64M112 64L240 -64M128 64L256 -64" stroke="#fff" stroke-width="6"/>'],
 ['hazard','Hazard','<path d="M-128 64L0 -64M-112 64L16 -64M-96 64L32 -64M-80 64L48 -64M-64 64L64 -64M-48 64L80 -64M-32 64L96 -64M-16 64L112 -64M0 64L128 -64M16 64L144 -64M32 64L160 -64M48 64L176 -64M64 64L192 -64M80 64L208 -64M96 64L224 -64M112 64L240 -64M128 64L256 -64" stroke="#252538" stroke-width="6"/>','#ffc543'],
 ['checker','Checkerboard','<path d="M0 0h32v32H0zm32 32h32v32H32z" fill="#f9f6eb"/>'],
 ['polka','Polka Dots','<g fill="#fdf5e8"><circle cx="16" cy="16" r="7"/><circle cx="48" cy="48" r="7"/></g>'],
 ['confetti','Confetti','<g stroke-width="5" stroke-linecap="round"><path d="M8 12l8 5M43 9l-3 8M24 40l8 -4M51 47l4 8" stroke="#ffe26c"/><path d="M51 26l6 -5M8 49l5 4" stroke="#ff8db8"/></g>'],
 ['circuit','Circuit Board','<g fill="none" stroke="#d6b453" stroke-width="3" stroke-linejoin="round"><path d="M-8 16h26l8 8h14l8 -8h24M-8 48h20l8 -8h10l8 8h34"/></g>','#174d38','pulse'],
 ['galaxy','Galaxy','<ellipse cx="32" cy="32" rx="22" ry="11" transform="rotate(-24 32 32)" fill="#aa68c4"/><ellipse cx="32" cy="32" rx="14" ry="6" transform="rotate(-24 32 32)" fill="#df9fe9"/><circle cx="32" cy="32" r="3" fill="#fff3d0"/><g fill="#fff"><circle cx="8" cy="10" r="1.5"/><circle cx="55" cy="13" r="1.5"/><circle cx="14" cy="52" r="1.5"/><path d="M51 44l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/></g>','#392555','twinkle'],
 ['lava','Lava Flow','<path d="M-16 16Q0 4 16 16T48 16T80 16M-16 48Q0 36 16 48T48 48T80 48" fill="none" stroke="#ffcf55" stroke-width="12"/><path d="M-16 32Q0 20 16 32T48 32T80 32" fill="none" stroke="#ff723c" stroke-width="7"/>','#bc343c','flow'],
 ['waves','Ocean Waves','<path d="M-4 17Q4 8 12 17T28 17T44 17T60 17T76 17M-4 45Q4 36 12 45T28 45T44 45T60 45T76 45" fill="none" stroke="#b8f8ee" stroke-width="5"/>','#168ca0','flow'],
 ['flame','Flames','<path d="M32 5C35 16 48 23 48 38C48 48 41 55 32 55S16 48 16 38C16 31 20 25 23 21C24 28 28 29 29 29C33 24 33 15 32 5Z" fill="#ffbd48"/><path d="M32 29C34 35 40 38 40 44A8 8 0 0 1 24 44C24 40 27 36 29 34C29 38 31 38 32 37Z" fill="#ff6a59"/>','#8d3349','flicker'],
 ['lightning','Lightning','<path d="M32 3L13 35h14l-4 26 28-38H36l7-20Z" fill="#fff379"/>','#48418d','flash'],
 ['stars','Starfield','<g fill="#fff0a6"><path d="M16 3l3 8 8 3-8 3-3 8-3-8-8-3 8-3zM47 31l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/></g>','#285080','twinkle'],
 ['hearts','Hearts','<path d="M16 27C-2 16 8 5 16 13c8-8 18 3 0 14M48 59C30 48 40 37 48 45c8-8 18 3 0 14" fill="#fff0f6"/>','#d75d8d'],
 ['pixel-camo','Pixel Camo','<path d="M0 0h24v8h8v16H16v8H0zm40 0h24v24H48v8H32V16h8zM0 40h16v-8h16v16H16v16H0zm40 0h24v24H32V48h8z" fill="#b9d7a0"/><path d="M16 8h16v8H16zm24 40h24v8H40z" fill="#f0e5b0"/>','#4d795e'],
 ['hex','Honeycomb','<g fill="none" stroke="#ffd76e" stroke-width="3"><path d="M0 0l16 0 8 14-8 14H0l-8-14zm32 0h16l8 14-8 14H32l-8-14zM16 28h16l8 14-8 14H16L8 42zm32 0h16l8 14-8 14H48l-8-14z"/></g>','#69426f'],
 ['barcode','Barcode','<path d="M5 0v64M12 0v64M20 0v64M30 0v64M38 0v64M44 0v64M57 0v64" stroke="#f7f2de" stroke-width="4"/>','#343847'],
 ['plaid','Plaid','<path d="M16 0v64M48 0v64M0 16h64M0 48h64" stroke="#f8ddab" stroke-width="10" opacity=".65"/><path d="M16 0v64M48 0v64M0 16h64M0 48h64" stroke="#532e48" stroke-width="2"/>','#ad5664'],
 ['zigzag','Zigzag','<path d="M-8 17L8 1l16 16L40 1l16 16L72 1M-8 49L8 33l16 16 16-16 16 16 16-16" fill="none" stroke="#f9e6a6" stroke-width="7"/>','#d96165'],
 ['diagonal-grid','Crosshatch','<path d="M-32 64L32 0M0 64L64 0M32 64L96 0M-32 0L32 64M0 0L64 64M32 0L96 64" stroke="#ebd6bb" stroke-width="3"/>','#755d75'],
 ['stripes','Racing Stripes','<path d="M18 0v64M46 0v64" stroke="#ffdb82" stroke-width="9"/><path d="M28 0v64M36 0v64" stroke="#f6f5ed" stroke-width="3"/>','#b64055'],
 ['pixel-rain','Pixel Rain','<path d="M8 0v18M24 12v15M39 0v25M55 20v17M15 40v24M32 46v18M49 51v13" stroke="#75ffe2" stroke-width="5"/>','#133f40','flow'],
 ['bubbles','Bubbles','<g fill="none" stroke="#dcffff" stroke-width="3"><circle cx="15" cy="15" r="9"/><circle cx="45" cy="35" r="14"/><circle cx="12" cy="53" r="5"/></g>','#4ba9bd','float'],
 ['diamonds','Diamonds','<path d="M16 2L30 16 16 30 2 16zm32 32l14 14-14 14-14-14z" fill="#fbe6b6"/>','#bd75a4'],
 ['sunburst','Sunburst','<g fill="#ffdd76"><path d="M32 4l3 11h-6zm0 56l-3-11h6zM4 32l11-3v6zm56 0l-11 3v-6zM12 12l10 6-4 4zm40 40l-10-6 4-4zM52 12l-6 10-4-4zM12 52l6-10 4 4z"/><circle cx="32" cy="32" r="13"/></g>','#e97357','rotate'],
 ['clouds','Clouds','<path d="M2 24q0-8 9-8 3-12 14-7 5 2 6 8 8-1 9 7zM26 56q0-8 9-8 3-12 14-7 5 2 6 8 8-1 9 7z" fill="#fff"/>','#77b8df','drift'],
 ['music','Music Notes','<path d="M20 8v31a7 7 0 1 1-4-6V11l22-5v27a7 7 0 1 1-4-6V3z" fill="#f9d779"/>','#744394','pulse'],
 ['glitch','Glitch','<path d="M0 12h26v5H0zm33 0h31v5H33zM6 29h40v6H6zm46 0h12v6H52zM0 48h18v5H0zm27 0h37v5H27z" fill="#ff7fc5"/><path d="M8 21h36v4H8zm27 18h29v4H35z" fill="#70ffe4"/>','#232643','glitch'],
 ['matrix','Pixel Code','<g fill="#7cffac"><path d="M5 6h6v6H5zm0 10h6v6H5zm12 9h6v6h-6zm0 10h6v6h-6zm12-28h6v6h-6zm0 10h6v6h-6zm12 25h6v6h-6zm12-31h6v6h-6zm0 10h6v6h-6z"/></g>','#15382d','flow'],
 ['orbit','Orbit','<g fill="none" stroke="#d9e8ff" stroke-width="2"><ellipse cx="32" cy="32" rx="26" ry="11" transform="rotate(-30 32 32)"/><ellipse cx="32" cy="32" rx="26" ry="11" transform="rotate(30 32 32)"/></g><circle cx="32" cy="32" r="6" fill="#ffcf6a"/><circle cx="10" cy="40" r="3" fill="#ff92bd"/>','#35476d','rotate'],
 ['scales','Dragon Scales','<g fill="none" stroke="#a8e6cd" stroke-width="3" stroke-linecap="round"><path d="M-16 0q8 16 16 0q8 16 16 0q8 16 16 0q8 16 16 0q8 16 16 0q8 16 16 0M-8 16q8 16 16 0q8 16 16 0q8 16 16 0q8 16 16 0q8 16 16 0M-16 32q8 16 16 0q8 16 16 0q8 16 16 0q8 16 16 0q8 16 16 0q8 16 16 0M-8 48q8 16 16 0q8 16 16 0q8 16 16 0q8 16 16 0q8 16 16 0M-16 64q8 16 16 0q8 16 16 0q8 16 16 0q8 16 16 0q8 16 16 0q8 16 16 0"/></g>','#397768']
];
export const PATTERNS = Object.freeze(swatches.map(([id,name,art,background='#635ab0',motion=null])=>Object.freeze({id,name,art,background,motion})));
export const PATTERN_PARTS = Object.freeze(['head','torso','arms','legs']);
// Include neighboring copies so artwork crossing an edge continues on its opposite edge.
export function tileArt(pattern) {
 return [-64, 0, 64].flatMap(y => [-64, 0, 64].map(x => `<g transform="translate(${x} ${y})">${pattern.art}</g>`)).join('');
}
export function swatchSvg(pattern) {
 return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="${pattern.background}"/>${tileArt(pattern)}</svg>`;
}
