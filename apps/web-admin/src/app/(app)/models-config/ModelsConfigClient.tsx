"use client";

import { useEffect, useState, useTransition } from "react";
import { Cpu } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { SectionCard } from "@/components/admin-ui/config";
import { SaveRow } from "../enricher-config/atlas-ui";
import { getModelsConfig, updateModelsConfig } from "./actions";
import {
  DEFAULT_MODELS_CONFIG,
  OPENAI_CHAT_MODELS,
  PERPLEXITY_OPTIONS,
  type ModelsConfig,
} from "./types";

// Models — one box, three selects (MESITA-1176). It was four cards for three
// controls: Enricher and Embeddings held no control at all, just read-only
// pointers at Enrichment, and the ModelChips above each select printed the
// value the select already showed. The three-badge Live/Staged/Locked legend
// went with them — after the cut every knob here is live, so the vocabulary
// had one member left.
//
// SoT for app_config.models_config. supabase + memo are
// edited here and read live by EFs (MESITA-941 loadModelsConfig). The Enricher
// and embedding values are not edited anywhere: they are atlas_* columns and a
// locked embedding id, and the Intake page that used to carry them is a Soon
// page. Failed GET blocks Save (MESITA-737) — never persist DEFAULTS over
// a live blob.

function Select({
  value,
  options,
  disabled,
  onChange,
  labelFor,
}: {
  value: string;
  options: readonly string[];
  disabled?: boolean;
  onChange: (v: string) => void;
  labelFor?: (v: string) => string;
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
          {labelFor ? labelFor(o) : o}
        </option>
      ))}
    </select>
  );
}

export function ModelsConfigClient() {
  const [cfg, setCfg] = useState<ModelsConfig>(DEFAULT_MODELS_CONFIG);
  const [saved, setSaved] = useState<ModelsConfig>(DEFAULT_MODELS_CONFIG);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loadBlocked, setLoadBlocked] = useState(false);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load the persisted blob on mount. On failure keep DEFAULTS visible but
  // block Save so we never overwrite a live singleton from a failed GET
  // (MESITA-737 — same pattern as Sourcing / Memo).
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getModelsConfig();
      if (!active) return;
      if (r.ok) {
        setCfg(r.data);
        setSaved(r.data);
        setError(null);
        setLoadBlocked(false);
      } else {
        setError(r.error);
        setLoadBlocked(true);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const busy = pending || loading || loadBlocked;
  const dirty =
    cfg.supabase.model !== saved.supabase.model ||
    cfg.memo.model !== saved.memo.model ||
    cfg.memo.perplexity !== saved.memo.perplexity ||
    cfg.ojo.model !== saved.ojo.model;

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

  const save = () => {
    if (loadBlocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateModelsConfig(cfg);
      if (r.ok) {
        setSaved(r.data);
        setCfg(r.data);
        setOk(true);
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <SectionCard
      icon={<Cpu className="h-4 w-4" />}
      title="Models"
      subtitle="Which model each subsystem thinks with. Both are read at run time, so changing one changes token spend."
    >
      {error && <ErrorNote message={error} />}

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
          <span className="text-muted-foreground type-eyebrow">
            Edge Functions
          </span>
          <Select
            value={cfg.supabase.model}
            options={OPENAI_CHAT_MODELS}
            disabled={busy}
            onChange={setSupabaseModel}
            labelFor={(id) => id}
          />
        </label>
        <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
          <span className="text-muted-foreground type-eyebrow">
            Memo · OpenAI
          </span>
          <Select
            value={cfg.memo.model}
            options={OPENAI_CHAT_MODELS}
            disabled={busy}
            onChange={setMemoModel}
            labelFor={(id) => id}
          />
        </label>
        <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
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
        <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
          <span className="text-muted-foreground type-eyebrow">
            Ojo · Vision
          </span>
          <Select
            value={cfg.ojo.model}
            options={OPENAI_CHAT_MODELS}
            disabled={busy}
            onChange={setOjoModel}
            labelFor={(id) => id}
          />
        </label>
      </div>

      <p className="text-muted-foreground mt-3 type-label leading-relaxed">
        Enricher quality tiers and the embedding model live on Enrichment; the
        embedding model is fixed by design — changing it re-vectors the catalog.
        Ojo&apos;s enabled/threshold/retry policy lives on Ojo Config.
      </p>

      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={loadBlocked ? (error ?? "Failed to load Models config") : null}
      />
    </SectionCard>
  );
}
