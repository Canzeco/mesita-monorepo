import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { recordMembershipStrike } from "./membership-enforcement.ts";
import { sendStaffWhatsAppReply } from "./staff-whatsapp-messages.ts";
import { resetSession } from "./staff-whatsapp-session.ts";
import type { SessionRow, StaffContext, StaffPlace } from "./staff-whatsapp-types.ts";
import type { TwilioEnv } from "./twilio.ts";

function strikeConsequenceNote(consequence: string): string {
  if (consequence === "warning_retest") {
    return "\n\n⚠️ Strike 1 — aviso. Vuelve a mandar el test ping desde Team.";
  }
  if (consequence === "pause_30d") {
    return "\n\n⚠️ Strike 2 — promos pausadas 30 días.";
  }
  return "\n\n⚠️ Strike 3 — membresía removida. El local sigue listado sin promos.";
}

export async function handleStaffCancel(opts: {
  admin: SupabaseClient;
  twilio: TwilioEnv;
  staff: StaffContext;
  session: SessionRow;
  places: StaffPlace[];
}): Promise<void> {
  const { admin, twilio, staff, session, places } = opts;
  const hadGuest =
    !!session.consumer_id &&
    session.state !== "idle" &&
    session.state !== "selecting_project";
  let strikeNote = "";

  if (hadGuest && session.consumer_id) {
    const strike = await recordMembershipStrike(admin, {
      projectId: staff.projectId,
      reason: "ignored_qr",
      consumerId: session.consumer_id,
      ticketId: session.ticket_id,
      notes: "staff WhatsApp cancel after guest identified",
    });
    if (strike.ok && !strike.alreadyRecorded) {
      strikeNote = strikeConsequenceNote(strike.consequence);
    }
  }

  await resetSession(admin, session.id, staff.projectId);
  await sendStaffWhatsAppReply(
    admin,
    twilio,
    staff.phoneE164,
    `Sesión reiniciada en ${staff.placeName}.\nCuando tengas un comensal, manda su código (0000-0000).\n` +
      (places.length > 1 ? "Escribe cambiar unidad para moverte a otro local." : "") +
      strikeNote,
  );
}
