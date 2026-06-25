"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, Search, Tag, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiListVenueTags,
  type TagFacet,
  type VenueTagOption,
} from "@/lib/api/venue-tags";
import { cn } from "@/lib/utils";
import { INPUT_CLASS as INPUT } from "@/lib/ui-classes";

// Grouped, searchable multi-select for the controlled tag vocabulary.
//
//   <PlaceTagsPicker value={form.tags} onChange={(t) => set("tags", t)} />
//
// `value` is an array of tag slugs; `onChange` emits the next array. Only
// slugs present in the catalog are ever emitted (membership is guaranteed
// because every toggle comes from a catalog row). Pre-existing free-text
// tags that aren't in the catalog still render as chips so the owner can
// see and remove them — they just can't be re-added from the picker.

export function PlaceTagsPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const supabase = useBrowserSupabase();
  const [facets, setFacets] = useState<TagFacet[]>([]);
  const [tags, setTags] = useState<VenueTagOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    // `loading` already starts true and `supabase` is a stable memoized
    // client, so the catalog is fetched exactly once at mount — no need to
    // re-flip loading synchronously (which also trips set-state-in-effect).
    let cancelled = false;
    apiListVenueTags(supabase)
      .then((data) => {
        if (cancelled) return;
        setFacets(data.facets);
        setTags(data.tags);
      })
      .catch(() => {
        if (cancelled) return;
        setFacets([]);
        setTags([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // slug → option, for resolving selected chips to their English label.
  const bySlug = useMemo(() => {
    const map = new Map<string, VenueTagOption>();
    for (const tag of tags) map.set(tag.slug, tag);
    return map;
  }, [tags]);

  const selected = useMemo(() => new Set(value), [value]);

  // Tags grouped by facet, in facet display order. Tags themselves arrive
  // pre-sorted by sort_order, so preserving insertion order is enough.
  const groups = useMemo(() => {
    const byFacet = new Map<string, VenueTagOption[]>();
    for (const tag of tags) {
      const list = byFacet.get(tag.facet) ?? [];
      list.push(tag);
      byFacet.set(tag.facet, list);
    }
    return facets
      .map((facet) => ({ facet, rows: byFacet.get(facet.slug) ?? [] }))
      .filter((group) => group.rows.length > 0);
  }, [facets, tags]);

  // Apply the search filter (English label + slug), dropping empty groups.
  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        facet: group.facet,
        rows: group.rows.filter(
          (tag) =>
            tag.label_en.toLowerCase().includes(q) ||
            tag.slug.toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.rows.length > 0);
  }, [groups, query]);

  const toggle = (slug: string) => {
    if (selected.has(slug)) {
      onChange(value.filter((item) => item !== slug));
    } else {
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
      {/* Selected chips */}
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((slug) => (
            <li key={slug}>
              <span className="border-border/60 bg-muted/35 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium">
                {labelFor(slug)}
                <button
                  type="button"
                  onClick={() => removeTag(slug)}
                  aria-label={`Remove ${labelFor(slug)}`}
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Trigger + popover */}
      {loading ? (
        <div className="text-muted-foreground flex h-10 items-center gap-1.5 text-[12px]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading tags…
        </div>
      ) : tags.length === 0 ? (
        <p className="text-muted-foreground text-[12px]">
          Tag catalog unavailable. Try again later.
        </p>
      ) : (
        <DropdownMenu
          modal={false}
          onOpenChange={(open) => {
            if (!open) setQuery("");
          }}
        >
          <DropdownMenuTrigger
            className={cn(
              INPUT,
              "flex h-10 items-center justify-between gap-2 text-[13px]",
              "data-[state=open]:border-foreground/40",
            )}
            aria-label="Add tags"
          >
            <span className="flex items-center gap-2">
              <Tag className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-muted-foreground">
                {value.length > 0 ? "Add or edit tags" : "Select tags"}
              </span>
            </span>
            <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-80 w-[var(--radix-dropdown-menu-trigger-width)] min-w-72 overflow-hidden p-0"
          >
            <div className="border-border bg-popover sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-2">
              <Search className="text-muted-foreground h-3.5 w-3.5" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tags"
                className="placeholder:text-muted-foreground flex-1 bg-transparent text-[12px] outline-none"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {visibleGroups.length === 0 ? (
                <p className="text-muted-foreground px-3 py-4 text-center text-[12px]">
                  No matching tags.
                </p>
              ) : (
                visibleGroups.map((group) => (
                  <div key={group.facet.slug} className="py-0.5">
                    <p className="text-muted-foreground/80 px-3 pt-1.5 pb-1 text-[10px] font-semibold tracking-[0.08em] uppercase">
                      {group.facet.emoji} {group.facet.label_en}
                    </p>
                    {group.rows.map((tag) => {
                      const isOn = selected.has(tag.slug);
                      return (
                        <button
                          key={tag.slug}
                          type="button"
                          // Plain buttons (not DropdownMenuItem) so a click
                          // toggles selection without closing the popover —
                          // the owner can pick several tags in one pass.
                          onClick={() => toggle(tag.slug)}
                          className={cn(
                            "hover:bg-muted/60 flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition",
                            isOn && "bg-muted/40",
                          )}
                        >
                          <span
                            className={cn(
                              "border-border flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition",
                              isOn
                                ? "bg-primary border-primary text-primary-foreground"
                                : "bg-card",
                            )}
                          >
                            {isOn ? <Check className="h-3 w-3" /> : null}
                          </span>
                          <span className="flex-1 truncate">
                            {tag.label_en}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <p className="text-muted-foreground text-[10px] tabular-nums">
        {value.length} selected
      </p>
    </div>
  );
}
