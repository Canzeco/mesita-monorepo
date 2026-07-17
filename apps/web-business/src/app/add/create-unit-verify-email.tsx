"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import {
  apiBusinessSendsEmailOtp,
  apiBusinessVerifiesEmail,
  type LookupMethods,
  type LookupPlace,
} from "@/lib/api/verifications";
import { OtpInput } from "@/components/business/OtpInput";
import { cn, errMsg } from "@/lib/utils";
import { isOtpCode } from "@/lib/validators";
import {
  ErrorBlurb,
  MockCodePill,
  type VerificationCallbacks,
} from "./create-unit-shared";

type EmailState =
  | { kind: "idle" }
  | { kind: "sending" }
  | {
      kind: "awaiting_code";
      verificationId: string;
      mockCode: string | null;
      sentTo: string;
      mockMode: boolean;
    }
  | {
      kind: "verifying";
      verificationId: string;
      mockCode: string | null;
      sentTo: string;
      mockMode: boolean;
    };

export function EmailBody({
  place,
  methods,
  supabase,
  signedInEmail,
  onApproved,
  onAwaitingAdmin,
}: {
  place: LookupPlace;
  methods: LookupMethods;
} & VerificationCallbacks) {
  const [state, setState] = useState<EmailState>({ kind: "idle" });
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const emailDisplay = methods.email.displayEmail ?? place.email ?? "";

  const sendEmail = () => {
    if (state.kind === "sending" || state.kind === "verifying") return;
    setError(null);
    setOtpCode("");
    setState({ kind: "sending" });
    void (async () => {
      try {
        const r = await apiBusinessSendsEmailOtp(
          supabase,
          place.id,
          signedInEmail,
        );
        setState({
          kind: "awaiting_code",
          verificationId: r.verificationId,
          mockCode: r.mockCode,
          sentTo: r.sentTo,
          mockMode: r.mockMode ?? !!r.mockCode,
        });
      } catch (err) {
        setError(errMsg(err, "Could not send code."));
        setState({ kind: "idle" });
      }
    })();
  };

  const verifyCode = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.kind !== "awaiting_code") return;
    const code = otpCode.trim();
    if (!isOtpCode(code)) {
      setError("Code must be 6 digits.");
      return;
    }
    const { verificationId, mockCode, sentTo, mockMode } = state;
    setError(null);
    setState({ kind: "verifying", verificationId, mockCode, sentTo, mockMode });
    void (async () => {
      try {
        const { projectId: vId, awaitingAdmin } = await apiBusinessVerifiesEmail(
          supabase,
          verificationId,
          code,
        );
        if (awaitingAdmin) onAwaitingAdmin();
        else onApproved(vId);
      } catch (err) {
        setError(errMsg(err, "Could not verify."));
        setState({
          kind: "awaiting_code",
          verificationId,
          mockCode,
          sentTo,
          mockMode,
        });
      }
    })();
  };

  if (state.kind === "idle" || state.kind === "sending") {
    const sending = state.kind === "sending";
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          We&apos;ll email a 6-digit code to the on-domain address on file. In
          test mode you&apos;ll see a mock inbox and the code on screen — we
          don&apos;t email{" "}
          <span className="text-foreground font-mono font-semibold break-all">
            {emailDisplay}
          </span>{" "}
          yet.
        </p>
        <button
          type="button"
          onClick={sendEmail}
          disabled={sending}
          className={cn(
            "flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold transition disabled:opacity-50",
            "bg-pink-gradient shadow-glow text-white",
          )}
        >
          {sending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Mail className="h-5 w-5" />
              Email the code
            </>
          )}
        </button>
        {error && <ErrorBlurb>{error}</ErrorBlurb>}
      </div>
    );
  }

  const verifying = state.kind === "verifying";
  const sentTo =
    state.kind === "awaiting_code" || state.kind === "verifying"
      ? state.sentTo
      : emailDisplay;
  const mockMode =
    state.kind === "awaiting_code" || state.kind === "verifying"
      ? state.mockMode
      : false;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex items-center gap-2 text-[12.5px] leading-snug">
        <span className="bg-secondary/10 text-secondary flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <Mail className="h-3.5 w-3.5" />
        </span>
        <p>
          {mockMode ? (
            <>
              Mock inbox{" "}
              <span className="text-foreground font-mono font-semibold break-all">
                {sentTo}
              </span>{" "}
              — we didn&apos;t email the place. Type the 6-digit code below.
            </>
          ) : (
            <>
              Code sent to{" "}
              <span className="text-foreground font-mono font-semibold break-all">
                {sentTo}
              </span>
              . Check the inbox and type it below.
            </>
          )}
        </p>
      </div>

      <form onSubmit={verifyCode} className="flex flex-col gap-3">
        <OtpInput
          value={otpCode}
          onChange={setOtpCode}
          disabled={verifying}
          hasError={!!error}
          autoFocus
        />
        {state.mockCode && <MockCodePill code={state.mockCode} />}
        {error && <ErrorBlurb>{error}</ErrorBlurb>}

        <button
          type="submit"
          disabled={verifying || otpCode.length !== 6}
          className={cn(
            "mt-1 flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-50",
            "bg-pink-gradient shadow-glow text-white",
          )}
        >
          {verifying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Verify code
            </>
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={sendEmail}
        disabled={verifying}
        className="text-muted-foreground hover:text-foreground -mt-1 inline-flex items-center justify-center gap-1.5 self-center text-[12px] font-medium transition disabled:opacity-50"
      >
        <Mail className="h-3.5 w-3.5" />
        Didn&apos;t get it? Re-send with a fresh code
      </button>
    </div>
  );
}
