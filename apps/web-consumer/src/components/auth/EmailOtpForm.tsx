"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { Spinner } from "@/components/shared";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { EMAIL_OTP_LENGTH, RESEND_COOLDOWN_SECONDS, otpErrorMessage } from "@/lib/phone-otp";
import { ERROR_BOX_CLASS, INFO_BOX_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// Email code (MESITA-3777): PhoneOtpForm's two steps with an address. The
// first verified code makes the account, later ones sign it in. The email
// carries an 8-digit code, never a link (both Auth templates show
// {{ .Token }}), so the guest stays in this tab.

type Step = "email" | "code";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailOtpForm({ redirectAfter }: { redirectAfter: string }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const address = email.trim().toLowerCase();
  const valid = EMAIL_SHAPE.test(address);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    setError(null);
    setInfo(null);
    if (!valid) {
      setError("Enter a valid email address.");
      return false;
    }
    setLoading(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (sendError) {
      setError(otpErrorMessage(sendError, EMAIL_OTP_LENGTH));
      return false;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setInfo(`We just emailed you an ${EMAIL_OTP_LENGTH}-digit code.`);
    return true;
  };

  const verifyCode = async () => {
    setError(null);
    setInfo(null);
    const token = code.replace(/\D/g, "");
    if (token.length !== EMAIL_OTP_LENGTH) {
      setError(`Enter the ${EMAIL_OTP_LENGTH}-digit code we emailed you.`);
      return;
    }
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: address,
      token,
      type: "email",
    });
    if (verifyError) {
      setLoading(false);
      setError(otpErrorMessage(verifyError, EMAIL_OTP_LENGTH));
      return;
    }
    router.push(redirectAfter);
    router.refresh();
  };

  if (step === "email") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendCode().then((sent) => sent && setStep("code"));
        }}
        className="flex flex-col gap-3"
      >
        <label className="block">
          <span className="text-muted-foreground mb-1.5 block text-xs font-medium">Email</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={INPUT_CLASS}
            required
          />
        </label>
        {error && <p className={ERROR_BOX_CLASS}>{error}</p>}
        <button type="submit" disabled={loading || !valid} className={cn(PRIMARY_BUTTON_CLASS, "mt-2")}>
          {loading ? (
            <Spinner size="sm" className="border-white/40 border-t-white" />
          ) : (
            <>
              <Mail className="h-4 w-4" />
              Email me the code
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
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
            setInfo(null);
          }}
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs font-semibold transition"
        >
          <ArrowLeft className="h-3 w-3" />
          Change email
        </button>
        <span className="text-muted-foreground truncate text-xs">{address}</span>
      </div>
      <label className="block">
        <span className="text-muted-foreground mb-1.5 block text-xs font-medium">
          {EMAIL_OTP_LENGTH}-digit code
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={EMAIL_OTP_LENGTH}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="12345678"
          data-field-size="lg"
          className={cn(INPUT_CLASS, "text-center text-lg tracking-[0.4em]")}
          autoFocus
          required
        />
      </label>
      {info && <p className={INFO_BOX_CLASS}>{info}</p>}
      {error && <p className={ERROR_BOX_CLASS}>{error}</p>}
      <button
        type="submit"
        disabled={loading || code.length !== EMAIL_OTP_LENGTH}
        className={cn(PRIMARY_BUTTON_CLASS, "mt-2")}
      >
        {loading ? <Spinner size="sm" className="border-white/40 border-t-white" /> : "Verify"}
      </button>
      <button
        type="button"
        onClick={() => void sendCode().then((sent) => sent && setCode(""))}
        disabled={loading || cooldown > 0}
        className="text-muted-foreground hover:text-foreground h-9 text-center text-xs font-semibold transition disabled:opacity-50"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get it? Resend code"}
      </button>
    </form>
  );
}
