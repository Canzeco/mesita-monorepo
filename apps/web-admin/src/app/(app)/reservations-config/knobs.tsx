"use client";

import type { ReactNode } from "react";
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

/** A small integer field — a daily meter. */
export function Cap({
  label,
  help,
  value,
  pending,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  pending: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-sm font-semibold">{label}</span>
      <input
        type="number"
        min={1}
        max={1000}
        value={value}
        disabled={pending}
        onChange={(e) => onChange(Math.max(1, Math.trunc(Number(e.target.value) || 1)))}
        className="border-border bg-card focus:border-foreground h-9 w-full max-w-[8rem] rounded-lg border px-3 text-sm tabular-nums outline-none disabled:opacity-50"
      />
      <span className="text-muted-foreground text-xs">{help}</span>
    </label>
  );
}

/** Quiet group label inside a SectionCard. Not a nested card. */
export function Group({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-5">
      <p className="text-muted-foreground type-meta mb-2 font-semibold tracking-wide uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}
