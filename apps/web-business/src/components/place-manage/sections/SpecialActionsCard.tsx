"use client";

// Special actions (Pato, MESITA-3159: "Enrich, Update Google, Update
// Reviews, Enable, Disable… edit is too vague"). The five writes Mesita
// staff run on one place, one row each, one button each:
//
//   Enrich          the whole Enricher run (business-web-enrich-place)
//   Update Google   Google's factuals, never the photos, pins kept
//                   (business-web-update-place-google); also runs by itself
//                   every N views (admin › Uprich)
//   Update Reviews  the Reviews Sync: Google stars, the Apify review list,
//                   Instagram and Facebook followers
//                   (business-web-reload-place-reviews, source "sync"); also
//                   every N views, far less often
//   Enable/Disable  guest visibility, places.state (business-web-set-place-listed);
//                   Disable is confirmed
//   Upgrade         Premier 2X or 5X for N days, given by Mesita, or End
//                   Mesita's Upgrade (business-web-boost-place, MESITA-3180);
//                   the place ranks at the higher of its plan and an Upgrade
//
// The states these change are drawn read-only in Profile States, Reviews
// States and Enrichment.

import { useState } from "react";
import { LightningIcon } from "@phosphor-icons/react/dist/ssr";
import { Loader2 } from "lucide-react";
import { boostPlace, enrichPlace, reloadPlaceReviews, setPlaceListed, updatePlaceGoogle, type AdminPlace, type BoostLine } from "../actions";
import { isEnriching, listedFromState } from "../place-header-state";
import { isEnrichedPlace } from "@/lib/place-enriched";
import { ConfirmDialog, SectionCard } from "@/components/ui/manage";
import { usePlaceContext } from "../PlaceContext";
import { cn } from "@/lib/utils";

type Key = "enrich" | "google" | "reviews" | "enable" | "disable" | "boost" | "end";
type Note = { key: Key; ok: boolean; text: string };

const BUTTON =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
const PRIMARY = `${BUTTON} bg-foreground text-paper hover:opacity-90`;
const QUIET = `${BUTTON} border-border border hover:bg-muted`;

const BOOST_REFUSED: Record<string, string> = {
  not_found: "Not on Mesita.",
  archived: "Archived: not boosted.",
  unlisted: "Disabled: enable it first.",
  paid_higher: "Its paid plan is already higher.",
  cap_reached: "Over a year of Upgrades is queued.",
};

/** What an Upgrade line says: the level and until when, or why it was refused. */
function boostText(line: BoostLine, ended: boolean): Note["text"] {
  if (line.result === "refused") return BOOST_REFUSED[line.code ?? ""] ?? line.code ?? "Refused.";
  if (line.result !== "ok") return "No answer. Try again.";
  const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null);
  const ends = [day(line.ends_at_5x) ? `5X until ${day(line.ends_at_5x)}` : null, day(line.ends_at_2x) ? `2X until ${day(line.ends_at_2x)}` : null]
    .filter(Boolean)
    .join(" · ");
  if (ended) return `Ended ${line.ended_days ?? 0} day${line.ended_days === 1 ? "" : "s"} of Mesita Upgrade.${ends ? ` ${ends} left.` : ""}`;
  return `${line.replayed ? "Already added. " : "Upgraded. "}${ends}`.trim();
}

function Row({
  name,
  detail,
  note,
  stacked = false,
  children,
}: {
  name: string;
  detail: string;
  note: Note | null;
  /** Controls under the text instead of beside it (Upgrade's four, MESITA-3180). */
  stacked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-border/60 flex gap-4 border-b py-3.5 first:pt-0 last:border-b-0 last:pb-0",
        stacked ? "flex-col gap-3" : "items-start justify-between",
      )}
    >
      <div className="min-w-0">
        <span className="text-foreground/90 type-body font-medium">{name}</span>
        <p className="text-foreground/70 mt-1 type-label font-medium">{detail}</p>
        {note ? (
          <p className={cn("mt-1.5 type-label", note.ok ? "text-muted-foreground" : "text-destructive")} aria-live="polite">
            {note.text}
          </p>
        ) : null}
      </div>
      <div className={cn("flex gap-2", stacked ? "flex-wrap" : "shrink-0")}>{children}</div>
    </div>
  );
}

export function SpecialActionsCard({ place }: { place: AdminPlace }) {
  const { setPlace } = usePlaceContext();
  const [busy, setBusy] = useState<Key | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [tier, setTier] = useState<1 | 2>(1);
  const [daysText, setDaysText] = useState("30");
  const days = Number(daysText);
  const daysOk = Number.isInteger(days) && days >= 1 && days <= 366;

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

  function boost(ended: boolean) {
    if (!hasGoogle) return;
    const key: Key = ended ? "end" : "boost";
    if (ended && !window.confirm("End the Upgrade Mesita gave this place? Bought Upgrades stay.")) return;
    setBusy(key);
    setNote(null);
    void boostPlace(
      place.google_place_id as string,
      ended ? { action: "end_mesita_days" } : { action: "refill", tier, days, requestId: crypto.randomUUID() },
    ).then((r) => {
      setBusy(null);
      if (!r.ok) return setNote({ key, ok: false, text: r.error });
      setNote({ key, ok: r.data.result === "ok", text: boostText(r.data, ended) });
    });
  }

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
    <SectionCard icon={<LightningIcon size={20} />} title="Special actions" subtitle="What Mesita runs on this place.">
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
          name="Upgrade"
          detail="Premier 2X or 5X for a number of days, given by Mesita, never a plan. The place ranks at the higher of its plan and an Upgrade."
          note={noteFor("boost") ?? noteFor("end")}
          stacked
        >
          <div className="border-border inline-flex h-9 shrink-0 rounded-full border p-0.5" role="radiogroup" aria-label="Premier">
            {([1, 2] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tier === t}
                disabled={busy !== null}
                onClick={() => setTier(t)}
                className={cn(
                  "rounded-full px-3 text-xs font-semibold disabled:opacity-40",
                  tier === t ? "bg-foreground text-paper" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === 1 ? "2X" : "5X"}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="boost-days">
            Days
          </label>
          <input
            id="boost-days"
            type="number"
            inputMode="numeric"
            min={1}
            max={366}
            value={daysText}
            disabled={busy !== null}
            onChange={(e) => setDaysText(e.target.value)}
            aria-invalid={!daysOk}
            className="border-border bg-background h-9 w-16 shrink-0 rounded-full border px-3 text-center text-xs tabular-nums outline-none disabled:opacity-40"
          />
          <button type="button" disabled={busy !== null || !hasGoogle || !daysOk} onClick={() => boost(false)} className={QUIET}>
            {label("boost", "Upgrade", "Upgrading…")}
          </button>
          <button type="button" disabled={busy !== null || !hasGoogle} onClick={() => boost(true)} className={QUIET}>
            {label("end", "End", "Ending…")}
          </button>
        </Row>
        <Row
          name="Update Google"
          detail="Google's facts. Never touches the photos or Mesita's own name, text or categories. Keeps pinned fields. Also runs by itself every N views."
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
