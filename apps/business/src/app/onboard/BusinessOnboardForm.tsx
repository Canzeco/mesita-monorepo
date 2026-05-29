"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiCreateBusinessProfile } from "@/lib/api/business";
import { Field } from "@/components/shared";
import { cn, errMsg } from "@/lib/utils";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

// Business onboard captures first + last name so contracts and
// reservation outreach can address the signer correctly. Phone is the
// auth identity and gets mirrored into businesses.phone by the EF
// from auth.user.phone.
export function BusinessOnboardForm() {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    // Read from the DOM (FormData) as the source of truth, not just React
    // state — browser autofill can populate the inputs without firing
    // onChange, which previously sent an empty body and got "Nothing to
    // update". DOM values win, with state as the fallback.
    const fd = new FormData(e.currentTarget);
    const first = ((fd.get("first_name") as string | null) ?? firstName).trim();
    const last = ((fd.get("last_name") as string | null) ?? lastName).trim();
    if (!first || !last) {
      setError("Tell us your first + last name so we know who's onboarding.");
      return;
    }
    setPending(true);
    void (async () => {
      try {
        await apiCreateBusinessProfile(supabase, {
          first_name: first,
          last_name: last,
        });
        router.push("/central");
        router.refresh();
      } catch (err) {
        setError(errMsg(err, "Couldn't save. Try again."));
        setPending(false);
      }
    })();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" required>
          <input
            name="first_name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={60}
            autoComplete="given-name"
            placeholder="Iván"
            className={INPUT_CLASS}
            required
          />
        </Field>
        <Field label="Last name" required>
          <input
            name="last_name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={60}
            autoComplete="family-name"
            placeholder="Solís"
            className={INPUT_CLASS}
            required
          />
        </Field>
      </div>

      {error && <p className={ERROR_BOX_CLASS}>{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className={cn(PRIMARY_BUTTON_CLASS, "mt-2")}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Continue <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
