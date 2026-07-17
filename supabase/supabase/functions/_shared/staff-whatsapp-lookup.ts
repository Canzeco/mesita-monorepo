import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { displayConsumerCode } from "./consumer-code.ts";
import {
  guestRewardContext,
  loadPlaceOpsRow,
} from "./staff-place-ops.ts";
import { sendStaffWhatsAppReply } from "./staff-whatsapp-messages.ts";
import type { SessionRow, StaffContext } from "./staff-whatsapp-types.ts";
import type { ConsumerRow } from "./ticket-informal.ts";
import type { TwilioEnv } from "./twilio.ts";

export async function handleLookupCode(
  admin: SupabaseClient,
  twilio: TwilioEnv,
  staff: StaffContext,
  session: SessionRow,
  code: string,
  opts?: { skipBillHint?: boolean },
): Promise<SessionRow | null> {
  const consumerRes = await admin
    .from("consumers")
    .select(
      "id, code, full_name, first_name, last_name, class_key, class_origin, consumer_instagram_followers_count, phone",
    )
    .eq("code", code)
    .maybeSingle();
  if (consumerRes.error || !consumerRes.data) {
    await reply(
      admin,
      twilio,
      staff.phoneE164,
      `No encontré comensal con el código ${displayConsumerCode(code)}. Revísalo e inténtalo de nuevo.`,
    );
    return null;
  }
  const c = consumerRes.data as ConsumerRow;
  const placeRow = await loadPlaceOpsRow(admin, staff.projectId);
  if (!placeRow) {
    await reply(admin, twilio, staff.phoneE164, "No encontré el restaurante.");
    return null;
  }
  const placeOps = await guestRewardContext(
    admin,
    placeRow,
    c.id,
    c.class_key,
  );

  const subRes = await admin
    .from("consumer_subscriptions")
    .select("status, current_period_end")
    .eq("consumer_id", c.id)
    .eq("status", "active")
    .maybeSingle();

  const name = c.full_name ||
    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
    "Guest";
  const tier = c.class_key ?? "free";
  const ig = c.consumer_instagram_followers_count;
  const igLine = ig != null ? `\nInstagram followers: ${ig}` : "";
  const subLine = subRes.data
    ? `\nSubscription: active`
    : `\nSubscription: none (${c.class_origin ?? "default"})`;

  const guestBlock =
    `Comensal verificado ✓\n` +
    `Código: ${displayConsumerCode(code)}\n` +
    `Nombre: ${name}\n` +
    `Nivel: ${tier}${igLine}${subLine}\n` +
    `Unidad: ${staff.placeName}\n` +
    `${placeOps.rewardLine}\n`;

  if (!placeOps.ops.ok) {
    await admin
      .from("staff_whatsapp_sessions")
      .update({
        state: "idle",
        consumer_id: null,
        pending_consumer_code: code,
        ticket_id: null,
        context: {
          consumer_preview: { name, tier },
          ops_block: placeOps.ops,
        },
      })
      .eq("id", session.id);

    await reply(
      admin,
      twilio,
      staff.phoneE164,
      guestBlock +
        `\n⚠️ No puedes abrir ticket con descuento aquí:\n${placeOps.ops.staffMessage}`,
    );
    return null;
  }

  const updated = await admin
    .from("staff_whatsapp_sessions")
    .update({
      state: "consumer_identified",
      consumer_id: c.id,
      pending_consumer_code: code,
      ticket_id: null,
      context: {
        consumer_preview: { name, tier },
        pending_bill: {},
        ops_ok: true,
      },
    })
    .eq("id", session.id)
    .select("*")
    .single();
  if (updated.error) {
    await reply(admin, twilio, staff.phoneE164, "Error al guardar la sesión.");
    return null;
  }

  const billHint = opts?.skipBillHint
    ? ""
    : `\n\nManda la cuenta aquí (ej. SUBTOTAL 850, luego PROPINA 100).\n` +
      `Al terminar, el comensal recibe la notificación en la app Mesita → Pay.`;

  await reply(
    admin,
    twilio,
    staff.phoneE164,
    guestBlock +
      `(El descuento aplica solo en este local.)` +
      billHint,
  );

  return updated.data as SessionRow;
}

async function reply(
  admin: SupabaseClient,
  twilio: TwilioEnv,
  to: string,
  body: string,
) {
  await sendStaffWhatsAppReply(admin, twilio, to, body);
}
