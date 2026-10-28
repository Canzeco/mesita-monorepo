"use client";

import { useState, useTransition } from "react";
import { Crown, Search, UsersRound } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import {
  Button,
  ChoicePill,
  SectionCard,
  TextField,
} from "@/components/admin-ui/config";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import {
  listGuests,
  setGuestStanding,
  type GuestClass,
  type GuestPlan,
  type GuestRow,
  type StandingPatch,
} from "./actions";

// Manage › Guests (MESITA-2550, MESITA-2553). Two independent facts per
// guest, both on their identity card in the consumer app:
//
//   Class   Regular · VIP   VIP comes through a partner (an agency, a creator
//                           deal). It is never sold and never an upgrade to Pro.
//   Plan    Free · Pro  the subscription; operator-set until a checkout exists
//
// A tap saves at once. A refusal rolls the row back; a lost connection
// re-reads the list, because the save may have landed. The note on where a
// VIP came from is for operators only and saves when the field loses focus.

const NOTE_MAX = 280;
const NOTE_COUNT_FROM = 240;

const CLASS_OPTIONS: { value: GuestClass; label: string }[] = [
  { value: "regular", label: "Regular" },
  { value: "vip", label: "VIP" },
];
const PLAN_OPTIONS: { value: GuestPlan; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "premium", label: "Pro" },
];

/** "VIP since Oct 21, 2026 · by pato@…": no line until an operator set it. */
export function vipLine(g: GuestRow): string | null {
  if (g.guestClass !== "vip" || !g.guestClassSetAt) return null;
  const when = new Date(g.guestClassSetAt);
  if (Number.isNaN(when.getTime())) return null;
  const date = when.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return g.guestClassSetByEmail
    ? `VIP since ${date} · by ${g.guestClassSetByEmail}`
    : `VIP since ${date}`;
}

export function GuestsClient({
  initialGuests,
  loadError,
}: {
  initialGuests: GuestRow[];
  loadError: string | null;
}) {
  return (
    <PageContainer size="3xl" className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        eyebrow="Manage · Guests"
        title="Guests"
        description="Set each guest's Class and Plan. They are separate: VIP comes from a partner and is never sold; the plan is Free or Pro. Both show on the guest's card in the app."
      />
      <GuestsCard initialGuests={initialGuests} loadError={loadError} />
    </PageContainer>
  );
}

function GuestsCard({
  initialGuests,
  loadError,
}: {
  initialGuests: GuestRow[];
  loadError: string | null;
}) {
  const [guests, setGuests] = useState<GuestRow[]>(initialGuests);
  const [q, setQ] = useState("");
  const [shownFor, setShownFor] = useState("");
  const [error, setError] = useState<string | null>(loadError);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [, startSave] = useTransition();

  const replace = (row: GuestRow) =>
    setGuests((prev) => prev.map((g) => (g.id === row.id ? row : g)));

  const reload = async (query: string) => {
    const r = await listGuests(query);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setGuests(r.guests);
    setShownFor(query);
  };

  const search = () => {
    if (searching) return;
    setError(null);
    startSearch(() => reload(q.trim()));
  };

  /** Saves one change; resolves true when the server took it. */
  const save = (guest: GuestRow, patch: StandingPatch): Promise<boolean> =>
    new Promise((resolve) => {
      setRowError(null);
      setBusyId(guest.id);
      replace({ ...guest, ...patch } as GuestRow);
      startSave(async () => {
        const r = await setGuestStanding(guest.id, patch);
        setBusyId(null);
        if (r.ok) {
          replace(r.guest);
          resolve(true);
          return;
        }
        if (r.status === 0) {
          // No answer: the save may have landed. Show what the server holds.
          setRowError({ id: guest.id, message: `${r.error} Showing the saved state.` });
          await reload(shownFor);
        } else {
          replace(guest);
          setRowError({ id: guest.id, message: r.error });
        }
        resolve(false);
      });
    });

  return (
    <SectionCard
      icon={<UsersRound className="text-muted-foreground h-4 w-4" />}
      title="Guests"
      subtitle={
        shownFor
          ? `Matching “${shownFor}”: name, member number or Instagram.`
          : "The 50 newest guests. Search by name, member number or Instagram."
      }
      state={
        <span className="text-muted-foreground text-xs tabular-nums">
          {guests.length}
        </span>
      }
    >
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1">
          <TextField
            value={q}
            onChange={setQ}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Name, 0000-0000 or @handle"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <Button
          pending={searching}
          icon={<Search className="h-3.5 w-3.5" />}
          onClick={search}
        >
          Search
        </Button>
      </div>

      {error && <ErrorNote message={error} />}

      <ul className="border-border divide-border/60 mt-5 divide-y overflow-hidden rounded-xl border">
        {guests.length === 0 && (
          <li className="text-muted-foreground px-4 py-4 text-sm">
            {shownFor ? "No guest matches." : "No guests yet."}
          </li>
        )}
        {guests.map((g) => (
          <GuestItem
            key={g.id}
            guest={g}
            busy={busyId === g.id}
            locked={busyId !== null}
            error={rowError?.id === g.id ? rowError.message : null}
            onSave={(patch) => save(g, patch)}
          />
        ))}
      </ul>
    </SectionCard>
  );
}

