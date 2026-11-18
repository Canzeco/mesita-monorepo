"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Spinner } from "@/components/shared";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { PhoneInputWithCountry } from "./PhoneInputWithCountry";
import {
  OTP_LENGTH,
  RESEND_COOLDOWN_SECONDS,
  otpErrorMessage,
  parsePhone,
} from "@/lib/phone-otp";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { AUTH_BUTTON_SIZE } from "./auth-ui";

// GREEN FOR THE PHONE (Pato, 2026-11-17, MESITA-4286: "use a more standard
// login button. and since its phone registration maybe a green box
// instead"): the send and verify buttons are the phone's green with white
// words, the way a phone sign-in reads; every other primary stays ink.
const PHONE_GREEN = "bg-green-600 text-white hover:bg-green-700";

// ON THE PHOTO (MESITA-4309): the form sits on the sign-in photo's dark
// foot, so its words are white, an error is a white box with red words,
// and a note is a frosted one. The fields stay white with ink type.
const ERROR_ON_PHOTO = "rounded-lg bg-white px-3 py-2 text-sm text-destructive";
const INFO_ON_PHOTO = "rounded-lg bg-white/15 px-3 py-2 text-sm text-white";
const LINK_ON_PHOTO =
  "text-white/85 hover:text-white transition disabled:opacity-50";

// Two-step phone OTP. Phone is the identity — there's no "create account"
// vs "sign in" anymore; first verify on a number creates the auth.user,
// subsequent verifies sign that user in. Single flow for both consumer and
// business surfaces — the parent passes the post-verify redirect.
//
// The number is normalized + length-checked before it leaves the browser
// (see lib/phone-otp.ts): every send is a real SMS we pay Twilio for, and
// a malformed one comes back as an unreadable provider string.
//
// TEXT ONLY (Pato, 2026-11-18, MESITA-4317: "remove call verification.
// Just phone verification"): the code comes by text message, one way; the
// "Call me instead" link and its resend (MESITA-3470) are gone.

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
  // Seconds left on Supabase's per-number send window. Ticked by the effect
  // below so "Resend" states the wait instead of failing into a raw
  // "you can only request this after 60 seconds" from the API.
  const [cooldown, setCooldown] = useState(0);
  // The number the cooldown belongs to: another number sends at once.
  const [cooldownPhone, setCooldownPhone] = useState("");

  const parsed = useMemo(
    () => parsePhone(countryCode, localPhone),
    [countryCode, localPhone],
  );
  const e164 = parsed.ok ? parsed.e164 : "";

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    setError(null);
    setInfo(null);
    if (!parsed.ok) {
      setError(parsed.error);
      return false;
    }
    if (cooldown > 0 && cooldownPhone === parsed.e164) {
      setError(`Hold on — you can ask for a new code in ${cooldown}s.`);
      return false;
    }
    setLoading(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      phone: parsed.e164,
    });
    setLoading(false);
    if (sendError) {
      setError(otpErrorMessage(sendError));
      return false;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setCooldownPhone(parsed.e164);
    return true;
  };

  const sentMessage = `We just texted you a ${OTP_LENGTH}-digit code.`;

  const startVerification = async () => {
    if (await sendCode()) {
      setStep("code");
      setInfo(sentMessage);
    }
  };

  // Resend stays on the code step, so the user never loses the number.
  const resendCode = async () => {
    if (await sendCode()) {
      setCode("");
      setInfo(sentMessage);
    }
  };

  const verifyCode = async () => {
    setError(null);
    setInfo(null);
    const token = code.replace(/\D/g, "");
    if (token.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code we sent you.`);
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
      setError(otpErrorMessage(verifyError));
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
          void startVerification();
        }}
        className="flex flex-col gap-3"
      >
        <label className="block">
          {/* The line above already asks for the number. */}
          <span className="sr-only">Phone number</span>
          <PhoneInputWithCountry
            value={localPhone}
            onChange={setLocalPhone}
            countryCode={countryCode}
            onCountryChange={setCountryCode}
            placeholder="55 1234 5678"
            required
          />
        </label>

        {error && <p className={ERROR_ON_PHOTO}>{error}</p>}

        {/* The one button (MESITA-4317). Never greyed out while typing: a
            short number answers on tap. */}
        <button
          type="submit"
          disabled={loading}
          className={cn(
            PRIMARY_BUTTON_CLASS,
            AUTH_BUTTON_SIZE,
            PHONE_GREEN,
            "mt-1",
          )}
        >
          {loading ? (
            <Spinner size="sm" className="border-white/40 border-t-white" />
          ) : (
            "Text me the code"
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
          className={cn(
            LINK_ON_PHOTO,
            "inline-flex min-h-11 items-center gap-1 text-sm font-semibold",
          )}
        >
          <ArrowLeft className="h-3 w-3" />
          Change number
        </button>
        <span className="text-sm text-white/75 tabular-nums">{e164}</span>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-white/80">
          {OTP_LENGTH}-digit code
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_LENGTH}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          data-field-size="lg"
          className={cn(
            INPUT_CLASS,
            "text-foreground h-13 rounded-[14px] border-transparent text-center text-lg tracking-[0.5em] focus:border-white",
          )}
          autoFocus
          required
        />
      </label>

      {info && <p className={INFO_ON_PHOTO}>{info}</p>}
      {error && <p className={ERROR_ON_PHOTO}>{error}</p>}

      <button
        type="submit"
        disabled={loading || code.length !== OTP_LENGTH}
        className={cn(
          PRIMARY_BUTTON_CLASS,
          AUTH_BUTTON_SIZE,
          PHONE_GREEN,
          "mt-2",
        )}
      >
        {loading ? (
          <Spinner size="sm" className="border-white/40 border-t-white" />
        ) : (
          "Verify"
        )}
      </button>

      <button
        type="button"
        onClick={() => void resendCode()}
        disabled={loading || cooldown > 0}
        className={cn(
          LINK_ON_PHOTO,
          "min-h-11 text-center text-sm font-semibold",
        )}
      >
        {cooldown > 0
          ? `Resend code in ${cooldown}s`
          : "Didn't get it? Resend code"}
      </button>
    </form>
  );
}
