"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { buttonClass } from "./ui";

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <span
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-border bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The page's sub-pages. Scrolls sideways on a phone instead of wrapping. */
export function SubTabs({ tabs }: { tabs: { href: string; label: string; count?: number }[] }) {
  const pathname = usePathname();
  // The longest matching href wins, so /credits does not light up on /credits/balances.
  const active = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Sections" className="no-scrollbar -mx-4 mb-6 overflow-x-auto border-b border-border px-4 lg:mx-0 lg:px-0">
      <div className="flex gap-5">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active === t.href ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active === t.href
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count ? (
              <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{t.count}</span>
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-lg border border-border bg-card px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm";

/**
 * Settings pages keep their edits in memory and "save" to nothing. The bar
 * appears once something changed and says plainly that the mock stores nothing.
 */
export function useMockSave() {
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2600);
    return () => clearTimeout(t);
  }, [saved]);
  return {
    dirty,
    saved,
    touch: () => {
      setDirty(true);
      setSaved(false);
    },
    save: () => {
      setDirty(false);
      setSaved(true);
    },
  };
}

export function SaveBar({ dirty, saved, onSave }: { dirty: boolean; saved: boolean; onSave: () => void }) {
  if (!dirty && !saved) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:left-64">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl bg-foreground px-4 py-3 text-background shadow-lg">
        <span className="text-sm">
          {saved ? "Saved. This is a mock, so nothing was stored." : "You have unsaved changes."}
        </span>
        {dirty ? (
          <button type="button" onClick={onSave} className={buttonClass("primary")}>
            Save
          </button>
        ) : null}
      </div>
    </div>
  );
}
