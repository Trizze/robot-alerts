// Fresh deliveries always play their entrance. A reconnect resumes using an age
// measured entirely on the server, never by subtracting clocks on two machines.
export function localAlertStart(
  alert,
  { fresh = false, serverNow, now = Date.now() } = {},
) {
  if (fresh) return now;
  const age =
    Number.isFinite(serverNow) && Number.isFinite(alert?.startedAt)
      ? Math.max(0, serverNow - alert.startedAt)
      : 0;
  return now - age;
}
