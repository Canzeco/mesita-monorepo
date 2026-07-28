import type { ComponentType } from "react";
import {
  BadgeCheck,
  Building2,
  Compass,
  CreditCard,
  Inbox,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { NotificationType } from "./actions";

// Per-type accent so the feed is scannable by color: icon tile, uppercase
// kicker, and tinted chips. Mirrors the tinted-chip language of the Atlas
// Config enricher catalog (bg-X-500/10 text-X-700).
export type Tone = {
  tile: string;
  kicker: string;
  chip: string;
  dot: string;
};

export const TONES = {
  indigo: {
    tile: "bg-indigo-500/10 text-indigo-600",
    kicker: "text-indigo-600",
    chip: "bg-indigo-500/10 text-indigo-700",
    dot: "bg-indigo-500",
  },
  violet: {
    tile: "bg-violet-500/10 text-violet-600",
    kicker: "text-violet-600",
    chip: "bg-violet-500/10 text-violet-700",
    dot: "bg-violet-500",
  },
  amber: {
    tile: "bg-amber-500/10 text-amber-600",
    kicker: "text-amber-600",
    chip: "bg-amber-500/10 text-amber-700",
    dot: "bg-amber-500",
  },
  emerald: {
    tile: "bg-emerald-500/10 text-emerald-600",
    kicker: "text-emerald-600",
    chip: "bg-emerald-500/10 text-emerald-700",
    dot: "bg-emerald-500",
  },
  sky: {
    tile: "bg-sky-500/10 text-sky-600",
    kicker: "text-sky-600",
    chip: "bg-sky-500/10 text-sky-700",
    dot: "bg-sky-500",
  },
  muted: {
    tile: "bg-muted text-muted-foreground",
    kicker: "text-muted-foreground",
    chip: "bg-muted text-muted-foreground",
    dot: "bg-foreground/25",
  },
} satisfies Record<string, Tone>;

type TypeConfig = {
  label: string;
  shortLabel: string;
  Icon: ComponentType<{ className?: string }>;
  tone: Tone;
};

export const TYPE_CONFIG: Record<NotificationType, TypeConfig> = {
  "atlas.place_created": {
    label: "New place created",
    shortLabel: "New place",
    Icon: Building2,
    tone: TONES.indigo,
  },
  "atlas.place_enriched": {
    label: "Place enriched",
    shortLabel: "Enriched",
    Icon: Sparkles,
    tone: TONES.violet,
  },
  "atlas.ownership_claimed": {
    label: "Ownership claimed",
    shortLabel: "Claimed",
    Icon: BadgeCheck,
    tone: TONES.amber,
  },
  "atlas.enrichment_step": {
    label: "Enrichment step",
    shortLabel: "Steps",
    Icon: ListChecks,
    tone: TONES.muted,
  },
};

// Runtime fallback — the EF may ship new types before this client knows them.
export const UNKNOWN_TYPE_CONFIG: TypeConfig = {
  label: "Notification",
  shortLabel: "Other",
  Icon: Inbox,
  tone: TONES.muted,
};

export const TYPE_ORDER: NotificationType[] = [
  "atlas.place_created",
  "atlas.place_enriched",
  "atlas.ownership_claimed",
  "atlas.enrichment_step",
];

type CategoryDef = {
  key: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  live: boolean;
};

export const CATEGORIES: CategoryDef[] = [
  { key: "atlas", label: "Atlas", Icon: Compass, live: true },
  { key: "billing", label: "Billing", Icon: CreditCard, live: false },
  { key: "verifications", label: "Verifications", Icon: ShieldCheck, live: false },
  { key: "consumers", label: "Consumers", Icon: Users, live: false },
];
