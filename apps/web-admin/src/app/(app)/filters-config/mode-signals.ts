// Which signals a mode shows, and how each one is allowed to look.
// The scores themselves come from admin-web-preview-signals.

import {
  catalogRelativeExponents,
  catalogShareLabel,
  type CatalogLiveRankKey,
} from "./catalog-shares";
import type { DiscoveryConfig, SignalKey } from "./catalog";
import type { DiscoveryModeKey } from "./discovery-matrix";

export const SIGNAL_ORDER = [
  "name",
  "category",
  "proximity",
  "timing",
  "enriched",
  "popularity",
  "randomness",
] as const satisfies readonly SignalKey[];

export type SignalVisual =
  | "relevance"
  | "filter"
  | "score"
  | "gate"
  | "explore";

export type ModeSignalView = {
  key: SignalKey;
  label: string;
  typeLabel: string;
  explanation: string;
  visual: SignalVisual;
  active: boolean;
  /** Hidden on a deterministic mode. Not listed as inactive. */
  hidden: boolean;
  weightLabel: string | null;
  contribution: string | null;
};

const COPY: Record<
  SignalKey,
  { label: string; typeLabel: string; explanation: string; visual: SignalVisual }
> = {
  name: {
    label: "Name",
    typeLabel: "Relevance",
    explanation: "How close a typed name is to each place name.",
    visual: "relevance",
  },
  category: {
    label: "Family",
    typeLabel: "Filter",
    explanation:
      "A family holds categories. Catalog keeps a place only when that place belongs to the family.",
    visual: "filter",
  },
  proximity: {
    label: "Proximity",
    typeLabel: "Continuous score",
    explanation: "Closer places score higher. The score reaches zero at Max km.",
    visual: "score",
  },
  timing: {
    label: "Timing",
    typeLabel: "Filter",
    explanation:
      "Open places stay. A closed place is pushed down to the closed floor. It is not a weight curve.",
    visual: "filter",
  },
  enriched: {
    label: "Enrichment",
    typeLabel: "Binary gate",
    explanation: "A place is admitted when Enrich has finished and the profile can be shown. Otherwise it is held out.",
    visual: "gate",
  },
  popularity: {
    label: "Popularity",
    typeLabel: "Continuous score",
    explanation: "A well-reviewed place scores higher than a barely reviewed one.",
    visual: "score",
  },
  randomness: {
    label: "Randomness",
    typeLabel: "Exploration",
    explanation: "A fresh draw. It reads nothing about the place, so the order is not frozen.",
    visual: "explore",
  },
};

/** Modes that must not show Randomness. Map pins it to zero. The others never configure it. */
const DETERMINISTIC = new Set<DiscoveryModeKey>(["word", "map", "chat", "favorites"]);

function active(mode: DiscoveryModeKey, key: SignalKey): boolean {
  if (mode === "chat" || mode === "favorites") return false;
  if (mode === "word") return key === "name";
  if (mode === "map") {
    return key === "category" || key === "proximity" || key === "timing" || key === "enriched" || key === "popularity";
  }
  // Catalog scores proximity, popularity, and randomness.
  // Family filters the list. Enrichment is the admission gate.
  // Timing is not in that profile. Swipe ranks the same three and also
  // reads timing as a filter on the deck.
  if (key === "name" || (key === "timing" && mode === "catalog")) return false;
  if (key === "timing") return mode === "swipe";
  return key === "category" || key === "proximity" || key === "enriched" || key === "popularity" || key === "randomness";
}

function weightLabel(
  mode: DiscoveryModeKey,
  key: SignalKey,
  config: DiscoveryConfig,
  show: boolean,
): string | null {
  if (!show) return null;
  if (mode === "catalog" && (key === "proximity" || key === "popularity" || key === "randomness")) {
    const ranking = config.catalog.ranking;
    const share = catalogRelativeExponents(ranking)[key as CatalogLiveRankKey];
    const weight = ranking[key as CatalogLiveRankKey];
    return `Weight ${weight} · Share ${catalogShareLabel(share)}`;
  }
  if ((mode === "map" || mode === "swipe") && (key === "proximity" || key === "popularity" || key === "randomness")) {
    return `Weight ${config.weightsByMode[mode][key]}`;
  }
  return null;
}

export function modeSignalViews(
  mode: DiscoveryModeKey,
  config: DiscoveryConfig,
): ModeSignalView[] {
  const drafted = SIGNAL_ORDER.map((key) => {
    const copy = COPY[key];
    const on = active(mode, key);
    return {
      key,
      ...copy,
      active: on,
      hidden: key === "randomness" && DETERMINISTIC.has(mode),
      weightLabel: null as string | null,
      contribution: null as string | null,
    };
  });
  const scoring = drafted.filter((row) =>
    row.active && (row.visual === "relevance" || row.visual === "score" || row.visual === "explore")
  );
  const combined = scoring.filter((row) => row.visual === "score" || row.visual === "explore").length > 1;
  return drafted.map((row) => ({
    ...row,
    weightLabel: weightLabel(mode, row.key, config, combined && row.active && (row.visual === "score" || row.visual === "explore")),
    contribution: scoring.length === 1 && row.active && scoring[0].key === row.key
      ? "Effective contribution: 100%"
      : null,
  }));
}
