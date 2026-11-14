"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Loader2, Play } from "lucide-react";
import {
  createPlacesFromGooglePlaceIds,
  enrichPlacesAll,
  searchPlacesByGoogleIds,
  writePlaces,
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

// A write box: Mesita Create, Mesita Edit or Mesita Delete (MESITA-3942).
// Each box shows its own copy of the shared Google Place ID field — the same
// text in every box — plus its buttons and its own result list. While any
// box runs, every box is locked (`locked`), so two runs never overlap.

type Group = "refresh" | "visibility";

const BUTTONS: Record<
  CrenupAction,
  {
    label: string;
    variant: "primary" | "secondary" | "destructive";
    group?: Group;
    meta?: string;
  }
> = {
  create: { label: "Create", variant: "primary" },
  "google-update": {
    label: "Fast Update",
    variant: "primary",
    group: "refresh",
    meta: "Google's facts · free",
  },
  "reviews-update": {
    label: "Deep Update",
    variant: "secondary",
    group: "refresh",
    meta: "Reviews and followers · paid scrape",
  },
  enrich: {
    label: "Deep Enrich",
    variant: "secondary",
    group: "refresh",
    meta: "Whole Enricher run · paid · places with no owner",
  },
  list: { label: "Enable", variant: "secondary", group: "visibility", meta: "Guests see it" },
  unlist: {
    label: "Disable",
    variant: "secondary",
    group: "visibility",
    meta: "Guests stop seeing it",
  },
  delete: { label: "Delete", variant: "destructive" },
};

const GROUP_LABEL: Record<Group, string> = { refresh: "Refresh", visibility: "Visibility" };

/** Enable and Disable confirm only past this many places. */
const VISIBILITY_CONFIRM_OVER = 10;
/** Delete asks for the typed count past this many places. */
const DELETE_TYPE_OVER = 10;

function places(n: number): string {
  return n === 1 ? "1 place" : `${n} places`;
}

/** The confirm a paid or visibility write needs before it runs, or null. */
export function confirmFor(action: CrenupAction, n: number): string | null {
  if (action === "enrich") {
    return `Deep Enrich: up to ${n} paid run${n === 1 ? "" : "s"}. Places with an owner are refused.`;
  }
  if (action === "reviews-update") {
    return `Deep Update: up to ${n} paid scrape${n === 1 ? "" : "s"}.`;
  }
  if (action === "list" && n > VISIBILITY_CONFIRM_OVER) {
    return `Enable ${places(n)}? Guests will see them.`;
  }
  if (action === "unlist" && n > VISIBILITY_CONFIRM_OVER) {
    return `Disable ${places(n)}? Guests will stop seeing them.`;
  }
  return null;
}

export function WriteBox({
  id,
  actions,
  text,
  onTextChange,
  sourceLine,
  locked,
  onRunStart,
  onRunEnd,
}: {
  id: string;
  actions: readonly CrenupAction[];
  text: string;
  onTextChange: (next: string) => void;
  /** "N IDs from … · filter: …" while the box still holds what was sent. */
  sourceLine?: string | null;
  /** Another box is running. */
  locked: boolean;
  onRunStart: () => void;
  onRunEnd: (action: CrenupAction) => void;
}) {
  const placeIds = useMemo(() => parseGooglePlaceIds(text), [text]);
  const [results, setResults] = useState<Record<string, Row>>({});
  // The IDs the last run used: the result list and its counts read these,
  // never the live box, so editing the box after a run cannot rewrite it.
  const [ranIds, setRanIds] = useState<string[]>([]);
  const [running, setRunning] = useState<CrenupAction | null>(null);
  const [lastRun, setLastRun] = useState<CrenupAction | null>(null);
  const busy = running !== null || locked;

  const count = (pred: (s: BatchRowState | undefined) => boolean) =>
    ranIds.filter((id) => pred(results[id]?.state)).length;
  const done = count(
    (s) => s === "ok" || s === "existed" || s === "enriching" || s === "refused" || s === "error",
  );
  const created = count((s) => s === "ok");
  const existed = count((s) => s === "existed");
  const enriching = count((s) => s === "enriching");
  const skipped = count((s) => s === "refused");
  const written = count((s) => s === "ok" || s === "existed");
  const failed = count((s) => s === "error");

  async function run(action: CrenupAction) {
    if (busy || placeIds.length === 0) return;
    const n = placeIds.length;
    // Paid and visibility writes confirm BEFORE anything runs.
    const ask = confirmFor(action, n);
    if (ask !== null && !window.confirm(ask)) return;
    // Delete writes places.state = 'archived' — reversible only by a direct
    // DB edit, never by any button here. One confirm naming the count, and
    // past 10 places the operator types the number.
    if (action === "delete") {
      const ok = window.confirm(
        `Delete ${places(n)}? No Undo in this console.`,
      );
      if (!ok) return;
      if (n > DELETE_TYPE_OVER) {
        const typed = window.prompt(`Type ${n} to delete ${n} places`);
        if (typed === null || parseInt(typed.trim(), 10) !== n) return;
      }
    }
    const ids = [...placeIds];
    setRunning(action);
    setLastRun(action);
    setRanIds(ids);
    onRunStart();
    setResults(Object.fromEntries(ids.map((id) => [id, { state: "pending" as const }])));
    try {
      if (action === "create") await runCreate(ids, setResults);
      else await runOnMesita(ids, action, setResults);
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unexpected error";
      setResults(
        Object.fromEntries(ids.map((id) => [id, { state: "error" as const, error }])),
      );
    }
    setRunning(null);
    onRunEnd(action);
  }

  function copyIds(state: BatchRowState) {
    const ids = ranIds.filter((id) => results[id]?.state === state);
    void navigator.clipboard.writeText(ids.join("\n"));
  }

  const summary =
    lastRun === "create"
      ? `${created} created · ${existed} already on Mesita · ${failed} failed`
      : lastRun === "enrich"
        ? `${enriching} started · ${skipped} skipped (owner or already enriching) · ${failed} failed`
        : lastRun === "list"
          ? `${written} enabled · ${failed} failed`
          : lastRun === "unlist"
            ? `${written} disabled · ${failed} failed`
            : lastRun === "google-update" || lastRun === "reviews-update"
              ? `${written} refreshed · ${failed} failed`
              : `${written} deleted · ${failed} failed`;

  // Buttons sit in labelled groups when the box has more than one group
  // (Mesita Edit: Refresh, Visibility); a one-button box is just the button.
  const groups: Array<{ label: string | null; actions: CrenupAction[] }> = [];
  for (const action of actions) {
    const g = BUTTONS[action].group;
    const label = g ? GROUP_LABEL[g] : null;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.actions.push(action);
    else groups.push({ label, actions: [action] });
  }
  const labelled = groups.length > 1;

  return (
    <div className="space-y-6">
      <div>
        <IdListField
          id={`${id}-place-ids`}
          label="Google Place IDs"
          text={text}
          onTextChange={onTextChange}
          placeIds={placeIds}
          running={busy}
        />
        {sourceLine ? (
          <p className="text-muted-foreground mt-2 text-xs tabular-nums">{sourceLine}</p>
        ) : null}
      </div>

      <div>
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.label ?? "only"} role={labelled ? "group" : undefined} aria-label={group.label ?? undefined}>
              {labelled ? (
                <p className="text-muted-foreground type-label mb-2 font-semibold tracking-[0.12em] uppercase">
                  {group.label}
                </p>
              ) : null}
              <div className="flex flex-wrap items-start gap-3">
                {group.actions.map((action) => (
                  <div key={action} className="flex flex-col gap-1">
                    <ActionButton
                      label={BUTTONS[action].label}
                      variant={BUTTONS[action].variant}
                      busy={running === action}
                      disabled={busy || placeIds.length === 0}
                      onClick={() => void run(action)}
                    />
                    {BUTTONS[action].meta ? (
                      <span className="text-muted-foreground px-1 text-xs">
                        {BUTTONS[action].meta}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {done > 0 || (failed > 0 && !running) ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {done > 0 ? (
              <span className="text-muted-foreground text-xs tabular-nums">{summary}</span>
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
          </div>
        ) : null}
        {Object.keys(results).length > 0 ? (
          <ResultList placeIds={ranIds} results={results} />
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

// Primary = the box's main action: Create, or Fast Update in Mesita Edit
// (free, the everyday refresh). Destructive marks Delete, the one action that
// cannot be undone from this console. Everything else is an outline pill, so
// the paid and visibility writes never read as the default click.
function ActionButton({
  label,
  variant,
  busy,
  disabled,
  onClick,
}: {
  label: string;
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
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
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

// Every Edit button and Delete write a place already on Mesita: one lookup
// for the whole box, then one batch for every place found. Deep Enrich starts
// its chunks of 50 at once; Render queues them.
async function runOnMesita(
  googleIds: string[],
  action: Exclude<CrenupAction, "create">,
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
  const written: Record<
    string,
    { ok: true; data: unknown } | { ok: false; error: string }
  > =
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
        if (action === "enrich" && r.data === "skipped") {
          return [googleId, {
            state: "refused",
            name: found.name,
            detail: "skipped (owner or already enriching)",
          }];
        }
        return [googleId, doneRow(found, action)];
      }),
    ),
  );
}

function doneRow(found: Found, action: Exclude<CrenupAction, "create">): Row {
  if (action === "enrich") {
    return { state: "enriching", name: found.name, detail: "Deep Enrich started" };
  }
  const detail =
    action === "google-update"
      ? "Google data refreshed"
      : action === "reviews-update"
        ? "Reviews and followers refreshed"
        : action === "delete"
          ? "Archived"
          : action === "list"
            ? "Enabled"
            : "Disabled";
  return { state: "ok", name: found.name, detail };
}
