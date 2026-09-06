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
  apiStartPaymentOnboarding,
  apiUpdateOrganization,
  apiUpdateOrgMemberRole,
  type OrgRole,
} from "@/lib/api/organizations";
import { isConnectEntityType } from "@/lib/connect-entity-types";
import { errMsg } from "@/lib/utils";

export type CreateOrgState = { error: string | null };
export type UpdateOrgState = { error: string | null; saved: boolean };

export async function createOrganizationAction(
  _prev: CreateOrgState,
  formData: FormData,
): Promise<CreateOrgState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const supabase = await createServerSupabase();
  try {
    // Name only, on purpose: legal name and RFC are not creation facts —
    // they matter the day the organization partners a place or gets paid,
    // and they land on the Organization screen's Identity card instead.
    await apiCreateOrganization(supabase, { name });
  } catch (e) {
    return { error: errMsg(e, "Couldn't create that organization.") };
  }
  // The nav's switcher and every org-scoped list change at once.
  revalidatePath("/", "layout");
  return { error: null };
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
      rfc: String(formData.get("rfc") ?? "").trim().toUpperCase() || null,
    });
  } catch (e) {
    return { error: errMsg(e, "Couldn't save the legal details."), saved: false };
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
  const country = String(formData.get("country") ?? "MX").trim().toUpperCase();
  const entityType = String(formData.get("entityType") ?? "").trim();
  if (!orgId) return { error: "Missing organization.", note: null };
  // The pre-onboarding gate, enforced server-side too: `required` on the
  // select is a courtesy the browser can skip. Only on create — resume mints
  // a link for an account that already carries its answer.
  if (
    String(formData.get("intent") ?? "create") === "create" &&
    !isConnectEntityType(entityType)
  ) {
    return {
      error:
        "Pick the legal entity type first — Stripe asks an individual and a company for different documents.",
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
      ...(entityType ? { entityType } : {}),
    }));
  } catch (e) {
    return { error: errMsg(e, "Couldn't start payment onboarding."), note: null };
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
    return { error: errMsg(e, "Couldn't open the payments dashboard."), note: null };
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
  if (!orgId) return { error: "Missing organization.", email, added: false, mode: null };
  if (!email) {
    return { error: "An email is required.", email, added: false, mode: null };
  }

  const supabase = await createServerSupabase();
  // The invite email's redirect link needs an absolute origin — resolved
  // server-side from the request's own headers (Vercel sets x-forwarded-*
  // in front of the Node runtime) rather than a client-supplied field, so
  // there's nothing here that a spoofed form value could redirect off-site.
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const origin = host ? `${proto}://${host}` : undefined;
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
    const copy = (code && ADD_MEMBER_COPY[code]) ??
      errMsg(e, "Couldn't add that member.");
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
      error: (code && MEMBER_ACTION_COPY[code]) ??
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
      error: (code && MEMBER_ACTION_COPY[code]) ??
        errMsg(e, "Couldn't update that member's role."),
    };
  }
  revalidatePath("/", "layout");
  return { error: null };
}
