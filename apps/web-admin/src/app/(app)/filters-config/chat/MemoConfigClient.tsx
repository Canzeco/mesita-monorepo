"use client";

import { useEffect, useState, useTransition } from "react";
import { Bot, Globe, MessageSquare } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { KnobStatus, SaveRow, SectionCard, Switch, TextAreaField } from "@/components/admin-ui";
import { getMemoConfig, updateMemoConfig } from "./memo-actions";
import {
  OPENAI_MODELS,
  PERPLEXITY_MODELS,
  type MemoConfig,
} from "./memo-types";

// Memo's config surface — kept deliberately small: the persona prose and the
// legacy model fields. Server-seeded from admin-web-get-memo-config
// (app_config.memo_*); a failed load keeps DEFAULT_MEMO_CONFIG visible but
// blocks Save (MESITA-737).
//
// Enforcement is stated PER KNOB via <KnobStatus>, not in card prose (MESITA-738).
// Ownership: live model picks are Models Config → models_config.memo.* →
// supabase-edgefunc-get-memo-config. This page owns instructions + greeting;
// provider / webGrounding / perplexityModel are staged. Verified 2026-08-09:
//
//   instructions    enforced  — resolveMemoSystemPrompt(cfg.instructions) is the
//                               live persona on every turn
//   greeting        enforced  — memo_greeting via get-memo-config → ask-memo
//                               (empty-query bootstrap + turn metadata); clients
//                               fall back to local Product Rules §C constant
//   provider        not wired — memo_provider is persisted but unused (OpenAI
//                               is fixed on the serving path)
//   openaiModel     fallback  — models_config.memo.model wins; memo_openai_model
//                               is only read when that is unset
//   webGrounding    not wired — memo_web_grounding unread; Perplexity runs from
//                               models_config.memo.perplexity regardless
//   perplexityModel not wired — live pick is models_config.memo.perplexity
//                               (Models Config), not memo_perplexity_model
//
// When one of these gets wired, change its chip in the same PR — a stale chip is
// the exact failure this replaced.

function Select<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  value: T;
  options: readonly T[];
  disabled?: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
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

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function MemoConfigClient({
  initialConfig,
  loadError,
}: {
  initialConfig: MemoConfig;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<MemoConfig>(initialConfig);
  const [saved, setSaved] = useState<MemoConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [blocked, setBlocked] = useState(!!loadError);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);

  // Re-fetch on mount so client-side nav shows the live row. Success clears a
  // prior loadError; failure keeps the seed and (if still blocked) refreshes
  // the message — never unblocks Save after a failed initial GET.
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getMemoConfig();
      if (!active) return;
      if (r.ok) {
        setCfg(r.data);
        setSaved(r.data);
        setError(null);
        setBlocked(false);
      } else if (blocked) {
        setError(r.error);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  const busy = pending || loading || blocked;
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);
  const set = <K extends keyof MemoConfig>(key: K, value: MemoConfig[K]) => {
    setCfg((c) => ({ ...c, [key]: value }));
    setOk(false);
  };

  const save = () => {
    if (blocked) return;
    setError(null);
    startTransition(async () => {
      const r = await updateMemoConfig(cfg);
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
      {error && <ErrorNote message={error} />}

      {/* Persona */}
      <SectionCard
        icon={<MessageSquare className="text-secondary h-4 w-4" />}
        title="Persona"
        subtitle="How Memo talks. Instructions is the live system prompt on every turn."
      >
        <div className="mt-4 grid gap-3">
          <div className="grid gap-2">
            <KnobStatus
              kind="enforced"
              reason="live opener via consumer-web-ask-memo (memo_greeting); clients keep a local fallback"
            />
            <TextAreaField
              label="Greeting"
              value={cfg.greeting}
              disabled={busy}
              onChange={(v) => set("greeting", v)}
            />
          </div>
          <div className="grid gap-2">
            <KnobStatus kind="enforced" reason="live system prompt in consumer-web-ask-memo" />
            <TextAreaField
              label="Instructions (system prompt)"
              value={cfg.instructions}
              disabled={busy}
              onChange={(v) => set("instructions", v)}
            />
          </div>
        </div>
      </SectionCard>

      {/* Models — legacy fields; live picks are Models Config */}
      <SectionCard
        icon={<Bot className="text-secondary h-4 w-4" />}
        title="Models (legacy fields)"
        subtitle="Live OpenAI + Perplexity picks come from Models Config → models_config.memo → get-memo-config. Fields below persist on memo_* columns but are fallback or unread on the serving path. Edit live models on Models Config."
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label={
              <>
                OpenAI model
                <KnobStatus
                  kind="fallback"
                  reason="live pick is models_config.memo.model (Models Config)"
                />
              </>
            }
          >
            <Select
              value={cfg.openaiModel}
              options={OPENAI_MODELS}
              disabled={busy}
              onChange={(v) => set("openaiModel", v)}
            />
          </Field>
          <Field
            label={
              <>
                Provider
                <KnobStatus
                  kind="not-wired"
                  reason="memo_provider unread — serving path is OpenAI-fixed"
                />
              </>
            }
          >
            <Select
              value={cfg.provider}
              options={["openai"] as const}
              disabled={busy}
              onChange={(v) => set("provider", v)}
            />
          </Field>
          <Field
            label={
              <>
                Web grounding (Perplexity)
                <KnobStatus
                  kind="not-wired"
                  reason="memo_web_grounding unread — Perplexity runs from models_config.memo.perplexity"
                />
              </>
            }
          >
            <Switch
              on={cfg.webGrounding}
              pending={pending || blocked}
              label="Web grounding (Perplexity)"
              onClick={() => set("webGrounding", !cfg.webGrounding)}
            />
          </Field>
          <Field
            label={
              <>
                <Globe className="text-muted-foreground h-4 w-4" />
                Perplexity model
                <KnobStatus
                  kind="not-wired"
                  reason="live pick is models_config.memo.perplexity (Models Config)"
                />
              </>
            }
          >
            <Select
              value={cfg.perplexityModel}
              options={PERPLEXITY_MODELS}
              disabled={busy}
              onChange={(v) => set("perplexityModel", v)}
            />
          </Field>
        </div>
      </SectionCard>

      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={blocked ? (error ?? "Failed to load Memo config") : null}
      />
    </div>
  );
}
