// Ticket proof screenshots (MESITA-1030). The Google review and Instagram
// story tasks take a screenshot as their proof — the guest uploads it to the
// public `ticket-proofs` bucket under their own folder (RLS-enforced, same
// house pattern as consumer-avatars) and submits the public URL here.
//
// Verification posture is UNCHANGED from MESITA-849: nothing inspects the
// image, the submission still self-attests (`self_verified`). The screenshot
// is the audit artifact — "just post whatever screenshot and it's done".
// This validator only stops the one thing that would be a real bug: an
// arbitrary remote URL (or someone else's object) landing on the ticket row.

export const TICKET_PROOFS_BUCKET = "ticket-proofs";

export function parseProofScreenshotUrl(
  raw: unknown,
  supabaseUrl: string,
  userId: string,
):
  | { ok: true; url: string | null }
  | { ok: false; error: string } {
  // Optional for now: deployed web/mobile builds still call without it.
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, url: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "screenshotUrl must be a string" };
  }
  const trimmed = raw.trim();
  const base = supabaseUrl.replace(/\/+$/, "");
  const prefix =
    `${base}/storage/v1/object/public/${TICKET_PROOFS_BUCKET}/${userId}/`;
  if (
    !trimmed.startsWith(prefix) ||
    trimmed.includes("..") ||
    trimmed.length > 600
  ) {
    return {
      ok: false,
      error: "screenshotUrl must be a Mesita proof upload for this account",
    };
  }
  return { ok: true, url: trimmed };
}
