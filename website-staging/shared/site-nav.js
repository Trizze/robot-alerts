const links = [
  ["Your Robot", "/robot/"],
  ["Streamer Dashboard", "/robot/dashboard/"],
  ["Privacy", "/robot/privacy/"],
  ["Get Started", "/robot/start/"],
  ["Streamers", "/robot/streamers/"],
  ["How it works", "/robot/how-it-works/"],
];
for (const header of document.querySelectorAll("[data-site-header]")) {
  const brand = document.createElement("a");
  brand.className = "brand";
  brand.href = "/robots/";
  const image = document.createElement("img");
  image.src = "/robot/brand/crt-logo.svg";
  image.alt = "";
  image.width = 40;
  image.height = 40;
  const text = document.createElement("span");
  text.textContent = "RobotAlerts";
  brand.append(image, text);
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "Main navigation");
  for (const [label, href] of links) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    if (location.pathname === href) a.setAttribute("aria-current", "page");
    nav.append(a);
  }
  header.replaceChildren(brand, nav);
}
