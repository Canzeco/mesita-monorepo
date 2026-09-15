"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiAddOrgMember,
  apiCreateOrganization,
  apiGetPaymentDashboardLink,
  apiRemoveOrgMember,
  apiSetOrgPartnership,
  apiStartMembership,
  apiStartPaymentOnboarding,
  apiUpdateOrganization,
  apiUpdateOrgMemberRole,
  type OrgRole,
} from "@/lib/api/organizations";
import { orgHref, orgRootHref } from "@/lib/console-routes";
import { isConnectEntityType } from "@/lib/connect-entity-types";
import { errMsg } from "@/lib/utils";

/**
 * Where this console is, from the request's own headers.
 *
 * Vercel sets `x-forwarded-*` in front of the Node runtime, so this is the
 * deployment's real origin — preview URLs included — and it is NOT a
 * client-supplied field, so a spoofed form value cannot redirect anyone
 * off-site. Returns null when there is no host to read, which callers must
 * treat as "cannot build an absolute URL" rather than falling back to a
 * relative one (MESITA-1643).
 */
async function consoleOrigin(): Promise<string | null> {
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  return host ? `${proto}://${host}` : null;
}

export type CreateOrgState = { error: string | null };
export type UpdateOrgState = { error: string | null; saved: boolean };

export async function createOrganizationAction(
  _prev: CreateOrgState,
  formData: FormData,
): Promise<CreateOrgState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  if (name.length > 120) return { error: "Name is too long." };

  const supabase = await createServerSupabase();
  // try/catch ONLY around the Edge Function. `redirect()` throws NEXT_REDIRECT
  // and must not sit inside this catch — errMsg would swallow it and the form
  // would show a nonsense error instead of leaving (MESITA-1793).
  let created: Awaited<ReturnType<typeof apiCreateOrganization>> | undefined;
  try {
    // Name only, on purpose: legal name and RFC are not creation facts —
    // they matter the day the organization partners a place or gets paid,
    // and they land on the Organization screen's Identity card instead.
    created = await apiCreateOrganization(supabase, { name });
  } catch (e) {
    return { error: errMsg(e, "Couldn't create that organization.") };
  }
  if (!created?.id) {
    return { error: "Created organization is missing an id." };
  }
  // The rail's picker and every org-scoped list change at once. The new
  // organization's own address — `orgHref` encodes the id.
  revalidatePath("/", "layout");
  redirect(orgHref(created.id));
}

export async function updateOrganizationAction(
  _prev: UpdateOrgState,
  formData: FormData,
): Promise<UpdateOrgState> {
  const orgId = String(formData.get("orgId") ?? "").trim();
  if (!orgId) return { error: "Missing organization.", saved: false };

  const supabase = await createServerSupabase();
  try {
    await apiUpdateOrganization(supabase, {
      orgId,
      legalName: String(formData.get("legalName") ?? "").trim() || null,
      rfc:
        String(formData.get("rfc") ?? "")
          .trim()
          .toUpperCase() || null,
    });
  } catch (e) {
    return {
      error: errMsg(e, "Couldn't save the legal details."),
      saved: false,
    };
  }
  revalidatePath("/", "layout");
  return { error: null, saved: true };
}

export type PaymentsActionState = { error: string | null; note: string | null };

/** Starts (or resumes) Stripe Connect onboarding for the organization and
 *  sends the owner to the Stripe-hosted flow. Mock mode (no Stripe key in
 *  the environment) creates the mirror row and says so instead of leaving. */
