"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiUpdateConsumerProfile } from "@/lib/api/profile";
import { ageFromBirthday, errMsg, MIN_SIGNUP_AGE } from "@/lib/utils";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { safeNextPath } from "@/lib/auth-redirect";
import { BirthdayPicker, Field, Spinner } from "@/components/shared";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

// Onboarding collects TWO things beyond the phone (already on the auth.user
// from the OTP step): first name and birthday. See `consumer-onboarding.ts`
// for why the set shrank from four (MESITA-1806) — briefly:
//
//   • first name — the app greets you by it, and it is the half of the name
//     every surface renders.
//   • birthday   — MIN_SIGNUP_AGE is a ToS floor, and an age gate is only
//     worth anything at account creation.
//
// LAST NAME IS NOT HERE, and that is not the same as "not required". It is
// asked by ReservationSheet, at the moment the guest can see why: the place
// books the table under their full name. Asking for it here bought nothing
// and cost a field in front of someone who hadn't seen a place yet.
//
// SEX IS NOT HERE EITHER — it is segmentation, nothing downstream reads it to
// work, and it stays editable on /me/profile.
//
// `initial` prefills from the stored profile so a returning half-onboarded
// consumer fills the one missing field instead of re-typing everything.

export type OnboardInitialValues = {
  firstName: string;
  birthday: string;
};

export function OnboardForm({
  initial,
  // Where the guest was heading when the profile gate caught them. Null
  // for a plain sign-up, which lands on the default home tab.
  next,
}: {
  initial?: OnboardInitialValues;
  next?: string | null;
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    // Read from the DOM (FormData) as the source of truth, not just React
    // state — browser autofill can populate the name input without firing
    // onChange, which previously sent a null name and bounced back to
    // /onboard (the shell gate). DOM value wins, with state as the fallback.
    const fd = new FormData(e.currentTarget);
    const first = ((fd.get("first_name") as string | null) ?? firstName).trim();
    if (!first || !birthday) {
      setError("Please complete all required fields");
      return;
    }
    // Age gate — 13 or below is restricted (MESITA-727).
    const age = ageFromBirthday(birthday);
    if (age === null || age < MIN_SIGNUP_AGE) {
      setError(`You must be at least ${MIN_SIGNUP_AGE} to use Mesita.`);
      return;
    }

    setLoading(true);
    void (async () => {
      try {
        await apiUpdateConsumerProfile(supabase, {
          first_name: first,
          birthday,
        });
        router.push(safeNextPath(next) ?? CONSUMER_ROUTES.discoverDefault);
        router.refresh();
      } catch (err) {
        setError(errMsg(err, "Couldn't save. Try again."));
        setLoading(false);
      }
    })();
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-3">
      <Field label="First name">
        <input
          name="first_name"
          className={INPUT_CLASS}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          maxLength={60}
          placeholder="First name"
          autoComplete="given-name"
          required
        />
      </Field>

      <Field label="Birthday">
        <BirthdayPicker value={birthday} onChange={setBirthday} />
      </Field>

      {error && <p className={ERROR_BOX_CLASS}>{error}</p>}

      <div className="mt-auto pt-4">
        <button
          type="submit"
          disabled={loading}
          className={PRIMARY_BUTTON_CLASS}
        >
          {loading ? (
            <Spinner size="sm" className="border-white/40 border-t-white" />
          ) : (
            <>
              Continue <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
        <p className="text-muted-foreground type-body mt-3 text-center">
          Your birthday stays private — we use it to check you&apos;re old
          enough and to personalize recommendations.
        </p>
      </div>
    </form>
  );
}
