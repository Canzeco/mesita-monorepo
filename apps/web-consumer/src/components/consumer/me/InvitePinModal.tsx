"use client";

import { useState } from "react";
import { BadgeCheck, KeyRound } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiClaimInviteCode } from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { classProperLabel, identityForClassKey } from "@/lib/consumer-data";
import { toast } from "@/lib/toast";
import { cn, errMsg } from "@/lib/utils";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";

// The invitation PIN sheet (MESITA-1168) — the TRANSFERABLE door.
//
// This replaces a button that fired a toast saying invitations are by hand and
// then did nothing. The real flow: Mesita hands a partner a batch of PINs, the
// partner gives them out, and the holder redeems here.
//
// TEN DIGITS, and numeric on purpose. A PIN gets read off a card or a
// screenshot in a lobby, so `inputMode="numeric"` raises the phone keypad and
// there is no case or letter/number ambiguity to get wrong. Anything that is
// not a digit is stripped as the guest types, because people paste PINs with
// spaces and dashes in them.
//
// The server answers ONE generic message for unknown, spent and expired PINs so
// this screen cannot be used to discover which 10-digit strings are real. Do
// not "improve" the copy by distinguishing them.

const PIN_LENGTH = 10;

export function InvitePinModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();
  const [code, setCode] = useState("");
  const [claiming, setClaiming] = useState(false);

  const digits = code.replace(/\D/g, "");
  const canClaim = digits.length === PIN_LENGTH && !claiming;

  async function claim() {
    if (!canClaim) return;
    setClaiming(true);
    try {
      const result = await apiClaimInviteCode(supabase, { code: digits });
      // `classKey` is the EFFECTIVE class the server settled on, and it is a
      // legacy key — bridge it rather than comparing it to a metal.
      const label = classProperLabel(identityForClassKey(result.classKey).cls);
      // Full reload so every surface reads the new class from a fresh server
      // seed, the same thing the Instagram claim does on success.
      window.location.href = `${CONSUMER_ROUTES.me}?invite=${encodeURIComponent(label)}`;
    } catch (e) {
      toast(errMsg(e, "That PIN didn't work."));
      setClaiming(false);
    }
  }

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Invitation PIN">
      <div className={cn(SHEET_BODY_CLASS, "pt-3")}>
        <div className="mb-4 flex items-center gap-3">
          <span className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            <KeyRound className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>Invitation PIN</h2>
            <p className="text-muted-foreground text-xs">
              Ten digits. It names your class outright.
            </p>
          </div>
        </div>

        <section className="border-border bg-card rounded-2xl border p-4">
          <label
            htmlFor="invite-pin"
            className="text-muted-foreground type-label block font-medium"
          >
            Your PIN
          </label>
          <input
            id="invite-pin"
            value={digits}
            onChange={(e) => setCode(e.target.value)}
            placeholder="0000000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={PIN_LENGTH}
            data-field-size="lg"
            className="border-border bg-muted/30 placeholder:text-muted-foreground/70 mt-1 h-12 w-full rounded-lg border px-5 text-center font-mono text-lg tracking-[0.3em] tabular-nums outline-none"
          />
          <p className="text-muted-foreground type-label mt-2 text-center">
            {digits.length}/{PIN_LENGTH}
          </p>

          <Button
            type="button"
            size="sm"
            onClick={claim}
            disabled={!canClaim}
            className="mt-3 w-full text-sm font-semibold"
          >
            {claiming ? (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            ) : (
              <BadgeCheck className="h-4 w-4" />
            )}
            {claiming ? "Checking…" : "Redeem"}
          </Button>
        </section>

        <p className="text-muted-foreground type-label mt-3 text-center leading-snug">
          Invitations come from Mesita and its partners. A PIN works once.
        </p>
      </div>
    </LocalSheet>
  );
}
