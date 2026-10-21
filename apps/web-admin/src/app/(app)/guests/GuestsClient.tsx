"use client";

import { useState, useTransition } from "react";
import { Gem, Search, UsersRound } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import {
  Button,
  ChoicePill,
  SectionCard,
  Switch,
  TextField,
} from "@/components/admin-ui/config";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import {
  listGuests,
  setGuestStanding,
  type GuestPlan,
  type GuestRow,
} from "./actions";

// Manage › Guests (MESITA-2550). Diamond is by invitation (MESITA-2044), so
// an operator grants it here; the plan is Free or Premium. Both show on the
// guest's identity card in the consumer app (MESITA-2548). A tap saves at
// once and rolls back if the server refuses.

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
        description="Grant Diamond and set the plan. Both show on the guest's card in the app."
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [, startSave] = useTransition();

  const search = () => {
    if (searching) return;
    const query = q.trim();
    setError(null);
    startSearch(async () => {
      const r = await listGuests(query);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setGuests(r.guests);
      setShownFor(query);
    });
  };

  const save = (guest: GuestRow, patch: { diamond?: boolean; plan?: GuestPlan }) => {
    if (busyId) return;
    setError(null);
    setBusyId(guest.id);
    const replace = (row: GuestRow) =>
      setGuests((prev) => prev.map((g) => (g.id === row.id ? row : g)));
    replace({ ...guest, ...patch });
    startSave(async () => {
      const r = await setGuestStanding(guest.id, patch);
      setBusyId(null);
      if (!r.ok) {
        replace(guest);
        setError(r.error);
        return;
      }
      replace(r.guest);
    });
  };

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
        {guests.map((g) => {
          const busy = busyId === g.id;
          return (
            <li
              key={g.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              data-guest-row
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {g.diamond && (
                    <Gem className="h-3.5 w-3.5 shrink-0" aria-label="Diamond" />
                  )}
                  <span className="truncate">{g.name}</span>
                </p>
                <p className="text-muted-foreground truncate text-xs tabular-nums">
                  {[g.code ? `Member ${g.code}` : "Member pending", g.instagram && `@${g.instagram}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span className="flex items-center gap-2 text-xs font-medium">
                  Diamond
                  <Switch
                    on={g.diamond}
                    pending={busy}
                    label={`Diamond for ${g.name}`}
                    onClick={() => save(g, { diamond: !g.diamond })}
                  />
                </span>
                <span className="flex items-center gap-1.5" role="group" aria-label={`Plan for ${g.name}`}>
                  {(["free", "premium"] as const).map((p) => (
                    <ChoicePill
                      key={p}
                      active={g.plan === p}
                      disabled={busy}
                      onClick={() => g.plan !== p && save(g, { plan: p })}
                    >
                      {p === "premium" ? "Premium" : "Free"}
                    </ChoicePill>
                  ))}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
