"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Cpu } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { SaveRow, SectionCard } from "@/components/admin-ui/config";
import type { SynthesisQuality } from "@/lib/synthesis-quality";
import { updateEnricherModelSettings, updateModelsConfig } from "./actions";
import {
  ENRICHER_PERPLEXITY_PRESETS,
  MEMO_PERPLEXITY_LABELS,
  OPENAI_CHAT_MODELS,
  PERPLEXITY_OPTIONS,
  changedEnricherFields,
  memoDirty,
  nextRadioIndex,
  runSave,
  tierChoice,
  withMemo,
  type EnricherModelSettings,
  type ModelsConfig,
} from "./types";

// Models (MESITA-2126): one card, one row per AI job that actually runs, each
// named by the job and the model behind it. Two stores behind one Save —
// Memo's picks on models_config, the Enricher's on enrichment_config — saved
// as independent halves by runSave (types.ts). The dead knobs (Edge Functions,
// Ojo) are not shown; see the types.ts header for what still rides the blob.

const UNAVAILABLE = "unavailable";
const CONTROL = "w-full sm:w-56";
const SELECT =
  "border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-2 text-sm font-medium outline-none disabled:opacity-50";

function JobRow({
  id,
  label,
  usedBy,
  note,
  children,
}: {
  id: string;
  label: string;
  usedBy: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
      <div className="min-w-0">
        <label htmlFor={id} id={`${id}-label`} className="text-sm font-medium">
          {label}
        </label>
        <p className="text-muted-foreground type-label leading-relaxed">{usedBy}</p>
        {note ? (
          <p className="text-muted-foreground type-label leading-relaxed">{note}</p>
        ) : null}
      </div>
      <div className={CONTROL}>{children}</div>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground type-eyebrow pt-5 pb-1">{children}</p>
  );
}

function Unavailable() {
  return <span className="text-muted-foreground text-sm">{UNAVAILABLE}</span>;
}

