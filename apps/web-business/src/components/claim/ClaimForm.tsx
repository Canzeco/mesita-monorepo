"use client";

// "This is my place" (MESITA-3103; works since MESITA-3127). Two ways in:
//   1. Get a call at the place — when the listing has a phone. A Twilio call
//      to that phone says a 6-digit code; the right code makes you run the
//      place at once (business-web-call-place-code → -check-place-code).
//   2. Mesita checks by hand — always offered, the only way without a phone:
//      name, role and a WhatsApp number Mesita writes to; a super-admin
//      approves it on Claim requests.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Phone } from "lucide-react";
import { callPlaceCode, checkPlaceCode, requestVerification, type ClaimOutcome, type ClaimablePlace } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { INPUT_BASE } from "@/components/ui/manage";
import { PLACES, placeTabHref } from "@/lib/routes";

const ERROR_COPY: Record<string, string> = {
  too_many_requests: "You can send three requests a day. Try again tomorrow.",
  too_many_calls: "No more calls to this place today. Try tomorrow, or ask Mesita to check by hand.",
  call_failed: "We couldn't call this place. Ask Mesita to check by hand.",
  no_phone: "This place has no phone on its listing. Ask Mesita to check by hand.",
};

/** Seconds before "Call again" wakes up, so a ringing phone isn't called twice. */
const RECALL_SECONDS = 30;

type Mode = "call" | "code" | "manual";

export function ClaimForm({ place }: { place: ClaimablePlace }) {
  const router = useRouter();
  const canCall = place.phone_on_listing;
  const [outcome, setOutcome] = useState<ClaimOutcome | null>(
    place.mine === "owner" ? "already_owner" : place.mine === "pending" ? "already_pending" : null,
  );
  const [mode, setMode] = useState<Mode>(canCall ? "call" : "manual");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (outcome === "verified" || outcome === "already_owner") {
    return (
      <Card className="flex flex-col items-start gap-3">
        <CheckCircle2 className="size-6 text-emerald-600" aria-hidden />
        <p className="font-semibold">You run this place on Mesita.</p>
        <p className="text-muted-foreground text-sm">Its profile, reviews, Premier and settings are yours to manage.</p>
        <Link
          href={placeTabHref(place.id, "profile")}
          className="bg-foreground text-background inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold"
        >
          Open the profile
        </Link>
      </Card>
    );
  }

  if (outcome === "pending" || outcome === "already_pending") {
    return (
      <Card className="flex flex-col items-start gap-3">
        <Clock className="text-muted-foreground size-6" aria-hidden />
        <p className="font-semibold">Mesita is checking your claim.</p>
        <p className="text-muted-foreground text-sm">
          We&apos;ll write to you on WhatsApp, usually within a day. The place shows up under Places once it&apos;s approved.
        </p>
        <Link href={PLACES} className="text-sm font-semibold underline underline-offset-4">Places</Link>
      </Card>
    );
  }

  const show = (code: string | null | undefined, fallback: string) => setError((code && ERROR_COPY[code]) || fallback);

  async function call() {
    setBusy(true);
    setError(null);
    const r = await callPlaceCode(place.id);
    setBusy(false);
    if (!r.ok) return show(r.code, r.error);
    if (r.data.outcome === "already_owner") {
      setOutcome("already_owner");
      router.refresh();
      return;
    }
    setMode("code");
  }

  return (
    <div className="flex flex-col gap-4">
      {mode === "call" ? (
        <Card className="flex flex-col items-start gap-3">
          <Phone className="text-muted-foreground size-6" aria-hidden />
          <p className="font-semibold">Get a call at the place</p>
          <p className="text-muted-foreground text-sm">
            We&apos;ll call {place.masked_phone ?? "the phone on its listing"} and say a 6-digit code. Be at the place to answer.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void call()}
            className="bg-foreground text-background inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Calling…" : "Call the place"}
          </button>
        </Card>
      ) : null}

      {mode === "code" ? (
        <CodeCard
          place={place}
          onVerified={() => {
            setOutcome("verified");
            router.refresh();
          }}
          onCallAgain={() => void call()}
          calling={busy}
        />
      ) : null}

      {mode === "manual" ? (
        <ManualCard
          canCall={canCall}
          onBack={() => {
            setError(null);
            setMode("call");
          }}
          onSent={setOutcome}
          placeId={place.id}
        />
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {mode !== "manual" ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode("manual");
          }}
          className="text-muted-foreground w-fit text-sm underline underline-offset-4"
        >
          Can&apos;t answer that phone? Ask Mesita to check by hand
        </button>
      ) : null}
    </div>
  );
}