export async function connectPaymentsAction(
  _prev: PaymentsActionState,
  formData: FormData,
): Promise<PaymentsActionState> {
  const orgId = String(formData.get("orgId") ?? "").trim();
  const country = String(formData.get("country") ?? "MX")
    .trim()
    .toUpperCase();
  const entityType = String(formData.get("entityType") ?? "").trim();
  if (!orgId) return { error: "Missing organization.", note: null };
  const intent = String(formData.get("intent") ?? "create");
  // The pre-onboarding gate, enforced server-side too: `required` on the
  // select is a courtesy the browser can skip. Create and RESTART both mint a
  // new account, so both need the answer; only resume may omit it, because the
  // account it reopens already carries Stripe's copy.
  if (
    (intent === "create" || intent === "restart") &&
    !isConnectEntityType(entityType)
  ) {
    return {
      error:
        "Pick the legal entity type first — Stripe asks an individual and a company for different documents.",
      note: null,
    };
  }

  // ABSOLUTE, AND FROM HERE (MESITA-1643). The EF used to synthesise these
  // from its own `Origin` header, but this is a SERVER action calling through
  // supabase-js — no browser sets an Origin on that hop, so the EF built a
  // relative "/?org=..." and Stripe's accountLinks.create rejected it. The
  // console is the only party that knows where the owner should land.
  const origin = await consoleOrigin();
  if (!origin) {
    return {
      error:
        "Couldn't work out where to send you back to. Reload and try again.",
      note: null,
    };
  }

  const supabase = await createServerSupabase();
  let url: string | null = null;
  let mock = false;
  try {
    ({ url, mock } = await apiStartPaymentOnboarding(supabase, {
      orgId,
      country,
      // Stripe stores these when the Account Link is minted, and they outlive
      // every rename (MESITA-1807). They name the BARE address deliberately
      // (MESITA-1846): that route is the one place `?connect=` is read and
      // handed on to Payments, and it is the address least likely to move
      // again — the page behind it has moved three times in one day.
      returnUrl: `${origin}${orgRootHref(orgId)}?connect=return`,
      refreshUrl: `${origin}${orgRootHref(orgId)}?connect=refresh`,
      ...(entityType ? { entityType } : {}),
      // Only ever from an explicit Start over (MESITA-1865). The EF re-reads
      // the live Stripe account before it deletes anything, so this flag asks;
      // it does not authorise.
      ...(intent === "restart" ? { restart: true } : {}),
    }));
  } catch (e) {
    return {
      error: errMsg(e, "Couldn't start payment onboarding."),
      note: null,
    };
  }
  if (url) redirect(url);
  revalidatePath("/", "layout");
  return {
    error: null,
    note: mock
      ? "Mock account created — Stripe isn't configured in this environment."
      : "Account ready.",
  };
}

/** Mints the single-use Express dashboard login link and sends the owner
 *  there. Never cached, never stored — straight redirect. */
export async function openPaymentsDashboardAction(
  _prev: PaymentsActionState,
  formData: FormData,
): Promise<PaymentsActionState> {
  const orgId = String(formData.get("orgId") ?? "").trim();
  if (!orgId) return { error: "Missing organization.", note: null };

  const supabase = await createServerSupabase();
  let url: string | null = null;
  try {
    url = await apiGetPaymentDashboardLink(supabase, orgId);
  } catch (e) {
    return {
      error: errMsg(e, "Couldn't open the payments dashboard."),
      note: null,
    };
  }
  if (url) redirect(url);
  return { error: null, note: "This account has no Stripe dashboard (mock)." };
}

export type AddMemberState = {
  error: string | null;
  /** The typed email, echoed back so an error never eats the input. */
  email: string;
  added: boolean;
  /** Which path fired, so the disclosure can say "Invited" vs "Added". */
  mode: "linked" | "invited" | null;
};

const ADD_MEMBER_COPY: Record<string, string> = {
  not_owner: "Only owners can add members.",
  already_member: "Already a member.",
  invite_pending: "An invite for that email is already pending.",
};

function isOrgRole(value: string): value is OrgRole {
  return value === "owner" || value === "editor" || value === "viewer";
}

