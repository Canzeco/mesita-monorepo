"use server";

// The place's own setup, written from the server: its legal identity, its
// Stripe account, its Mesita Membership and the Partner bit that Membership
// buys.
//
// IT WAS `actions/organizations.ts` (MESITA-1892). Every action in it took an
// `orgId` and wrote a row on `organizations`; the columns moved onto `places`
// — `partnered`, `legal_name`, `rfc`, `stripe_billing_customer_id`, and
// `place_payment_accounts` in place of `organization_payment_accounts` — so
// every action takes a `placeId` and nothing else changed about what they do.
//
// THE MEMBER ACTIONS ARE NOT HERE, and their absence is deliberate. Adding,
// removing and re-roling a member used to live beside these because the
// organization owned the people; `place_members` always owned them really, and
// `components/place-manage/actions.ts` has driven the place's four member
// endpoints since long before this issue. Keeping a second set pointed at the
// same four endpoints would be two callers for one door, which the EF naming
// law exists to prevent.
//
// THE CREATE CEREMONY IS NOT HERE EITHER. There is no legal person to create.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiGetPaymentDashboardLink,
  apiManageMembership,
  apiStartMembership,
  apiStartPaymentOnboarding,
  apiUpdateLegalIdentity,
} from "@/lib/api/console";
import { placePageHref, placeRootHref } from "@/lib/console-routes";
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

export type UpdateLegalIdentityState = { error: string | null; saved: boolean };

/** The legal person behind the venue — `places.legal_name` and `places.rfc`.
 *
 *  OWNER-ONLY, and the EF says so: `business-web-update-legal-identity` runs
 *  `requireOwner` on the place. It was `requireOrgRole(…, ["owner"])` against
 *  the organization that held it; the organization is gone and the place is
 *  the tenant, so the same rank answers on the same subject. */
export async function updateLegalIdentityAction(
  _prev: UpdateLegalIdentityState,
  formData: FormData,
): Promise<UpdateLegalIdentityState> {
  const placeId = String(formData.get("placeId") ?? "").trim();
  if (!placeId) return { error: "Missing place.", saved: false };

  const supabase = await createServerSupabase();
  try {
    await apiUpdateLegalIdentity(supabase, {
      placeId,
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

/** Starts (or resumes) Stripe Connect onboarding for the place and sends the
 *  owner to the Stripe-hosted flow. Mock mode (no Stripe key in the
 *  environment) creates the mirror row and says so instead of leaving. */
export async function connectPaymentsAction(
  _prev: PaymentsActionState,
  formData: FormData,
): Promise<PaymentsActionState> {
  const placeId = String(formData.get("placeId") ?? "").trim();
  const country = String(formData.get("country") ?? "MX")
    .trim()
    .toUpperCase();
  const entityType = String(formData.get("entityType") ?? "").trim();
  if (!placeId) return { error: "Missing place.", note: null };
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
      placeId,
      country,
      // Stripe stores these when the Account Link is minted, and they outlive
      // every rename (MESITA-1807). They name the BARE place address
      // deliberately: that route is the one place `?connect=` is read and
      // handed on to this product's own page, and it is the address least
      // likely to move again — a place's id is the one thing in this console
      // that has never changed. Links minted before MESITA-1892 point at
      // `/orgs/<id>`, which `next.config.ts` forwards to `/`, which resolves
      // the remembered place and lands them here.
      returnUrl: `${origin}${placeRootHref(placeId)}?connect=return`,
      refreshUrl: `${origin}${placeRootHref(placeId)}?connect=refresh`,
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
  const placeId = String(formData.get("placeId") ?? "").trim();
  if (!placeId) return { error: "Missing place.", note: null };

  const supabase = await createServerSupabase();
  let url: string | null = null;
  try {
    url = await apiGetPaymentDashboardLink(supabase, placeId);
  } catch (e) {
    return {
      error: errMsg(e, "Couldn't open the payments dashboard."),
      note: null,
    };
  }
  if (url) redirect(url);
  return { error: null, note: "This account has no Stripe dashboard (mock)." };
}

// THE PARTNER SWITCH IS NOT HERE, and this note is the reason nobody adds it
// back. `setPartnerStatusAction` lived here and posted to an EF that wrote
// `partnered` directly. MESITA-1889 retired that door — the yearly Mesita
// Membership is the one thing that buys the entitlement, and a second writer is
// how a switch and a subscription start disagreeing about whether a place is a
// Partner. `startMembershipAction` below is the door.

export type StartMembershipState = { error: string | null };

/**
 * The owner buys the place's yearly Mesita Membership (MESITA-1877).
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
  const placeId = String(formData.get("placeId") ?? "").trim();
  if (!placeId) return { error: "Missing place." };

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
      placeId,
      successUrl: `${origin}${placePageHref(placeId, "setup")}?membership=return`,
      cancelUrl: `${origin}${placePageHref(placeId, "setup")}?membership=cancelled`,
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

/**
 * The owner manages — and cancels — the place's Mesita Membership
 * (MESITA-1891), in Stripe's own Billing Portal.
 *
 * MESITA WRITES NO CANCELLATION LOGIC. A Cancel button of our own would be a
 * second writer racing the `customer.subscription.updated` that Stripe sends
 * moments later saying the same thing; the portal moves the subscription and
 * the webhook mirrors it, so `partner_memberships` keeps one writer. Invoices
 * and the card on file come free with the same session.
 *
 * A FORM AND A REDIRECT, like the two above it: `redirect()` throws
 * NEXT_REDIRECT and MUST stay outside the try, or errMsg would swallow it and
 * the card would show a nonsense error instead of going to Stripe
 * (MESITA-1793).
 *
 * The mock answer is a NOTE, not an error. With MOCK_SUBSCRIPTION on there is
 * no Stripe subscription behind the partnership, so there is nothing to
 * manage and nothing went wrong — the same shape
 * `openPaymentsDashboardAction` uses for a mock Connect account. Nothing here
 * reads or writes MOCK_SUBSCRIPTION, STRIPE_MODE or STRIPE_ALLOW_LIVE; those
 * are the operator's (MESITA-37).
 */
export async function manageMembershipAction(
  _prev: PaymentsActionState,
  formData: FormData,
): Promise<PaymentsActionState> {
  const placeId = String(formData.get("placeId") ?? "").trim();
  if (!placeId) return { error: "Missing place.", note: null };

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
  try {
    ({ url } = await apiManageMembership(supabase, {
      placeId,
      returnUrl:
        `${origin}${placePageHref(placeId, "setup")}?membership=managed`,
    }));
  } catch (e) {
    return {
      error: errMsg(e, "Couldn't open the billing portal."),
      note: null,
    };
  }
  if (url) redirect(url);
  return {
    error: null,
    note: "This partnership isn't billed through Stripe in this environment.",
  };
}
