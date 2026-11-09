// Feedback about the app itself, not a place (MESITA-3029): Settings › Your
// account › Send feedback stores it through consumer-web-send-feedback. Every
// send is its own row; admin reads them on Activity › Feedback. A place's
// problems go through the place screen's three dots (reports.ts).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

/** The CHECK on app_feedback.note (supabase/.../_shared/app-feedback.ts). */
export const APP_FEEDBACK_NOTE_MAX = 1000;

export async function apiSendFeedback(
  client: SupabaseClient,
  note: string,
): Promise<void> {
  await invokeEF<Record<string, never>>(client, "consumer-web-send-feedback", {
    note: note.trim(),
  });
}