function GuestItem({
  guest: g,
  busy,
  locked,
  error,
  onSave,
}: {
  guest: GuestRow;
  busy: boolean;
  locked: boolean;
  error: string | null;
  onSave: (patch: StandingPatch) => Promise<boolean>;
}) {
  const since = vipLine(g);
  return (
    <li className="flex flex-col gap-3 px-4 py-3" data-guest-row>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {g.guestClass === "vip" && (
              <Crown className="h-3.5 w-3.5 shrink-0" aria-label="VIP" />
            )}
            <span className="truncate">{g.name}</span>
          </p>
          <p className="text-muted-foreground truncate text-xs tabular-nums">
            {[g.code ? `Member ${g.code}` : "Member pending", g.instagram && `@${g.instagram}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {since && (
            <p className="text-muted-foreground truncate text-xs" data-vip-since>
              {since}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4">
          <Segmented
            label="Class"
            name={g.name}
            options={CLASS_OPTIONS}
            value={g.guestClass}
            disabled={locked}
            onPick={(v) => onSave({ guestClass: v })}
          />
          <Segmented
            label="Plan"
            name={g.name}
            options={PLAN_OPTIONS}
            value={g.plan}
            disabled={locked}
            onPick={(v) => onSave({ plan: v })}
          />
        </div>
      </div>
      {(g.guestClass === "vip" || g.guestClassNote) && (
        <NoteField
          guest={g}
          disabled={locked && !busy}
          onSave={(note) => onSave({ guestClassNote: note })}
        />
      )}
      {error && (
        <p className="text-destructive text-xs" role="alert" data-guest-row-error>
          {error}
        </p>
      )}
    </li>
  );
}

function Segmented<T extends string>({
  label,
  name,
  options,
  value,
  disabled,
  onPick,
}: {
  label: string;
  name: string;
  options: { value: T; label: string }[];
  value: T;
  disabled: boolean;
  onPick: (v: T) => void;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <span className="flex items-center gap-1.5" role="group" aria-label={`${label} for ${name}`}>
        {options.map((o) => (
          <ChoicePill
            key={o.value}
            active={value === o.value}
            disabled={disabled}
            onClick={() => value !== o.value && onPick(o.value)}
          >
            {o.value === "vip" ? (
              <span className="inline-flex items-center gap-1">
                <Crown className="h-3 w-3" aria-hidden />
                {o.label}
              </span>
            ) : (
              o.label
            )}
          </ChoicePill>
        ))}
      </span>
    </span>
  );
}

/** Operator-only note on where a VIP came from. Saves on blur; a failure keeps the draft. */
function NoteField({
  guest,
  disabled,
  onSave,
}: {
  guest: GuestRow;
  disabled: boolean;
  onSave: (note: string | null) => Promise<boolean>;
}) {
  const saved = guest.guestClassNote ?? "";
  const [draft, setDraft] = useState(saved);
  const [failed, setFailed] = useState(false);

  const commit = async () => {
    const next = draft.trim();
    if (next === saved) {
      setFailed(false);
      return;
    }
    // The draft stays as typed on a failure, so Retry sends it again.
    const ok = await onSave(next === "" ? null : next);
    setFailed(!ok);
    if (ok) setDraft(next);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">
          Where this VIP came from · only operators see this
        </span>
        <input
          type="text"
          value={draft}
          disabled={disabled}
          maxLength={NOTE_MAX}
          placeholder="Agency, creator partnership…"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="border-border bg-background h-9 rounded-lg border px-3 text-sm outline-none focus:border-foreground disabled:opacity-50"
          data-vip-note
        />
      </label>
      <div className="flex items-center justify-between gap-3 text-xs">
        {failed ? (
          <span className="text-destructive" data-vip-note-failed>
            Not saved ·{" "}
            <button type="button" className="underline" onClick={commit}>
              Retry
            </button>
          </span>
        ) : (
          <span />
        )}
        {draft.length >= NOTE_COUNT_FROM && (
          <span className="text-muted-foreground tabular-nums">
            {draft.length}/{NOTE_MAX}
          </span>
        )}
      </div>
    </div>
  );
}
