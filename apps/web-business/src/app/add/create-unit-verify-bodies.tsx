"use client";

import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import {
  apiBusinessSendsEmailOtp,
  apiBusinessSendsPhoneOtp,
  apiBusinessVerifiesEmail,
  apiBusinessVerifiesPhone,
  type LookupMethods,
  type LookupPlace,
} from "@/lib/api/verifications";
import { OtpInput } from "@/components/business/OtpInput";
import { cn, errMsg } from "@/lib/utils";
import { isOtpCode } from "@/lib/validators";
import { ErrorBlurb, type VerificationCallbacks } from "./create-unit-shared";

// Mesita ops contact channels. Direct fallback for ownership claims
// that can't be auto-verified by phone or email. WhatsApp is the
// LATAM-friendly primary; email is the universal fallback for regions
// where WhatsApp isn't dominant (US, most of Europe) and also the
// natural channel when the operator needs to attach proof documents
// (business license, utility bill, staff photo with signage).
// Hardcoded so the "Talk to us" buttons always work regardless of
// Supabase env config.
const MESITA_OPS_WHATSAPP_E164 = "+524445499597";
const MESITA_OPS_EMAIL = "hello@mesita.ai";

// ── Phone OTP body ────────────────────────────────────────────────────

export type CallState =
  | { kind: "idle" }
  | { kind: "placing" }
  | {
      kind: "awaiting_code";
      verificationId: string;
      mockCode: string | null;
      phoneDialed: string;
      mockMode: boolean;
    }
  | {
      kind: "verifying";
      verificationId: string;
      mockCode: string | null;
      phoneDialed: string;
      mockMode: boolean;
    };

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
        const { projectId: vId, awaitingAdmin } = await apiBusinessVerifiesPhone(
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
  const dialed =
    state.kind === "awaiting_code" || state.kind === "verifying"
      ? state.phoneDialed
      : phoneDisplay;
  const mockMode =
    state.kind === "awaiting_code" || state.kind === "verifying"
      ? state.mockMode
      : false;

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

// ── Email OTP body ────────────────────────────────────────────────────

export type EmailState =
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

// ── Talk-to-us fallback body ──────────────────────────────────────────

// Always-available manual path. Opens a wa.me deep-link OR a mailto:
// with a prefilled claim message to Mesita ops. No DB row, no admin
// queue — ops handles the conversation directly. Phone/email
// auto-verify remain the happy paths; this is the fallback when
// neither is available or when the operator wants a human.
//
// WhatsApp is the primary CTA (LATAM-friendly, where most operators
// live), and email is the universal secondary — better for regions
// where WhatsApp isn't dominant (US, most of Europe) and also the
// natural channel when ops asks the operator to attach proof of
// ownership (business license, utility bill, staff photo with signage).
export function WhatsAppBody({ place }: { place: LookupPlace }) {
  const waNumber = MESITA_OPS_WHATSAPP_E164.replace(/[^\d]/g, "");
  const waMessage = `Hi Mesita — I'd like to claim "${place.name}" on Mesita. Place ID: ${place.id}.`;
  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;

  const emailSubject = `Claim "${place.name}" on Mesita`;
  const emailBody = `Hi Mesita team,\n\nI'd like to claim "${place.name}" on Mesita.\n\nPlace ID: ${place.id}\n\nHappy to share proof of ownership (business license, utility bill, or a staff photo with signage) if helpful.\n\nThanks,`;
  const mailHref = `mailto:${MESITA_OPS_EMAIL}?subject=${encodeURIComponent(
    emailSubject,
  )}&body=${encodeURIComponent(emailBody)}`;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-[13px] leading-relaxed">
        Reach our team and we&apos;ll verify ownership manually — we usually
        reply within minutes, and never more than one business day.
      </p>
      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        className="bg-whatsapp flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold text-white transition hover:opacity-90"
      >
        <MessageCircle className="h-5 w-5" />
        Talk to us on WhatsApp
      </a>
      <a
        href={mailHref}
        className="border-border bg-card text-foreground hover:bg-muted/50 flex h-14 items-center justify-center gap-2 rounded-full border text-base font-semibold transition"
      >
        <Mail className="h-5 w-5" />
        Email {MESITA_OPS_EMAIL}
      </a>
    </div>
  );
}

export function MockCodePill({ code }: { code: string }) {
  return (
    <p className="inline-flex items-center justify-center gap-1.5 self-center rounded-full border border-amber-200/70 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800">
      <AlertTriangle className="h-3 w-3" />
      Mock mode · type{" "}
      <span className="font-mono font-bold tracking-[0.18em] text-amber-900">
        {code}
      </span>
    </p>
  );
}
