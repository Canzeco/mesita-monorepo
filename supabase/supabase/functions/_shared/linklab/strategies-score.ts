// linklab — name/host coverage scoring + IG candidate ranking helpers.
// Used by the discovery strategies; kept separate so strategies.ts stays strategy-shaped.

import { normInstagramHandle, normWebsiteHost } from "./normalize.ts";
import { SearchHit } from "./providers.ts";

const STOP = new Set([
  "el","la","los","las","de","del","y","the","restaurante","restaurant","cocina",
  "bar","cafe","café","taqueria","taquería","by","en","mx","mexico","méxico",
]);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
export function nameTokens(name: string): string[] {
  return stripAccents(name.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}
function domainLabel(host: string): string {
  const parts = host.split(".");
  // second-level label (skip common 2-part TLDs like com.mx)
  if (parts.length >= 3 && ["com", "co", "org", "net"].includes(parts[parts.length - 2])) {
    return parts[parts.length - 3];
  }
  return parts[parts.length - 2] ?? host;
}
/** fraction of the domain label's letters that the place-name tokens account for. */
export function hostNameCoverage(host: string, name: string): number {
  const label = domainLabel(host).replace(/[^a-z0-9]/g, "");
  const toks = nameTokens(name);
  if (!label || !toks.length) return 0;
  let covered = 0;
  let rest = label;
  for (const t of [...toks].sort((a, b) => b.length - a.length)) {
    const idx = rest.indexOf(stripAccents(t));
    if (idx !== -1) {
      covered += t.length;
      rest = rest.slice(0, idx) + rest.slice(idx + t.length);
    }
  }
  return covered / label.length;
}

/** Choose the best official-website URL from search hits by name coverage. */
export function pickWebsite(hits: SearchHit[], name: string, minCov = 0.5): string | null {
  for (const h of hits) {
    const host = normWebsiteHost(h.url);
    if (!host) continue; // blocked/junk
    if (hostNameCoverage(host, name) >= minCov) return `https://${host}`;
  }
  return null;
}

/** Extract distinct instagram handles from a bag of URLs, best-name-match first. */
export function igCandidates(urls: string[], name: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const h = normInstagramHandle(u);
    if (h && !seen.has(h)) {
      seen.add(h);
      out.push(h);
    }
  }
  const toks = nameTokens(name);
  return out.sort((a, b) => igScore(b, toks) - igScore(a, toks));
}
function igScore(handle: string, toks: string[]): number {
  const h = handle.replace(/[^a-z0-9]/g, "");
  let s = 0;
  for (const t of toks) if (h.includes(stripAccents(t))) s += t.length;
  return s;
}
export function igUrl(handle: string | null): string | null {
  return handle ? `https://www.instagram.com/${handle}` : null;
}
