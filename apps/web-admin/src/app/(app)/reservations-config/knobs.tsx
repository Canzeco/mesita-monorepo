"use client";

import { Switch } from "@/components/admin-ui/config";

/** A labelled switch row. One line of help, and only when it earns one. */
export function Row({
  label,
  help,
  danger,
  on,
  pending,
  onClick,
}: {
  label: string;
  help?: string;
  danger?: boolean;
  on: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {help ? (
          <p
            className={`mt-0.5 text-xs ${danger ? "font-medium text-amber-600" : "text-muted-foreground"}`}
          >
            {help}
          </p>
        ) : null}
      </div>
      <Switch on={on} pending={pending} label={label} onClick={onClick} />
    </div>
  );
}
