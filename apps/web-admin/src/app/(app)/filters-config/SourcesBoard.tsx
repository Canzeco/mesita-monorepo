"use client";

import Link from "next/link";
import { Blocks } from "lucide-react";
import { KnobState, SectionCard } from "@/components/admin-ui/config";
import {
  FloorMirror,
  FiltersFloorOwner,
  GeneralFloorOwner,
  MapFloorOwner,
  NearbyPullOwner,
  type FloorSeed,
} from "./SourceFloor";
import { floorNumber, GENERAL_FLOOR_OWNER } from "./source-floor-copy";
import {
  DISCOVERY_MODES,
  DISCOVERY_SOURCES,
  modesCallingSource,
  type DiscoverySourceKey,
} from "./discovery-surface";
import { DISCOVERY_CATALOG_HREF, DISCOVERY_MODES_HREF } from "./nav";

const MODE_LABEL = new Map(DISCOVERY_MODES.map((mode) => [mode.key, mode.label]));

function modeNames(source: DiscoverySourceKey): string {
  const names = modesCallingSource(source).map((key) => MODE_LABEL.get(key) ?? key);
  return names.length > 0 ? names.join(", ") : "None";
}

export function SourcesBoard({ seed }: { seed: FloorSeed }) {
  const g = seed.initialConfig.general;
  const generalRows = [
    { label: "Only active places", value: g.requireActive ? "On" : "Off" },
    { label: "Minimum Google reviewers", value: floorNumber(g.minReviews) },
  ];

  return (
    <div className="flex flex-col gap-4">
      {DISCOVERY_SOURCES.map((source) => (
        <div key={source.key} id={`s-${source.key}`} className="scroll-mt-16">
          <SectionCard
            icon={<Blocks className="text-primary h-4 w-4" />}
            title={source.label}
            subtitle={source.contributes}
            state={
              <KnobState
                kind={source.availability === "live" ? "enforced" : "not-wired"}
                reason={
                  source.availability === "live"
                    ? `Used by ${modeNames(source.key)}`
                    : "No engine retrieves this"
                }
              />
            }
          >
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground type-meta font-semibold">Modes</dt>
                <dd className="mt-1 text-sm">{modeNames(source.key)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground type-meta font-semibold">Status</dt>
                <dd className="mt-1 text-sm">{source.availabilityLabel}</dd>
              </div>
            </dl>
            <SourceControls source={source.key} seed={seed} generalRows={generalRows} />
          </SectionCard>
        </div>
      ))}
    </div>
  );
}

function SourceControls({
  source,
  seed,
  generalRows,
}: {
  source: DiscoverySourceKey;
  seed: FloorSeed;
  generalRows: { label: string; value: string }[];
}) {
  if (source === "google_autocomplete") {
    return (
      <>
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          Result caps for this source are on{" "}
          <Link href={DISCOVERY_MODES_HREF} className="text-foreground font-medium underline">
            Modes
          </Link>
          , under Word. Family membership is on Atlas.
        </p>
        <GeneralFloorOwner seed={seed} />
      </>
    );
  }
  if (source === "google_text" || source === "mesita_name") {
    return (
      <FloorMirror
        rows={generalRows}
        ownedBy={GENERAL_FLOOR_OWNER}
        note={
          source === "mesita_name"
            ? "The same active-place and reviewer floor is applied to this name search."
            : undefined
        }
      />
    );
  }
  if (source === "google_nearby") {
    return (
      <>
        <FloorMirror
          label="Quality floor · the General wipe"
          rows={generalRows}
          ownedBy={GENERAL_FLOOR_OWNER}
        />
        <MapFloorOwner seed={seed} label="Quality floor · Nearby's own" />
        <NearbyPullOwner seed={seed} />
      </>
    );
  }
  if (source === "mesita_nearby") {
    return <FiltersFloorOwner seed={seed} />;
  }
  if (source === "mesita_catalog") {
    return (
      <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
        Catalog reads listed Mesita places. Ranking weights for the family
        lists are on{" "}
        <Link href={DISCOVERY_CATALOG_HREF} className="text-foreground font-medium underline">
          Modes
        </Link>
        , on Catalog. One profile covers every family.
      </p>
    );
  }
  return (
    <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
      Unavailable. No mode can call it, and there is nothing to configure.
    </p>
  );
}
