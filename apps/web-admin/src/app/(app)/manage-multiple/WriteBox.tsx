"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Loader2, Play } from "lucide-react";
import {
  createPlaceFromGooglePlaceId,
  deletePlace,
  enrichPlace,
  enrichPlaces,
  searchPlacesByGoogleIds,
  setPlaceListed,
  setPlaceSelected,
} from "./actions";
import { parseGooglePlaceIds } from "./google-place-ids";
import type { CrenupAction } from "./pipeline";
import { OverwriteSwitch } from "@/components/place-manage/OverwriteSwitch";
import { IdListField } from "./IdListField";
import { StateIcon, type BatchRowState } from "./StateIcon";
import { ENRICH_ACTIONS, enrichLabel, type EnrichDepth } from "@/lib/enrich-depth";

type Row = {
  state: BatchRowState;
  name?: string;
  detail?: string;
  error?: string;
  placeId?: string;
  alreadyExisted?: boolean;
};

async function resolveMesitaId(googleId: string): Promise<
  { ok: true; placeId: string; name: string } | { ok: false; error: string }
> {
  const r = await searchPlacesByGoogleIds([googleId]);
  if (!r.ok) return { ok: false, error: r.error };
  const hit = r.data.find((p) => p.google_place_id === googleId) ?? r.data[0];
  if (!hit) return { ok: false, error: "Not on Mesita" };
  return { ok: true, placeId: hit.id, name: hit.google_name || hit.name };
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
  select: { label: "Select", variant: "secondary" },
  unselect: { label: "Unselect", variant: "secondary" },
  list: { label: "Enable", variant: "secondary" },
  unlist: { label: "Disable", variant: "secondary" },
  delete: { label: "Delete", variant: "destructive" },
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
  const [overwrite, setOverwrite] = useState(false);
  const [enrichingDepth, setEnrichingDepth] = useState<EnrichDepth | null>(null);
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

  async function run(action: CrenupAction, depth: EnrichDepth = "full") {
    if (busy || placeIds.length === 0) return;
    // Delete writes places.state = 'archived' — reversible only by a direct
    // DB edit, never by any button here. One confirm for the whole batch,
    // not per row: the paste is already the commitment, this just catches
    // a fat-fingered click before it archives a hundred places.
    if (action === "enrich" && overwrite) {
      const label = enrichLabel(depth);
      const ok = window.confirm(
        placeIds.length === 1
          ? `Overwrite existing data on 1 place and run ${label}? This can replace the profile.`
          : `Overwrite existing data on ${placeIds.length} places and run ${label}? This can replace every profile in this batch.`,
      );
      if (!ok) return;
    }
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
    if (action === "enrich") {
      setEnrichingDepth(depth);
      await runEnrich(ids, setResults, overwrite, depth);
      setEnrichingDepth(null);
      setOverwrite(false);
    }
    else await Promise.all(ids.map((id) => runRow(id, action, setResults)));
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
        : lastRun === "select"
          ? `${written} selected · ${failed} failed`
          : lastRun === "unselect"
            ? `${written} unselected · ${failed} failed`
            : lastRun === "list"
              ? `${written} enabled · ${failed} failed`
              : lastRun === "unlist"
                ? `${written} disabled · ${failed} failed`
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
          {actions.includes("enrich") ? (
            <div className="mb-3">
              <OverwriteSwitch checked={overwrite} disabled={busy} onChange={setOverwrite} />
            </div>
          ) : null}
          {actions.map((action) =>
            action === "enrich" ? (
              ENRICH_ACTIONS.map((choice) => (
                <ActionButton
                  key={choice.depth}
                  label={choice.label}
                  title={choice.title}
                  variant={choice.depth === "quick" ? "secondary" : "primary"}
                  busy={running === "enrich" && enrichingDepth === choice.depth}
                  disabled={busy || placeIds.length === 0}
                  onClick={() => void run("enrich", choice.depth)}
                />
              ))
            ) : (
              <ActionButton
                key={action}
                label={BUTTONS[action].label}
                variant={BUTTONS[action].variant}
                busy={running === action}
                disabled={busy || placeIds.length === 0}
                onClick={() => void run(action)}
              />
            ),
          )}
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

async function runEnrich(
  googleIds: string[],
  setResults: Dispatch<SetStateAction<Record<string, Row>>>,
  overwrite: boolean,
  depth: EnrichDepth,
): Promise<void> {
  const resolved: { googleId: string; placeId: string; name: string }[] = [];
  await Promise.all(googleIds.map(async (googleId) => {
    setResults((prev) => ({ ...prev, [googleId]: { state: "running" } }));
    const found = await resolveMesitaId(googleId);
    if (!found.ok) {
      setResults((prev) => ({ ...prev, [googleId]: { state: "error", error: found.error } }));
      return;
    }
    resolved.push({ googleId, placeId: found.placeId, name: found.name });
  }));
  if (resolved.length === 0) return;
  const started = await enrichPlaces(resolved.map((row) => row.placeId), overwrite, depth);
  const detail = `${enrichLabel(depth)} started`;
  for (const row of resolved) {
    setResults((prev) => ({
      ...prev,
      [row.googleId]: started.ok
        ? { state: "enriching", name: row.name, detail }
        : { state: "error", name: row.name, error: started.error },
    }));
  }
}

async function runRow(
  googleId: string,
  action: CrenupAction,
  setResults: Dispatch<SetStateAction<Record<string, Row>>>,
): Promise<void> {
  setResults((prev) => ({ ...prev, [googleId]: { state: "running" } }));
  try {
    const row = await runOne(googleId, action);
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

async function enrichOne(googleId: string): Promise<Row> {
  const found = await resolveMesitaId(googleId);
  if (!found.ok) return { state: "error", error: found.error };
  const en = await enrichPlace(found.placeId);
  if (!en.ok) return { state: "error", name: found.name, error: en.error };
  return {
    state: "enriching",
    name: found.name,
    detail: "Enrichment started",
  };
}

async function selectOne(googleId: string, selected: boolean): Promise<Row> {
  const found = await resolveMesitaId(googleId);
  if (!found.ok) return { state: "error", error: found.error };
  const r = await setPlaceSelected(found.placeId, selected);
  if (!r.ok) return { state: "error", name: found.name, error: r.error };
  return {
    state: "ok",
    name: found.name,
    detail: selected ? "Selected" : "Unselected",
  };
}

async function listOne(googleId: string, listed: boolean): Promise<Row> {
  const found = await resolveMesitaId(googleId);
  if (!found.ok) return { state: "error", error: found.error };
  const r = await setPlaceListed(found.placeId, listed);
  if (!r.ok) return { state: "error", name: found.name, error: r.error };
  return {
    state: "ok",
    name: found.name,
    detail: listed ? "Enabled" : "Disabled",
  };
}

async function deleteOne(googleId: string): Promise<Row> {
  const found = await resolveMesitaId(googleId);
  if (!found.ok) return { state: "error", error: found.error };
  const r = await deletePlace(found.placeId);
  if (!r.ok) return { state: "error", name: found.name, error: r.error };
  return { state: "ok", name: found.name, detail: "Archived" };
}

async function runOne(googleId: string, action: CrenupAction): Promise<Row> {
  if (action === "enrich") return enrichOne(googleId);
  if (action === "select") return selectOne(googleId, true);
  if (action === "unselect") return selectOne(googleId, false);
  if (action === "list") return listOne(googleId, true);
  if (action === "unlist") return listOne(googleId, false);
  if (action === "delete") return deleteOne(googleId);
  return createOne(googleId);
}
