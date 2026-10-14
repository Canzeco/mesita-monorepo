// Score one resolved channel against hand-checked ground truth.
// Both empty is an abstention and counts as correct. A value where truth is
// empty is a false positive. A different entity is not a miss.

export type ChannelVerdict = "correct" | "wrong_entity" | "missed" | "false_positive";

export type ChannelTrio = {
  website: string | null;
  instagram: string | null;
  facebook: string | null;
};

function hostAndPath(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return host + path;
  } catch {
    return null;
  }
}

function handle(raw: string, host: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (!u.hostname.replace(/^www\./, "").endsWith(host)) return null;
    const seg = u.pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
    return seg || null;
  } catch {
    return null;
  }
}

export function canonWebsite(raw: string | null): string | null {
  if (!raw) return null;
  return hostAndPath(raw);
}

export function canonInstagram(raw: string | null): string | null {
  if (!raw) return null;
  return handle(raw, "instagram.com");
}

export function canonFacebook(raw: string | null): string | null {
  if (!raw) return null;
  return handle(raw, "facebook.com");
}

export function scoreChannel(
  got: string | null,
  truth: string | null,
  canon: (raw: string | null) => string | null,
): ChannelVerdict {
  const g = canon(got);
  const t = canon(truth);
  if (t && g && g === t) return "correct";
  if (t && g && g !== t) return "wrong_entity";
  if (t && !g) return "missed";
  if (!t && g) return "false_positive";
  return "correct";
}

export function scoreTrio(got: ChannelTrio, truth: ChannelTrio): Record<keyof ChannelTrio, ChannelVerdict> {
  return {
    website: scoreChannel(got.website, truth.website, canonWebsite),
    instagram: scoreChannel(got.instagram, truth.instagram, canonInstagram),
    facebook: scoreChannel(got.facebook, truth.facebook, canonFacebook),
  };
}
