"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiCreateOrganization,
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
