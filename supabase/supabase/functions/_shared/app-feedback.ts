// MESITA-3029: a guest's feedback about the app itself (Settings › Send
// feedback), not tied to a place. Append-only, public.app_feedback.
//
// The note is trimmed, required, and at most 1,000 characters: the CHECK on
// app_feedback.note.

export const APP_FEEDBACK_NOTE_MAX = 1000;

export function parseAppFeedback(
  body: Record<string, unknown>,
): { ok: true; note: string } | { ok: false; error: string } {
  const raw = body.note;
  if (typeof raw !== "string") return { ok: false, error: "note_required" };
  const note = raw.trim();
  if (note === "") return { ok: false, error: "note_required" };
  if (note.length > APP_FEEDBACK_NOTE_MAX) {
    return {
      ok: false,
      error: `note must be at most ${APP_FEEDBACK_NOTE_MAX} characters`,
    };
  }
  return { ok: true, note };
}
