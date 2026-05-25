"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { COUNTRIES } from "@/lib/consumer-data";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiUpdateConsumerProfile } from "@/lib/api/tickets";
import { errMsg } from "@/lib/utils";
import { Field } from "@/components/shared";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

// Onboarding collects everything beyond the phone, which is already on
// the auth.user from the OTP sign-in step. Country is inferred from the
// phone's dial code on the server side (consumer-update-profile reads it
// from auth.user.phone when the body doesn't carry phone).

export function OnboardForm() {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [name, setName] = useState("");
  const [sex, setSex] = useState("");
  const [birthday, setBirthday] = useState("");
  const [country, setCountry] = useState("Mexico");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !sex || !birthday) {
      setError("Please complete all required fields");
      return;
    }
    if (sex !== "male" && sex !== "female" && sex !== "other") {
      setError("Pick a sex from the list.");
      return;
    }

    setLoading(true);
    void (async () => {
      try {
        await apiUpdateConsumerProfile(supabase, {
          full_name: name.trim(),
          sex,
          birthday,
          country,
        });
        router.push("/discover/swipe");
        router.refresh();
      } catch (err) {
        setError(errMsg(err, "Couldn't save. Try again."));
        setLoading(false);
      }
    })();
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-3">
      <Field label="Name">
        <input
          className={INPUT_CLASS}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Your name"
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
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
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Birthday">
          <input
            type="date"
            className={INPUT_CLASS}
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Country">
        <select
          className={INPUT_CLASS}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          required
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.name}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
      </Field>

      {error && <p className={ERROR_BOX_CLASS}>{error}</p>}

      <div className="mt-auto pt-4">
        <button
          type="submit"
          disabled={loading}
          className={PRIMARY_BUTTON_CLASS}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Continue <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
        <p className="text-muted-foreground mt-3 text-center text-[11px]">
          We use these to personalize recommendations. Your details are never
          shared with venues.
        </p>
      </div>
    </form>
  );
}
