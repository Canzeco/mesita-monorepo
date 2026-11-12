"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageCircle, Phone } from "lucide-react";
import { Spinner } from "@/components/shared";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiCallSignInCode } from "@/lib/api/auth";
import { PhoneInputWithCountry } from "./PhoneInputWithCountry";
import {
  OTP_LENGTH,
  RESEND_COOLDOWN_SECONDS,
  otpErrorMessage,
  parsePhone,
} from "@/lib/phone-otp";
import {
  ERROR_BOX_CLASS,
  INFO_BOX_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { AUTH_BUTTON_SIZE } from "./auth-ui";

// Two-step phone OTP. Phone is the identity — there's no "create account"
// vs "sign in" anymore; first verify on a number creates the auth.user,
// subsequent verifies sign that user in. Single flow for both consumer and
// business surfaces — the parent passes the post-verify redirect.
//
// The number is normalized + length-checked before it leaves the browser
// (see lib/phone-otp.ts): every send is a real SMS we pay Twilio for, and
// a malformed one comes back as an unreadable provider string.
//
// The phone step asks how the code comes, text or call (MESITA-3470). Call
// marks the number first (consumer-web-call-sign-in-code), so Auth's Send
// SMS hook calls instead of texting. Resend uses the same way.

type Step = "phone" | "code";
type Method = "sms" | "call";

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
  const [method, setMethod] = useState<Method>("sms");
  const [sending, setSending] = useState<Method | null>(null);

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

  const sendCode = async (how: Method) => {
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
    setSending(how);
    try {
      if (how === "call") await apiCallSignInCode(supabase, parsed.e164);
      const { error: sendError } = await supabase.auth.signInWithOtp({
        phone: parsed.e164,
      });
      if (sendError) {
        setError(otpErrorMessage(sendError));
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't call you. Try again.");
      return false;
    } finally {
      setLoading(false);
      setSending(null);
    }
    setMethod(how);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setCooldownPhone(parsed.e164);
    return true;
  };

  const sentMessage = (how: Method) =>
    how === "call"
      ? "We're calling you now. Answer to hear your code."
      : `We just texted you a ${OTP_LENGTH}-digit code.`;

  const startVerification = async (how: Method) => {
    if (await sendCode(how)) {
      setStep("code");
      setInfo(sentMessage(how));
    }
  };

  // Resend stays on the code step, by the same way, so the user never
  // loses the digits they already typed.
  const resendCode = async () => {
    if (await sendCode(method)) {
      setCode("");
      setInfo(sentMessage(method));
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
          void startVerification("sms");
        }}
        className="flex flex-col gap-3"
      >
        <label className="block">
          <span className="text-foreground mb-1.5 block text-sm font-semibold">
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

        {error && <p className={ERROR_BOX_CLASS}>{error}</p>}

        {/* One dark button; calling is the quiet second way (MESITA-3795).
            Never greyed out while typing: a short number answers on tap. */}
        <button
          type="submit"
          disabled={loading}
          className={cn(PRIMARY_BUTTON_CLASS, AUTH_BUTTON_SIZE, "mt-1")}
        >
          {sending === "sms" ? (
            <Spinner size="sm" className="border-white/40 border-t-white" />
          ) : (
            <>
              <MessageCircle className="h-4 w-4" />
              Text me the code
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => void startVerification("call")}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center justify-center gap-1.5 self-center text-sm font-semibold transition disabled:opacity-50"
        >
          {sending === "call" ? (
            <Spinner size="sm" />
          ) : (
            <>
              <Phone className="h-4 w-4" />
              Call me instead
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
          className={cn(INPUT_CLASS, "text-center text-lg tracking-[0.5em]")}
          autoFocus
          required
        />
      </label>

      {info && <p className={INFO_BOX_CLASS}>{info}</p>}
      {error && <p className={ERROR_BOX_CLASS}>{error}</p>}

      <button
        type="submit"
        disabled={loading || code.length !== OTP_LENGTH}
        className={cn(PRIMARY_BUTTON_CLASS, AUTH_BUTTON_SIZE, "mt-2")}
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
        className="text-muted-foreground hover:text-foreground h-9 text-center text-xs font-semibold transition disabled:opacity-50"
      >
        {cooldown > 0
          ? `${method === "call" ? "Call again" : "Resend code"} in ${cooldown}s`
          : method === "call"
            ? "Didn't get it? Call me again"
            : "Didn't get it? Resend code"}
      </button>
    </form>
  );
}
