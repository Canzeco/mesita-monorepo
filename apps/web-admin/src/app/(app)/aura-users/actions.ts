"use server";

// Server actions for Aura Users. Thin wrappers over the admin-web-*
// Edge Functions via the Result-style efInvoke (never throws) — same contract
// as the Rewards / Reservations / Sourcing config actions.
//
// Backed by admin-web-list-aura (the roster) and admin-web-grant-class (the
// single write that seats or unseats a member). No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";

/** A consumer as the Aura roster shows them. Mirrors the EF's ConsumerSummary. */
export type AuraMember = {
  id: string;
  code: string | null;
  name: string | null;
  phone: string | null;
  instagramHandle: string | null;
  followers: number | null;
  classKey: string | null;
  classOrigin: string | null;
  grantedAt: string | null;
};

type ListResult =
  | { ok: true; members: AuraMember[] }
  | { ok: false; error: string };

export async function listAura(): Promise<ListResult> {
  const r = await efInvoke<{ members: AuraMember[] }>("admin-web-list-aura", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, members: r.data.members ?? [] };
}

type GrantResult =
  | { ok: true; classKey: string; origin: string; consumer: AuraMember }
  | { ok: false; error: string };

// The Aura door (segments v6). `lookup` is whatever the operator has at hand —
// uuid, 8-digit code, phone, @handle or name; the EF refuses anything that
// doesn't land on exactly one consumer. Grant writes aura/'invitation'; revoke
// recomputes the best remaining door server-side (subscription → premium,
// reach → influencer, else standard).
export async function setAura(
  lookup: string,
  grant: boolean,
): Promise<GrantResult> {
  const r = await efInvoke<{
    classKey: string;
    origin: string;
    consumer: AuraMember;
  }>("admin-web-grant-class", {
    lookup,
    classKey: grant ? "aura" : null,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    classKey: r.data.classKey,
    origin: r.data.origin,
    consumer: r.data.consumer,
  };
}
