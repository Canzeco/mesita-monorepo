"use client";

// Shared Families — live. Seven params, the same seven the guest sees
// as pills, written onto all three Google callers (Fast / Deep / Map) as one
// list. Each family sends its whole Google battery; the operator never toggles
// a Google slug, and there is no ordered "first N" cap on top (MESITA-1695).

import { useMemo } from "react";
import { Plug, SlidersHorizontal } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  KnobState,
  SaveRow,
  SectionCard,
  Switch,
} from "@/components/admin-ui/config";
import { useConfigEditor, type ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { getDiscoveryConfig, updateDiscoveryConfig } from "./actions";
import {
  SUPER_FIELDS,
  type DiscoveryConfig,
  type SuperParamKey,
} from "./catalog";

export function FamiliesClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: ConfigSeed<DiscoveryConfig>) {
  const { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, updatedAt, saveWith } =
    useConfigEditor({ initialConfig, initialUpdatedAt, loadError, load: getDiscoveryConfig });

  const supers = cfg.map.supers;
  const dirty = useMemo(
    () =>
      JSON.stringify(cfg.map.supers) !== JSON.stringify(saved.map.supers),
    [cfg.map.supers, saved.map.supers],
  );

  const patchSuper = (key: SuperParamKey, on: boolean) => {
    setOk(false);
    setCfg((c) => {
      const next = { ...c.map.supers, [key]: on };
      return {
        ...c,
        name: {
          fast: { ...c.name.fast, supers: next },
          deep: { ...c.name.deep, supers: next },
        },
        map: { ...c.map, supers: next },
      };
    });
  };

  const save = () =>
    saveWith((c) => updateDiscoveryConfig(c, ["nameFast", "nameDeep", "mapSupers"]));

  return (
    <div id="s-google-types" className="scroll-mt-16 flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<SlidersHorizontal className="text-primary h-4 w-4" />}
        title="Families"
        subtitle="Which Families Autocomplete, Nearby and Text Search ask Google for. One list for all three, and it shapes what a call RETURNS, never how many calls happen — one request carries the whole battery. Governs the no-pill map, Word Fast and Deep, Swipe admission and Add eligibility; a guest who picks a family pill bypasses it."
        state={
          <KnobState
            kind="enforced"
            reason="list-places · suggest-places · Search"
          />
        }
      >
        <p className="text-muted-foreground mt-5 type-meta">
          The operator&rsquo;s noun is the family, not Google&rsquo;s slug. Each
          one sends the Google types listed under it — that mapping is code,
          pinned to the taxonomy, and not an operator knob.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SUPER_FIELDS.map((field) => (
            <div
              key={field.key}
              className="border-border bg-background flex items-start justify-between gap-4 rounded-xl border p-4"
            >
              <div className="flex min-w-0 items-start gap-2">
                <Plug className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    <span aria-hidden="true">{field.emoji}</span> {field.label}
                  </p>
                  <p className="text-muted-foreground type-meta break-words">
                    {field.battery.join(" · ")}
                  </p>
                </div>
              </div>
              <Switch
                on={supers[field.key]}
                pending={pending || loadBlocked}
                onClick={() => patchSuper(field.key, !supers[field.key])}
                label={field.label}
              />
            </div>
          ))}
        </div>
        {updatedAt ? (
          <p className="text-muted-foreground mt-4 type-meta">
            Last saved {formatShortDate(updatedAt)}
          </p>
        ) : null}
        <SaveRow
          pending={pending}
          dirty={dirty}
          ok={ok}
          onClick={save}
          loadError={loadBlocked ? error : null}
        />
      </SectionCard>
    </div>
  );
}
