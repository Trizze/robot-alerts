// Request-driven only: no Twitch polling timer. Share refreshes and serve failures stale.
export function directoryCache(load, clock = Date.now) {
  let cached = [],
    until = 0,
    failureUntil = 0,
    pending,
    directoryKey = "";
  return async (ids) => {
    const key = ids.join(",");
    const now = clock();
    if (key === directoryKey && (until > now || failureUntil > now))
      return cached.filter((x) => ids.includes(x.id));
    if (!pending) {
      pending = load(ids)
        .then((items) => {
          cached = items;
          directoryKey = key;
          until = clock() + 120000;
          failureUntil = 0;
          return items;
        })
        .catch(() => {
          failureUntil = clock() + 60000;
          directoryKey = key;
          return cached.filter((x) => ids.includes(x.id));
        })
        .finally(() => (pending = null));
    }
    return pending.then((items) => items.filter((x) => ids.includes(x.id)));
  };
}
