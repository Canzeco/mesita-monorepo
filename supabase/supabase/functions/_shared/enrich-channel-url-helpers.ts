export function pathStartsWith(url: string, prefix: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().startsWith(prefix);
  } catch {
    return false;
  }
}

export function pathIncludes(url: string, frag: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().includes(frag);
  } catch {
    return false;
  }
}

// Minimal tokeniser for the one place we still name-match: website ranking.
function nameTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

// Main registrable label of a host (label before the TLD): "cosmoprofbeauty"
// for both "cosmoprofbeauty.com" and "stores.cosmoprofbeauty.com".
function mainDomainLabel(host: string): string {
  const parts = host.replace(/^www\./, "").toLowerCase().split(".").filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] ?? "");
}

// Fraction of a candidate host's main-label letters that the place-name tokens
// account for. Used only as a soft ranking signal.
export function hostNameCoverage(host: string, name: string): number {
  const letters = mainDomainLabel(host).replace(/[^a-z0-9]/g, "");
  const toks = nameTokens(name);
  if (!letters || !toks.length) return 0;
  let covered = 0;
  let rest = letters;
  for (const t of [...toks].sort((a, b) => b.length - a.length)) {
    const idx = rest.indexOf(t);
    if (idx !== -1) {
      covered += t.length;
      rest = rest.slice(0, idx) + rest.slice(idx + t.length);
    }
  }
  return covered / letters.length;
}
