"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiCreateManagerProfile } from "@/lib/api/manager";
import { Field } from "@/components/shared";
import { cn, errMsg } from "@/lib/utils";
import {
  ERROR_BOX_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";

// Manager onboard only needs full_name — phone is the auth identity and
// gets mirrored into managers.phone by the EF from auth.user.phone.
export function ManagerOnboardForm() {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [fullName, setFullName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = fullName.trim();
    if (!trimmed) {
      setError("Tell us your name so we know who's onboarding.");
      return;
    }
    setPending(true);
    void (async () => {
      try {
        await apiCreateManagerProfile(supabase, { full_name: trimmed });
        router.push("/add");
        router.refresh();
      } catch (err) {
        setError(errMsg(err, "Couldn't save. Try again."));
        setPending(false);
      }
    })();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Your name" required>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={120}
          autoComplete="name"
          placeholder="e.g. Iván Solís"
          className={INPUT_CLASS}
          required
        />
      </Field>

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
            Continue to venue setup <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
      <button
        type="button"
        onClick={() => router.push("/")}
        disabled={pending}
        className="text-muted-foreground/80 hover:text-foreground mt-1 block w-full text-center text-[11px] underline-offset-2 hover:underline"
      >
        Skip for now — set up the venue later
      </button>
    </form>
  );
}
