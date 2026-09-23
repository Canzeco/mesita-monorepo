import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { diamondLabel, isDiamond } from "../_shared/diamond.ts";
import { getTierConfig, perkClassKey } from "../_shared/membership.ts";
import { toolError, toolText } from "./rpc.ts";

export async function getProfileTool(
  admin: SupabaseClient,
  consumerId: string,
): Promise<ReturnType<typeof toolText>> {
  const { data: consumer, error } = await admin
    .from("consumers")
    .select(
      "id, code, full_name, first_name, last_name, phone, instagram_handle, class_key, class_origin, plan, instagram_followers_count, class_expires_at",
    )
    .eq("id", consumerId)
    .maybeSingle();
  if (error) return toolError(error.message);
  if (!consumer) return toolError("Consumer profile not found");
  const classKey = consumer.class_key ?? "bronze";
  let tier = null;
  try {
    // Perk row, the same one consumer-web-get-profile reads (a Premium plan
    // at the base shares the elevated reservation cap).
    tier = await getTierConfig(admin, perkClassKey(classKey, consumer.plan));
  } catch {
    tier = null;
  }
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("reservation_tickets")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", consumerId)
    .eq("is_test", false)
    .gte("created_at", monthStart.toISOString())
    .neq("state", "cancelled");
  return toolText({
    ok: true,
    consumer,
    // The guest is Diamond or not (MESITA-2044, MESITA-2046). `class.key` is
    // the storage name; `diamond` and `label` are what an assistant should
    // say. `label` is never a metal.
    diamond: isDiamond(classKey),
    class: {
      key: classKey,
      origin: consumer.class_origin ?? "default",
      plan: consumer.plan ?? "free",
      label: diamondLabel(classKey),
      followers: consumer.instagram_followers_count ?? null,
      expires_at: consumer.class_expires_at ?? null,
      usage: {
        reservations_used: count ?? 0,
        reservations_limit: tier?.monthly_reservation_limit ?? null,
      },
    },
  });
}
