import { RobotRig, DIRECTIONS } from "/shared/robot-rig.js";
const state = await (await fetch("/api/state")).json(),
  profiles = state.testViewers || state.viewers;
const select = document.querySelector("#viewer"),
  views = document.querySelector("#views");
for (const profile of profiles) {
  const option = document.createElement("option");
  option.value = profile.id;
  option.textContent = profile.name;
  select.append(option);
}
if (profiles.some((p) => p.id === "14824099")) select.value = "14824099";
function render() {
  const viewer = profiles.find((p) => p.id === select.value) || profiles[0];
  views.replaceChildren();
  for (const direction of DIRECTIONS) {
    const tile = document.createElement("article");
    tile.className = "view";
    tile.dataset.direction = direction;
    const rig = new RobotRig(viewer, { direction }),
      name = document.createElement("h2"),
      code = document.createElement("code");
    name.textContent = direction
      .split("-")
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(" ");
    code.textContent = direction;
    tile.append(rig.svg, name, code);
    views.append(tile);
  }
}
select.addEventListener("change", render);
render();
