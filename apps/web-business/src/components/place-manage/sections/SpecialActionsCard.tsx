"use client";

// Special actions (Pato, MESITA-3159: "Enrich, Update Google, Update
// Reviews, Enable, Disable… edit is too vague"). The five writes Mesita
// staff run on one place, one row each, one button each:
//
//   Enrich          the whole Enricher run (business-web-enrich-place)
//   Update Google   Google's factuals and a lone hero, pins kept
//                   (business-web-update-place-google); also runs by itself
//                   every N views (admin › Updating)
//   Update Reviews  the Reviews Sync: Google stars, the Apify review list,
//                   Instagram and Facebook followers
//                   (business-web-reload-place-reviews, source "sync"); also
//                   every N views, far less often
//   Enable/Disable  guest visibility, places.state (business-web-set-place-listed);
//                   Disable is confirmed
//
// The states these change are drawn read-only in Profile States, Reviews
// States and Enrichment.

import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { enrichPlace, reloadPlaceReviews, setPlaceListed, updatePlaceGoogle, type AdminPlace } from "../actions";
import { isEnriching, listedFromState } from "../place-header-state";
import { isEnrichedPlace } from "@/lib/place-enriched";
import { ConfirmDialog, SectionCard } from "@/components/ui/manage";
import { usePlaceContext } from "../PlaceContext";
import { cn } from "@/lib/utils";

type Key = "enrich" | "google" | "reviews" | "enable" | "disable";
type Note = { key: Key; ok: boolean; text: string };

const BUTTON =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
const PRIMARY = `${BUTTON} bg-foreground text-paper hover:opacity-90`;
const QUIET = `${BUTTON} border-border border hover:bg-muted`;

function Row({
  name,
  detail,
  note,
  children,
}: {
  name: string;
  detail: string;
  note: Note | null;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/60 flex items-start justify-between gap-4 border-b py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <span className="text-foreground/90 type-body font-medium">{name}</span>
        <p className="text-foreground/70 mt-1 type-label font-medium">{detail}</p>
        {note ? (
          <p className={cn("mt-1.5 type-label", note.ok ? "text-muted-foreground" : "text-destructive")} aria-live="polite">
            {note.text}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </div>
  );
}

export function SpecialActionsCard({ place }: { place: AdminPlace }) {
  const { setPlace } = usePlaceContext();
  const [busy, setBusy] = useState<Key | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const listed = listedFromState(place.state);
  const enriching = isEnriching({ content_state: typeof place.content_state === "string" ? place.content_state : null, last_enriched_at: null });
  const hasGoogle = typeof place.google_place_id === "string" && place.google_place_id.trim() !== "";
  const noteFor = (key: Key) => (note?.key === key ? note : null);

  async function run(key: Key, fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setBusy(key);
    setNote(null);
    const r = await fn();
    setBusy(null);
    setNote(r.ok ? { key, ok: true, text: done } : { key, ok: false, text: r.error ?? "Something went wrong" });
  }

  const label = (key: Key, idle: string, working: string) =>
    busy === key ? (
      <>
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> {working}
      </>
    ) : (
      idle
    );

  function setListed(next: boolean) {
    const key: Key = next ? "enable" : "disable";
    setBusy(key);
    setNote(null);
    void setPlaceListed(place.id, next).then((r) => {
      setBusy(null);
      setConfirmDisable(false);
      if (!r.ok) return setNote({ key, ok: false, text: r.error });
      setPlace(r.data);
      setNote({ key, ok: true, text: next ? "Enabled. Guests can find it again." : "Disabled. Guests no longer see it." });
    });
  }

  return (
    <SectionCard icon={<Zap className="h-4 w-4" />} tint="amber" title="Special actions" subtitle="What Mesita runs on this place.">
      <div className="mt-5 flex flex-col">
        <Row name="Enrich" detail="The whole Enricher run: links, reviews, photos and the presentation. Replaces what it finds." note={noteFor("enrich")}>
          <button
            type="button"
            disabled={busy !== null || enriching || !hasGoogle}
            onClick={() => {
              if (isEnrichedPlace(place) && !window.confirm("This place is already enriched. Run Enrich again?")) return;
              void run("enrich", () => enrichPlace(place.id), "Started. The profile is written once the run finishes.");
            }}
            className={PRIMARY}
          >
            {enriching ? "Enriching…" : label("enrich", "Enrich", "Starting…")}
          </button>
        </Row>
        <Row
          name="Update Google"
          detail="Google's facts and, while the gallery is one photo, its hero. Never touches Mesita's own name, text or categories. Keeps pinned fields. Also runs by itself every N views."
          note={noteFor("google")}
        >
          <button
            type="button"
            disabled={busy !== null || !hasGoogle}
            onClick={() => void run("google", () => updatePlaceGoogle(place.id), "Updated from Google. Reload to see it.")}
            className={QUIET}
          >
            {label("google", "Update Google", "Updating…")}
          </button>
        </Row>
        <Row
          name="Update Reviews"
          detail="Google stars, up to 100 Google reviews (Apify), Instagram and Facebook followers. Also runs by itself every N views, less often."
          note={noteFor("reviews")}
        >
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run("reviews", () => reloadPlaceReviews(place.id, "sync"), "Reviews updated. Reload to see them.")}
            className={QUIET}
          >
            {label("reviews", "Update Reviews", "Updating…")}
          </button>
        </Row>
        <Row
          name="Enable · Disable"
          detail={
            listed === "unknown"
              ? "Couldn't read whether guests can see this place."
              : listed
                ? "Enabled: guests find it everywhere. Disable hides it at once; nothing is deleted."
                : "Disabled: no guest surface shows it. Enable brings it back."
          }
          note={noteFor("enable") ?? noteFor("disable")}
        >
          <button type="button" disabled={busy !== null || listed !== false} onClick={() => setListed(true)} className={QUIET}>
            {label("enable", "Enable", "Enabling…")}
          </button>
          <button type="button" disabled={busy !== null || listed !== true} onClick={() => setConfirmDisable(true)} className={QUIET}>
            {label("disable", "Disable", "Disabling…")}
          </button>
        </Row>
      </div>

      <ConfirmDialog
        open={confirmDisable}
        title="Disable this place?"
        danger
        busy={busy === "disable"}
        confirmLabel="Disable"
        body={
          <p>
            Guests stop finding {place.name} everywhere at once — browse, search, and any link already shared. Tickets and history are
            untouched, and you can enable it again whenever you want.
          </p>
        }
        onConfirm={() => setListed(false)}
        onCancel={() => setConfirmDisable(false)}
      />
    </SectionCard>
  );
}
