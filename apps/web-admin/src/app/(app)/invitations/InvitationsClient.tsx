"use client";

import { useState, useTransition } from "react";
import { Gem, Loader2, UserRound } from "lucide-react";
import {
  ConfirmDialog,
  ReadField,
  SectionCard as ManageSectionCard,
  TextField,
} from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import { diamondLabel, isDiamondKey } from "./class-bridge";
import {
  grantInvitation,
  revokeInvitation,
  type ConsumerSummary,
  type DoorResult,
} from "./actions";

/** `2026-08-23T04:11:00Z` → `23 Aug 2026, 04:11`. */
function stamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

// DIAMOND (MESITA-2044, MESITA-2046): a guest is Diamond or not, nothing in
// between, so this page has two verbs and no picker — add, and remove.
export function InvitationsClient() {
  const [lookup, setLookup] = useState("");
  const [result, setResult] = useState<
    { consumer: ConsumerSummary; classKey: string; origin: string } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  // 404 is not just "an error" — it is the one gap this page cannot close,
  // so it gets its own explanation instead of a bare EF message.
  const [missed, setMissed] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [pending, start] = useTransition();

  const trimmed = lookup.trim();

  const settle = (r: DoorResult) => {
    if (!r.ok) {
      setResult(null);
      setError(r.error);
      setMissed(r.status === 404);
      return;
    }
    setError(null);
    setMissed(false);
    setResult({ consumer: r.consumer, classKey: r.classKey, origin: r.origin });
  };

  const grant = () => {
    if (!trimmed || pending) return;
    setError(null);
    setMissed(false);
    start(async () => settle(await grantInvitation(trimmed)));
  };

  const revoke = () => {
    if (!trimmed || pending) return;
    setError(null);
    setMissed(false);
    setConfirmRevoke(false);
    start(async () => settle(await revokeInvitation(trimmed)));
  };

  return (
    <PageContainer size="3xl" className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        eyebrow="Manage · Invitations"
        title="Diamond"
        description="Make a guest Diamond, or take it away. Diamond is invitation-only and binary — a guest is Diamond or not, nothing in between. Instagram and the guest's plan are separate facts, and neither is touched here."
      />

      <ManageSectionCard
        icon={<Gem className="h-4 w-4" />}
        tint="violet"
        title="Who is Diamond"
        subtitle="Name the guest however you have them — a uuid, an 8-digit consumer code, a phone, an @handle, or a name. A lookup that matches several people is refused rather than guessed at."
      >
        <div className="mt-5 flex flex-col gap-4">
          <TextField
            label="Guest"
            value={lookup}
            onChange={setLookup}
            placeholder="+52 81 1234 5678 · 0000-0000 · @handle · name"
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={grant}
              disabled={pending || trimmed.length === 0}
              className="bg-foreground text-background inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Make Diamond
            </button>
            <button
              type="button"
              onClick={() => setConfirmRevoke(true)}
              disabled={pending || trimmed.length === 0}
              className="border-border hover:bg-muted inline-flex h-10 items-center justify-center rounded-xl border px-5 text-sm font-semibold transition disabled:opacity-50"
            >
              Remove Diamond
            </button>
          </div>

          {error && <ErrorNote message={error} />}

          {missed && (
            <p className="border-border bg-muted/50 text-muted-foreground rounded-xl border p-3 text-xs leading-relaxed">
              A guest can only be made Diamond once their account
              exists. Phone OTP is the only way into the consumer app, and
              nothing here can hold Diamond for a number that has never
              signed in — so make them Diamond again after they sign up.
            </p>
          )}
        </div>
      </ManageSectionCard>

      {result && <ResultCard {...result} />}

      <ConfirmDialog
        open={confirmRevoke}
        danger
        title="Remove Diamond?"
        body={
          <>
            This takes Diamond away from whoever{" "}
            <span className="text-foreground font-medium">{trimmed}</span>{" "}
            resolves to, whether they joined by a Mesita invitation or a
            PIN. Their Instagram and their plan are untouched.
          </>
        }
        confirmLabel="Remove"
        busy={pending}
        onConfirm={revoke}
        onCancel={() => setConfirmRevoke(false)}
      />
    </PageContainer>
  );
}

// Who the lookup landed on, and whether they are Diamond now — read back
// from the EF rather than assumed from the button that was pressed.
function ResultCard({
  consumer,
  classKey,
}: {
  consumer: ConsumerSummary;
  classKey: string;
}) {
  return (
    <ManageSectionCard
      icon={<UserRound className="h-4 w-4" />}
      tint="emerald"
      title={consumer.name ?? "Unnamed guest"}
      subtitle="The guest this landed on, as the database holds them now."
    >
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <ReadField label="Consumer code" boxed>
          {consumer.code ?? "—"}
        </ReadField>
        <ReadField label="Phone" boxed>
          {consumer.phone ?? "—"}
        </ReadField>
        <ReadField label="Instagram" boxed>
          {consumer.instagramHandle ? `@${consumer.instagramHandle}` : "—"}
          {consumer.followers != null && (
            <span className="text-muted-foreground ml-2 tabular-nums">
              {consumer.followers.toLocaleString("en-US")} followers
            </span>
          )}
        </ReadField>
        <ReadField label="Diamond" boxed>
          {diamondLabel(classKey)}
        </ReadField>
        <ReadField label="Invited" boxed>
          {isDiamondKey(consumer.invitationClassKey)
            ? stamp(consumer.invitationGrantedAt)
            : "—"}
        </ReadField>
      </div>
    </ManageSectionCard>
  );
}
