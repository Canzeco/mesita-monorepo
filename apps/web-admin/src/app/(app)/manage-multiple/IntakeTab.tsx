"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Loader2, Play } from "lucide-react";
import {
  createPlaceFromGooglePlaceId,
  deletePlace,
  enrichPlace,
  searchPlacesByGoogleIds,
  setPlaceListed,
} from "./actions";
import { parseGooglePlaceIds } from "./google-place-ids";
import type { IntakeAction } from "./intake-batch";
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

async function resolveMesitaId(googleId: string): Promise<
  { ok: true; placeId: string; name: string } | { ok: false; error: string }
> {
  const r = await searchPlacesByGoogleIds([googleId]);
  if (!r.ok) return { ok: false, error: r.error };
  const hit = r.data.find((p) => p.google_place_id === googleId) ?? r.data[0];
  if (!hit) return { ok: false, error: "Not on Mesita" };
  return { ok: true, placeId: hit.id, name: hit.google_name || hit.name };
}

export function IntakeTab({
  text,
  onTextChange,
}: {
  text: string;
  onTextChange: (next: string) => void;
}) {
  const placeIds = useMemo(() => parseGooglePlaceIds(text), [text]);
  const [results, setResults] = useState<Record<string, Row>>({});
  const [running, setRunning] = useState<IntakeAction | null>(null);
  const [lastRun, setLastRun] = useState<IntakeAction | null>(null);
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

  async function run(action: IntakeAction) {
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
    await Promise.all(ids.map((id) => runRow(id, action, setResults)));
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
          ? `${written} listed · ${failed} failed`
          : lastRun === "unlist"
            ? `${written} unlisted · ${failed} failed`
            : `${written} deleted · ${failed} failed`;

  return (
    <div className="space-y-6">
      <IdListField
        id="intake-place-ids"
        label="Google Place IDs"
        text={text}
        onTextChange={onTextChange}
        placeIds={placeIds}
        running={busy}
      />

      <div>
        <p className="text-muted-foreground text-xs">
          Create runs every ID at once. Enrich is queued. List and Unlist toggle
          guest visibility. Delete archives — no Undo here.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ActionButton
            label="Create"
            variant="primary"
            busy={running === "create"}
            disabled={busy || placeIds.length === 0}
            onClick={() => void run("create")}
          />
          <ActionButton
            label="Delete"
            variant="destructive"
            busy={running === "delete"}
            disabled={busy || placeIds.length === 0}
            onClick={() => void run("delete")}
          />
          <ActionButton
            label="List"
            variant="secondary"
            busy={running === "list"}
            disabled={busy || placeIds.length === 0}
            onClick={() => void run("list")}
          />
          <ActionButton
            label="Unlist"
            variant="secondary"
            busy={running === "unlist"}
            disabled={busy || placeIds.length === 0}
            onClick={() => void run("unlist")}
          />
          <ActionButton
            label="Enrich"
            variant="secondary"
            busy={running === "enrich"}
            disabled={busy || placeIds.length === 0}
            onClick={() => void run("enrich")}
          />
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

// Primary = the one action that starts from nothing (matches the "Look up on
// Mesita" filled pill in MesitaSearchTab). Destructive marks the one action
// that cannot be undone from this console. Everything else assumes a place
// already exists and is reversible, so it takes the same outline secondary
// pill as MesitaSearchTab's "All places" — four identical black buttons read
// as four equally important actions when they are not.
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

async function runRow(
  googleId: string,
  action: IntakeAction,
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
    detail: r.enrichmentTriggered
      ? "Created · enrich queued"
      : "Created · enrich not queued",
    placeId: r.placeId,
  };
}

async function enrichOne(googleId: string): Promise<Row> {
  const found = await resolveMesitaId(googleId);
  if (!found.ok) return { state: "error", error: found.error };
  const en = await enrichPlace(found.placeId, "full");
  if (!en.ok) return { state: "error", name: found.name, error: en.error };
  return {
    state: "enriching",
    name: found.name,
    detail: "Re-enrich from zero — Intaker 1–10 queued",
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
    detail: listed ? "Listed on" : "Listed off",
  };
}

async function deleteOne(googleId: string): Promise<Row> {
  const found = await resolveMesitaId(googleId);
  if (!found.ok) return { state: "error", error: found.error };
  const r = await deletePlace(found.placeId);
  if (!r.ok) return { state: "error", name: found.name, error: r.error };
  return { state: "ok", name: found.name, detail: "Archived" };
}

async function runOne(googleId: string, action: IntakeAction): Promise<Row> {
  if (action === "enrich") return enrichOne(googleId);
  if (action === "list") return listOne(googleId, true);
  if (action === "unlist") return listOne(googleId, false);
  if (action === "delete") return deleteOne(googleId);
  return createOne(googleId);
}
