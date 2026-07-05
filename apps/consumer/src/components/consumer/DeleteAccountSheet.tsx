"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { Spinner } from "@/components/shared/Spinner";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiDeleteConsumerAccount } from "@/lib/api/profile";

// Destructive confirm sheet for Settings → Privacy & data → Delete account.
// Type-to-confirm ("DELETE") gates the real consumer-web-delete-account call;
// on success the dead session is cleared locally and the app hard-navigates
// to /. The privacy@ mailto stays in the copy as the manual fallback path.

const CONFIRM_WORD = "DELETE";
const PRIVACY_EMAIL = "privacy@mesita.ai";

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
    <LocalSheet open={open} onClose={onClose} ariaLabel="Delete account">
      <div className="scrollbar-hide min-h-0 overflow-y-auto p-5 pt-3">
        <div className="flex items-start gap-3">
          <span className="bg-destructive/10 text-destructive flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            <Trash2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Delete account
            </h2>
            <p className="text-muted-foreground text-[12px]">
              This is permanent and can&apos;t be undone.
            </p>
          </div>
        </div>

        <p className="text-muted-foreground mt-4 text-[13px] leading-snug">
          Your profile, tickets, reservations and rewards will be permanently
          deleted, and your sign-in will stop working immediately. If you&apos;d
          rather we handle it manually, email{" "}
          <a
            href={`mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent(
              "Delete my Mesita account",
            )}`}
            className="text-secondary underline underline-offset-2"
          >
            {PRIVACY_EMAIL}
          </a>
          .
        </p>

        <p className="mt-4 text-[13px] font-medium">
          Type <span className="text-destructive font-mono">{CONFIRM_WORD}</span>{" "}
          to confirm:
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
            className="border-border bg-card hover:bg-muted flex-1 rounded-lg border py-3 text-sm font-semibold transition"
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
              <Trash2 className="h-4 w-4" />
            )}
            {deleting ? "Deleting…" : "Delete forever"}
          </button>
        </div>
      </div>
    </LocalSheet>
  );
}
