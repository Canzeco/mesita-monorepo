"use client";

// "This is my place" (MESITA-3103). One button: the server checks the
// signed-in phone against the listing's and either makes the caller the
// owner at once or asks for a short request Mesita reviews.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { requestVerification, type ClaimOutcome, type FoundPlace } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { INPUT_BASE } from "@/components/ui/manage";

const ERROR_COPY: Record<string, string> = {
  no_account: "Sign in with your phone number to claim a place.",
  too_many_requests: "You can send three requests a day. Try again tomorrow.",
};

export function ClaimForm({
  place,
  signedInPhone,
  hasAccount,
}: {
  place: FoundPlace;
  signedInPhone: string | null;
  hasAccount: boolean;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<ClaimOutcome | null>(
    place.mine === "owner" ? "already_owner" : place.mine === "pending" ? "already_pending" : null,
  );
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(withDetails: boolean) {
    setBusy(true);
    setError(null);
    const r = await requestVerification({
      placeId: place.id,
      ...(withDetails ? { name, role, note } : {}),
    });
    setBusy(false);
    if (!r.ok) {
      setError((r.code && ERROR_COPY[r.code]) || r.error);
      return;
    }
    setOutcome(r.data);
    if (r.data === "verified" || r.data === "already_owner") router.refresh();
  }

  if (outcome === "verified" || outcome === "already_owner") {
    return (
      <Card className="flex flex-col items-start gap-3">
        <CheckCircle2 className="size-6 text-emerald-600" aria-hidden />
        <p className="font-semibold">
          {outcome === "verified" ? "Your number is the one on the listing. The profile is yours." : "You already run this place."}
        </p>
        <Link
          href={`/places/${encodeURIComponent(place.id)}/profile`}
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
        <p className="font-semibold">Mesita is reviewing your request.</p>
        <p className="text-muted-foreground text-sm">It usually takes a day. You will see the place under Your places once it is approved.</p>
        <Link href="/places" className="text-sm font-semibold underline underline-offset-4">Your places</Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <p className="font-semibold">Prove it with your phone</p>
        <p className="text-muted-foreground text-sm">
          {place.masked_phone
            ? <>The listing&apos;s phone ends in <span className="text-foreground font-medium">{place.masked_phone}</span>. </>
            : "This place has no phone on its listing. "}
          {signedInPhone ? <>You signed in with <span className="text-foreground font-medium">{signedInPhone}</span>.</> : "You signed in without a phone."}
        </p>
        {!hasAccount ? (
          <p className="text-muted-foreground text-sm">Sign out and sign in with your phone number to claim a place.</p>
        ) : outcome === null ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(false)}
            className="bg-foreground text-background inline-flex h-11 w-fit items-center rounded-full px-5 text-sm font-semibold disabled:opacity-60"
          >
            This is my place
          </button>
        ) : null}
      </Card>

      {outcome === "needs_details" ? (
        <Card className="flex flex-col gap-3">
          <p className="font-semibold">Your number isn&apos;t the one on the listing</p>
          <p className="text-muted-foreground text-sm">Tell us who you are at the place. Mesita reviews it, usually within a day.</p>
          <label className="flex flex-col gap-1 text-sm">
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={`${INPUT_BASE} h-10 px-3`} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Your role at the place
            <input value={role} onChange={(e) => setRole(e.target.value)} maxLength={80} placeholder="Owner, chef, director…" className={`${INPUT_BASE} h-10 px-3`} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Anything that helps us check (optional)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className={`${INPUT_BASE} px-3 py-2`} />
          </label>
          <button
            type="button"
            disabled={busy || !name.trim() || !role.trim()}
            onClick={() => void send(true)}
            className="bg-foreground text-background inline-flex h-11 w-fit items-center rounded-full px-5 text-sm font-semibold disabled:opacity-60"
          >
            Send for review
          </button>
        </Card>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
