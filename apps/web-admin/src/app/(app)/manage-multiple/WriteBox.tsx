"use client";

import { Fragment, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { Loader2, Play } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import { placeTabHref } from "@/lib/place-tabs";
import {
  createPlacesFromGooglePlaceIds,
  enrichPlacesAll,
  searchPlacesByGoogleIds,
  setPlacesPremier,
  writePlaces,
  type PremierSet,
} from "./actions";
import { parseGooglePlaceIds } from "./google-place-ids";
import type { CrenupAction } from "./pipeline";
import { IdListField } from "./IdListField";
import { StateIcon, type BatchRowState } from "./StateIcon";

type Row = {
  state: BatchRowState;
  name?: string;
  detail?: string;
  error?: string;
  placeId?: string;
  alreadyExisted?: boolean;
  /** A refused Premier row's door to Single Place › Premier (MESITA-3090). */
  href?: string;
};

type Found = { placeId: string; name: string; listed: boolean };

// Every Google Place ID in the box resolved to its Mesita place with ONE
// search call — the EF takes the box's whole 250. An ID missing from the
// map is not on Mesita.
async function resolveMesitaIds(
  googleIds: string[],
): Promise<{ ok: true; found: Map<string, Found> } | { ok: false; error: string }> {
  const r = await searchPlacesByGoogleIds(googleIds);
  if (!r.ok) return { ok: false, error: r.error };
  const found = new Map<string, Found>();
  for (const hit of r.data) {
    if (!hit.google_place_id) continue;
    found.set(hit.google_place_id, {
      placeId: hit.id,
      name: hit.name || hit.google_name || "",
      listed: hit.listed,
    });
  }
  return { ok: true, found };
}

// One write box: Create, Enrich or Update (MESITA-2096). Each box carries its
// own copy of the shared Google Place ID field — the same text in every box,
// so a paste or a Google Search send reaches all three — plus its own buttons
// and its own result list.

const BUTTONS: Record<
  CrenupAction,
  { label: string; variant: "primary" | "secondary" | "destructive" }
> = {
  create: { label: "Create", variant: "primary" },
  enrich: { label: "Enrich", variant: "primary" },
  list: { label: "Enable", variant: "secondary" },
  unlist: { label: "Disable", variant: "secondary" },
  delete: { label: "Delete", variant: "destructive" },
  "google-update": { label: "Update Google", variant: "primary" },
  "premier-2x": { label: "Premier 2X", variant: "secondary" },
  "premier-5x": { label: "Premier 5X", variant: "secondary" },
  "premier-off": { label: "End Premier", variant: "secondary" },
};

// Premier (MESITA-3090): the tier each button sets. 0 ends the operator grant.
type PremierAction = "premier-2x" | "premier-5x" | "premier-off";
const PREMIER_TIER: Record<PremierAction, 0 | 1 | 2> = {
  "premier-2x": 1,
  "premier-5x": 2,
  "premier-off": 0,
};
const PREMIER_LABEL: Record<number, string> = { 1: "Premier 2X", 2: "Premier 5X" };
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function isPremier(action: CrenupAction): action is PremierAction {
  return action in PREMIER_TIER;
}

export function WriteBox({
  id,
  actions,
  text,
  onTextChange,
}: {
  id: string;
  actions: readonly CrenupAction[];
  text: string;
  onTextChange: (next: string) => void;
}) {
  const placeIds = useMemo(() => parseGooglePlaceIds(text), [text]);
  const [results, setResults] = useState<Record<string, Row>>({});
  const [running, setRunning] = useState<CrenupAction | null>(null);
  const [lastRun, setLastRun] = useState<CrenupAction | null>(null);
  // Premier length for a bulk grant: 12 months unless the operator picks
  // fewer (MESITA-3090).
  const [months, setMonths] = useState(12);
  const busy = running !== null;

  const done = placeIds.filter((id) => {
    const s = results[id]?.state;
    return s === "ok" || s === "existed" || s === "enriching" || s === "refused" || s === "error";
  }).length;
  const created = placeIds.filter((id) => results[id]?.state === "ok").length;
  const existed = placeIds.filter((id) => results[id]?.state === "existed").length;
  const enriching = placeIds.filter((id) => results[id]?.state === "enriching").length;
  const written = placeIds.filter((id) => {
    const s = results[id]?.state;
    return s === "ok" || s === "existed";
  }).length;
  const failed = placeIds.filter((id) => results[id]?.state === "error").length;
  const refused = placeIds.filter((id) => results[id]?.state === "refused").length;

  async function run(action: CrenupAction) {
    if (busy || placeIds.length === 0) return;
    // Delete writes places.state = 'archived' — reversible only by a direct
    // DB edit, never by any button here. One confirm for the whole batch,
    // not per row: the paste is already the commitment, this just catches
    // a fat-fingered click before it archives a hundred places.
    if (action === "delete") {
      const ok = window.confirm(
        placeIds.length === 1
          ? "Delete 1 place? This archives it — no Undo in this console."
          : `Delete ${placeIds.length} places? This archives every one — no Undo in this console.`,
      );
      if (!ok) return;
    }
    setRunning(action);
    setLastRun(action);
    setResults(
      Object.fromEntries(placeIds.map((id) => [id, { state: "pending" as const }])),
    );
    const ids = [...placeIds];
    try {
      if (action === "create") await runCreate(ids, setResults);
      else if (isPremier(action)) {
        await runPremier(ids, PREMIER_TIER[action], PREMIER_TIER[action] === 0 ? null : months, setResults);
      } else await runOnMesita(ids, action, setResults);
    } catch (err) {
      // A Premier run is safe to repeat: set lands every place on the same
      // tier however many times it runs.
      const error = isPremier(action)
        ? "Didn't finish — run again (setting Premier twice is safe)"
        : err instanceof Error
          ? err.message
          : "Unexpected error";
      setResults(
        Object.fromEntries(ids.map((id) => [id, { state: "error" as const, error }])),
      );
    }
    setRunning(null);
  }

  function copyIds(state: BatchRowState) {
    const ids = placeIds.filter((id) => results[id]?.state === state);
    void navigator.clipboard.writeText(ids.join("\n"));
  }

  const summary =
    lastRun && isPremier(lastRun)
      ? premierSummary(lastRun, { set: created, already: existed, refused, failed })
      : lastRun === "create"
      ? `${created} created · ${existed} already on Mesita · ${failed} failed`
      : lastRun === "enrich"
        ? `${enriching} enriching · ${failed} failed`
        : lastRun === "list"
          ? `${written} enabled · ${failed} failed`
          : lastRun === "unlist"
            ? `${written} disabled · ${failed} failed`
            : lastRun === "google-update"
              ? `${written} refreshed · ${failed} failed`
              : `${written} deleted · ${failed} failed`;

  return (
    <div className="space-y-6">
      <IdListField
        id={`${id}-place-ids`}
        label="Google Place IDs"
        text={text}
        onTextChange={onTextChange}
        placeIds={placeIds}
        running={busy}
      />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action, i) => {
            const button = (
              <ActionButton
                key={action}
                label={BUTTONS[action].label}
                variant={BUTTONS[action].variant}
                busy={running === action}
                disabled={busy || placeIds.length === 0}
                onClick={() => void run(action)}
              />
            );
            if (!isPremier(action)) return button;
            // The Premier buttons and their length wrap as one group, so
            // the picker never lands apart from the buttons it sets.
            if (i > 0 && isPremier(actions[i - 1])) return null;
            const group = actions.slice(i).filter(isPremier);
            return (
              <div key="premier" className="inline-flex flex-nowrap items-center gap-2">
                {group.map((a) => (
                  <Fragment key={a}>
                    {a === "premier-off" ? (
                      <label className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                        for
                        <select
                          aria-label="Premier length"
                          value={months}
                          disabled={busy}
                          onChange={(e) => setMonths(Number(e.target.value))}
                          className="border-border text-foreground h-10 rounded-full border bg-transparent px-3 text-sm font-medium disabled:opacity-50"
                        >
                          {MONTHS.map((m) => (
                            <option key={m} value={m}>
                              {m === 1 ? "1 month" : `${m} months`}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <ActionButton
                      label={BUTTONS[a].label}
                      variant={BUTTONS[a].variant}
                      busy={running === a}
                      disabled={busy || placeIds.length === 0}
                      onClick={() => void run(a)}
                    />
                  </Fragment>
                ))}
              </div>
            );
          })}
          {done > 0 ? (
            <span className="text-muted-foreground text-xs">{summary}</span>
          ) : null}
          {failed > 0 && !running ? (
            <button
              type="button"
              onClick={() => copyIds("error")}
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
            >
              Copy failed IDs
            </button>
          ) : null}
          {refused > 0 && !running ? (
            <button
              type="button"
              onClick={() => copyIds("refused")}
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
            >
              Copy refused IDs
            </button>
          ) : null}
        </div>
        {Object.keys(results).length > 0 ? (
          <ResultList placeIds={placeIds} results={results} />
        ) : null}
      </div>
    </div>
  );
}

function ResultList({
  placeIds,
  results,
}: {
  placeIds: string[];
  results: Record<string, Row>;
}) {
  return (
    <div className="border-border bg-card mt-3 overflow-hidden rounded-2xl border">
      <ul className="divide-border/60 divide-y">
        {placeIds.map((id) => {
          const r = results[id];
          if (!r) return null;
          return (
            <li key={id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <StateIcon state={r.state} />
              <div className="min-w-0 flex-1">
                {r.name ? (
                  <span className="truncate font-medium">{r.name}</span>
                ) : (
                  <span className="text-muted-foreground font-mono text-xs">
                    {id}
                  </span>
                )}
                {r.detail ? (
                  <p className="text-muted-foreground type-label">{r.detail}</p>
                ) : null}
                {r.href ? (
                  <Link
                    href={r.href}
                    className="type-label font-medium underline underline-offset-2"
                  >
                    Open in Single Place →
                  </Link>
                ) : null}
                {r.error ? (
                  <p className="text-destructive type-label">{r.error}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Primary = the Create or Enrich box's one action (matches the "Look up on Mesita" filled pill
// in MesitaSearchTab). Destructive marks the one action that cannot be undone
// from this console. List and Unlist share the Update box and are reversible,
// so they take the same outline secondary pill as MesitaSearchTab's "All
// places" — three identical black buttons read as three equally important
// actions when they are not.
function ActionButton({
  label,
  title,
  variant,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  title?: string;
  variant: "primary" | "secondary" | "destructive";
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const className =
    variant === "primary"
      ? "bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
      : variant === "destructive"
        ? "border-destructive/40 text-destructive hover:bg-destructive/5 inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition disabled:opacity-50"
        : "border-border hover:border-foreground/40 inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition disabled:opacity-50";
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} className={className}>
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Play className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}

// Every box run is ONE server action that calls all its edge functions at
// once (MESITA-3085): the browser runs server actions one at a time, so a
// call per row ran the rows in series. Rows fill in when the batch returns.

async function runCreate(
  googleIds: string[],
  setResults: Dispatch<SetStateAction<Record<string, Row>>>,
): Promise<void> {
  setResults(
    Object.fromEntries(googleIds.map((id) => [id, { state: "running" as const }])),
  );
  const created = await createPlacesFromGooglePlaceIds(googleIds);
  setResults(
    Object.fromEntries(
      googleIds.map((id): [string, Row] => {
        const r = created[id];
        if (!r) return [id, { state: "error", error: "No result" }];
        if (!r.ok) return [id, { state: "error", error: r.error }];
        if (r.alreadyExisted) {
          return [id, {
            state: "existed",
            name: r.name,
            detail: "Already on Mesita — skipped create",
            placeId: r.placeId,
            alreadyExisted: true,
          }];
        }
        return [id, {
          state: "ok",
          name: r.name,
          detail: "Created · not enriched",
          placeId: r.placeId,
        }];
      }),
    ),
  );
}

// Enrich, Update, Enable, Disable and Delete write a place already on
// Mesita: one lookup for the whole box, then one batch for every place
// found. Enrich starts its chunks of 50 at once; Render queues them.
async function runOnMesita(
  googleIds: string[],
  action: Exclude<CrenupAction, "create" | PremierAction>,
  setResults: Dispatch<SetStateAction<Record<string, Row>>>,
): Promise<void> {
  setResults(
    Object.fromEntries(googleIds.map((id) => [id, { state: "running" as const }])),
  );
  const lookup = await resolveMesitaIds(googleIds);
  if (!lookup.ok) {
    setResults(
      Object.fromEntries(
        googleIds.map((id) => [id, { state: "error" as const, error: lookup.error }]),
      ),
    );
    return;
  }
  const placeIds = googleIds
    .map((id) => lookup.found.get(id)?.placeId)
    .filter((id): id is string => Boolean(id));
  const written =
    placeIds.length === 0
      ? {}
      : action === "enrich"
        ? await enrichPlacesAll(placeIds)
        : await writePlaces(placeIds, action);
  setResults(
    Object.fromEntries(
      googleIds.map((googleId): [string, Row] => {
        const found = lookup.found.get(googleId);
        if (!found) return [googleId, { state: "error", error: "Not on Mesita" }];
        const r = written[found.placeId];
        if (!r) return [googleId, { state: "error", name: found.name, error: "No result" }];
        if (!r.ok) return [googleId, { state: "error", name: found.name, error: r.error }];
        return [googleId, doneRow(found, action)];
      }),
    ),
  );
}

function doneRow(found: Found, action: Exclude<CrenupAction, "create" | PremierAction>): Row {
  if (action === "enrich") {
    return { state: "enriching", name: found.name, detail: "Enrich started" };
  }
  const detail =
    action === "google-update"
      ? "Google data refreshed"
      : action === "delete"
        ? "Archived"
        : action === "list"
          ? "Enabled"
          : "Disabled";
  return { state: "ok", name: found.name, detail };
}

// Premier 2X · Premier 5X · End Premier (MESITA-3090): one lookup, then one
// batch that moves every found place to the tier. A refusal (a guest pays,
// guests waiting, a guest checking out, archived) leaves the place
// unchanged and shows amber, not as a failure.
async function runPremier(
  googleIds: string[],
  tier: 0 | 1 | 2,
  months: number | null,
  setResults: Dispatch<SetStateAction<Record<string, Row>>>,
): Promise<void> {
  setResults(
    Object.fromEntries(googleIds.map((id) => [id, { state: "running" as const }])),
  );
  const lookup = await resolveMesitaIds(googleIds);
  if (!lookup.ok) {
    setResults(
      Object.fromEntries(
        googleIds.map((id) => [id, { state: "error" as const, error: lookup.error }]),
      ),
    );
    return;
  }
  const placeIds = googleIds
    .map((id) => lookup.found.get(id)?.placeId)
    .filter((id): id is string => Boolean(id));
  const set = placeIds.length === 0 ? {} : await setPlacesPremier(placeIds, tier, months);
  setResults(
    Object.fromEntries(
      googleIds.map((googleId): [string, Row] => {
        const found = lookup.found.get(googleId);
        if (!found) {
          return [googleId, { state: "error", error: "Not on Mesita — create it in the Create box first" }];
        }
        return [googleId, premierRow(found, tier, set[found.placeId])];
      }),
    ),
  );
}

const REFUSED_CODES = new Set(["guest_pays", "guests_waiting", "guest_checking_out", "place_archived"]);

function premierRow(
  found: Found,
  tier: 0 | 1 | 2,
  r: { ok: true; data: PremierSet } | { ok: false; error: string; code?: string | null } | undefined,
): Row {
  const name = found.name;
  if (!r) return { state: "error", name, error: "No result" };
  if (!r.ok) {
    if (r.code && REFUSED_CODES.has(r.code)) {
      return {
        state: "refused",
        name,
        detail: r.error,
        href: r.code === "place_archived" ? undefined : placeTabHref(found.placeId, "boost"),
      };
    }
    return { state: "error", name, error: r.error };
  }
  const { result, ends_at, previous_tier, previous_ends_at } = r.data;
  if (result === "already") return { state: "existed", name, detail: "Already not Premier" };
  if (result === "ended") return { state: "ok", name, detail: "Not Premier" };
  const label = PREMIER_LABEL[tier];
  const until = ends_at ? ` · until ${formatShortDate(ends_at)}` : "";
  const head =
    previous_tier && previous_tier !== tier ? `${PREMIER_LABEL[previous_tier]} → ${label.slice(8)}` : label;
  const was =
    previous_tier === tier && previous_ends_at ? ` (was ${formatShortDate(previous_ends_at)})` : "";
  return {
    state: "ok",
    name,
    detail: `${head}${until}${was}${found.listed ? "" : " · disabled"}`,
  };
}

function premierSummary(
  action: PremierAction,
  n: { set: number; already: number; refused: number; failed: number },
): string {
  const tail = ` · ${n.refused} refused · ${n.failed} failed`;
  if (action === "premier-off") return `${n.set} ended · ${n.already} already not Premier${tail}`;
  return `${n.set} set to ${PREMIER_LABEL[PREMIER_TIER[action]]} · ${n.already} already${tail}`;
}
