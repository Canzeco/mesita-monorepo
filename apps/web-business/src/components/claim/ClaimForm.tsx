"use client";

// "This is my place" (MESITA-3103; works since MESITA-3127). Two ways in:
//   1. Get a call at the place — when the listing has a phone. A Twilio call
//      to that phone says a 6-digit code; the right code makes you run the
//      place at once (business-web-call-place-code → -check-place-code).
//      Calls are off for now (MESITA-3148): the server answers `test` and the
//      code is 123456, which the code step says.
//   A place someone else already owns (MESITA-3155) shows neither: it says
//   whose it is (their email, masked) and offers Report to Mesita, the hand
//   check below with the note filled in.
//   2. Mesita checks by hand — always offered, the only way without a phone:
//      name, role and a WhatsApp number Mesita writes to; a super-admin
//      approves it on the place's Admin page.
//
// One quiet grey panel (Pato, MESITA-3148: "better UI in that modal"): a
// round icon, a title, one line, one full-width button; the hand check is a
// plain link under it.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, FlaskConical, Phone, ShieldAlert, type LucideIcon } from "lucide-react";
import { callPlaceCode, checkPlaceCode, requestVerification, type ClaimOutcome, type ClaimablePlace } from "@/lib/business-api";
import { INPUT_BASE } from "@/components/ui/manage";
import { PLACES, placeTabHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ERROR_COPY: Record<string, string> = {
  too_many_requests: "You can send three requests a day. Try again tomorrow.",
  too_many_calls: "No more calls to this place today. Try tomorrow, or ask Mesita to check by hand.",
  call_failed: "We couldn't call this place. Ask Mesita to check by hand.",
  no_phone: "This place has no phone on its listing. Ask Mesita to check by hand.",
  claimed: "Someone else already runs this place on Mesita. If that's wrong, report it to Mesita.",
};

/** Seconds before "Call again" wakes up, so a ringing phone isn't called twice. */
const RECALL_SECONDS = 30;
const CODE_LENGTH = 6;

const PRIMARY =
  "bg-foreground text-background inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50";
const QUIET_LINK = "text-muted-foreground hover:text-foreground text-sm transition-colors";

type Mode = "claimed" | "call" | "code" | "manual";

const REPORT_NOTE = "Someone else claimed this place on Mesita, but I run it. Please check.";

/** The grey panel each step sits in. */
function Panel({ icon: Icon, tone = "muted", title, children }: { icon: LucideIcon; tone?: "muted" | "done" | "warn"; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-muted/50 flex flex-col items-center gap-4 rounded-2xl px-5 py-6 text-center sm:px-8">
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          tone === "done" ? "bg-emerald-500/10 text-emerald-600" : tone === "warn" ? "bg-amber-500/10 text-amber-600" : "bg-card text-foreground shadow-sm",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

export function ClaimForm({ place }: { place: ClaimablePlace }) {
  const router = useRouter();
  const canCall = place.phone_on_listing;
  const [outcome, setOutcome] = useState<ClaimOutcome | null>(
    place.mine === "owner" ? "already_owner" : place.mine === "pending" ? "already_pending" : null,
  );
  const claimedBy = place.mine ? null : (place.claimed_by ?? null);
  const [mode, setMode] = useState<Mode>(claimedBy ? "claimed" : canCall ? "call" : "manual");
  const [note, setNote] = useState("");
  const [test, setTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (outcome === "verified" || outcome === "already_owner") {
    return (
      <Panel icon={CheckCircle2} tone="done" title="You run this place on Mesita">
        <p className="text-muted-foreground max-w-xs text-sm">Its profile, reviews, Premier and settings are yours to manage.</p>
        <Link href={placeTabHref(place.id, "profile")} className={PRIMARY}>
          Open the profile
        </Link>
      </Panel>
    );
  }

  if (outcome === "pending" || outcome === "already_pending") {
    return (
      <Panel icon={Clock} title="Mesita is checking your claim">
        <p className="text-muted-foreground max-w-xs text-sm">
          We&apos;ll write to you on WhatsApp, usually within a day. The place shows up under Places once it&apos;s approved.
        </p>
        <Link href={PLACES} className={QUIET_LINK}>Back to Places</Link>
      </Panel>
    );
  }

  const show = (code: string | null | undefined, fallback: string) => setError((code && ERROR_COPY[code]) || fallback);

  async function call() {
    setBusy(true);
    setError(null);
    const r = await callPlaceCode(place.id);
    setBusy(false);
    if (!r.ok) {
      if (r.code === "claimed") setMode("claimed");
      return show(r.code, r.error);
    }
    if (r.data.outcome === "already_owner") {
      setOutcome("already_owner");
      router.refresh();
      return;
    }
    setTest(r.data.test);
    setMode("code");
  }

  return (
    <div className="flex flex-col gap-3">
      {mode === "claimed" ? (
        <Panel icon={ShieldAlert} tone="warn" title="Already claimed">
          <p className="text-muted-foreground max-w-xs text-sm">
            {claimedBy ? (
              <>
                This place is run on Mesita by <span className="text-foreground font-medium">{claimedBy}</span>.
              </>
            ) : (
              "Someone else already runs this place on Mesita."
            )}{" "}
            If that isn&apos;t you or your team, tell us and a person at Mesita checks.
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setNote(REPORT_NOTE);
              setMode("manual");
            }}
            className={PRIMARY}
          >
            Report to Mesita
          </button>
        </Panel>
      ) : null}

      {mode === "call" ? (
        <Panel icon={Phone} title="Get a call at the place">
          <p className="text-muted-foreground max-w-xs text-sm">
            We&apos;ll call {place.masked_phone ?? "the phone on its listing"} and say a 6-digit code. Be at the place to answer.
          </p>
          <button type="button" disabled={busy} onClick={() => void call()} className={PRIMARY}>
            {busy ? "Calling…" : "Call the place"}
          </button>
        </Panel>
      ) : null}

      {mode === "code" ? (
        <CodeStep
          place={place}
          test={test}
          onVerified={() => {
            setOutcome("verified");
            router.refresh();
          }}
          onCallAgain={() => void call()}
          calling={busy}
        />
      ) : null}

      {mode === "manual" ? (
        <ManualStep
          canCall={canCall && !claimedBy}
          initialNote={note}
          onBack={() => {
            setError(null);
            setMode("call");
          }}
          onSent={setOutcome}
          placeId={place.id}
        />
      ) : null}

      {error ? <p className="text-destructive text-center text-sm">{error}</p> : null}

      {mode === "call" || mode === "code" ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode("manual");
          }}
          className={cn(QUIET_LINK, "mx-auto py-1")}
        >
          Can&apos;t answer that phone? <span className="text-foreground font-medium">Ask Mesita to check</span>
        </button>
      ) : null}
    </div>
  );
}

