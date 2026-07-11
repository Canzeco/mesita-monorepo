"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

// Phone-OTP sign-in for operators allowlisted by phone (public.super_admins
// .phone) rather than a Google account. Two steps — phone → 6-digit code —
// mirroring the consumer flow: signInWithOtp() then verifyOtp(). Defaults to
// +52 (Mexico); type a full +<country><number> to override. The (app) layout
// runs the super_admins check after the session cookie lands, so a
// non-allowlisted number falls through to the "not authorised" empty state.

type Step = "phone" | "code";

export function PhoneOtpForm() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [rawPhone, setRawPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const e164 = useMemo(() => toE164(rawPhone), [rawPhone]);

  const sendCode = async () => {
    setError(null);
    setInfo(null);
    if (!e164) {
      setError("Enter your phone number.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { error: sendError } = await supabase.auth.signInWithOtp({
        phone: e164,
      });
      if (sendError) {
        setError(sendError.message);
        return;
      }
      setStep("code");
      setInfo(`We sent a 6-digit code to ${e164}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setError(null);
    setInfo(null);
    const token = code.replace(/\D/g, "");
    if (token.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: e164,
        token,
        type: "sms",
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }
      // Root re-routes signed-in operators to /central; the (app) layout
      // then runs the super_admins allowlist check. Refresh so SSR sees the
      // freshly-set session cookie.
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the code.");
      setLoading(false);
    }
  };

  if (step === "phone") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendCode();
        }}
        className="flex flex-col gap-2"
      >
        <label className="block">
          <span className="text-muted-foreground mb-1.5 block text-xs font-medium">
            Phone number
          </span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={rawPhone}
            onChange={(e) => setRawPhone(e.target.value)}
            placeholder="+52 444 549 9597"
            className="border-border bg-background focus:ring-foreground/20 h-11 w-full rounded-full border px-4 text-sm outline-none focus:ring-2"
            required
          />
        </label>
        <p className="text-muted-foreground text-[11px]">
          Defaults to +52 (Mexico) — type a full <code>+</code> number to
          override. Allowlisted numbers only.
        </p>
        {error && (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs leading-relaxed">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !rawPhone.trim()}
          className="border-border bg-background hover:bg-muted mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-semibold transition disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
          Send code
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void verifyCode();
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setCode("");
            setError(null);
            setInfo(null);
          }}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-semibold transition"
        >
          <ArrowLeft className="h-3 w-3" />
          Change number
        </button>
        <span className="text-muted-foreground text-xs">{e164}</span>
      </div>
      <label className="block">
        <span className="text-muted-foreground mb-1.5 block text-xs font-medium">
          6-digit code
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className="border-border bg-background focus:ring-foreground/20 h-11 w-full rounded-full border px-4 text-center text-lg tracking-[0.5em] outline-none focus:ring-2"
          autoFocus
          required
        />
      </label>
      {info && (
        <p className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-xs leading-relaxed">
          {info}
        </p>
      )}
      {error && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs leading-relaxed">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="bg-foreground text-background mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
      </button>
      <button
        type="button"
        onClick={() => void sendCode()}
        disabled={loading}
        className="text-muted-foreground hover:text-foreground h-9 text-center text-xs font-semibold transition disabled:opacity-50"
      >
        Didn&apos;t get it? Resend code
      </button>
    </form>
  );
}

// Supabase Auth requires strict E.164 (leading +, digits only). Bare
// national digits default to the Mexico dial code (+52); a leading + is
// taken verbatim.
function toE164(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return `+52${digits}`;
}
