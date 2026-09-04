"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Loader2, Play } from "lucide-react";
import {
  createPlaceFromGooglePlaceId,
  enrichPlace,
  searchPlacesByGoogleIds,
} from "../manage-single/actions";
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
import { StatusIcon, type BatchRowStatus } from "./StatusIcon";

type Running = IntakeAction | "create_then_enrich";

type Row = {
  status: BatchRowStatus;
  name?: string;
  detail?: string;
  error?: string;
  projectId?: string;
  alreadyExisted?: boolean;
};

async function resolveMesitaId(googleId: string): Promise<
  { ok: true; projectId: string; name: string } | { ok: false; error: string }
> {
  const r = await searchPlacesByGoogleIds([googleId]);
  if (!r.ok) return { ok: false, error: r.error };
  const hit = r.data.find((p) => p.google_place_id === googleId) ?? r.data[0];
  if (!hit) return { ok: false, error: "Not on Mesita" };
  return { ok: true, projectId: hit.id, name: hit.google_name || hit.name };
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
  const [fact, setFact] = useState<EditFact>("listed");
  const [values, setValues] = useState<EditValues>(DEFAULT_EDIT_VALUES);
  const busy = running !== null;

  const done = placeIds.filter((id) => {
    const s = results[id]?.status;
    return s === "ok" || s === "existed" || s === "enriching" || s === "error";
  }).length;
  const created = placeIds.filter((id) => results[id]?.status === "ok").length;
  const existed = placeIds.filter((id) => results[id]?.status === "existed").length;
  const enriching = placeIds.filter((id) => results[id]?.status === "enriching").length;
  const written = placeIds.filter((id) => {
    const s = results[id]?.status;
    return s === "ok" || s === "existed";
  }).length;
  const failed = placeIds.filter((id) => results[id]?.status === "error").length;

  async function run(action: Running) {
    if (busy || placeIds.length === 0) return;
    setRunning(action);
    setLastRun(action);
    setResults(
      Object.fromEntries(placeIds.map((id) => [id, { status: "pending" as const }])),
    );
    const ids = [...placeIds];
    await Promise.all(ids.map((id) => runRow(id, action, fact, values, setResults)));
    setRunning(null);
  }

  function copyFailed() {
    const ids = placeIds.filter((id) => results[id]?.status === "error");
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
          Create runs every ID at once. Enrich is queued. Update writes Listed · Active · Verified · Partnered · Visit Rewards. Create + Enrich is create then enrich.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ActionButton
            label="Create"
            busy={running === "create"}
            disabled={busy || placeIds.length === 0}
            onClick={() => void run("create")}
          />
          <ActionButton
            label="Enrich"
            busy={running === "enrich"}
            disabled={busy || placeIds.length === 0}
            onClick={() => void run("enrich")}
          />
          <UpdateFields
            fact={fact}
            onFact={setFact}
            values={values}
            onValues={setValues}
            disabled={busy}
          />
          <ActionButton
            label="Update"
            busy={running === "update"}
            disabled={busy || placeIds.length === 0}
            onClick={() => void run("update")}
          />
          <ActionButton
            label="Create + Enrich"
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
              <StatusIcon status={r.status} />
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

function ActionButton({
  label,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
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
  setResults((prev) => ({ ...prev, [googleId]: { status: "running" } }));
  try {
    const row = await runOne(googleId, action, fact, values);
    setResults((prev) => ({ ...prev, [googleId]: row }));
  } catch (err) {
    setResults((prev) => ({
      ...prev,
      [googleId]: {
        status: "error",
        error: err instanceof Error ? err.message : "Unexpected error",
      },
    }));
  }
}

async function createOne(googleId: string): Promise<Row> {
  const r = await createPlaceFromGooglePlaceId(googleId);
  if (!r.ok) return { status: "error", error: r.error };
  if (r.alreadyExisted) {
    return {
      status: "existed",
      name: r.name,
      detail: "Already on Mesita — skipped create",
      projectId: r.projectId,
      alreadyExisted: true,
    };
  }
  return {
    status: "ok",
    name: r.name,
    detail: r.enrichmentTriggered
      ? "Created · enrich queued"
      : "Created · enrich not queued",
    projectId: r.projectId,
  };
}

async function enrichOne(
  googleId: string,
  known?: { projectId: string; name?: string },
): Promise<Row> {
  const found = known
    ? { ok: true as const, projectId: known.projectId, name: known.name ?? "" }
    : await resolveMesitaId(googleId);
  if (!found.ok) return { status: "error", error: found.error };
  const en = await enrichPlace(found.projectId, "full");
  if (!en.ok) return { status: "error", name: found.name, error: en.error };
  return {
    status: "enriching",
    name: found.name,
    detail: "Re-enrich from zero — Intaker 1–10 queued",
  };
}

async function runCreateThenEnrich(googleId: string): Promise<Row> {
  const created = await createOne(googleId);
  if (created.status === "error" || !created.projectId) return created;
  const en = await enrichOne(googleId, {
    projectId: created.projectId,
    name: created.name,
  });
  if (en.status === "error") {
    return {
      status: "error",
      name: created.name,
      error: created.alreadyExisted
        ? `Already on Mesita · enrich not queued: ${en.error}`
        : `Created · enrich not queued: ${en.error}`,
    };
  }
  return {
    status: created.alreadyExisted ? "existed" : "enriching",
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
