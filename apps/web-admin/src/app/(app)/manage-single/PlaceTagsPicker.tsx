"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, Tag, X } from "lucide-react";
import {
  listPlaceTagCatalog,
  type PlaceTagFacet,
  type PlaceTagOption,
} from "./actions";

// Atlas-catalog multi-select modal for place tags.
//
// Catalog is loaded via server action → admin-web-get-atlas-fields (same EF
// Atlas Config uses). This page never imports from /atlas-config and never
// reads place_tags from the client.

export function PlaceTagsPicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facets, setFacets] = useState<PlaceTagFacet[]>([]);
  const [tags, setTags] = useState<PlaceTagOption[]>([]);
  const [max, setMax] = useState(20);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);

  const loadCatalog = () => {
    if (loaded || loading) return;
    setLoading(true);
    setError(null);
    listPlaceTagCatalog().then((r) => {
      setLoading(false);
      if (!r.ok) {
        setError(r.error);
        setFacets([]);
        setTags([]);
        return;
      }
      setFacets(r.data.facets);
      setTags(r.data.tags);
      setMax(r.data.tagsPerPlaceMax);
      setLoaded(true);
    });
  };

  const openModal = () => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    loadCatalog();
  };

  const bySlug = useMemo(() => {
    const map = new Map<string, PlaceTagOption>();
    for (const tag of tags) map.set(tag.slug, tag);
    return map;
  }, [tags]);

  const selected = useMemo(() => new Set(value), [value]);

  const groups = useMemo(() => {
    const byFacet = new Map<string, PlaceTagOption[]>();
    for (const tag of tags) {
      const list = byFacet.get(tag.facet) ?? [];
      list.push(tag);
      byFacet.set(tag.facet, list);
    }
    return facets
      .map((facet) => ({ facet, rows: byFacet.get(facet.slug) ?? [] }))
      .filter((group) => group.rows.length > 0);
  }, [facets, tags]);

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        facet: group.facet,
        rows: group.rows.filter(
          (tag) =>
            tag.label_en.toLowerCase().includes(q) ||
            tag.label_es.toLowerCase().includes(q) ||
            tag.slug.toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.rows.length > 0);
  }, [groups, query]);

  const atLimit = value.length >= max;

  const toggle = (slug: string) => {
    if (selected.has(slug)) {
      onChange(value.filter((item) => item !== slug));
    } else if (value.length < max) {
      onChange([...value, slug]);
    }
  };

  const removeTag = (slug: string) => {
    onChange(value.filter((item) => item !== slug));
  };

  const labelFor = (slug: string) =>
    bySlug.get(slug)?.label_en ?? slug.replace(/_/g, " ");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-foreground/80 type-body font-medium">Tags</span>
        <span className="text-muted-foreground type-label tabular-nums">
          {value.length} / {max}
        </span>
      </div>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((slug) => (
            <li key={slug}>
              <span className="border-pink-200/80 bg-pink-500/[0.06] text-foreground/90 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium">
                {labelFor(slug)}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeTag(slug)}
                  aria-label={`Remove ${labelFor(slug)}`}
                  className="text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">No tags selected.</p>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={openModal}
        className="border-border hover:border-primary/50 hover:text-primary inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-50"
      >
        <Tag className="h-3.5 w-3.5" />
        {value.length > 0 ? "Edit tags" : "Select tags"}
      </button>

      {open ? (
        <TagsModal
          loading={loading}
          error={error}
          query={query}
          onQueryChange={setQuery}
          visibleGroups={visibleGroups}
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

function TagsModal({
  loading,
  error,
  query,
  onQueryChange,
  visibleGroups,
  selected,
  atLimit,
  valueCount,
  max,
  onToggle,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  query: string;
  onQueryChange: (v: string) => void;
  visibleGroups: { facet: PlaceTagFacet; rows: PlaceTagOption[] }[];
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
        aria-label="Select tags"
      >
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Select tags</h3>
            <p className="text-muted-foreground text-xs tabular-nums">
              Atlas catalog · {valueCount}/{max} selected
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
            placeholder="Search tags…"
            className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading catalog…
            </div>
          ) : error ? (
            <p className="text-destructive px-4 py-10 text-center text-sm">{error}</p>
          ) : visibleGroups.length === 0 ? (
            <p className="text-muted-foreground px-4 py-10 text-center text-sm">
              No matching tags.
            </p>
          ) : (
            visibleGroups.map((group) => (
              <div key={group.facet.slug} className="border-border border-b last:border-b-0">
                <p className="text-muted-foreground bg-muted/30 sticky top-0 px-4 py-2 type-label font-semibold tracking-[0.12em] uppercase">
                  {group.facet.emoji} {group.facet.label_en}
                </p>
                <div className="grid grid-cols-1 gap-0.5 px-2 py-1 sm:grid-cols-2 lg:grid-cols-3">
                  {group.rows.map((tag) => {
                    const isOn = selected.has(tag.slug);
                    return (
                      <button
                        key={tag.slug}
                        type="button"
                        disabled={!isOn && atLimit}
                        onClick={() => onToggle(tag.slug)}
                        title={tag.slug}
                        className={
                          "hover:bg-muted/60 flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition " +
                          (isOn ? "bg-muted/40" : "") +
                          (!isOn && atLimit ? " cursor-not-allowed opacity-40" : "")
                        }
                      >
                        <span
                          className={
                            "border-border flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border " +
                            (isOn
                              ? "bg-pink-gradient border-transparent text-white"
                              : "bg-card")
                          }
                        >
                          {isOn ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{tag.label_en}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
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
