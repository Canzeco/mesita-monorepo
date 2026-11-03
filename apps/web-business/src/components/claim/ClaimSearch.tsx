"use client";

// Claim your place (MESITA-3103; Google search + Add and claim MESITA-3112).
// One field, searched as you type (Google's names through the Admin &
// Business Name Pipeline, the way the consumer app's Add a place searches).
// A place Mesita holds opens its claim form; a Google listing Mesita doesn't
// hold yet says "Not on Mesita yet" and Add and claim adds it
// (business-web-create-place), then opens the same claim form. Adding a
// place grants nothing: Mesita still reviews the claim.
// The same field heads Places (MESITA-3126); for Mesita staff it opens any
// place Mesita holds instead (`open`). Staff see Google-only listings too
// (MESITA-3134, Pato: "google and mesita, like the searchbar in consumer
// app"): their Add adds the place and opens its profile, since staff run any
// place without a claim. Everyone else still claims what they add. A
// Google-only row opens Google's preview first (MESITA-3138): hero photo,
// category, stars and address, then Add. Claim, and Add and claim once the
// place is added, open the claim flow in a modal (MESITA-3139): a call to
// the listing's phone with a code, or Mesita checks by hand.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { createPlace, findPlaces, type ClaimablePlace, type FoundPlace } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { AddPlaceDialog } from "./AddPlaceDialog";
import { ClaimDialog } from "./ClaimDialog";
import { INPUT_BASE } from "@/components/ui/manage";
import { claimHref, placeTabHref } from "@/lib/routes";

const MIN_QUERY = 2;
const SEARCH_DELAY_MS = 400;

const MINE_COPY: Record<NonNullable<FoundPlace["mine"]>, string> = {
  owner: "You run this place",
  pending: "Your request is in review",
  expired: "Your verification ended",
};

const CREATE_ERRORS: Record<string, string> = {
  create_quota_exceeded: "You've added the most places allowed today. Try again tomorrow.",
  account_deleted: "This account was deleted.",
};

function newSessionToken(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function Thumb({ photo }: { photo: string | null }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className="size-12 shrink-0 rounded-xl object-cover" />;
  }
  return <span className="bg-muted size-12 shrink-0 rounded-xl" />;
}

export function ClaimSearch({ open = false }: { open?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<FoundPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  // The Google-only row whose preview dialog is open.
  const [picked, setPicked] = useState<FoundPlace | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  // The place whose claim modal is open, and whether it was just added.
  const [claiming, setClaiming] = useState<{ place: ClaimablePlace; added: boolean; enriching: boolean } | null>(null);
  // One Google session per search run; a new run after a pick gets a new one.
  const session = useRef<string | null>(null);
  const seq = useRef(0);

  async function search(text: string) {
    const query = text.trim();
    if (query.length < MIN_QUERY) return;
    const mine = ++seq.current;
    setBusy(true);
    setError(null);
    session.current ??= newSessionToken();
    const r = await findPlaces({ q: query, sessionToken: session.current });
    if (mine !== seq.current) return; // a newer search answered first
    setBusy(false);
    if (!r.ok) setError(r.error);
    else setRows(r.data);
  }

  // Search as you type, after a short pause.
  useEffect(() => {
    if (q.trim().length < MIN_QUERY) return;
    const t = setTimeout(() => void search(q), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [q]);

  async function add(p: FoundPlace) {
    if (!p.google_place_id || adding) return;
    setAdding(p.google_place_id);
    setAddError(null);
    const r = await createPlace(p.google_place_id);
    if (!r.ok) {
      setAdding(null);
      setAddError((r.code && CREATE_ERRORS[r.code]) || r.error);
      return;
    }
    session.current = null;
    if (open) {
      router.push(placeTabHref(r.data.placeId, "profile"));
      return;
    }
    // The new place, with its listing phone, for the claim modal.
    const found = await findPlaces({ placeId: r.data.placeId });
    setAdding(null);
    setPicked(null);
    const hit = found.ok ? found.data[0] : null;
    if (hit?.id) setClaiming({ place: hit as ClaimablePlace, added: r.data.created, enriching: r.data.enriching });
    else router.push(claimHref(r.data.placeId, { added: r.data.created }));
  }

  const empty = rows !== null && rows.length === 0 && q.trim().length >= MIN_QUERY && !busy;

  return (
    <Card className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={open ? "Search any place" : "Search for your place"}
          className={`${INPUT_BASE} h-11 px-3`}
          aria-label={open ? "Search any place" : "Search for your place"}
        />
        <button type="submit" disabled={busy} className="bg-foreground text-background inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60">
          <Search className="size-4" aria-hidden /> {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {empty ? (
        <p className="text-muted-foreground text-sm">
          Google doesn&apos;t know that name either. Check the spelling, or add the city.
        </p>
      ) : null}
      {rows && rows.length > 0 ? (
        <ul className="divide-border divide-y">
          {rows.map((p) =>
            p.id ? (
              <li key={p.id}>
                {open ? (
                  <Link href={placeTabHref(p.id, "profile")} className="hover:bg-muted/50 flex items-center gap-4 px-1 py-3">
                    <Thumb photo={p.photo} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name ?? "Unnamed place"}</span>
                      <span className="text-muted-foreground block truncate text-sm">{p.mine ? MINE_COPY[p.mine] : (p.address ?? "")}</span>
                    </span>
                    <span className="border-border shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold">Open</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setClaiming({ place: p as ClaimablePlace, added: false, enriching: false })}
                    className="hover:bg-muted/50 flex w-full items-center gap-4 px-1 py-3 text-left"
                  >
                    <Thumb photo={p.photo} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name ?? "Unnamed place"}</span>
                      <span className="text-muted-foreground block truncate text-sm">{p.mine ? MINE_COPY[p.mine] : (p.address ?? "")}</span>
                    </span>
                    <span className="border-border shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold">{p.mine === "owner" ? "Open" : "Claim"}</span>
                  </button>
                )}
              </li>
            ) : (
              <li key={p.google_place_id ?? p.name}>
                <button
                  type="button"
                  onClick={() => {
                    setAddError(null);
                    setPicked(p);
                  }}
                  className="hover:bg-muted/50 flex w-full items-center gap-4 px-1 py-3 text-left"
                >
                  <Thumb photo={null} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name ?? "Unnamed place"}</span>
                    <span className="text-muted-foreground block truncate text-sm">
                      Not on Mesita yet{p.address ? ` · ${p.address}` : ""}
                    </span>
                  </span>
                  <span className="bg-foreground text-background inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold">
                    <Plus className="size-4" aria-hidden />
                    {open ? "Add" : "Add and claim"}
                  </span>
                </button>
              </li>
            ),
          )}
        </ul>
      ) : null}
      <AddPlaceDialog
        place={picked}
        label={open ? "Add" : "Add and claim"}
        adding={!!picked && adding === picked.google_place_id}
        error={addError}
        onConfirm={() => picked && void add(picked)}
        onClose={() => setPicked(null)}
      />
      <ClaimDialog
        place={claiming?.place ?? null}
        added={claiming?.added ?? false}
        enriching={claiming?.enriching ?? false}
        onClose={() => setClaiming(null)}
      />
    </Card>
  );
}
