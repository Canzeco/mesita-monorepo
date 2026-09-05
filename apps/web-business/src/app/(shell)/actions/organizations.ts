"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiCreateOrganization } from "@/lib/api/organizations";
import { errMsg } from "@/lib/utils";

export type CreateOrgState = { error: string | null };

export async function createOrganizationAction(
  _prev: CreateOrgState,
  formData: FormData,
): Promise<CreateOrgState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const supabase = await createServerSupabase();
  try {
    await apiCreateOrganization(supabase, {
      name,
      legalName: String(formData.get("legalName") ?? "").trim() || null,
      rfc: String(formData.get("rfc") ?? "").trim().toUpperCase() || null,
    });
  } catch (e) {
    return { error: errMsg(e, "Couldn't create that organization.") };
  }
  // The nav's switcher and every org-scoped list change at once.
  revalidatePath("/", "layout");
  return { error: null };
}
