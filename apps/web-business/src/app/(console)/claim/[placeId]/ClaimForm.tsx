"use client";

// "This is my place" (MESITA-3103). Since the Business app signs in with
// Google only (MESITA-3105) there is no phone to match: every claim is a short
// request a Mesita super-admin approves or rejects on the Claim requests page.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { requestVerification, type ClaimOutcome, type ClaimablePlace } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { INPUT_BASE } from "@/components/ui/manage";

const ERROR_COPY: Record<string, string> = {
  too_many_requests: "You can send three requests a day. Try again tomorrow.",
};

export function ClaimForm({ place }: { place: ClaimablePlace }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<ClaimOutcome | null>(
    place.mine === "owner" ? "already_owner" : place.mine === "pending" ? "already_pending" : null,
  );
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const r = await requestVerification({ placeId: place.id, name, role, note });
    setBusy(false);
    if (!r.ok) {
      setError((r.code && ERROR_COPY[r.code]) || r.error);
      return;
    }
    setOutcome(r.data);
    if (r.data === "already_owner") router.refresh();
  }

  if (outcome === "verified" || outcome === "already_owner") {
    return (
      <Card className="flex flex-col items-start gap-3">
        <CheckCircle2 className="size-6 text-emerald-600" aria-hidden />
        <p className="font-semibold">You run this place on Mesita.</p>
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
        <p className="font-semibold">Tell us who you are at this place</p>
        <p className="text-muted-foreground text-sm">Mesita checks every request before the profile is yours, usually within a day.</p>
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
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="A way to reach the place, your website, your Instagram…" className={`${INPUT_BASE} px-3 py-2`} />
        </label>
        <button
          type="button"
          disabled={busy || !name.trim() || !role.trim()}
          onClick={() => void send()}
          className="bg-foreground text-background inline-flex h-11 w-fit items-center rounded-full px-5 text-sm font-semibold disabled:opacity-60"
        >
          This is my place
        </button>
      </Card>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
