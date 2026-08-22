"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Phone } from "lucide-react";
import {
  apiBusinessSendsPhoneOtp,
  apiBusinessVerifiesPhone,
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
} from "./create-place-shared";

type OtpSession = {
  verificationId: string;
  mockCode: string | null;
  phoneDialed: string;
  mockMode: boolean;
};

type CallState =
  | { kind: "idle" }
  | { kind: "placing" }
  | ({ kind: "awaiting_code" } & OtpSession)
  | ({ kind: "verifying" } & OtpSession);

export function PhoneBody({
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
  const [state, setState] = useState<CallState>({ kind: "idle" });
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const phoneDisplay = methods.phone.displayPhone ?? place.phone ?? "";

  const placeCall = () => {
    if (state.kind === "placing" || state.kind === "verifying") return;
    setError(null);
    setOtpCode("");
    setState({ kind: "placing" });
    void (async () => {
      try {
        const r = await apiBusinessSendsPhoneOtp(
          supabase,
          place.id,
          signedInEmail,
        );
        setState({
          kind: "awaiting_code",
          verificationId: r.verificationId,
          mockCode: r.mockCode,
          phoneDialed: r.phoneDialed,
          mockMode: r.mockMode ?? !!r.mockCode,
        });
      } catch (err) {
        setError(errMsg(err, "Could not place call."));
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
    const { verificationId, mockCode, phoneDialed, mockMode } = state;
    setError(null);
    setState({
      kind: "verifying",
      verificationId,
      mockCode,
      phoneDialed,
      mockMode,
    });
    void (async () => {
      try {
        const { projectId: vId, awaitingAdmin } =
          await apiBusinessVerifiesPhone(supabase, verificationId, code);
        if (awaitingAdmin) onAwaitingAdmin();
        else onApproved(vId);
      } catch (err) {
        setError(errMsg(err, "Could not verify."));
        setState({
          kind: "awaiting_code",
          verificationId,
          mockCode,
          phoneDialed,
          mockMode,
        });
      }
    })();
  };

  if (state.kind === "idle" || state.kind === "placing") {
    const placing = state.kind === "placing";
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          We&apos;ll dial the number on file and read out a 6-digit code. In
          test mode you&apos;ll see a Mesita mock line and the code on screen —
          we don&apos;t call{" "}
          <span className="text-foreground font-mono font-semibold">
            {phoneDisplay}
          </span>{" "}
          yet.
        </p>
        <button
          type="button"
          onClick={placeCall}
          disabled={placing}
          className={cn(
            "flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold transition disabled:opacity-50",
            "bg-pink-gradient shadow-glow text-white",
          )}
        >
          {placing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Dialing…
            </>
          ) : (
            <>
              <Phone className="h-5 w-5" />
              Call my place
            </>
          )}
        </button>
        {error && <ErrorBlurb>{error}</ErrorBlurb>}
      </div>
    );
  }

  const verifying = state.kind === "verifying";
  const dialed = state.phoneDialed;
  const mockMode = state.mockMode;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex items-center gap-2 text-[12.5px] leading-snug">
        <span className="bg-secondary/10 text-secondary flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <Phone className="h-3.5 w-3.5" />
        </span>
        <p>
          {mockMode ? (
            <>
              Mock line{" "}
              <span className="text-foreground font-mono font-semibold">
                {dialed}
              </span>{" "}
              — we didn&apos;t call the place. Type the 6-digit code below.
            </>
          ) : (
            <>
              Called{" "}
              <span className="text-foreground font-mono font-semibold">
                {dialed}
              </span>
              . Pick up and type the 6-digit code we read out.
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
          disabled={verifying || !isOtpCode(otpCode)}
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
        onClick={placeCall}
        disabled={verifying}
        className="text-muted-foreground hover:text-foreground -mt-1 inline-flex items-center justify-center gap-1.5 self-center text-[12px] font-medium transition disabled:opacity-50"
      >
        <Phone className="h-3.5 w-3.5" />
        Didn&apos;t pick up? Re-dial with a fresh code
      </button>
    </div>
  );
}
