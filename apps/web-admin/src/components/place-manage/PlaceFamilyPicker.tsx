"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Search, X } from "lucide-react";
import { usePlaceContext } from "./PlaceContext";
import type { PlaceFamilyOption } from "./actions";

// The thirty-seven Mesita Families as a multi-select (MESITA-2893), the Tags picker's
// shape: chips for the picked ones, a modal with search to change them, the
// "n / max" counter, and no more picks once the cap is reached. The vocabulary
// arrives on the profile read in catalog (day-arc) order; opening the picker
// does not fetch. The list is stored in that same order whatever order the
// operator clicked (gate d27a), so the chips here follow it too.

export function PlaceFamilyPicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (families: string[]) => void;
  disabled?: boolean;
}) {
  const { profile } = usePlaceContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const families = profile.families;
  const max = profile.fieldLimits.familiesPerPlaceMax;

  const bySlug = useMemo(() => {
    const map = new Map<string, PlaceFamilyOption>();
    for (const f of families) map.set(f.slug, f);
    return map;
  }, [families]);

  const selected = useMemo(() => new Set(value), [value]);

  // Picked chips in catalog order, the order the door stores.
  const ordered = useMemo(() => {
    const rank = new Map(families.map((f, i) => [f.slug, i] as const));
    return [...value].sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999));
  }, [families, value]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return families;
    return families.filter(
      (f) => f.label.toLowerCase().includes(q) || f.slug.toLowerCase().includes(q),
    );
  }, [families, query]);

  const atLimit = value.length >= max;

  const toggle = (slug: string) => {
    if (selected.has(slug)) {
      onChange(value.filter((item) => item !== slug));
    } else if (value.length < max) {
      onChange([...value, slug]);
    }
  };

  const chipFor = (slug: string) => {
    const f = bySlug.get(slug);
    return f ? `${f.emoji} ${f.label}` : slug.replace(/_/g, " ");
  };

  return (
    <div className="-mx-1.5 flex-1 py-2">
      <ul className="flex flex-wrap items-center gap-1.5">
        {ordered.map((slug) => (
          <li key={slug}>
            <span className="border-border bg-foreground/[0.06] text-foreground/90 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium">
              {chipFor(slug)}
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggle(slug)}
                aria-label={`Remove ${chipFor(slug)}`}
                className="text-muted-foreground hover:text-foreground transition disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </li>
        ))}
        <li>
          <button
            type="button"
            disabled={disabled || families.length === 0}
            onClick={() => {
              if (disabled) return;
              setOpen(true);
              setQuery("");
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
          >
            {value.length > 0 ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {value.length > 0 ? "Edit" : "Add families"}
          </button>
        </li>
        {ordered.length === 0 ? (
          <li className="text-muted-foreground text-xs">
            None yet: the place reads Undefined and stays off the guest rails.
          </li>
        ) : null}
      </ul>

      {open ? (
        <FamiliesModal
          query={query}
          onQueryChange={setQuery}
          visible={visible}
          selected={selected}
          atLimit={atLimit}
          valueCount={value.length}
          max={max}
          onToggle={toggle}
          onClose={() => {
            setOpen(false);
            setQuery("");
          }}
        />
      ) : null}
    </div>
  );
}

function FamiliesModal({
  query,
  onQueryChange,
  visible,
  selected,
  atLimit,
  valueCount,
  max,
  onToggle,
  onClose,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  visible: PlaceFamilyOption[];
  selected: Set<string>;
  atLimit: boolean;
  valueCount: number;
  max: number;
  onToggle: (slug: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="border-border/70 bg-card shadow-elev flex max-h-[85dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Select families"
      >
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Select families</h3>
            <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
              The thirty-seven Mesita Families · {valueCount}/{max} selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 inline-flex h-7 w-7 items-center justify-center rounded-md transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-border flex items-center gap-2 border-b px-4 py-2.5">
          <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search families…"
            className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="text-muted-foreground px-4 py-10 text-center text-sm">
              No matching families.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-0.5 px-2 py-1 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((f) => {
                const isOn = selected.has(f.slug);
                return (
                  <button
                    key={f.slug}
                    type="button"
                    aria-pressed={isOn}
                    disabled={!isOn && atLimit}
                    onClick={() => onToggle(f.slug)}
                    title={f.slug}
                    className={
                      "hover:bg-muted/60 flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition " +
                      (isOn ? "bg-muted/40" : "") +
                      (!isOn && atLimit ? " cursor-not-allowed opacity-40" : "")
                    }
                  >
                    <span
                      className={
                        "border-border flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border " +
                        (isOn ? "bg-pink-gradient border-transparent text-white" : "bg-card")
                      }
                    >
                      {isOn ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {f.emoji} {f.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-border flex items-center justify-end border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-pink-gradient shadow-save inline-flex h-9 items-center rounded-full px-5 text-sm font-semibold text-white transition hover:brightness-105 active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
