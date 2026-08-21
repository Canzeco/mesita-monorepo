"use client";

// Filters Config · Search — the SEARCHBAR block (MESITA-1151).
//
// Everything else on this page configures a filter sheet: a set of predicates
// applied to a pool the surface was already handed. The searchbar is the one
// discovery control that goes and FETCHES a pool — ≥N characters triggers a
// debounced call to consumer-web-suggest-places, the rows come back split
// "On Mesita" / "From Google", and a Google row carries the Add flow that
// generates the place into the catalog on the spot.
//
// None of the six modules can express any of that, which is why this is a
// sibling block on the Search tab rather than a seventh module — the same shape
// Memo's own config takes on the Chat tab.
//
// Presentational on purpose: SurfaceConfigClient owns the whole blob and the
// single Save, so this never holds state. Two clients over one blob would mean
// whichever saved last silently discarded the other's edits.

import { Clock, Globe, Keyboard, ListFilter } from "lucide-react";
import { NumberField, SectionCard, Switch } from "@/components/admin-ui/config";
import {
  DEBOUNCE_CEILING_MS,
  QUERY_LENGTH_CEILING,
  SEARCH_RESULT_CAP_CEILING,
  type SearchbarFilters,
} from "./filters";
import { KnobRow, SegmentedPicker, WarningsNote } from "./ui";

/** One "No cap / Cap" picker plus the number it reveals. */
function CapKnob({
  label,
  blurb,
  value,
  disabled,
  onChange,
}: {
  label: string;
  blurb: string;
  value: number | null;
  disabled: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <>
      <KnobRow
        label={label}
        blurb={blurb}
        control={
          <SegmentedPicker<"none" | "cap">
            ariaLabel={label}
            value={value === null ? "none" : "cap"}
            disabled={disabled}
            options={[
              { value: "none", label: "No cap" },
              { value: "cap", label: "Cap" },
            ]}
            onChange={(v) => onChange(v === "none" ? null : 5)}
          />
        }
        trailing={
          value === null ? "Everything the EF returns" : `${value} rows`
        }
      />
      {value !== null && (
        <NumberField
          icon={<ListFilter className="h-4 w-4" />}
          label={`${label} — maximum rows`}
          value={value}
          min={1}
          max={SEARCH_RESULT_CAP_CEILING}
          disabled={disabled}
          onChange={onChange}
        />
      )}
    </>
  );
}

export function SearchbarCard({
  value,
  onChange,
  pending,
  status,
  warnings,
}: {
  value: SearchbarFilters;
  onChange: (patch: Partial<SearchbarFilters>) => void;
  pending: boolean;
  status: React.ReactNode;
  warnings: string[];
}) {
  return (
    <>
      <SectionCard
        icon={<Keyboard className="h-4 w-4" />}
        title="Suggest"
        subtitle="When a keystroke becomes a call. Both knobs trade responsiveness against Google autocomplete spend, and they trade it in opposite directions — a shorter threshold asks sooner, a longer debounce asks less often."
        status={status}
      >
        <div className="mt-5 flex flex-col gap-2.5">
          <NumberField
            icon={<Keyboard className="h-4 w-4" />}
            label="Minimum query length (characters)"
            value={value.minQueryLength}
            min={1}
            max={QUERY_LENGTH_CEILING}
            disabled={pending}
            onChange={(minQueryLength) => onChange({ minQueryLength })}
          />
          <NumberField
            icon={<Clock className="h-4 w-4" />}
            label="Debounce (ms)"
            value={value.debounceMs}
            min={0}
            max={DEBOUNCE_CEILING_MS}
            disabled={pending}
            onChange={(debounceMs) => onChange({ debounceMs })}
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={<Globe className="h-4 w-4" />}
        title="Results"
        subtitle='Rows come back in two groups. "On Mesita" selects a place on the map; "From Google" is a place the catalog has never seen.'
        status={status}
      >
        <div className="mt-5 flex flex-col gap-2.5">
          <KnobRow
            label="Show From Google"
            blurb="Off makes the searchbar catalog-only: a guest searching for a place Mesita has never heard of gets nothing back rather than an invitation."
            control={
              <div className="flex justify-end">
                <Switch
                  on={value.googleResults}
                  pending={pending}
                  label="Show From Google rows"
                  onClick={() =>
                    onChange({ googleResults: !value.googleResults })
                  }
                />
              </div>
            }
            trailing={value.googleResults ? "Two groups" : "On Mesita only"}
          />
          <KnobRow
            label="Add from Google"
            blurb="Whether tapping a Google row can generate the place into Mesita on the spot — consumer-web-create-place, then the async Enricher builds the profile. This is a real door into the catalog, not a preview toggle."
            control={
              <div className="flex justify-end">
                <Switch
                  on={value.addFromGoogle}
                  pending={pending}
                  label="Add from Google rows"
                  onClick={() =>
                    onChange({ addFromGoogle: !value.addFromGoogle })
                  }
                />
              </div>
            }
            trailing={value.addFromGoogle ? "Add flow live" : "Preview only"}
          />
          <CapKnob
            label="On Mesita rows"
            blurb="How many catalog matches the panel lists before it stops."
            value={value.mesitaResultCap}
            disabled={pending}
            onChange={(mesitaResultCap) => onChange({ mesitaResultCap })}
          />
          <CapKnob
            label="From Google rows"
            blurb="How many not-on-Mesita suggestions the panel lists. Each one is an Add candidate, so this is a growth knob as much as a layout one."
            value={value.googleResultCap}
            disabled={pending}
            onChange={(googleResultCap) => onChange({ googleResultCap })}
          />
        </div>
        <WarningsNote warnings={warnings} />
      </SectionCard>
    </>
  );
}
