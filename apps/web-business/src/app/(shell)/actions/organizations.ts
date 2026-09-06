"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiCreateOrganization,
  apiGetPaymentDashboardLink,
  apiStartPaymentOnboarding,
  apiUpdateOrganization,
} from "@/lib/api/organizations";
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
  if (!orgId) return { error: "Missing organization.", note: null };

  const supabase = await createServerSupabase();
  let url: string | null = null;
  let mock = false;
  try {
    ({ url, mock } = await apiStartPaymentOnboarding(supabase, {
      orgId,
      country,
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
