"use client";

// Ojo Config — the proof-verification engine's policy. WHOLE-BLOB save (the
// thresholds are a related set), `dirty` gates on loadError so a failed read
// can never overwrite the live singleton (MESITA-737), and every knob carries
// a STAGED badge until the engine ships (MESITA-1034). House rule: an
// unenforced config is a bug — a staged one has to say so out loud.

import { useState, useTransition } from "react";
import {
  Eye,
  Gauge,
  ListChecks,
  MessageSquareText,
  RotateCcw,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import {
  NumberField,
  SaveRow,
  SectionCard,
  Switch,
  TextAreaField,
} from "@/components/admin-ui/config";
import { getOjoConfig, updateOjoConfig } from "./actions";
import type { OjoChecks, OjoConfig } from "./defaults";

function StagedBadge() {
  return (
    <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
      Staged
    </span>
  );
}

const CHECKS: { key: keyof OjoChecks; label: string; blurb: string }[] = [
  {
    key: "placeNameMatches",
    label: "Place name matches",
    blurb:
      "The name visible in the screenshot has to be this place. The single strongest signal Ojo has — a proof for the wrong venue is the most common way this gets gamed.",
  },
  {
    key: "isRightSurface",
    label: "Right surface for the task",
    blurb:
      "A Google review proof must look like Google; a story proof must look like an Instagram story. Catches a guest posting the wrong screenshot by accident more often than fraud.",
  },
  {
    key: "ratingPresent",
    label: "Rating is visible (Google only)",
    blurb:
      "Stars are on screen. Deliberately sentiment-blind: Ojo checks that a rating EXISTS, never what it says. A reward that pays more for five stars buys fake reviews.",
  },
  {
    key: "recentTimestamp",
    label: "Timestamp looks recent",
    blurb:
      "Any visible date reads as recent rather than months old. Off by default — most screenshots crop the timestamp, so this fails honest guests more than it catches dishonest ones.",
  },
];

export function OjoConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: {
  initialConfig: OjoConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<OjoConfig>(initialConfig);
  const [saved, setSaved] = useState<OjoConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);

  const patch = (p: Partial<OjoConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, ...p }));
  };
  const patchCheck = (key: keyof OjoChecks) => {
    setOk(false);
    setCfg((c) => ({ ...c, checks: { ...c.checks, [key]: !c.checks[key] } }));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      // The review floor can never exceed auto-pass, or the "flag" band
      // inverts and every proof lands in one bucket.
      const next: OjoConfig = {
        ...cfg,
        reviewFloorScore: Math.min(cfg.reviewFloorScore, cfg.autoPassScore),
      };
      const r = await updateOjoConfig(next);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setOk(true);
    });
  };

  const reload = () => {
    setError(null);
    startTransition(async () => {
      const r = await getOjoConfig();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setOk(false);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<Eye className="h-4 w-4" />}
        title="Engine"
        subtitle="Off means proofs keep today's behavior: the guest's word verifies the task and no vision call is made."
        status={<StagedBadge />}
      >
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Run Ojo on submitted proofs</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              When on, every screenshot posted for an Instagram story or Google
              review is scored before the bonus is treated as earned. The QR is
              never gated on it — the guest keeps moving while Ojo reads.
            </p>
          </div>
          <Switch
            on={cfg.enabled}
            pending={pending}
            onClick={() => patch({ enabled: !cfg.enabled })}
            label="Enable Ojo"
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={<Gauge className="h-4 w-4" />}
        title="Confidence bands"
        subtitle="Ojo returns a score, not a yes/no. These two numbers cut it into auto-pass, needs-a-human, and fail."
        status={<StagedBadge />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<Gauge className="h-4 w-4" />}
            label="Auto-pass at or above"
            value={cfg.autoPassScore}
            min={0}
            max={1}
            decimals
            disabled={pending}
            onChange={(v) => patch({ autoPassScore: v })}
          />
          <NumberField
            icon={<ListChecks className="h-4 w-4" />}
            label="Send to queue at or above"
            value={cfg.reviewFloorScore}
            min={0}
            max={1}
            decimals
            disabled={pending}
            onChange={(v) => patch({ reviewFloorScore: v })}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Below the queue floor is a fail. Saving clamps the floor to the
          auto-pass score — a floor above it would collapse the middle band and
          send everything one way.
        </p>

        <div className="border-border bg-background mt-3 flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">A fail withholds the bonus</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Off (default): a failed proof still verifies and is flagged for
              the Verification Queue — a human decides, and nobody argues with
              a robot at the table. On: the task stays unearned and the guest
              keeps their base rate. Real money either way, so this is the one
              knob to think hardest about.
            </p>
          </div>
          <Switch
            on={cfg.failAction === "withhold"}
            pending={pending}
            onClick={() =>
              patch({
                failAction: cfg.failAction === "withhold" ? "flag" : "withhold",
              })
            }
            label="Withhold on fail"
          />
        </div>

        <div className="border-border bg-background mt-3 flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Tell the guest why</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Shows Ojo&apos;s reason on the ticket so a guest can fix the
              screenshot and retry instead of guessing. Off hides it — quieter,
              but it turns a fixable miss into a support message.
            </p>
          </div>
          <Switch
            on={cfg.showGuestReason}
            pending={pending}
            onClick={() => patch({ showGuestReason: !cfg.showGuestReason })}
            label="Show guest reason"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<RotateCcw className="h-4 w-4" />}
            label="Retries per ticket"
            value={cfg.maxRetries}
            min={0}
            max={10}
            disabled={pending}
            onChange={(v) => patch({ maxRetries: Math.round(v) })}
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={<ListChecks className="h-4 w-4" />}
        title="What Ojo checks"
        subtitle="Each claim the model must assess. Fewer checks means fewer false rejections of honest guests."
        status={<StagedBadge />}
      >
        <div className="flex flex-col gap-3">
          {CHECKS.map((c) => (
            <div
              key={c.key}
              className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{c.label}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {c.blurb}
                </p>
              </div>
              <Switch
                on={cfg.checks[c.key]}
                pending={pending}
                onClick={() => patchCheck(c.key)}
                label={c.label}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        icon={<MessageSquareText className="h-4 w-4" />}
        title="Instruction"
        subtitle="Prepended to the vision call. Empty uses the engine's built-in prompt."
        status={<StagedBadge />}
      >
        <TextAreaField
          label="Operator instruction"
          value={cfg.prompt}
          disabled={pending}
          onChange={(v) => patch({ prompt: v })}
        />
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          Never ask it to judge sentiment. Ojo checks that a review exists, not
          whether it was kind — paying more for praise is how a rewards program
          buys fake reviews.
        </p>
      </SectionCard>

      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={loadError}
      />

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={reload}
          disabled={pending}
          className="hover:text-foreground underline underline-offset-2 disabled:opacity-50"
        >
          Reload
        </button>
        {updatedAt ? (
          <span>Last saved {new Date(updatedAt).toLocaleString()}</span>
        ) : null}
      </div>
    </div>
  );
}