export async function addOrgMemberAction(
  _prev: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  const orgId = String(formData.get("orgId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "editor");
  const role: OrgRole = isOrgRole(roleRaw) ? roleRaw : "editor";
  if (!orgId)
    return { error: "Missing organization.", email, added: false, mode: null };
  if (!email) {
    return { error: "An email is required.", email, added: false, mode: null };
  }

  const supabase = await createServerSupabase();
  // The invite email's redirect link needs an absolute origin — resolved
  // server-side from the request's own headers (Vercel sets x-forwarded-*
  // in front of the Node runtime) rather than a client-supplied field, so
  // there's nothing here that a spoofed form value could redirect off-site.
  const origin = (await consoleOrigin()) ?? undefined;
  let mode: "linked" | "invited";
  try {
    const res = await apiAddOrgMember(supabase, {
      orgId,
      email,
      role,
      ...(origin ? { redirectBase: origin } : {}),
    });
    mode = res.mode;
  } catch (e) {
    const code = (e as { code?: string | null })?.code ?? null;
    const copy =
      (code && ADD_MEMBER_COPY[code]) ?? errMsg(e, "Couldn't add that member.");
    return { error: copy, email, added: false, mode: null };
  }
  revalidatePath("/", "layout");
  return { error: null, email: "", added: true, mode };
}

export type MemberRowActionState = { error: string | null };

const MEMBER_ACTION_COPY: Record<string, string> = {
  last_owner: "The organization must keep at least one owner.",
};

export async function removeOrgMemberAction(
  _prev: MemberRowActionState,
  formData: FormData,
): Promise<MemberRowActionState> {
  const orgId = String(formData.get("orgId") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "member");
  const kind = kindRaw === "invite" ? "invite" : "member";
  if (!orgId || !id) return { error: "Missing member." };

  const supabase = await createServerSupabase();
  try {
    await apiRemoveOrgMember(supabase, { orgId, id, kind });
  } catch (e) {
    const code = (e as { code?: string | null })?.code ?? null;
    return {
      error:
        (code && MEMBER_ACTION_COPY[code]) ??
        errMsg(e, "Couldn't remove that member."),
    };
  }
  revalidatePath("/", "layout");
  return { error: null };
}

export async function updateOrgMemberRoleAction(
  _prev: MemberRowActionState,
  formData: FormData,
): Promise<MemberRowActionState> {
  const orgId = String(formData.get("orgId") ?? "").trim();
  const memberId = String(formData.get("memberId") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "");
  if (!orgId || !memberId) return { error: "Missing member." };
  if (!isOrgRole(roleRaw)) return { error: "Invalid role." };

  const supabase = await createServerSupabase();
  try {
    await apiUpdateOrgMemberRole(supabase, { orgId, memberId, role: roleRaw });
  } catch (e) {
    const code = (e as { code?: string | null })?.code ?? null;
    return {
      error:
        (code && MEMBER_ACTION_COPY[code]) ??
        errMsg(e, "Couldn't update that member's role."),
    };
  }
  revalidatePath("/", "layout");
  return { error: null };
}

export type SetOrgPartnershipState = {
  error: string | null;
  partnered: boolean;
};

/** Owner flips the org Partner switch. Stripe Ready is the lock; the EF
 *  also refuses ON without it (code stripe_not_ready). */
export async function setOrgPartnershipAction(
  orgId: string,
  partnered: boolean,
): Promise<SetOrgPartnershipState> {
  if (!orgId) return { error: "Missing organization.", partnered: false };
  const supabase = await createServerSupabase();
  try {
    const r = await apiSetOrgPartnership(supabase, orgId, partnered);
    revalidatePath("/", "layout");
    return { error: null, partnered: r.partnered };
  } catch (e) {
    const code = (e as { code?: string | null })?.code ?? null;
    return {
      error:
        code === "stripe_not_ready"
          ? "Connect Stripe first — Partner needs a Ready account."
          : errMsg(e, "Couldn't update Partner."),
      partnered: false,
    };
  }
}

export type StartMembershipState = { error: string | null };

/**
 * The owner buys the organization's yearly Mesita Membership (MESITA-1877).
 *
 * It ends in a redirect in every mode that works: real Stripe returns the
 * hosted Checkout page, and MOCK_SUBSCRIPTION returns the success URL after
 * entitling inline. So there is no success branch here — only the two ways it
 * can fail to leave.
 *
 * `redirect()` throws NEXT_REDIRECT and MUST stay outside the try: errMsg
 * would swallow it and the modal would show a nonsense error instead of
 * going to Stripe (MESITA-1793, and connectPaymentsAction above).
 *
 * ABSOLUTE URLS, BUILT HERE. This is a server action calling through
 * supabase-js, so no browser sets an Origin on that hop and the EF's own
 * fallback would build a relative path Stripe rejects — the same lesson
 * MESITA-1643 taught Connect. The console is the only party that knows where
 * the owner should land.
 */
export async function startMembershipAction(
  _prev: StartMembershipState,
  formData: FormData,
): Promise<StartMembershipState> {
  const orgId = String(formData.get("orgId") ?? "").trim();
  if (!orgId) return { error: "Missing organization." };

  const origin = await consoleOrigin();
  if (!origin) {
    return {
      error: "Couldn't work out where to send you back to. Reload and try again.",
    };
  }

  const supabase = await createServerSupabase();
  let checkoutUrl: string | null = null;
  let alreadyMember = false;
  try {
    ({ checkoutUrl, alreadyMember } = await apiStartMembership(supabase, {
      orgId,
      successUrl: `${origin}${orgHref(orgId, "products")}?membership=return`,
      cancelUrl: `${origin}${orgHref(orgId, "products")}?membership=cancelled`,
    }));
  } catch (e) {
    const code = (e as { code?: string | null })?.code ?? null;
    return {
      error: code === "stripe_live_blocked"
        // The operator's own gate (MESITA-37), not the owner's mistake — so
        // it says who can clear it rather than telling them to try again.
        ? "Live payments aren't switched on yet. Mesita has to enable them."
        : errMsg(e, "Couldn't start the membership checkout."),
    };
  }

  if (alreadyMember) {
    // Two tabs, or a double-click. The partnership is already paid for, so
    // the honest answer is to show them the page saying so.
    revalidatePath("/", "layout");
    return { error: null };
  }
  if (checkoutUrl) redirect(checkoutUrl);
  return { error: "Couldn't start the membership checkout." };
}
