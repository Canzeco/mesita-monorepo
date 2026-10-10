// What the owner sees the moment Stripe sends them back.
//
// `?connect=return` and `?connect=refresh` were on the Account Link from the
// start and NOTHING read them (MESITA-1645) — the only references in the repo
// were the legacy place flow WRITING them. So an owner spent eight minutes
// uploading documents to Stripe, got redirected here, and landed on an
// unchanged screen with a stale pill and no acknowledgement that anything had
// happened. The two cases are different and both need saying:
//
//   return  — they finished or saved for later. The mirror converges by
//             webhook, so the pill may still be behind; say so rather than
//             letting a stale badge answer for us.
//   refresh — the link expired or they backed out. Account Links are
//             single-use; the fix is to press Resume, not to wonder.
export function ConnectReturnNotice({ connect }: { connect?: string }) {
  if (connect !== "return" && connect !== "refresh") return null;
  const returning = connect === "return";
  return (
    <div
      role="status"
      className="border-border bg-muted/40 text-foreground rounded-2xl border px-4 py-3 text-sm leading-relaxed"
    >
      {returning
        ? "Thanks — Stripe has what you sent and is checking it. This can take a few minutes, and the status below updates on its own."
        : "That Stripe link expired. Press Resume onboarding to pick up where you left off — nothing you already sent was lost."}
    </div>
  );
}
