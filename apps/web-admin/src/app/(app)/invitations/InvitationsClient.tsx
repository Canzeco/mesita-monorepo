"use client";

import { useState, useTransition } from "react";
import { DoorOpen, Loader2, UserRound } from "lucide-react";
import {
  ConfirmDialog,
  ErrorNote,
  ManageSectionCard,
  ReadField,
  SelectField,
  TextField,
} from "@/components/admin-ui";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import {
  INVITATION_CLASSES,
  ORIGIN_LABEL,
  storedClassLabel,
} from "./class-bridge";
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

export function InvitationsClient() {
  const [lookup, setLookup] = useState("");
  const [classKey, setClassKey] = useState(INVITATION_CLASSES[0].key);
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
  const chosen =
    INVITATION_CLASSES.find((c) => c.key === classKey) ?? INVITATION_CLASSES[0];

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
    start(async () => settle(await grantInvitation(trimmed, classKey)));
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
        title="Invitations"
        description="Open or close a guest's invitation door by hand. The invitation never cancels the other doors — a paying member granted Diamond keeps their subscription running underneath, and revoking drops them to the best door they still hold."
      />

      <ManageSectionCard
        icon={<DoorOpen className="h-4 w-4" />}
        tint="violet"
        title="The invitation door"
        subtitle="Name the guest however you have them — a uuid, an 8-digit consumer code, a phone, an @handle, or a name. A lookup that matches several people is refused rather than guessed at."
      >
        <div className="mt-5 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <TextField
              label="Guest"
              value={lookup}
              onChange={setLookup}
              placeholder="+52 81 1234 5678 · 0000-0000 · @handle · name"
            />
            <SelectField
              label="Class"
              value={classKey}
              onChange={setClassKey}
              options={INVITATION_CLASSES.map((c) => ({
                value: c.key,
                label: c.label,
              }))}
            />
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            {chosen.blurb}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={grant}
              disabled={pending || trimmed.length === 0}
              className="bg-foreground text-background inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Grant {chosen.label}
            </button>
            <button
              type="button"
              onClick={() => setConfirmRevoke(true)}
              disabled={pending || trimmed.length === 0}
              className="border-border hover:bg-muted inline-flex h-10 items-center justify-center rounded-xl border px-5 text-sm font-semibold transition disabled:opacity-50"
            >
              Revoke invitation
            </button>
          </div>

          {error && <ErrorNote message={error} />}

          {missed && (
            <p className="border-border bg-muted/50 text-muted-foreground rounded-xl border p-3 text-xs leading-relaxed">
              An invitation can only land on an account that already exists.
              Phone OTP is the only way into the consumer app, and nothing here
              holds an invitation for a number that has never signed in — so a
              guest invited before they sign up has to be granted again
              afterwards.
            </p>
          )}
        </div>
      </ManageSectionCard>

      {result && <ResultCard {...result} />}

      <ConfirmDialog
        open={confirmRevoke}
        danger
        title="Revoke this invitation?"
        body={
          <>
            This clears the invitation door for whoever{" "}
            <span className="text-foreground font-medium">{trimmed}</span>{" "}
            resolves to. Their class falls back to the best door they still
            hold — a live subscription, then their Instagram reach, then the
            floor. It does not say which class they had.
          </>
        }
        confirmLabel="Revoke"
        busy={pending}
        onConfirm={revoke}
        onCancel={() => setConfirmRevoke(false)}
      />
    </PageContainer>
  );
}

// Who the lookup landed on, and what the recompute settled — read back from
// the EF rather than assumed, because the granted class is not always the
// effective one (a Diamond subscriber granted Silver stays Diamond).
function ResultCard({
  consumer,
  classKey,
  origin,
}: {
  consumer: ConsumerSummary;
  classKey: string;
  origin: string;
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
        <ReadField label="Invitation door" boxed>
          {consumer.invitationClassKey
            ? `${storedClassLabel(consumer.invitationClassKey)} · ${stamp(
                consumer.invitationGrantedAt,
              )}`
            : "Closed"}
        </ReadField>
        <ReadField label="Effective class" boxed>
          {storedClassLabel(classKey)}
        </ReadField>
        <ReadField label="Won by" boxed>
          {ORIGIN_LABEL[origin] ?? origin}
        </ReadField>
      </div>
    </ManageSectionCard>
  );
}
