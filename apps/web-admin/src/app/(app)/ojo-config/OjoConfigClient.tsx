"use client";

// Ojo Config — the proof-verification engine's policy.
//
// MINIMAL PAGE (Pato, 2026-08-21: "less info, that's overwhelming, just ask
// the important params"). A census of all 306 admin knobs found 68% of them
// unread by any code path; Ojo was 11 controls of which ZERO are enforced,
// spread over four cards each wearing its own identical Staged badge.
//
// The rule this page is the template for:
//   • ENFORCED knobs are always visible, never behind a disclosure.
//   • STAGED knobs stay if an operator can answer them TODAY from product
//     intent alone (enabled · auto-pass · what a fail does), and go behind ONE
//     disclosure if they describe an object that doesn't exist yet (the
//     rubric and the prompt of a vision model nobody has written).
//   • STOP RENDERING, NEVER STOP CARRYING. `cfg` still holds every key —
//     showGuestReason and maxRetries included — and save spreads the whole
//     object, so a knob without a control keeps its stored value instead of
//     being reset by the next whole-blob write. ojo-config.test.ts is the
//     ship gate for that.
//
// WHOLE-BLOB save; `dirty` gates on loadError so a failed read can never
// overwrite the live singleton (MESITA-737).

import { useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import {
  Collapsible,
  NumberField,
  SaveRow,
  SectionCard,
  Switch,
  TextAreaField,
} from "@/components/admin-ui/config";
import { getOjoConfig, updateOjoConfig } from "./actions";
import type { OjoChecks, OjoConfig } from "./defaults";

// One label each. The reasoning behind a check belongs in Notion Docs › Ojo,
// not in four paragraphs an operator re-reads every visit.
const CHECKS: { key: keyof OjoChecks; label: string }[] = [
  { key: "placeNameMatches", label: "Place name matches" },
  { key: "isRightSurface", label: "Right surface for the task" },
  { key: "ratingPresent", label: "Rating visible (Google)" },
  { key: "recentTimestamp", label: "Timestamp looks recent" },
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
        title="Ojo"
        subtitle="Reads the screenshot a guest posts as proof and scores it. Nothing reads this policy until the engine ships (MESITA-1034)."
        status={
          <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            Staged
          </span>
        }
      >
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <p className="text-sm font-semibold">Run Ojo on submitted proofs</p>
          <Switch
            on={cfg.enabled}
            pending={pending}
            onClick={() => patch({ enabled: !cfg.enabled })}
            label="Enable Ojo"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<Eye className="h-4 w-4" />}
            label="Auto-pass at or above"
            value={cfg.autoPassScore}
            min={0}
            max={1}
            decimals
            disabled={pending}
            onChange={(v) => patch({ autoPassScore: v })}
          />
        </div>

        <div className="border-border bg-background mt-3 flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">A fail withholds the bonus</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Off: a failed proof still verifies and is flagged for the queue —
              a human decides. On: the guest keeps their base rate. Real money
              either way.
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

        {/* Everything below describes a vision model nobody has written yet.
            The Linear id is in the label so it is greppable on ship day: the
            controls move OUT of this <details>, same file, same keys. */}
        <Collapsible summary="Engine detail — not built yet (MESITA-1034)">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              icon={<Eye className="h-4 w-4" />}
              label="Send to queue at or above"
              value={cfg.reviewFloorScore}
              min={0}
              max={1}
              decimals
              disabled={pending}
              onChange={(v) => patch({ reviewFloorScore: v })}
            />
          </div>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Below this is a fail. Saving clamps it to the auto-pass score.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {CHECKS.map((c) => (
              <div
                key={c.key}
                className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border px-4 py-2.5"
              >
                <p className="text-sm">{c.label}</p>
                <Switch
                  on={cfg.checks[c.key]}
                  pending={pending}
                  onClick={() => patchCheck(c.key)}
                  label={c.label}
                />
              </div>
            ))}
          </div>

          <div className="mt-4">
            <TextAreaField
              label="Operator instruction"
              value={cfg.prompt}
              disabled={pending}
              onChange={(v) => patch({ prompt: v })}
            />
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Never ask it to judge sentiment — paying more for praise is how a
              rewards program buys fake reviews.
            </p>
          </div>
        </Collapsible>
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
