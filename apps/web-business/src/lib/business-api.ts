"use server";

// The Business app's server actions over its own Edge Functions
// (MESITA-3103). Each returns the Result shape the screens branch on; the
// server decides who may see or change a place, never these wrappers.

import { efInvoke } from "@/lib/supabase-ef";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string | null };

function fail(r: { error: string; code: string | null }): { ok: false; error: string; code: string | null } {
  return { ok: false, error: r.error, code: r.code };
}

// ── Identity ────────────────────────────────────────────────────────────

export type MyPlaceState = "owner" | "expired" | "pending" | "rejected";

export type MyPlace = {
  place_id: string;
  name: string | null;
  photo: string | null;
  state: MyPlaceState;
  /** owner | editor on a place you run (MESITA-3120); null for a request. */
  role: "owner" | "editor" | null;
  method: string | null;
  expires_at: string | null;
  decision_note: string | null;
};

export type Identity = {
  email: string | null;
  phone: string | null;
  isSuperAdmin: boolean;
  hasAccount: boolean;
  places: MyPlace[];
};

export async function getIdentity(): Promise<Result<Identity>> {
  const r = await efInvoke<Identity & { ok: true }>("business-web-get-identity", {});
  if (!r.ok) return fail(r);
  const { email, phone, isSuperAdmin, hasAccount, places } = r.data;
  return { ok: true, data: { email, phone, isSuperAdmin, hasAccount, places: places ?? [] } };
}

// ── Claim ───────────────────────────────────────────────────────────────

/** A search row (MESITA-3112): a Mesita place (`id`) or a Google listing
 *  Mesita doesn't hold yet (`google_place_id`, "Add and claim"). */
export type FoundPlace = {
  id: string | null;
  google_place_id: string | null;
  name: string | null;
  address: string | null;
  photo: string | null;
  masked_phone: string | null;
  phone_on_listing: boolean;
  mine: "owner" | "expired" | "pending" | null;
};

/** A Mesita place, the only kind the claim form takes. */
export type ClaimablePlace = FoundPlace & { id: string };

export async function findPlaces(input: { q?: string; placeId?: string; sessionToken?: string }): Promise<Result<FoundPlace[]>> {
  const r = await efInvoke<{ places: FoundPlace[] }>("business-web-find-place", {
    q: input.q,
    place_id: input.placeId,
    sessionToken: input.sessionToken,
  });
  if (!r.ok) return fail(r);
  return { ok: true, data: r.data.places ?? [] };
}

/** Adds a Google listing to Mesita (get-or-create); the id to claim. */
export async function createPlace(googlePlaceId: string): Promise<Result<{ placeId: string; created: boolean }>> {
  const r = await efInvoke<{ created: boolean; place: { id: string } }>("business-web-create-place", { googlePlaceId });
  if (!r.ok) return fail(r);
  return { ok: true, data: { placeId: r.data.place.id, created: r.data.created === true } };
}

export type ClaimOutcome = "verified" | "pending" | "already_pending" | "already_owner" | "needs_details";

export async function requestVerification(input: {
  placeId: string;
  name?: string;
  role?: string;
  note?: string;
}): Promise<Result<ClaimOutcome>> {
  const r = await efInvoke<{ outcome: ClaimOutcome }>("business-web-request-verification", {
    place_id: input.placeId,
    name: input.name,
    role: input.role,
    note: input.note,
  });
  if (!r.ok) return fail(r);
  return { ok: true, data: r.data.outcome };
}

export async function leavePlace(placeId: string): Promise<Result<null>> {
  const r = await efInvoke<{ ok: true }>("business-web-leave-place", { place_id: placeId });
  if (!r.ok) return fail(r);
  return { ok: true, data: null };
}

// ── Team (MESITA-3120: one owner, editors; per place, no org layer) ─────

export type TeamMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: "owner" | "editor";
  live: boolean;
  expires_at: string;
  me: boolean;
};

export type TeamInvite = { id: string; email: string; created_at: string };

export type Team = { role: "owner" | "editor" | "superadmin"; members: TeamMember[]; invites: TeamInvite[] };

export async function getTeam(placeId: string): Promise<Result<Team>> {
  const r = await efInvoke<Team & { ok: true }>("business-web-get-team", { place_id: placeId });
  if (!r.ok) return fail(r);
  return { ok: true, data: { role: r.data.role, members: r.data.members ?? [], invites: r.data.invites ?? [] } };
}

export async function inviteEditor(placeId: string, email: string): Promise<Result<TeamInvite>> {
  const r = await efInvoke<{ invite: TeamInvite }>("business-web-invite-editor", { place_id: placeId, email });
  if (!r.ok) return fail(r);
  return { ok: true, data: r.data.invite };
}

