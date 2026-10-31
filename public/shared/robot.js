const NS = "http://www.w3.org/2000/svg";
export const SCREEN = Object.freeze({ x: 20, y: 18, size: 40, center: 40 });
let counter = 0;
const paintColors = {
  copper: ["#dc9b71", "#995b44"],
  neon: ["#c8ff7a", "#7271ad"],
  patina: ["#8bd2bd", "#537e75"],
  comet: ["#d3bcff", "#7e6aa1"],
};
function seedColor(id = "") {
  let hash = 0;
  for (const ch of id) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 42% 68%)`;
}
// An integer-grid sprite rig. Themes never enter the renderer or change its parts.
export function robot(viewer, { silhouette = false } = {}) {
  const look = viewer?.look || {},
    uid = `robot-${++counter}`;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 80 104");
  svg.classList.add("robot");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    silhouette
      ? "An unidentified member of the raid"
      : `${viewer?.name || "Viewer"}’s robot`,
  );
  const light = /^#[\da-f]{6}$/i.test(viewer?.color || "")
    ? viewer.color
    : seedColor(viewer?.id);
  const palette = paintColors[look.paint] || [
    viewer?.palette?.[0] || seedColor(viewer?.id),
    viewer?.palette?.[1] || "#637783",
  ];
  svg.style.setProperty("--metal", silhouette ? "#46505f" : palette[0]);
  svg.style.setProperty("--shade", silhouette ? "#303a49" : palette[1]);
  svg.style.setProperty("--light", silhouette ? "#6d7f8d" : light);
  // Original static artwork. Variable identity data is assigned with DOM APIs.
  svg.innerHTML = `<defs><clipPath id="${uid}-screen"><rect x="20" y="18" width="40" height="40"/></clipPath></defs>
  <rect x="18" y="100" width="44" height="2" fill="#101a29" opacity=".24"/>
  <g data-layer="pose"><g class="leg-left"><path d="M28 86h10v10H24v-4h4z" fill="#182630"/><path d="M30 88h6v6h-6z" fill="var(--metal)"/><path d="M24 94h14v4H22v-2h2z" fill="var(--shade)"/><path d="M24 94h10v2H24z" fill="var(--metal)"/></g><g class="leg-right"><path d="M44 86h10v6h4v4H44z" fill="#182630"/><path d="M46 88h6v6h-6z" fill="var(--metal)"/><path d="M44 94h14v2h2v2H44z" fill="var(--shade)"/><path d="M48 94h10v2H48z" fill="var(--metal)"/></g>
  <g class="arm-left"><path d="M22 70h8v8h-6v10h-4v4h-8V82h4V72h6z" fill="#182630"/><path d="M20 74h6v4h-6zm-2 4h4v8h-4zm-4 8h8v4h-2v-2h-4v2h-2z" fill="var(--metal)"/></g></g>
  <g data-layer="paint"><path d="M34 64h12v8H34z" fill="#182630"/><path d="M36 66h8v4h-8z" fill="var(--shade)"/><path d="M28 68h24v4h4v14h-4v4H28v-4h-4V72h4z" fill="#182630"/><path d="M28 72h24v12H28z" fill="var(--metal)"/><path d="M28 84h24v2H28zM50 74h2v10h-2z" fill="var(--shade)"/><path d="M28 72h20v2H28z" fill="#fff" opacity=".25"/><path d="M28 82h2v2h-2zm22 0h2v2h-2z" fill="#182630"/></g>
  <g data-layer="chest"><rect x="32" y="75" width="16" height="7" fill="#182630"/><rect x="34" y="77" width="12" height="3" fill="var(--light)" class="chest-light"/><path class="chest-mark" d="M38 77v3m4-3v3" stroke="#fff" stroke-width="1" opacity=".45"/></g>
  <g data-layer="head" class="robot-head"><path d="M16 8h48v4h4v48h-4v4H16v-4h-4V12h4z" fill="#182630"/><path d="M16 12h48v48H16z" fill="var(--metal)"/><path d="M16 12h48v3H16z" fill="#fff" opacity=".3"/><path d="M62 15h2v45H16v-3h46z" fill="var(--shade)"/><rect x="18" y="16" width="44" height="44" fill="#182630"/><rect x="20" y="18" width="40" height="40" fill="#14282e"/>
  <g data-layer="screen" clip-path="url(#${uid}-screen)"><g class="face"><path d="M28 30h4v7h-4zm20 0h4v7h-4zM30 43h4v4h12v-4h4v6H30z" fill="var(--light)"/></g><image class="avatar" x="20" y="18" width="40" height="40" preserveAspectRatio="xMidYMid meet"/><path d="M20 20h40m-40 4h40m-40 4h40m-40 4h40m-40 4h40m-40 4h40m-40 4h40m-40 4h40m-40 4h40" stroke="#000" stroke-width=".4" opacity=".12"/><path d="M20 18h40v2H22v38h-2z" fill="#fff" opacity=".08"/></g>
  <path d="M22 61h8m2 0h3" stroke="#182630" stroke-width="1"/><rect x="57" y="61" width="3" height="1" fill="var(--light)"/><g class="head-extra" fill="#e8d8ac"><path d="M14 12h8v2h-6v6h-2zm44 0h8v8h-2v-6h-6zM14 52h2v6h6v2h-8zm50 0h2v8h-8v-2h6z"/></g><path class="visor-frame" d="M18 16h44v3H18z" fill="#e0ca8e"/></g>
  <g class="arm-right"><path d="M54 70h8v-4h4V54h8v10h-4v12H54z" fill="#182630"/><path d="M56 72h10v-8h4v-4h-4v-4h6v6h-4v12H56z" fill="var(--metal)"/><rect x="56" y="72" width="4" height="2" fill="var(--shade)"/></g>
  <g data-layer="hat" class="hat"></g><g data-layer="entrance" class="entrance-effect"><path d="M6 36v-6h6M68 30h6v6M6 48v6h6m56 0h6v-6" fill="none" stroke="var(--light)" stroke-width="2"/></g>`;
  const avatar = svg.querySelector(".avatar");
  if (
    !silhouette &&
    /^\/(?:assets\/avatars\/|avatars\/)[a-zA-Z0-9_.-]+$/.test(
      viewer?.avatar || "",
    )
  ) {
    avatar.setAttribute("href", viewer.avatar);
    avatar.addEventListener("error", () => avatar.remove());
    extractPalette(viewer.avatar).then((colors) => {
      if (!paintColors[look.paint] && colors) {
        svg.style.setProperty("--metal", colors[0]);
        svg.style.setProperty("--shade", colors[1]);
      }
    });
  } else avatar.remove();
  const hats = {
    antenna:
      '<path d="M38 2h4v6h-4z" fill="#65788a"/><path d="M36 0h8v4h-8z" fill="var(--light)"/>',
    crown:
      '<path d="M24 0h4v4h8V0h8v4h8V0h4v10H24z" fill="#e7b55e"/><path d="M26 6h28v2H26z" fill="#ffe8a1"/><rect x="38" y="4" width="4" height="3" fill="var(--light)"/>',
    sprout:
      '<path d="M38 2h4v6h-4z" fill="#548b58"/><path d="M28 0h10v2h-8v2h8v2h-8V4h-2zm14 2h10V0H42z" fill="#a7d990"/>',
    parcel:
      '<path d="M38 0h4v8h-4zM24 2h12v4H24zm20 0h12v4H44z" fill="#f18c96"/><path d="M28 0h8v2h-8zm16 0h8v2h-8z" fill="#ffc0b8"/>',
    mug: '<path d="M34 0h12v8H34zM46 2h4v4h-4" fill="#f0dfba"/><path d="M36 0h8v2h-8z" fill="#7f6257"/>',
  };
  if (!silhouette) svg.querySelector(".hat").innerHTML = hats[look.hat] || "";
  svg.querySelector(".head-extra").style.display = [
    "reinforced",
    "clockwork",
  ].includes(look.head)
    ? ""
    : "none";
  if (look.head === "clockwork")
    svg.querySelector(".head-extra").setAttribute("fill", "#e9ba6b");
  svg.querySelector(".visor-frame").style.display =
    look.screen === "visor" ? "" : "none";
  if (look.pose === "salute")
    svg
      .querySelector(".arm-right")
      .setAttribute("transform", "translate(0 -4)");
  if (look.pose === "cape") {
    const cape = document.createElementNS(NS, "path");
    cape.setAttribute("d", "M28 68h24v8h4v8h4v12H20V84h4v-8h4z");
    cape.setAttribute("fill", "#a46683");
    svg.insertBefore(cape, svg.querySelector('[data-layer="pose"]'));
  }
  const marks = {
    star: "M39 76h2v2h3v1h-3v2h-2v-2h-3v-1h3z",
    helper: "M36 77h3v1h2v-1h3v3h-2v1h-4v-1h-2z",
    coil: "M40 76h3l-3 3h3l-4 3 1-3h-3z",
    veteran: "M35 77h2v1h2v1h2v-1h2v-1h2v2h-2v1h-2v1h-2v-1h-2v-1h-2z",
  };
  if (marks[look.chest]) {
    const mark = svg.querySelector(".chest-mark");
    mark.setAttribute("d", marks[look.chest]);
    mark.setAttribute("stroke", "none");
    mark.setAttribute("fill", "#fff");
    mark.setAttribute("opacity", ".8");
  }
  if (["spark", "beacon"].includes(look.entrance))
    svg.classList.add("earned-entrance");
  if (silhouette) svg.classList.add("silhouette");
  return svg;
}
const palettes = new Map();
function extractPalette(src) {
  if (!palettes.has(src))
    palettes.set(
      src,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 16;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, 16, 16);
            const data = ctx.getImageData(0, 0, 16, 16).data;
            const sums = [0, 0, 0];
            let count = 0;
            for (let i = 0; i < data.length; i += 4)
              if (
                data[i + 3] > 150 &&
                Math.max(data[i], data[i + 1], data[i + 2]) > 60
              ) {
                for (let k = 0; k < 3; k++) sums[k] += data[i + k];
                count++;
              }
            if (!count) return resolve(null);
            const rgb = sums.map((v) => Math.round(v / count));
            resolve([
              `rgb(${rgb.map((v) => Math.round(v * 0.6 + 95)).join(" ")})`,
              `rgb(${rgb.map((v) => Math.round(v * 0.45 + 25)).join(" ")})`,
            ]);
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = src;
      }),
    );
  return palettes.get(src);
}
