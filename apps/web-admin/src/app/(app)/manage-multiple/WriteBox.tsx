"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Loader2, Play } from "lucide-react";
import {
  createPlaceFromGooglePlaceId,
  deletePlace,
  enrichPlaces,
  updatePlacesGoogle,
  searchPlacesByGoogleIds,
  setPlaceListed,
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

type Found = { placeId: string; name: string };

// The most places one Enrich start carries: ENRICH_MAX_PLACES in
// supabase/functions/_shared/enrich-start.ts, which refuses the whole call
// past it. The box holds 250, so a longer list starts in chunks
// (MESITA-3084).
const ENRICH_CHUNK = 50;

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
};

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
  const busy = running !== null;

  const done = placeIds.filter((id) => {
    const s = results[id]?.state;
    return s === "ok" || s === "existed" || s === "enriching" || s === "error";
  }).length;
  const created = placeIds.filter((id) => results[id]?.state === "ok").length;
  const existed = placeIds.filter((id) => results[id]?.state === "existed").length;
  const enriching = placeIds.filter((id) => results[id]?.state === "enriching").length;
  const written = placeIds.filter((id) => {
    const s = results[id]?.state;
    return s === "ok" || s === "existed";
  }).length;
  const failed = placeIds.filter((id) => results[id]?.state === "error").length;

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
    if (action === "create") {
      await Promise.all(ids.map((id) => runRow(id, () => createOne(id), setResults)));
    } else {
      await runOnMesita(ids, action, setResults);
    }
    setRunning(null);
  }

  function copyFailed() {
    const ids = placeIds.filter((id) => results[id]?.state === "error");
    void navigator.clipboard.writeText(ids.join("\n"));
  }

  const summary =
    lastRun === "create"
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
          {actions.map((action) => (
            <ActionButton
              key={action}
              label={BUTTONS[action].label}
              variant={BUTTONS[action].variant}
              busy={running === action}
              disabled={busy || placeIds.length === 0}
              onClick={() => void run(action)}
            />
          ))}
          {done > 0 ? (
            <span className="text-muted-foreground text-xs">{summary}</span>
          ) : null}
          {failed > 0 && !running ? (
            <button
              type="button"
              onClick={copyFailed}
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
            >
              Copy failed IDs
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

// Enrich, Update, Enable, Disable and Delete write a place already on
// Mesita: one lookup for the whole box, then the write. Enrich starts the
// found places in chunks of ENRICH_CHUNK, each row reporting its own chunk;
// the rest fan out one call per place.
async function runOnMesita(
  googleIds: string[],
  action: Exclude<CrenupAction, "create">,
  setResults: Dispatch<SetStateAction<Record<string, Row>>>,
): Promise<void> {
  setResults(
    Object.fromEntries(googleIds.map((id) => [id, { state: "running" as const }])),
  );
  const lookup = await resolveMesitaIds(googleIds).catch((err: unknown) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : "Unexpected error",
  }));
  if (!lookup.ok) {
    setResults(
      Object.fromEntries(
        googleIds.map((id) => [id, { state: "error" as const, error: lookup.error }]),
      ),
    );
    return;
  }
  const resolved: { googleId: string; found: Found }[] = [];
  for (const googleId of googleIds) {
    const found = lookup.found.get(googleId);
    if (found) resolved.push({ googleId, found });
    else {
      setResults((prev) => ({
        ...prev,
        [googleId]: { state: "error", error: "Not on Mesita" },
      }));
    }
  }
  if (action === "enrich") {
    for (let i = 0; i < resolved.length; i += ENRICH_CHUNK) {
      await enrichChunk(resolved.slice(i, i + ENRICH_CHUNK), setResults);
    }
    return;
  }
  await Promise.all(
    resolved.map(({ googleId, found }) =>
      runRow(googleId, () => writeOne(found, action), setResults),
    ),
  );
}

async function enrichChunk(
  chunk: { googleId: string; found: Found }[],
  setResults: Dispatch<SetStateAction<Record<string, Row>>>,
): Promise<void> {
  const started = await enrichPlaces(chunk.map((row) => row.found.placeId)).catch(
    (err: unknown) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : "Unexpected error",
    }),
  );
  setResults((prev) => {
    const next = { ...prev };
    for (const { googleId, found } of chunk) {
      next[googleId] = started.ok
        ? { state: "enriching", name: found.name, detail: "Enrich started" }
        : { state: "error", name: found.name, error: started.error };
    }
    return next;
  });
}

async function runRow(
  googleId: string,
  write: () => Promise<Row>,
  setResults: Dispatch<SetStateAction<Record<string, Row>>>,
): Promise<void> {
  setResults((prev) => ({ ...prev, [googleId]: { state: "running" } }));
  try {
    const row = await write();
    setResults((prev) => ({ ...prev, [googleId]: row }));
  } catch (err) {
    setResults((prev) => ({
      ...prev,
      [googleId]: {
        state: "error",
        error: err instanceof Error ? err.message : "Unexpected error",
      },
    }));
  }
}

async function createOne(googleId: string): Promise<Row> {
  const r = await createPlaceFromGooglePlaceId(googleId);
  if (!r.ok) return { state: "error", error: r.error };
  if (r.alreadyExisted) {
    return {
      state: "existed",
      name: r.name,
      detail: "Already on Mesita — skipped create",
      placeId: r.placeId,
      alreadyExisted: true,
    };
  }
  return {
    state: "ok",
    name: r.name,
    detail: "Created · not enriched",
    placeId: r.placeId,
  };
}

async function writeOne(
  found: Found,
  action: "list" | "unlist" | "delete" | "google-update",
): Promise<Row> {
  const r =
    action === "google-update"
      ? await updatePlacesGoogle([found.placeId])
      : action === "delete"
        ? await deletePlace(found.placeId)
        : await setPlaceListed(found.placeId, action === "list");
  if (!r.ok) return { state: "error", name: found.name, error: r.error };
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
