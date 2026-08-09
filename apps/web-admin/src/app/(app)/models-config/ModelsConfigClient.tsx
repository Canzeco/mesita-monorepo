"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ArrowUpRight } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { SaveRow, SectionCard } from "../enricher-config/atlas-ui";
import { getModelsConfig, updateModelsConfig } from "./actions";
import {
  DEFAULT_MODELS_CONFIG,
  OPENAI_CHAT_MODELS,
  OPENAI_MODEL_INFO,
  PERPLEXITY_OPTIONS,
  SUBSYSTEMS,
  type ModelChip,
  type ModelsConfig,
  type ModelStatus,
} from "./types";

// Models Config — SoT for app_settings.models_config. supabase + memo are
// edited here and read live by EFs (MESITA-941 loadModelsConfig). Enricher /
// Lineup cards map to Enricher Config (plus a staged note for
// models_config.enricher.perplexity). Failed GET blocks Save (MESITA-737) —
// never persist DEFAULTS over a live blob.

const STATUS_STYLE: Record<ModelStatus, { label: string; className: string }> = {
  live: {
    label: "Live",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  staged: {
    label: "Staged",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  locked: {
    label: "Locked",
    className: "border-border bg-muted text-muted-foreground",
  },
};

function StatusBadge({ status }: { status: ModelStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
        s.className
      }
    >
      {s.label}
    </span>
  );
}

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

function OwnerLink({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="text-secondary hover:text-secondary/80 mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
    >
      Configured on {label}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  );
}

// The model(s) a subsystem uses, shown up front on the card: a mono id chip
// plus a short note on what it is / what it's for.
function ModelChips({ items }: { items: ModelChip[] }) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      {items.map((m) => (
        <div key={m.id + (m.note ?? "")} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <code className="border-border bg-muted text-foreground rounded-md border px-1.5 py-0.5 font-mono text-xs">
            {m.id}
          </code>
          {m.note ? (
            <span className="text-muted-foreground text-xs">{m.note}</span>
          ) : null}
        </div>
      ))}
    </div>
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
  // (MESITA-737 — same pattern as Sourcing / Memo / Lineup).
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
    cfg.memo.perplexity !== saved.memo.perplexity;

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
    <div className="space-y-4 sm:space-y-6">
      {/* Ownership note — what is live vs staged in this blob. */}
      <div className="border-border bg-muted/40 rounded-2xl border p-4 sm:p-5">
        <p className="text-sm leading-relaxed">
          <span className="text-foreground font-medium">
            This page owns <code className="font-mono text-xs">models_config</code>.
          </span>{" "}
          <span className="text-muted-foreground">
            Supabase and Memo picks here are read live by Edge Functions. Enricher
            quality / Perplexity Agent preset and Lineup embeddings are controlled
            on Enricher Config — only <code className="font-mono text-xs">enricher.perplexity</code>{" "}
            in this blob is staged (unread; Enricher uses{" "}
            <code className="font-mono text-xs">atlas_perplexity_preset</code>).
          </span>
        </p>
        <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <StatusBadge status="live" /> read at runtime
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StatusBadge status="staged" /> saved, not read yet
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StatusBadge status="locked" /> fixed by design
          </span>
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {SUBSYSTEMS.map((meta) => (
        <SectionCard
          key={meta.key}
          icon={<meta.Icon className="text-secondary h-4 w-4" />}
          title={meta.label}
          subtitle={meta.detail}
          status={<StatusBadge status={meta.status} />}
        >
          {meta.key === "supabase" ? (
            <ModelChips
              items={[
                {
                  id: cfg.supabase.model,
                  note: OPENAI_MODEL_INFO[cfg.supabase.model],
                },
              ]}
            />
          ) : meta.key === "memo" ? (
            <ModelChips
              items={[
                {
                  id: cfg.memo.model,
                  note: "OpenAI brain · models_config.memo.model",
                },
                {
                  id: cfg.memo.perplexity,
                  note: "Perplexity grounding · models_config.memo.perplexity",
                },
              ]}
            />
          ) : meta.models ? (
            <ModelChips items={meta.models} />
          ) : null}

          {meta.key === "supabase" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Change default
                </span>
                <Select
                  value={cfg.supabase.model}
                  options={OPENAI_CHAT_MODELS}
                  disabled={busy}
                  onChange={setSupabaseModel}
                  labelFor={(id) =>
                    OPENAI_MODEL_INFO[id] ? `${id} — ${OPENAI_MODEL_INFO[id]}` : id
                  }
                />
              </label>
            </div>
          ) : meta.key === "memo" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  OpenAI model
                </span>
                <Select
                  value={cfg.memo.model}
                  options={OPENAI_CHAT_MODELS}
                  disabled={busy}
                  onChange={setMemoModel}
                  labelFor={(id) =>
                    OPENAI_MODEL_INFO[id] ? `${id} — ${OPENAI_MODEL_INFO[id]}` : id
                  }
                />
              </label>
              <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Perplexity model
                </span>
                <Select
                  value={cfg.memo.perplexity}
                  options={PERPLEXITY_OPTIONS}
                  disabled={busy}
                  onChange={setMemoPerplexity}
                />
              </label>
            </div>
          ) : meta.owner ? (
            <OwnerLink label={meta.owner.label} href={meta.owner.href} />
          ) : null}
        </SectionCard>
      ))}

      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={loadBlocked ? (error ?? "Failed to load Models config") : null}
      />
    </div>
  );
}
