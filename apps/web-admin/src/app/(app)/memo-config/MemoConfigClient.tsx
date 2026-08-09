"use client";

import { useEffect, useState, useTransition } from "react";
import { Bot, Globe, MessageSquare } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { KnobStatus, SaveRow, SectionCard, Switch, TextAreaField } from "../enricher-config/atlas-ui";
import { getMemoConfig, updateMemoConfig } from "./actions";
import {
  OPENAI_MODELS,
  PERPLEXITY_MODELS,
  type MemoConfig,
} from "./types";

// Memo's config surface — kept deliberately small: the persona prose and the
// models. Server-seeded from admin-web-get-memo-config (app_settings.memo_*);
// a failed load keeps DEFAULT_MEMO_CONFIG visible but blocks Save (MESITA-737).
//
// Enforcement is stated PER KNOB via <KnobStatus>, not in card prose (MESITA-738).
// Verified against consumer-web-ask-memo on 2026-08-07:
//
//   instructions    enforced  — resolveMemoSystemPrompt(cfg.instructions) is the
//                               live persona on every turn
//   greeting        not wired — no consumer reads memo_greeting; the greeting the
//                               user sees is a client thread constant
//                               (apps/web-consumer/.../ask-ai-thread.ts)
//   openaiModel     fallback  — models_config.memo.model wins; memo_openai_model
//                               is only read when that is unset
//   webGrounding    not wired — the Perplexity leg is not optional. It IS Memo's
//                               answer engine (step 2 of 2) and runs on every
//                               turn regardless of this switch
//   perplexityModel not wired — the live model comes from
//                               models_config.memo.perplexity, not this field
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
              kind="not-wired"
              reason="Ask AI parked — web/mobile client constants mirror this string (Product Rules §E); fetch live on unpark"
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

      {/* Models */}
      <SectionCard
        icon={<Bot className="text-secondary h-4 w-4" />}
        title="Models"
        subtitle="Perplexity is Memo's answer engine, not an optional add-on — it runs on every turn. The live model picks come from Models Config; these fields are legacy."
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label={
              <>
                OpenAI model
                <KnobStatus kind="fallback" reason="models_config.memo.model wins when set" />
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
                Web grounding (Perplexity)
                <KnobStatus
                  kind="not-wired"
                  reason="Perplexity answers every turn regardless of this switch"
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
                <KnobStatus kind="not-wired" reason="live pick is models_config.memo.perplexity" />
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
