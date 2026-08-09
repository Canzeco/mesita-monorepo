import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getTierConfig } from "../_shared/membership.ts";
import { toolError, toolText } from "./rpc.ts";

export async function getProfileTool(
  admin: SupabaseClient,
  consumerId: string,
): Promise<ReturnType<typeof toolText>> {
  const { data: consumer, error } = await admin
    .from("consumers")
    .select(
      "id, code, full_name, first_name, last_name, phone, instagram_handle, class_key, class_origin, consumer_instagram_followers_count, class_expires_at",
    )
    .eq("id", consumerId)
    .maybeSingle();
  if (error) return toolError(error.message);
  if (!consumer) return toolError("Consumer profile not found");
  const classKey = consumer.class_key ?? "standard";
  let tier = null;
  try {
    tier = await getTierConfig(admin, classKey);
  } catch {
    tier = null;
  }
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", consumerId)
    .eq("is_test", false)
    .gte("created_at", monthStart.toISOString())
    .neq("status", "cancelled");
  return toolText({
    ok: true,
    consumer,
    class: {
      key: classKey,
      origin: consumer.class_origin ?? "default",
      label: tier?.label ?? "Standard",
      followers: consumer.consumer_instagram_followers_count ?? null,
      expires_at: consumer.class_expires_at ?? null,
      usage: {
        reservations_used: count ?? 0,
        reservations_limit: tier?.monthly_reservation_limit ?? null,
      },
    },
  });
}