export async function removeMember(placeId: string, target: { managerId?: string; inviteId?: string }): Promise<Result<null>> {
  const r = await efInvoke<{ ok: true }>("business-web-remove-member", {
    place_id: placeId,
    manager_id: target.managerId,
    invite_id: target.inviteId,
  });
  if (!r.ok) return fail(r);
  return { ok: true, data: null };
}

export async function transferOwner(placeId: string, managerId: string): Promise<Result<null>> {
  const r = await efInvoke<{ ok: true }>("business-web-transfer-owner", { place_id: placeId, manager_id: managerId });
  if (!r.ok) return fail(r);
  return { ok: true, data: null };
}

// ── Premier ─────────────────────────────────────────────────────────────

export type BoostTier = "boost_2x" | "boost_5x";
export type BoostInterval = "month" | "year";

export type PremierQuote = {
  price_cents: number;
  charge_cents: number;
  credit_cents: number;
  extra_days: number;
  new_ends_at: string | null;
  renews_at: string | null;
  kind: "buy" | "change" | "resume" | "blocked";
  blocked_by: "taken" | "charging" | null;
  checkout: "payment" | "setup" | "none";
  covered: boolean;
};

export type PlacePremier = {
  role: "owner" | "superadmin";
  tier: number;
  manual: { tier: number; ends_at: string } | null;
  paid: { tier: number; ends_at: string; renews: boolean; by_you: boolean } | null;
  renewing: boolean;
  viewer: "payer" | "former_payer" | "stranger" | null;
  can_resume: boolean;
  mine: {
    id: string;
    tier: number;
    interval: BoostInterval;
    status: "open" | "ready";
    pending: number | null;
    has_card: boolean;
    checkout: string | null;
  } | null;
  quotes: Record<BoostTier, Record<BoostInterval, PremierQuote>> | null;
  outcome?: string;
};

export async function getPremier(placeId: string, sessionId?: string | null): Promise<Result<PlacePremier>> {
  const r = await efInvoke<PlacePremier>("business-web-get-premier", {
    place_id: placeId,
    ...(sessionId ? { session_id: sessionId } : {}),
  });
  if (!r.ok) return fail(r);
  return { ok: true, data: r.data };
}

export async function startPremier(input: {
  placeId: string;
  tier?: BoostTier;
  interval?: BoostInterval;
  updateCard?: boolean;
  returnUrl: string;
}): Promise<Result<{ url: string | null; outcome?: string }>> {
  const body = input.updateCard
    ? { place_id: input.placeId, kind: "update_card", return_url: input.returnUrl }
    : { place_id: input.placeId, tier: input.tier, interval: input.interval, return_url: input.returnUrl };
  const r = await efInvoke<{ url: string | null; outcome?: string }>("business-web-start-premier", body);
  if (!r.ok) return fail(r);
  return { ok: true, data: { url: r.data.url ?? null, outcome: r.data.outcome } };
}

export async function cancelPremier(placeId: string, asPlace: boolean): Promise<Result<null>> {
  const r = await efInvoke<{ ok: true }>("business-web-cancel-premier", { place_id: placeId, as_place: asPlace });
  if (!r.ok) return fail(r);
  return { ok: true, data: null };
}

// ── Claim requests (Mesita staff) ────────────────────────────────────────────

export type OwnerView = {
  id: string;
  consumer_id: string;
  name: string | null;
  phone: string | null;
  instagram_handle: string | null;
  member_number: string | null;
  method: string;
  verified_at: string;
  expires_at: string;
  live: boolean;
};

export type PendingRequest = {
  id: string;
  place_id: string;
  place_name: string | null;
  consumer_id: string;
  name: string;
  role: string;
  note: string | null;
  created_at: string;
  phone: string | null;
  instagram_handle: string | null;
  member_number: string | null;
};

export async function listVerifications(placeId?: string): Promise<Result<{ owners: OwnerView[]; pending: PendingRequest[] }>> {
  const r = await efInvoke<{ owners: OwnerView[]; pending: PendingRequest[] }>(
    "business-web-list-verifications",
    placeId ? { place_id: placeId } : {},
  );
  if (!r.ok) return fail(r);
  return { ok: true, data: { owners: r.data.owners ?? [], pending: r.data.pending ?? [] } };
}

export async function decideVerification(
  input: { requestId: string; decision: "approve" | "reject"; note?: string } | { managerId: string; decision: "revoke"; note?: string },
): Promise<Result<null>> {
  const body = "managerId" in input
    ? { manager_id: input.managerId, decision: "revoke", note: input.note }
    : { request_id: input.requestId, decision: input.decision, note: input.note };
  const r = await efInvoke<{ ok: true }>("business-web-decide-verification", body);
  if (!r.ok) return fail(r);
  return { ok: true, data: null };
}
