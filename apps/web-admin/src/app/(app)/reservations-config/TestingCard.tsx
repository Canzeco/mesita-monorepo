"use client";

import { FlaskConical } from "lucide-react";
import {
  SectionCard,
  Switch,
  SwitchRow,
  TextField,
} from "@/components/admin-ui";
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
      icon={<FlaskConical />}
      title="Testing"
      subtitle="Keep both on until a real run."
    >
      <div className="border-border bg-background mt-5 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-medium">Test mode</span>
            <span
              className={
                cfg.testCall.enabled
                  ? "text-muted-foreground type-meta"
                  : "text-warning type-meta font-medium"
              }
            >
              {cfg.testCall.enabled
                ? "Every call dials the test number, never a real place."
                : "The agent is calling real businesses."}
            </span>
          </div>
          <Switch
            checked={cfg.testCall.enabled}
            pending={pending}
            label="Test mode"
            onCheckedChange={(enabled) =>
              patch({ testCall: { ...cfg.testCall, enabled } })
            }
          />
        </div>
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