/** A two-option model choice: a radiogroup with roving focus (Left/Right). */
function ModelChoice({
  id,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string;
  value: SynthesisQuality;
  options: { tier: SynthesisQuality; label: string }[];
  disabled: boolean;
  onChange: (tier: SynthesisQuality) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(
    0,
    options.findIndex((o) => o.tier === value),
  );
  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      className="flex flex-col gap-1"
    >
      {options.map((o, i) => {
        const checked = o.tier === value;
        return (
          <button
            key={o.tier}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === current ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.tier)}
            onKeyDown={(e) => {
              const next = nextRadioIndex(e.key, i, options.length);
              if (next === null) return;
              e.preventDefault();
              onChange(options[next].tier);
              refs.current[next]?.focus();
            }}
            className={`focus-visible:ring-foreground/40 h-9 rounded-lg border px-3 text-left text-xs font-semibold transition outline-none focus-visible:ring-2 disabled:opacity-50 ${
              checked
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:border-foreground/40"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ModelsConfigClient({
  initialConfig,
  initialEnricher,
  loadError,
}: {
  /** null when the load failed — the page then shows "unavailable", never defaults. */
  initialConfig: ModelsConfig | null;
  initialEnricher: EnricherModelSettings | null;
  loadError: string | null;
}) {
  const ids = useId();
  const loaded = initialConfig !== null && initialEnricher !== null;
  const [cfg, setCfg] = useState(initialConfig);
  const [saved, setSaved] = useState(initialConfig);
  const [enricher, setEnricher] = useState(initialEnricher);
  const [savedEnricher, setSavedEnricher] = useState(initialEnricher);
  const [pending, startTransition] = useTransition();
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [enricherError, setEnricherError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<{ models: boolean; enricher: boolean }>({
    models: false,
    enricher: false,
  });
  const [ok, setOk] = useState(false);

  const busy = pending || !loaded;
  const dirty =
    !!cfg &&
    !!saved &&
    !!enricher &&
    !!savedEnricher &&
    (memoDirty(saved, cfg) ||
      Object.keys(changedEnricherFields(savedEnricher, enricher)).length > 0);

  const edited = () => {
    setOk(false);
    setSavedNote({ models: false, enricher: false });
  };
  const setMemo = (patch: Partial<ModelsConfig["memo"]>) => {
    edited();
    setCfg((c) => (c ? withMemo(c, patch) : c));
  };
  const patchEnricher = (patch: Partial<EnricherModelSettings>) => {
    edited();
    setEnricher((s) => (s ? { ...s, ...patch } : s));
  };

  const save = () => {
    if (!cfg || !saved || !enricher || !savedEnricher) return;
    setModelsError(null);
    setEnricherError(null);
    startTransition(async () => {
      const out = await runSave(
        { savedModels: saved, nextModels: cfg, savedEnricher, nextEnricher: enricher },
        { updateModels: updateModelsConfig, updateEnricher: updateEnricherModelSettings },
      );
      if (out.modelsSaved) {
        setSaved(out.savedModels);
        setCfg(out.savedModels);
      }
      if (out.enricherSaved) {
        setSavedEnricher(out.savedEnricher);
        setEnricher(out.savedEnricher);
      }
      setModelsError(out.modelsError);
      setEnricherError(out.enricherError);
      setSavedNote({ models: out.modelsSaved, enricher: out.enricherSaved });
      setOk(!out.modelsError && !out.enricherError);
    });
  };

  // memo.model is a free string; one off the catalog is shown as what it is.
  const memoModels: { value: string; label: string }[] =
    cfg && !(OPENAI_CHAT_MODELS as readonly string[]).includes(cfg.memo.model)
      ? [
          { value: cfg.memo.model, label: `${cfg.memo.model} (current, not in list)` },
          ...OPENAI_CHAT_MODELS.map((m) => ({ value: m, label: m })),
        ]
      : OPENAI_CHAT_MODELS.map((m) => ({ value: m, label: m }));

  const tierRow = (
    row: "writing" | "photos",
    id: string,
    value: SynthesisQuality,
    onChange: (t: SynthesisQuality) => void,
  ) => {
    if (!cfg) return <Unavailable />;
    const choice = tierChoice(row, cfg.enricher.model);
    if (choice.kind === "same") {
      return (
        <p id={id} className="text-muted-foreground text-sm">
          Both options run {choice.model}.
        </p>
      );
    }
    return (
      <ModelChoice
        id={id}
        value={value}
        options={choice.options}
        disabled={busy}
        onChange={onChange}
      />
    );
  };

  const id = (k: string) => `${ids}-${k}`;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        icon={<Cpu className="h-4 w-4" />}
        title="AI jobs"
        subtitle="Each job below runs on the model you pick. A change applies from the next run and changes what each run costs."
      >
        {loadError && <ErrorNote message={loadError} />}

        <GroupLabel>Discovery</GroupLabel>
        <div className="divide-border divide-y">
          <JobRow
            id={id("memo-model")}
            label="Discovery chat"
            usedBy="Memo, the chat on Home › Chat."
          >
            {cfg ? (
              <select
                id={id("memo-model")}
                value={cfg.memo.model}
                disabled={busy}
                onChange={(e) => setMemo({ model: e.target.value })}
                className={SELECT}
              >
                {memoModels.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : (
              <Unavailable />
            )}
          </JobRow>
          <JobRow
            id={id("memo-web")}
            label="Discovery chat web answers"
            usedBy="Memo, when a question needs the web. Off skips it."
          >
            {cfg ? (
              <select
                id={id("memo-web")}
                value={cfg.memo.perplexity}
                disabled={busy}
                onChange={(e) => setMemo({ perplexity: e.target.value })}
                className={SELECT}
              >
                {PERPLEXITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {MEMO_PERPLEXITY_LABELS[p]}
                  </option>
                ))}
              </select>
            ) : (
              <Unavailable />
            )}
          </JobRow>
        </div>
        {modelsError && (
          <ErrorNote
            message={`Couldn't save Discovery chat or its web answers: ${modelsError}.${
              savedNote.enricher ? " Enricher changes were saved." : ""
            }`}
          />
        )}

        <GroupLabel>Enricher</GroupLabel>
        <div className="divide-border divide-y">
          <JobRow
            id={id("writing")}
            label="Enricher writing"
            usedBy="Writes each place's description and ranks its photos."
          >
            {enricher
              ? tierRow("writing", id("writing"), enricher.synthesisQuality, (t) =>
                  patchEnricher({ synthesisQuality: t }),
                )
              : <Unavailable />}
          </JobRow>
          <JobRow
            id={id("photos")}
            label="Enricher photos"
            usedBy="Reads each photo while a place is enriched."
            note="The cheaper option uses the sorting model."
          >
            {enricher
              ? tierRow("photos", id("photos"), enricher.visionQuality, (t) =>
                  patchEnricher({ visionQuality: t }),
                )
              : <Unavailable />}
          </JobRow>
          <JobRow
            id={id("search")}
            label="Enricher web search"
            usedBy="Finds a place's links and press while it is enriched."
          >
            {enricher ? (
              <select
                id={id("search")}
                value={enricher.perplexityPreset}
                disabled={busy}
                onChange={(e) =>
                  patchEnricher({
                    perplexityPreset: e.target.value as EnricherModelSettings["perplexityPreset"],
                  })
                }
                className={SELECT}
              >
                {ENRICHER_PERPLEXITY_PRESETS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <Unavailable />
            )}
          </JobRow>
        </div>
        {enricherError && (
          <ErrorNote
            message={`Couldn't save Enricher writing, photos or web search: ${enricherError}.${
              savedNote.models ? " Discovery chat changes were saved." : ""
            }`}
          />
        )}

        <GroupLabel>Not editable here</GroupLabel>
        <p className="text-muted-foreground type-label">
          Set in code. Changing them needs a code change and a re-index.
        </p>
        <dl className="divide-border mt-1 divide-y">
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-sm">Place search index</dt>
            <dd className="font-mono text-sm">{cfg ? cfg.embeddings.model : UNAVAILABLE}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <dt className="text-sm">Enricher sorting and tagging</dt>
            <dd className="font-mono text-sm">{cfg ? cfg.enricher.model : UNAVAILABLE}</dd>
          </div>
        </dl>
      </SectionCard>

      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={loaded ? null : (loadError ?? "Failed to load Models config")}
      />
      {ok && !dirty && (
        <p className="text-muted-foreground type-label -mt-2">
          Saved. Discovery chat uses it from the next message; Enricher from the
          next place enriched.
        </p>
      )}
    </div>
  );
}
