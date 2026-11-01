import { API_BASE } from "../config.js?v=shared-service-1";
const $ = (s) => document.querySelector(s),
  base = new URL(API_BASE.replace(/\/?$/, "/"), location.origin);
const status = document.createElement("p");
status.setAttribute("role", "status");
$("#data-management").before(status);
async function api(path, method = "GET") {
  const r = await fetch(new URL(path, base), {
    method,
    credentials: "include",
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok)
    throw new Error(
      r.status === 401
        ? "Sign in from Your Robot to manage your data."
        : "Could not complete that request. Please try again.",
    );
  return r.status === 204 ? null : r.json();
}
async function load() {
  try {
    const data = await api("api/me?profile=0");
    $("#data-management").hidden = false;
    $("#delete-viewer").hidden = false;
    $("#disconnect").hidden = !data.channelStored;
    status.textContent = `Signed in as ${data.viewer.displayName}.`;
  } catch (e) {
    status.textContent = e.message;
  }
}
function confirm(title, description, action, word) {
  const d = $("#confirm-dialog");
  $("#confirm-title").textContent = title;
  $("#confirm-description").textContent = description;
  $("#confirm-delete").textContent = action;
  $("#confirm-check").hidden = !word;
  $("#confirm-word").value = "";
  $("#confirm-delete").disabled = word;
  $("#confirm-word").oninput = () =>
    ($("#confirm-delete").disabled =
      word && $("#confirm-word").value !== "DELETE");
  d.returnValue = "cancel";
  d.showModal();
  return new Promise((resolve) =>
    d.addEventListener("close", () => resolve(d.returnValue === "confirm"), {
      once: true,
    }),
  );
}
$("#delete-viewer").onclick = async () => {
  if (
    !(await confirm(
      "Are you sure you want to delete your data?",
      "This permanently removes your viewer profile, points, patterns and appearance across participating channels, and signs you out. A streamer channel stays connected; disconnect it separately.",
      "Delete my data permanently",
      true,
    ))
  )
    return;
  const b = $("#delete-viewer");
  b.disabled = true;
  status.textContent = "Deleting data…";
  try {
    await api("api/me", "DELETE");
    $("#data-management").hidden = true;
    status.textContent = "Your viewer data was deleted. You are signed out.";
  } catch (e) {
    status.textContent = e.message;
  } finally {
    b.disabled = false;
  }
};
$("#disconnect").onclick = async () => {
  if (
    !(await confirm(
      "Disconnect your channel?",
      "This removes your channel connection and point records. Viewer totals will be recalculated.",
      "Disconnect channel",
      false,
    ))
  )
    return;
  const b = $("#disconnect");
  b.disabled = true;
  status.textContent = "Disconnecting…";
  try {
    await api("api/channel", "DELETE");
    b.hidden = true;
    status.textContent = "Your channel was disconnected.";
  } catch (e) {
    status.textContent = e.message;
  } finally {
    b.disabled = false;
  }
};
void load();
