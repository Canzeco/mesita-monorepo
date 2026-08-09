"use client";

import { useState, useTransition } from "react";
import { Instagram, Loader2, Sparkles, UserMinus, UserPlus } from "lucide-react";

import { ErrorNote } from "@/components/ErrorNote";
import { formatAbsoluteUtc } from "@/lib/format";
import { SectionCard } from "../enricher-config/atlas-ui";
import { CLASS_META } from "../rewards-config/promos";
import { setAura, type AuraMember } from "./actions";

// The Aura roster. One card, one list: who is in, plus the two writes that
// change it. Membership is the whole page — Aura's RATES live in Rewards
// Config, and duplicating them here would give the operator two tables to
// keep in agreement.

/** "aura" → "Aura", falling back to the raw key for a class we don't know. */
function className(key: string | null): string {
  if (!key) return "an unknown class";
  return (CLASS_META as Record<string, { name: string }>)[key]?.name ?? key;
}

/** The ISO date, rendered identically on server and client (no locale). */
function invitedOn(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

export function AuraConsumersClient({
  initialMembers,
  loadError,
}: {
  initialMembers: AuraMember[];
  loadError: string | null;
}) {
  const [members, setMembers] = useState<AuraMember[]>(initialMembers);
  const [lookup, setLookup] = useState("");
  const [error, setError] = useState<string | null>(loadError);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviting, startInvite] = useTransition();
  const [revoking, startRevoke] = useTransition();

  const trimmed = lookup.trim();

  const invite = () => {
    if (!trimmed || inviting) return;
    setError(null);
    setNote(null);
    startInvite(async () => {
      const r = await setAura(trimmed, true);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // Reconcile off the row the EF actually wrote, and keep the roster in
      // newest-first order to match admin-web-list-aura. Re-inviting someone
      // already on the list moves them, never duplicates them.
      const row = r.consumer;
      setMembers((prev) => [row, ...prev.filter((m) => m.id !== row.id)]);
      setNote(`${memberLabel(row)} is now Aura.`);
      setLookup("");
    });
  };

  const revoke = (member: AuraMember) => {
    if (revoking) return;
    setError(null);
    setNote(null);
    setBusyId(member.id);
    startRevoke(async () => {
      const r = await setAura(member.id, false);
      setBusyId(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setNote(
        `${memberLabel(member)} left Aura — they fall back to ${className(r.classKey)}.`,
      );
    });
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <SectionCard
        icon={<Sparkles className="text-secondary h-4 w-4" />}
        title="Aura members"
        subtitle="Everyone currently on the invite-only class. Invite by consumer id, 8-digit code, phone, @handle or name — a search that matches more than one consumer is refused rather than guessed at. Revoking recomputes the consumer's best remaining door: an active subscription lands them on Premium, 2,000+ Instagram followers on Influencer, otherwise Standard."
        status={
          <span className="text-muted-foreground text-xs tabular-nums">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        }
      >
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={lookup}
            onChange={(e) => {
              setLookup(e.target.value);
              setError(null);
              setNote(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && invite()}
            placeholder="Consumer id, 0000-0000, phone, @handle or name"
            autoComplete="off"
            spellCheck={false}
            disabled={inviting}
            className="border-border bg-background focus:border-foreground h-10 flex-1 rounded-xl border px-3 text-sm outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={invite}
            disabled={inviting || trimmed.length === 0}
            className="bg-foreground text-background inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
          >
            {inviting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            Invite to Aura
          </button>
        </div>

        {note && (
          <p className="text-muted-foreground mt-3 text-xs font-medium">{note}</p>
        )}
        {error && <ErrorNote message={error} />}

        <ul className="border-border divide-border/60 mt-5 divide-y overflow-hidden rounded-xl border">
          {members.length === 0 && (
            <li className="text-muted-foreground px-4 py-4 text-sm">
              Nobody is on Aura yet. Invite the first member above.
            </li>
          )}
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              busy={busyId === m.id}
              disabled={revoking}
              onRevoke={() => revoke(m)}
            />
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

/** Whatever identifies this member best in a one-line message. */
function memberLabel(m: AuraMember): string {
  return m.name ?? (m.instagramHandle ? `@${m.instagramHandle}` : null) ??
    m.code ?? m.id;
}

function MemberRow({
  member,
  busy,
  disabled,
  onRevoke,
}: {
  member: AuraMember;
  busy: boolean;
  disabled: boolean;
  onRevoke: () => void;
}) {
  const invited = invitedOn(member.grantedAt);
  // Aura is admin-granted, so anything but 'invitation' is worth seeing: it
  // means another door seated this member, and revoke here won't move them.
  const oddOrigin =
    member.classOrigin && member.classOrigin !== "invitation"
      ? member.classOrigin
      : null;

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {member.name ?? "Unnamed consumer"}
          {member.code && (
            <span className="text-muted-foreground ml-1.5 font-mono text-xs font-normal">
              {member.code}
            </span>
          )}
        </p>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          {member.instagramHandle && (
            <span className="inline-flex items-center gap-1">
              <Instagram className="h-3 w-3" />@{member.instagramHandle}
              {member.followers != null && (
                <span className="tabular-nums">
                  · {member.followers.toLocaleString("en-US")}
                </span>
              )}
            </span>
          )}
          {member.phone && <span className="tabular-nums">{member.phone}</span>}
          {member.grantedAt && invited && (
            <span title={formatAbsoluteUtc(member.grantedAt)}>
              Invited {invited}
            </span>
          )}
          {oddOrigin && (
            <span className="text-destructive">origin: {oddOrigin}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRevoke}
        disabled={busy || disabled}
        title="Revoke Aura"
        className="border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <UserMinus className="h-3.5 w-3.5" />
        )}
        Revoke
      </button>
    </li>
  );
}
