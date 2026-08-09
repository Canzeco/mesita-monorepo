"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, Loader2, Trash2 } from "lucide-react";

import type { BusinessRole } from "@/lib/api/team";
import { ICON_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

import { ROLE_LABEL } from "./team-constants";

export function TeamModule({
  icon,
  title,
  active,
  pending = 0,
  meta,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  active: number;
  pending?: number;
  meta?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const subtitle =
    meta ?? `${active} active${pending > 0 ? ` · ${pending} pending` : ""}`;

  return (
    <section className="border-border bg-card overflow-hidden rounded-2xl border shadow-[0_8px_28px_-24px_rgba(0,0,0,0.35)]">
      <div className="border-border/60 flex items-center gap-3 border-b px-4 py-3">
        <span className="bg-muted text-foreground/75 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <p className="text-muted-foreground text-[11px]">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-2.5 p-3">{children}</div>
    </section>
  );
}

export function TeamList({ children }: { children: ReactNode }) {
  return (
    <ul className="border-border/70 bg-background divide-border/60 divide-y overflow-hidden rounded-xl border">
      {children}
    </ul>
  );
}

export function TeamEmpty({ message }: { message: string }) {
  return (
    <div className="border-border/60 bg-muted/15 text-muted-foreground flex min-h-[4.5rem] items-center justify-center rounded-xl border border-dashed px-4 text-center text-[12px]">
      {message}
    </div>
  );
}

export function InviteButton({
  open,
  onClick,
  label,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition",
        open
          ? "border-border bg-muted text-foreground border"
          : "bg-pink-gradient text-white hover:opacity-90",
      )}
    >
      {open ? "Cancel" : label}
    </button>
  );
}

export function PendingRow({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <li className="bg-muted/25 flex items-center gap-2.5 px-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold">{title}</p>
        <p className="text-muted-foreground truncate text-[10px]">{subtitle}</p>
      </div>
      {children}
    </li>
  );
}

export function RoleSelect({
  role,
  choices,
  disabled,
  onChange,
}: {
  role: BusinessRole;
  choices: BusinessRole[];
  disabled: boolean;
  onChange: (r: BusinessRole) => void;
}) {
  return (
    <select
      value={role}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as BusinessRole)}
      className="border-border bg-background text-foreground hidden rounded-full border px-2.5 py-1 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-60 sm:block"
    >
      {choices.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </select>
  );
}

// Swaps a button's icon for a spinner while its action is in flight.
function BusyIcon({ busy, icon }: { busy: boolean; icon: ReactNode }) {
  return busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon;
}

export function RemoveButton({
  busy,
  hidden,
  label,
  onClick,
}: {
  busy: boolean;
  hidden?: boolean;
  label: string;
  onClick: () => void;
}) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={cn(
        ICON_BUTTON_CLASS,
        "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive border-transparent bg-transparent",
      )}
    >
      <BusyIcon busy={busy} icon={<Trash2 className="h-3.5 w-3.5" />} />
    </button>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* swallow */
        }
      }}
      className={ICON_BUTTON_CLASS}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function Avatar({ initial, tint }: { initial: string; tint: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase",
        tint,
        tint.includes("gradient") && "text-white",
      )}
    >
      {initial.trim() || "·"}
    </span>
  );
}
