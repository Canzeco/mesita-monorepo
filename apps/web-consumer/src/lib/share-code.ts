// WHO SHARED A LINK (MESITA-5060, Pato 2026-11-27: Share is "the cheapest
// CAC we will ever have"). Every place link a guest shares carries their
// share code, `?s=<code>`. A friend who opens it:
//
//   1. records one open (consumer-web-track-share-open): code, place and a
//      random id for this browser; never an account, never a location;
//   2. keeps the code in the `mesita_share` cookie for 30 days, first link
//      wins, so the sign-in page (auth/post-signin, on the server) can hand
//      it to consumer-web-signin-phone, which credits a NEW account once.
//
// The guest's own code is fetched once and kept in localStorage, so a Share
// tap reads it synchronously: an await before `navigator.share` loses the
// tap on iOS. Before the first fetch lands, a link goes out without a code.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "@/lib/api/_invoke";

export const SHARE_PARAM = "s";
export const SHARE_COOKIE = "mesita_share";
const SHARE_COOKIE_DAYS = 30;
const CODE_KEY = "mesita.shareCode";
const VISITOR_KEY = "mesita.visitor";

export type ShareClaim = { code: string; place: string | null; opened_at: string };

export function isShareCode(v: unknown): v is string {
  return typeof v === "string" && /^[a-z0-9]{8}$/.test(v);
}

/** The guest's code from this browser, or null before the first fetch. */
export function cachedShareCode(): string | null {
  try {
    const v = localStorage.getItem(CODE_KEY);
    return isShareCode(v) ? v : null;
  } catch {
    return null;
  }
}

/** Fetch the signed-in guest's code once per browser. Never throws. */
export async function prefetchShareCode(client: SupabaseClient): Promise<void> {
  if (cachedShareCode()) return;
  try {
    const res = await invokeEF<{ code: string }>(client, "consumer-web-get-share-code", {});
    if (isShareCode(res?.code)) localStorage.setItem(CODE_KEY, res.code);
  } catch {
    // No code yet: links go out without one.
  }
}

/** Forget the code (sign-out), so the next guest on this browser gets theirs. */
export function forgetShareCode(): void {
  try {
    localStorage.removeItem(CODE_KEY);
  } catch {
    // Nothing kept.
  }
}

/** `url` with the guest's code on it, when there is one. */
export function withShareCode(url: string, code = cachedShareCode()): string {
  if (!code) return url;
  try {
    const u = new URL(url);
    u.searchParams.set(SHARE_PARAM, code);
    return u.toString();
  } catch {
    return url;
  }
}

/** The place a link names, from a /place/<id or slug> path. */
export function placeRefFromPath(pathname: string): string | null {
  const m = /^\/place\/([^/?#]+)/.exec(pathname);
  if (!m) return null;
  const ref = decodeURIComponent(m[1]);
  return /^[A-Za-z0-9-]{1,120}$/.test(ref) && ref !== "google" ? ref : null;
}

/** A cookie value for a claim, or the claim inside one. */
export function encodeShareClaim(c: ShareClaim): string {
  return encodeURIComponent(JSON.stringify(c));
}

export function decodeShareClaim(raw: string | undefined | null): ShareClaim | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    if (!isShareCode(v.code) || typeof v.opened_at !== "string") return null;
    return {
      code: v.code,
      place: typeof v.place === "string" ? v.place : null,
      opened_at: v.opened_at,
    };
  } catch {
    return null;
  }
}

function visitorId(): string | null {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) {
      v = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return null;
  }
}

function hasCookie(name: string): boolean {
  return document.cookie.split("; ").some((c) => c.startsWith(`${name}=`));
}

/**
 * The page was opened from a share link: record the open, keep the code for
 * sign-in (first link wins) and take `?s=` off the address, so a reload or a
 * re-share does not carry the friend's code. Never throws.
 */
export function recordShareOpen(client: SupabaseClient, ownCode = cachedShareCode()): void {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get(SHARE_PARAM);
    if (!code) return;
    url.searchParams.delete(SHARE_PARAM);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    if (!isShareCode(code) || code === ownCode) return;

    const place = placeRefFromPath(url.pathname);
    if (!hasCookie(SHARE_COOKIE)) {
      const claim: ShareClaim = { code, place, opened_at: new Date().toISOString() };
      document.cookie = `${SHARE_COOKIE}=${encodeShareClaim(claim)}; Max-Age=${SHARE_COOKIE_DAYS * 86_400}; Path=/; SameSite=Lax; Secure`;
    }
    const visitor = visitorId();
    if (!visitor) return;
    void invokeEF(client, "consumer-web-track-share-open", {
      code,
      visitor,
      ...(place ? { place } : {}),
    }).catch(() => undefined);
  } catch {
    // A count that could not be made is not the visitor's problem.
  }
}
