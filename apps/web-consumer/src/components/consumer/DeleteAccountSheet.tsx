"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { Spinner } from "@/components/shared";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiDeleteConsumerAccount } from "@/lib/api/profile";
import { MESITA_PRIVACY_EMAIL } from "@/lib/mesita-contact";
import { SHEET_TITLE_CLASS, SHEET_BODY_CLASS, SHEET_CANCEL_BUTTON_CLASS } from "@/lib/ui-classes";

// Destructive confirm DIALOG for Settings → Privacy & data → Delete account.
//
// A confirm is a dialog, not a sheet (decision: Pato, 2026-08-22). Sheets are
// a fixed 80% of the card now, and this surface is a paragraph, one field and
// two buttons — in a sheet it would be more than half empty, which is the
// "fixed tall empty panel" the design law names. The centred dialog is sized
// by its content, so the question and the two answers sit together with
// nothing between them. It reads as a stop, which is what it is.
// Type-to-confirm ("DELETE") gates the real consumer-web-delete-account call;
// on success the dead session is cleared locally and the app hard-navigates
// to /. The privacy@ mailto stays in the copy as the manual fallback path.

const CONFIRM_WORD = "DELETE";

export function DeleteAccountSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const armed = confirm.trim().toUpperCase() === CONFIRM_WORD && !deleting;

  async function deleteAccount() {
    if (!armed) return;
    setDeleting(true);
    try {
      await apiDeleteConsumerAccount(supabase);
      // The auth user is gone server-side; clear the local session (best
      // effort — it may already be invalid) and leave the app entirely.
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      window.location.href = "/";
    } catch (e) {
      toast(errMsg(e, "Couldn't delete your account — try again."));
      setDeleting(false);
    }
  }

  return (
    <LocalDialog open={open} onClose={onClose} ariaLabel="Delete account">
      <div className={cn(SHEET_BODY_CLASS, "overflow-y-auto")}>
        <div className="flex items-start gap-3">
          <span className="bg-destructive/10 text-destructive flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            <Trash2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>Delete account</h2>
            <p className="text-muted-foreground text-xs">
              This is permanent and can&apos;t be undone.
            </p>
          </div>
        </div>

        <p className="text-muted-foreground type-body mt-4 leading-snug">
          Your profile, tickets, reservations and rewards will be permanently
          deleted, and your sign-in will stop working immediately. If you&apos;d
          rather we handle it manually, email{" "}
          <a
            href={`mailto:${MESITA_PRIVACY_EMAIL}?subject=${encodeURIComponent(
              "Delete my Mesita account",
            )}`}
            className="text-secondary underline underline-offset-2"
          >
            {MESITA_PRIVACY_EMAIL}
          </a>
          .
        </p>

        <p className="type-body mt-4 font-medium">
          Type{" "}
          <span className="text-destructive font-mono">{CONFIRM_WORD}</span> to
          confirm:
        </p>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={CONFIRM_WORD}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="border-border bg-muted/30 placeholder:text-muted-foreground/50 mt-2 h-12 w-full rounded-lg border px-5 text-center font-mono text-sm tracking-widest outline-none"
          maxLength={CONFIRM_WORD.length}
        />

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className={SHEET_CANCEL_BUTTON_CLASS}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={!armed}
            className="bg-destructive flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition disabled:opacity-60"
          >
            {deleting ? (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
            {deleting ? "Deleting…" : "Delete forever"}
          </button>
        </div>
      </div>
    </LocalDialog>
  );
}
