"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Loader2, Play } from "lucide-react";
import {
  createPlaceFromGooglePlaceId,
  enrichPlace,
  searchPlacesByGoogleIds,
} from "./actions";
import { parseGooglePlaceIds } from "./google-place-ids";
import type { IntakeAction } from "./intake-batch";
import {
  applyOne,
  DEFAULT_EDIT_VALUES,
  UpdateFields,
  type EditFact,
  type EditValues,
} from "./EditTab";
import { IdListField } from "./IdListField";
import { StateIcon, type BatchRowState } from "./StateIcon";

type Running = IntakeAction | "create_then_enrich";

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
  const [running, setRunning] = useState<Running | null>(null);
  const [lastRun, setLastRun] = useState<Running | null>(null);
  const [fact, setFact] = useState<EditFact>("active");
  const [values, setValues] = useState<EditValues>(DEFAULT_EDIT_VALUES);
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

  async function run(action: Running) {
    if (busy || placeIds.length === 0) return;
    setRunning(action);
    setLastRun(action);
    setResults(
      Object.fromEntries(placeIds.map((id) => [id, { state: "pending" as const }])),
    );
    const ids = [...placeIds];
    await Promise.all(ids.map((id) => runRow(id, action, fact, values, setResults)));
    setRunning(null);
  }

  function copyFailed() {
    const ids = placeIds.filter((id) => results[id]?.state === "error");
    void navigator.clipboard.writeText(ids.join("\n"));
  }

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
          Create runs every ID at once. Enrich is queued. Update writes Active · Listed · Verified · Partnered · Visit Rewards. Create + Enrich is create then enrich.
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
            label="Enrich"
            variant="secondary"
            busy={running === "enrich"}
            disabled={busy || placeIds.length === 0}
            onClick={() => void run("enrich")}
          />
          {/* Active · Listed · Verified · Partnered · Visit Rewards — the
              state facts, plus the value they'd write — read as ONE control
              with Update, so the dividers keep them out of the run-a-pipeline
              row either side. */}
          <div className="border-border/60 flex items-center gap-2 border-l border-r px-2">
            <UpdateFields
              fact={fact}
              onFact={setFact}
              values={values}
              onValues={setValues}
              disabled={busy}
            />
            <ActionButton
              label="Update"
              variant="secondary"
              busy={running === "update"}
              disabled={busy || placeIds.length === 0}
              onClick={() => void run("update")}
            />
          </div>
          <ActionButton
            label="Create + Enrich"
            variant="secondary"
            busy={running === "create_then_enrich"}
            disabled={busy || placeIds.length === 0}
            onClick={() => void run("create_then_enrich")}
          />
          {done > 0 ? (
            <span className="text-muted-foreground text-xs">
              {lastRun === "update"
                ? `${written} written · ${failed} failed`
                : `${created} created · ${existed} already on Mesita · ${enriching} enriching · ${failed} failed`}
            </span>
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
// Mesita" filled pill in MesitaSearchTab). Everything else here assumes a
// place already exists, so it takes the same outline secondary pill as that
// tab's "All places" — four identical black buttons read as four equally
// important actions when only one is.
function ActionButton({
  label,
  variant,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  variant: "primary" | "secondary";
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        variant === "primary"
          ? "bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
          : "border-border hover:border-foreground/40 inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition disabled:opacity-50"
      }
    >
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
  action: Running,
  fact: EditFact,
  values: EditValues,
  setResults: Dispatch<SetStateAction<Record<string, Row>>>,
): Promise<void> {
  setResults((prev) => ({ ...prev, [googleId]: { state: "running" } }));
  try {
    const row = await runOne(googleId, action, fact, values);
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

async function enrichOne(
  googleId: string,
  known?: { placeId: string; name?: string },
): Promise<Row> {
  const found = known
    ? { ok: true as const, placeId: known.placeId, name: known.name ?? "" }
    : await resolveMesitaId(googleId);
  if (!found.ok) return { state: "error", error: found.error };
  const en = await enrichPlace(found.placeId, "full");
  if (!en.ok) return { state: "error", name: found.name, error: en.error };
  return {
    state: "enriching",
    name: found.name,
    detail: "Re-enrich from zero — Intaker 1–10 queued",
  };
}

async function runCreateThenEnrich(googleId: string): Promise<Row> {
  const created = await createOne(googleId);
  if (created.state === "error" || !created.placeId) return created;
  const en = await enrichOne(googleId, {
    placeId: created.placeId,
    name: created.name,
  });
  if (en.state === "error") {
    return {
      state: "error",
      name: created.name,
      error: created.alreadyExisted
        ? `Already on Mesita · enrich not queued: ${en.error}`
        : `Created · enrich not queued: ${en.error}`,
    };
  }
  return {
    state: created.alreadyExisted ? "existed" : "enriching",
    name: created.name,
    detail: created.alreadyExisted
      ? "Already on Mesita — enrich queued"
      : "Created · enrich queued",
  };
}

async function runOne(
  googleId: string,
  action: Running,
  fact: EditFact,
  values: EditValues,
): Promise<Row> {
  if (action === "update") return applyOne(googleId, fact, values);
  if (action === "enrich") return enrichOne(googleId);
  if (action === "create_then_enrich") return runCreateThenEnrich(googleId);
  return createOne(googleId);
}
