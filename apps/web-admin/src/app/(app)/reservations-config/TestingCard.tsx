"use client";

import { FlaskConical } from "lucide-react";
import {
  ChoicePill,
  SectionCard,
  SwitchRow,
  TextField,
} from "@/components/admin-ui";
import {
  type CallMode,
  callMode,
  type ReservationsConfig,
  withCallMode,
} from "./catalog";

// MESITA-4149: three call modes. Consultants test on their own phones, so the
// guest's-phone mode rings whoever made the reservation, with no number in the
// console.
const MODES: Array<[CallMode, string]> = [
  ["number", "Test number"],
  ["guest", "Guest's phone"],
  ["production", "Production"],
];

const MODE_HINT: Record<CallMode, string> = {
  number: "Every call to a place dials the test number below.",
  guest:
    "Every call to a place dials the phone of the guest who made the reservation.",
  production: "The agent is calling real businesses.",
};

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
  const mode = callMode(cfg.testCall);
  return (
    <SectionCard
      icon={<FlaskConical />}
      title="Testing"
      subtitle="Stay off Production until a real run."
    >
      <div className="border-border bg-background mt-5 rounded-xl border p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">Who the agent calls</span>
          <span
            className={
              mode === "production"
                ? "text-warning type-meta font-medium"
                : "text-muted-foreground type-meta"
            }
          >
            {MODE_HINT[mode]}
          </span>
        </div>
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Who the agent calls"
        >
          {MODES.map(([m, label]) => (
            <ChoicePill
              key={m}
              active={mode === m}
              disabled={pending}
              onClick={() => patch({ testCall: withCallMode(cfg.testCall, m) })}
            >
              {label}
            </ChoicePill>
          ))}
        </div>
        {mode === "number" ? (
          <TextField
            className="mt-4"
            label="Test number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+524445499597"
            value={cfg.testCall.number}
            disabled={pending}
            aria-invalid={testInvalid || undefined}
            onChange={(number) =>
              patch({ testCall: { ...cfg.testCall, number } })
            }
            hint={
              testInvalid ? (
                <span className="text-warning">
                  Needs E.164 — a leading + and country code.
                </span>
              ) : undefined
            }
          />
        ) : null}
      </div>

      <div className="mt-3">
        <SwitchRow
          label="Ignore the monthly cap"
          hint={
            cfg.unlimitedReservations ? (
              <span className="text-warning font-medium">
                Every guest can book past the monthly cap — each booking is a
                real call.
              </span>
            ) : undefined
          }
          checked={cfg.unlimitedReservations}
          pending={pending}
          onCheckedChange={(unlimitedReservations) =>
            patch({ unlimitedReservations })
          }
        />
      </div>
    </SectionCard>
  );
}
