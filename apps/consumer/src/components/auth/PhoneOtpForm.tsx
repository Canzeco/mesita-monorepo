"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { COUNTRY_BY_CODE } from "@/lib/consumer-data";
import { PhoneInputWithCountry } from "./PhoneInputWithCountry";
import {
  ERROR_BOX_CLASS,
  INFO_BOX_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// Two-step phone OTP. Phone is the identity — there's no "create account"
// vs "sign in" anymore; first verify on a number creates the auth.user,
// subsequent verifies sign that user in. Single flow for both consumer and
// manager surfaces — the parent passes the post-verify redirect.

type Step = "phone" | "code";

export function PhoneOtpForm({ redirectAfter }: { redirectAfter: string }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("MX");
  const [localPhone, setLocalPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const e164 = useMemo(
    () => buildE164(countryCode, localPhone),
    [countryCode, localPhone],
  );

  const sendCode = async () => {
    setError(null);
    setInfo(null);
    if (!e164) {
      setError("Enter your phone number.");
      return;
    }
    setLoading(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      phone: e164,
    });
    setLoading(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setStep("code");
    setInfo("We just sent you a 6-digit code.");
  };

  const verifyCode = async () => {
    setError(null);
    setInfo(null);
    const token = code.replace(/\D/g, "");
    if (token.length !== 6) {
      setError("Enter the 6-digit code we sent you.");
      return;
    }
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: e164,
      token,
      type: "sms",
    });
    if (verifyError) {
      setLoading(false);
      setError(verifyError.message);
      return;
    }
    // Force a server-side re-render so SSR pages see the new cookie.
    router.push(redirectAfter);
    router.refresh();
  };

  if (step === "phone") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendCode();
        }}
        className="flex flex-col gap-3"
      >
        <label className="block">
          <span className="text-muted-foreground mb-1.5 block text-xs font-medium">
            Phone number
          </span>
          <PhoneInputWithCountry
            value={localPhone}
            onChange={setLocalPhone}
            countryCode={countryCode}
            onCountryChange={setCountryCode}
            placeholder="55 1234 5678"
            required
          />
        </label>

        <p className="text-muted-foreground text-[11px]">
          We&apos;ll text you a 6-digit code. Standard SMS rates may apply.
        </p>

        {error && <p className={ERROR_BOX_CLASS}>{error}</p>}

        <button
          type="submit"
          disabled={loading || !localPhone.trim()}
          className={cn(PRIMARY_BUTTON_CLASS, "mt-2")}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <MessageCircle className="h-4 w-4" />
              Send code
            </>
          )}
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
      className="flex flex-col gap-3"
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
          className={cn(INPUT_CLASS, "text-center text-lg tracking-[0.5em]")}
          autoFocus
          required
        />
      </label>

      {info && <p className={INFO_BOX_CLASS}>{info}</p>}
      {error && <p className={ERROR_BOX_CLASS}>{error}</p>}

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className={cn(PRIMARY_BUTTON_CLASS, "mt-2")}
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

// Supabase Auth requires strict E.164 (no spaces, no dashes, leading +).
// PhoneInputWithCountry keeps the dial code separate, so we re-combine it
// here from the country meta + the local subscriber digits.
function buildE164(countryCode: string, local: string): string {
  const country = COUNTRY_BY_CODE[countryCode] ?? COUNTRY_BY_CODE.MX;
  const digits = local.replace(/\D/g, "");
  if (!digits) return "";
  return `+${country.dial}${digits}`;
}
