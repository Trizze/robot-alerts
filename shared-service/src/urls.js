export function serviceUrls(publicBase, frontend) {
  const base = new URL(publicBase),
    site = new URL(frontend);
  if (
    base.protocol !== "https:" ||
    site.protocol !== "https:" ||
    base.origin !== site.origin ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    site.username ||
    site.password ||
    site.search ||
    site.hash
  )
    throw new Error(
      "PUBLIC_BASE_URL and FRONTEND_URL must be same-origin HTTPS URLs without credentials, query or fragment",
    );
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return {
    callback: new URL("auth/callback", base).href,
    webhookCallback: new URL("eventsub", base).href,
    frontendUrl: site.href,
  };
}
