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

// Onboarding collects the minimum beyond the phone (already on the
// auth.user from the OTP sign-in step): first name, last name, sex,
// birthday.
//
// Last name is REQUIRED, not cosmetic: reservations are placed with the
// venue under the guest's full name (the host system keys on "last name +
// party size"), and the reservation agent reads consumers.full_name, which
// this EF derives from first + last. A first-name-only profile books a
// table nobody can find.
//
// `initial` prefills from the stored profile so a consumer who onboarded
// before the last-name requirement only has to fill the one missing field
// instead of re-typing everything.

export type OnboardInitialValues = {
  firstName: string;
  lastName: string;
  sex: string;
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
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [sex, setSex] = useState(initial?.sex ?? "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    // Read from the DOM (FormData) as the source of truth, not just React
    // state — browser autofill can populate the name input without firing
    // onChange, which previously sent a null name and bounced back to
    // /onboard (full_name gate). DOM value wins, with state as the fallback.
    const fd = new FormData(e.currentTarget);
    const first = ((fd.get("first_name") as string | null) ?? firstName).trim();
    const last = ((fd.get("last_name") as string | null) ?? lastName).trim();
    if (!first || !last || !sex || !birthday) {
      setError("Please complete all required fields");
      return;
    }
    if (sex !== "male" && sex !== "female") {
      setError("Pick a sex from the list.");
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
          last_name: last,
          sex,
          birthday,
        });
        router.push(safeNextPath(next) ?? CONSUMER_ROUTES.search);
        router.refresh();
      } catch (err) {
        setError(errMsg(err, "Couldn't save. Try again."));
        setLoading(false);
      }
    })();
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
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

        <Field label="Last name">
          <input
            name="last_name"
            className={INPUT_CLASS}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={60}
            placeholder="Last name"
            autoComplete="family-name"
            required
          />
        </Field>
      </div>

      <Field label="Sex">
        <select
          className={INPUT_CLASS}
          value={sex}
          onChange={(e) => setSex(e.target.value)}
          required
        >
          <option value="">Select</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
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
        <p className="text-muted-foreground type-label mt-3 text-center">
          We use these to personalize recommendations. Only your name is shared
          with a place — it&apos;s the name your reservation is booked under.
        </p>
      </div>
    </form>
  );
}
