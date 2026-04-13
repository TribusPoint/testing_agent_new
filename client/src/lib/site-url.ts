/**
 * Match server `extract_primary_url` so the UI can warn before calling analyze-site.
 */
export function extractPrimaryUrlFromWebsites(websites: string | null | undefined): string | null {
  if (!websites || !String(websites).trim()) return null;
  const raw = String(websites).trim();
  const parts = raw.split(/[\s,;|]+/);
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    if (p.startsWith("http://") || p.startsWith("https://")) {
      try {
        new URL(p);
        return p;
      } catch {
        continue;
      }
    }
    if (p.includes(".") && !p.includes(" ") && !p.includes("/")) {
      return `https://${p.replace(/^\/+/, "")}`;
    }
  }
  return null;
}

export function hasResolvableAnalyzeUrl(overrideUrl: string, companyWebsites: string | null | undefined): boolean {
  const t = overrideUrl.trim();
  if (t) return true;
  return Boolean(extractPrimaryUrlFromWebsites(companyWebsites));
}
