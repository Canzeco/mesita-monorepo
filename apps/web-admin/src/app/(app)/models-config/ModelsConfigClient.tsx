"use client";

import { useEffect, useState, useTransition } from "react";
import { Cpu, Sparkles } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { FIELD_WELL, QualityPicker, SaveRow, SectionCard } from "@/components/admin-ui/config";
import {
  getEnricherModelSettings,
  getModelsConfig,
  updateEnricherModelSettings,
  updateModelsConfig,
} from "./actions";
import {
  ENRICHER_PERPLEXITY_PRESETS,
  OPENAI_CHAT_MODELS,
  PERPLEXITY_OPTIONS,
  type EnricherModelSettings,
  type ModelsConfig,
} from "./types";

// Models — platform-wide picks. models_config blob (supabase, memo, ojo) plus
// Enricher atlas_* quality tiers (MESITA-1811). Failed GET blocks Save (MESITA-737).

function Select({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: readonly string[];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-2 text-sm font-medium outline-none disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function enricherDirty(a: EnricherModelSettings, b: EnricherModelSettings): boolean {
  return (
    a.synthesisQuality !== b.synthesisQuality ||
    a.visionQuality !== b.visionQuality ||
    a.perplexityPreset !== b.perplexityPreset
  );
}

export function ModelsConfigClient({
  initialConfig,
  initialEnricher,
  loadError,
  enricherLoadError,
}: {
  initialConfig: ModelsConfig;
  initialEnricher: EnricherModelSettings;
  loadError: string | null;
  enricherLoadError: string | null;
}) {
  const [cfg, setCfg] = useState<ModelsConfig>(initialConfig);
  const [saved, setSaved] = useState<ModelsConfig>(initialConfig);
  const [enricher, setEnricher] = useState<EnricherModelSettings>(initialEnricher);
  const [savedEnricher, setSavedEnricher] =
    useState<EnricherModelSettings>(initialEnricher);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(
    loadError ?? enricherLoadError,
  );
  const [loadBlocked, setLoadBlocked] = useState(
    !!loadError || !!enricherLoadError,
  );
  const [ok, setOk] = useState(false);

  // Re-fetch on mount so client-side nav shows the live blobs.
  useEffect(() => {
    let active = true;
    (async () => {
      const [modelsR, enricherR] = await Promise.all([
        getModelsConfig(),
        getEnricherModelSettings(),
      ]);
      if (!active) return;
      if (modelsR.ok && enricherR.ok) {
        setCfg(modelsR.data);
        setSaved(modelsR.data);
        setEnricher(enricherR.data);
        setSavedEnricher(enricherR.data);
        setError(null);
        setLoadBlocked(false);
      } else {
        setError(
          !modelsR.ok
            ? modelsR.error
            : !enricherR.ok
              ? enricherR.error
              : "Failed to load Models config",
        );
        setLoadBlocked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const busy = pending || loadBlocked;
  const dirty =
    cfg.supabase.model !== saved.supabase.model ||
    cfg.memo.model !== saved.memo.model ||
    cfg.memo.perplexity !== saved.memo.perplexity ||
    cfg.ojo.model !== saved.ojo.model ||
    enricherDirty(enricher, savedEnricher);

  const setSupabaseModel = (model: string) => {
    setOk(false);
    setCfg((c) => ({ ...c, supabase: { model } }));
  };

  const setMemoModel = (model: string) => {
    setOk(false);
    setCfg((c) => ({ ...c, memo: { ...c.memo, model } }));
  };

  const setMemoPerplexity = (perplexity: string) => {
    setOk(false);
    setCfg((c) => ({ ...c, memo: { ...c.memo, perplexity } }));
  };

  const setOjoModel = (model: string) => {
    setOk(false);
    setCfg((c) => ({ ...c, ojo: { model } }));
  };

  const patchEnricher = (next: Partial<EnricherModelSettings>) => {
    setOk(false);
    setEnricher((s) => ({ ...s, ...next }));
  };

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const enricherR = await updateEnricherModelSettings(enricher);
      if (!enricherR.ok) {
        setError(enricherR.error);
        return;
      }
      const modelsR = await updateModelsConfig(cfg);
      if (!modelsR.ok) {
        setError(modelsR.error);
        return;
      }
      setSaved(modelsR.data);
      setCfg(modelsR.data);
      setSavedEnricher(enricherR.data);
      setEnricher(enricherR.data);
      setOk(true);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        icon={<Cpu className="h-4 w-4" />}
        title="Platform"
        subtitle="Which model each subsystem thinks with. Every pick here is read at run time — changing one changes token spend."
      >
        {error && <ErrorNote message={error} />}

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <label className={FIELD_WELL}>
            <span className="text-muted-foreground type-eyebrow">
              Edge Functions
            </span>
            <Select
              value={cfg.supabase.model}
              options={OPENAI_CHAT_MODELS}
              disabled={busy}
              onChange={setSupabaseModel}
            />
          </label>
          <label className={FIELD_WELL}>
            <span className="text-muted-foreground type-eyebrow">
              Memo · OpenAI
            </span>
            <Select
              value={cfg.memo.model}
              options={OPENAI_CHAT_MODELS}
              disabled={busy}
              onChange={setMemoModel}
            />
          </label>
          <label className={FIELD_WELL}>
            <span className="text-muted-foreground type-eyebrow">
              Memo · Perplexity
            </span>
            <Select
              value={cfg.memo.perplexity}
              options={PERPLEXITY_OPTIONS}
              disabled={busy}
              onChange={setMemoPerplexity}
            />
          </label>
          <label className={FIELD_WELL}>
            <span className="text-muted-foreground type-eyebrow">
              Ojo · Vision
            </span>
            <Select
              value={cfg.ojo.model}
              options={OPENAI_CHAT_MODELS}
              disabled={busy}
              onChange={setOjoModel}
            />
          </label>
        </div>

        <p className="text-muted-foreground mt-3 type-label leading-relaxed">
          Ojo&apos;s enabled, threshold and fail-action policy lives on Visits.
        </p>
      </SectionCard>

      <SectionCard
        icon={<Sparkles className="text-secondary h-4 w-4" />}
        title="Enricher"
        subtitle="Text, image and search quality tiers for the enrichment pipeline. Embeddings is locked."
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={FIELD_WELL}>
            <span className="text-muted-foreground type-eyebrow">Text</span>
            <QualityPicker
              value={enricher.synthesisQuality}
              onChange={(v) => patchEnricher({ synthesisQuality: v })}
            />
            <span className="text-muted-foreground type-label">
              9 · Description, image-rank
            </span>
          </label>
          <label className={FIELD_WELL}>
            <span className="text-muted-foreground type-eyebrow">Image</span>
            <QualityPicker
              value={enricher.visionQuality}
              onChange={(v) => patchEnricher({ visionQuality: v })}
            />
            <span className="text-muted-foreground type-label">6 · Images</span>
          </label>
          <label className={FIELD_WELL}>
            <span className="text-muted-foreground type-eyebrow">Search</span>
            <select
              value={enricher.perplexityPreset}
              disabled={busy}
              aria-label="Search model preset"
              onChange={(e) =>
                patchEnricher({
                  perplexityPreset: e.target.value as EnricherModelSettings["perplexityPreset"],
                })
              }
              className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-2 text-sm font-medium outline-none disabled:opacity-50"
            >
              {ENRICHER_PERPLEXITY_PRESETS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground type-label">
              3 · Serp · 4 · Links
            </span>
          </label>
          <div className={FIELD_WELL}>
            <span className="text-muted-foreground type-eyebrow">
              Embeddings
            </span>
            <span className="text-sm font-medium">text-embedding-3-small</span>
            <span className="text-muted-foreground type-label">
              locked · 10 · Embedding
            </span>
          </div>
        </div>
      </SectionCard>

      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={
          loadBlocked ? (error ?? "Failed to load Models config") : null
        }
      />
    </div>
  );
}