/** Six boxes over one real input, so paste and one-time-code autofill work. */
function CodeBoxes({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(true);
  return (
    <div className="relative mx-auto w-full max-w-xs" onClick={() => input.current?.focus()}>
      <input
        ref={input}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        aria-label="6-digit code"
        maxLength={CODE_LENGTH}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div className="grid grid-cols-6 gap-2" aria-hidden>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const current = focused && (i === value.length || (i === CODE_LENGTH - 1 && value.length === CODE_LENGTH));
          return (
            <span
              key={i}
              className={cn(
                "bg-card flex aspect-[4/5] items-center justify-center rounded-xl font-mono text-2xl font-semibold shadow-sm ring-1 transition",
                current ? "ring-foreground/40" : "ring-border",
              )}
            >
              {value[i] ?? ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CodeStep({
  place,
  test,
  onVerified,
  onCallAgain,
  calling,
}: {
  place: ClaimablePlace;
  test: boolean;
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
    <Panel icon={test ? FlaskConical : Phone} title={test ? "Type the test code" : "Answer and type the code"}>
      {test ? (
        <p className="text-muted-foreground max-w-xs text-sm">
          Calls are off while we test. Type <span className="text-foreground font-mono font-semibold">123456</span>.
        </p>
      ) : (
        <p className="text-muted-foreground max-w-xs text-sm">
          We&apos;re calling {place.masked_phone ?? "the place"}. The call says six digits twice; they work for 10 minutes.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === CODE_LENGTH) void check(code);
        }}
        className="flex w-full flex-col gap-4"
      >
        <CodeBoxes
          value={code}
          disabled={busy}
          onChange={(v) => {
            setCode(v);
            if (v.length === CODE_LENGTH && !busy) void check(v);
          }}
        />
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <button type="submit" disabled={busy || code.length !== CODE_LENGTH} className={PRIMARY}>
          {busy ? "Checking…" : "Confirm"}
        </button>
      </form>
      {test ? null : (
        <button
          type="button"
          disabled={wait > 0 || calling}
          onClick={() => {
            setError(null);
            setWait(RECALL_SECONDS);
            onCallAgain();
          }}
          className={cn(QUIET_LINK, "disabled:opacity-50")}
        >
          {calling ? "Calling…" : wait > 0 ? `Call again in ${wait}s` : "Didn't get it? Call again"}
        </button>
      )}
    </Panel>
  );
}

function ManualStep({
  placeId,
  canCall,
  initialNote,
  onBack,
  onSent,
}: {
  placeId: string;
  canCall: boolean;
  initialNote: string;
  onBack: () => void;
  onSent: (o: ClaimOutcome) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState(initialNote);
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

  const field = `${INPUT_BASE} bg-card h-11 px-3`;
  return (
    <section className="bg-muted/50 flex flex-col gap-4 rounded-2xl px-5 py-6 sm:px-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold tracking-tight">Mesita checks by hand</h3>
        <p className="text-muted-foreground text-sm">
          {canCall ? "" : "This place has no phone on its listing, so a person at Mesita checks. "}
          We&apos;ll write to you on WhatsApp to confirm, usually within a day.
        </p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Your role at the place
        <input value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} placeholder="Owner, chef, director…" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Your WhatsApp number
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={40}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+52 55 1234 5678"
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Anything that helps us check <span className="text-muted-foreground -mt-1 font-normal">Optional</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Your website, your Instagram…"
          className={`${INPUT_BASE} bg-card px-3 py-2`}
        />
      </label>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <button type="button" disabled={busy || !ready} onClick={() => void send()} className={PRIMARY}>
        {busy ? "Sending…" : "Send to Mesita"}
      </button>
      {canCall ? (
        <button type="button" onClick={onBack} className={cn(QUIET_LINK, "mx-auto")}>
          Get a call at the place instead
        </button>
      ) : null}
    </section>
  );
}
