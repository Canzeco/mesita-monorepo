"use client";

import { FlaskConical } from "lucide-react";
import { SectionCard, Switch } from "@/components/admin-ui/config";
import { Row } from "./knobs";
import type { ReservationsConfig } from "./catalog";

export function TestingCard({
  cfg,
  pending,
  testInvalid,
  patch,
}: {
  cfg: ReservationsConfig;
  pending: boolean;
  testInvalid: boolean;
  patch: (next: Partial<ReservationsConfig>) => void;
}) {
  return (
    <SectionCard
      icon={<FlaskConical className="text-secondary h-4 w-4" />}
      title="Testing"
      subtitle="Check both before a real run."
    >
      <div className="border-border bg-background mt-5 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Test mode</p>
            <p
              className={`mt-0.5 text-xs ${
                cfg.testCall.enabled ? "text-muted-foreground" : "font-medium text-amber-600"
              }`}
            >
              {cfg.testCall.enabled
                ? "Every call dials the test number, never a real place."
                : "The agent is calling real businesses."}
            </p>
          </div>
          <Switch
            on={cfg.testCall.enabled}
            pending={pending}
            label="Test mode"
            onClick={() =>
              patch({ testCall: { ...cfg.testCall, enabled: !cfg.testCall.enabled } })
            }
          />
        </div>
        <label className="mt-4 flex flex-col gap-2">
          <span className="text-sm font-semibold">Test number</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+524445499597"
            value={cfg.testCall.number}
            disabled={pending}
            aria-invalid={testInvalid || undefined}
            onChange={(e) => patch({ testCall: { ...cfg.testCall, number: e.target.value } })}
            className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-3 text-sm tabular-nums outline-none disabled:opacity-50"
          />
          {testInvalid ? (
            <span className="text-xs text-amber-600">
              Needs E.164 — a leading + and country code.
            </span>
          ) : null}
        </label>
      </div>

      <div className="mt-3">
        <Row
          label="Ignore the monthly cap"
          help={
            cfg.unlimitedReservations
              ? "Hides the paywall Premium depends on."
              : undefined
          }
          danger={cfg.unlimitedReservations}
          on={cfg.unlimitedReservations}
          pending={pending}
          onClick={() => patch({ unlimitedReservations: !cfg.unlimitedReservations })}
        />
      </div>
    </SectionCard>
  );
}
