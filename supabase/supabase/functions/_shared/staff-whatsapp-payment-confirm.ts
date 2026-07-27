import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { resetSession } from "./staff-whatsapp-session.ts";
import type { SessionRow, StaffContext } from "./staff-whatsapp-types.ts";
import { sendStaffWhatsAppReply } from "./staff-whatsapp-messages.ts";
import { type TwilioEnv } from "./twilio.ts";
import { closeTicketAndEnqueueReview } from "./ticket-informal.ts";

export async function handleStaffPaymentConfirm(
  admin: SupabaseClient,
  twilio: TwilioEnv,
  staff: StaffContext,
  session: SessionRow,
) {
  if (!session.ticket_id || !session.consumer_id) return;

  const ticket = await admin
    .from("tickets")
    .select("id, status")
    .eq("id", session.ticket_id)
    .maybeSingle();
  if (!ticket.data || ticket.data.status !== "awaiting_payment_confirm") {
    await resetSession(admin, session.id, staff.projectId);
    await sendStaffWhatsAppReply(
      admin,
      twilio,
      staff.phoneE164,
      "No hay un cobro pendiente. Manda el código del siguiente comensal.",
    );
    return;
  }

  const done = await closeTicketAndEnqueueReview(
    admin,
    session.ticket_id,
    session.consumer_id,
    staff.projectId,
  );
  if (!done.ok) {
    await sendStaffWhatsAppReply(admin, twilio, staff.phoneE164, `Error al cerrar: ${done.error}`);
    return;
  }

  await resetSession(admin, session.id, staff.projectId);
  await sendStaffWhatsAppReply(
    admin,
    twilio,
    staff.phoneE164,
    `Pago registrado ✓ Ticket cerrado en ${staff.placeName}.\n` +
      `El comensal ya puede dejar su reseña en la app.\n` +
      `Manda el código del siguiente comensal cuando quieras.`,
  );
}

