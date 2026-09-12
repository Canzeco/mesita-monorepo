"use client";

import { useState } from "react";
import { BadgeCheck, KeyRound } from "lucide-react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { PIN_LENGTH, PinField } from "@/components/consumer/PinField";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiClaimInviteCode } from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { classProperLabel, identityForClassKey } from "@/lib/consumer-data";
import { errMsg } from "@/lib/utils";

// The invitation PIN sheet (MESITA-1168) — the TRANSFERABLE door.
//
// This replaces a button that fired a toast saying invitations are by hand and
// then did nothing. The real flow: Mesita hands a partner a batch of PINs, the
// partner gives them out, and the holder redeems here.
//
// THE FIELD LIVES IN `PinField` NOW (MESITA-1672). Ten digits, numeric,
// non-digits stripped as you type — all of it moved out because Credits
// gifting redeems a 10-digit code too, and its screen is a public route
// rather than a sheet. What stays here is what is specific to an INVITATION:
// the EF it calls and the class it grants.
//
// The failure moved with it, from a toast to an inline error. A toast at
// z-140 is not reliably announced and cannot be re-read while you check your
// typing, which is exactly what someone does after a code is rejected.
//
// The server answers ONE generic message for unknown, spent and expired PINs so
// this screen cannot be used to discover which 10-digit strings are real. Do
// not "improve" the copy by distinguishing them.

export function InvitePinModal() {
  const supabase = useBrowserSupabase();
  const [digits, setDigits] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canClaim = digits.length === PIN_LENGTH && !claiming;

  async function claim() {
    if (!canClaim) return;
    setClaiming(true);
    setError(null);
    try {
      const result = await apiClaimInviteCode(supabase, { code: digits });
      // `classKey` is the EFFECTIVE class the server settled on, and it is a
      // legacy key — bridge it rather than comparing it to a metal.
      const label = classProperLabel(identityForClassKey(result.classKey).cls);
      // Full reload so every surface reads the new class from a fresh server
      // seed, the same thing the Instagram claim does on success.
      window.location.href = `${CONSUMER_ROUTES.me}?invite=${encodeURIComponent(label)}`;
    } catch (e) {
      setError(errMsg(e, "That PIN didn't work."));
      setClaiming(false);
    }
  }

  return (
    <MeScreen title="Invitation PIN">
      <div className="mb-4 flex items-center gap-3">
        <span className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
          <KeyRound className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-muted-foreground text-xs">
          Ten digits. It names your class outright.
        </p>
      </div>

        <section className="border-border bg-card rounded-2xl border p-4">
          <PinField
            id="invite-pin"
            label="Your PIN"
            value={digits}
            onChange={setDigits}
            error={error}
            disabled={claiming}
          />

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
    </MeScreen>
  );
}
