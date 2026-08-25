"use client";

import { OctagonPause, Phone } from "lucide-react";
import { SectionCard, Switch } from "@/components/admin-ui/config";
import { Cap, Group, Row } from "./knobs";
import type { ReservationsConfig } from "./catalog";

export function CallsCard({
  cfg,
  pending,
  patch,
}: {
  cfg: ReservationsConfig;
  pending: boolean;
  patch: (next: Partial<ReservationsConfig>) => void;
}) {
  return (
    <SectionCard
      icon={<Phone className="text-secondary h-4 w-4" />}
      title="Calls"
      subtitle="Every reservation is a real, metered phone call."
    >
      <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <OctagonPause className="h-4 w-4 text-red-600" />
            Stop all calls
          </p>
          {cfg.limits.killSwitch ? (
            <p className="mt-0.5 text-xs font-medium text-red-600">
              Nothing is dialling. Resumes a minute after you turn this off.
            </p>
          ) : null}
        </div>
        <Switch
          on={cfg.limits.killSwitch}
          pending={pending}
          label="Stop all calls"
          onClick={() =>
            patch({ limits: { ...cfg.limits, killSwitch: !cfg.limits.killSwitch } })
          }
        />
      </div>

      <Group title="Caps">
        <div className="grid gap-3 sm:grid-cols-2">
          <Cap
            label="Reschedules per ticket, daily"
            help="Each one buys fresh place calls."
            value={cfg.limits.reschedulesPerTicketPerDay}
            pending={pending}
            onChange={(v) =>
              patch({ limits: { ...cfg.limits, reschedulesPerTicketPerDay: v } })
            }
          />
          <Cap
            label="Calls per place, daily"
            help="Bookings and cancel notices share the meter."
            value={cfg.limits.venueCallsPerPlacePerDay}
            pending={pending}
            onChange={(v) =>
              patch({ limits: { ...cfg.limits, venueCallsPerPlacePerDay: v } })
            }
          />
        </div>
      </Group>

      <Group title="Guest">
        <Row
          label="Remind guests 3 hours before"
          help={
            cfg.reminder.enabled
              ? "One extra a2 call per confirmed table. Quiet hours still apply."
              : undefined
          }
          danger={cfg.reminder.enabled}
          on={cfg.reminder.enabled}
          pending={pending}
          onClick={() => patch({ reminder: { enabled: !cfg.reminder.enabled } })}
        />
      </Group>

      <Group title="Intake">
        <Row
          label="Keep hand-picked contacts"
          help={
            cfg.respectAdminOverride
              ? undefined
              : "The next Enrich or Re-enrich overwrites contacts an operator chose."
          }
          danger={!cfg.respectAdminOverride}
          on={cfg.respectAdminOverride}
          pending={pending}
          onClick={() => patch({ respectAdminOverride: !cfg.respectAdminOverride })}
        />
      </Group>
    </SectionCard>
  );
}