function CodeCard({
  place,
  onVerified,
  onCallAgain,
  calling,
}: {
  place: ClaimablePlace;
  onVerified: () => void;
  onCallAgain: () => void;
  calling: boolean;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(RECALL_SECONDS);

  // Count down to "Call again"; a new call restarts it.
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function check(value: string) {
    setBusy(true);
    setError(null);
    const r = await checkPlaceCode(place.id, value);
    setBusy(false);
    if (r.ok) return onVerified();
    setCode("");
    setError(r.error);
  }

  return (
    <Card className="flex flex-col items-start gap-3">
      <Phone className="text-muted-foreground size-6" aria-hidden />
      <p className="font-semibold">Answer the call and type the code</p>
      <p className="text-muted-foreground text-sm">
        We&apos;re calling {place.masked_phone ?? "the place"}. The call says six digits twice. The code works for 10 minutes.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) void check(code);
        }}
        className="flex w-full flex-col gap-3 sm:flex-row"
      >
        <input
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(v);
            if (v.length === 6 && !busy) void check(v);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          aria-label="6-digit code"
          placeholder="••••••"
          className={`${INPUT_BASE} h-12 px-4 text-center font-mono text-2xl tracking-[0.4em] sm:max-w-56`}
        />
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="bg-foreground text-background inline-flex h-12 shrink-0 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Checking…" : "Confirm"}
        </button>
      </form>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <button
        type="button"
        disabled={wait > 0 || calling}
        onClick={() => {
          setError(null);
          setWait(RECALL_SECONDS);
          onCallAgain();
        }}
        className="text-sm font-semibold underline underline-offset-4 disabled:no-underline disabled:opacity-50"
      >
        {calling ? "Calling…" : wait > 0 ? `Didn't get it? Call again in ${wait}s` : "Didn't get it? Call again"}
      </button>
    </Card>
  );
}

function ManualCard({
  placeId,
  canCall,
  onBack,
  onSent,
}: {
  placeId: string;
  canCall: boolean;
  onBack: () => void;
  onSent: (o: ClaimOutcome) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!name.trim() && !!role.trim() && contact.replace(/\D/g, "").length >= 7;

  async function send() {
    setBusy(true);
    setError(null);
    const r = await requestVerification({ placeId, name, role, contact, note });
    setBusy(false);
    if (!r.ok) {
      setError((r.code && ERROR_COPY[r.code]) || r.error);
      return;
    }
    onSent(r.data);
    if (r.data === "already_owner") router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="font-semibold">Mesita checks by hand</p>
      <p className="text-muted-foreground text-sm">
        {canCall ? "" : "This place has no phone on its listing, so a person at Mesita checks. "}
        We&apos;ll write to you on WhatsApp to confirm, usually within a day.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={`${INPUT_BASE} h-10 px-3`} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Your role at the place
        <input value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} placeholder="Owner, chef, director…" className={`${INPUT_BASE} h-10 px-3`} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Your WhatsApp number
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={40}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+52 55 1234 5678"
          className={`${INPUT_BASE} h-10 px-3`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Anything that helps us check (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="Your website, your Instagram…" className={`${INPUT_BASE} px-3 py-2`} />
      </label>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={busy || !ready}
          onClick={() => void send()}
          className="bg-foreground text-background inline-flex h-11 w-fit items-center rounded-full px-5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send to Mesita"}
        </button>
        {canCall ? (
          <button type="button" onClick={onBack} className="text-muted-foreground text-sm underline underline-offset-4">
            Get a call at the place instead
          </button>
        ) : null}
      </div>
    </Card>
  );
}
