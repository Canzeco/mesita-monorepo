import type { ComponentType } from "react";
import {
  BadgeCheck,
  Bookmark,
  Building2,
  CalendarCheck,
  Compass,
  CreditCard,
  Flag,
  Footprints,
  Inbox,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
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
  // Was violet until 2026-08-03. Validated against the categorical checks
  // (dataviz validator, light surface): violet-600 vs indigo-600 scored ΔE
  // 7.5 for NORMAL vision — below the 15 floor, i.e. Tickets and Reviews
  // were near-indistinguishable for everyone, not just CVD readers. Rose
  // re-steps that pair to 16.6 and the whole ramp passes. Every row and tile
  // also carries an icon + text label, which is what makes the one remaining
  // 6–8 band WARN (emerald↔amber) legal.
  rose: {
    tile: "bg-rose-500/10 text-rose-600",
    kicker: "text-rose-600",
    chip: "bg-rose-500/10 text-rose-700",
    dot: "bg-rose-500",
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
    label: "Place created",
    shortLabel: "Created",
    Icon: Building2,
    tone: TONES.indigo,
  },
  "atlas.place_enriched": {
    label: "Place enriched",
    shortLabel: "Enriched",
    Icon: Sparkles,
    tone: TONES.rose,
  },
  "atlas.ownership_claimed": {
    label: "Ownership verified",
    shortLabel: "Verified",
    Icon: BadgeCheck,
    tone: TONES.amber,
  },
  "atlas.enrichment_step": {
    label: "Enrichment step",
    shortLabel: "Steps",
    Icon: ListChecks,
    tone: TONES.muted,
  },
  "consumer.place_saved": {
    label: "Place saved",
    shortLabel: "Saves",
    Icon: Bookmark,
    tone: TONES.sky,
  },
  "rewards.ticket_created": {
    label: "Ticket created",
    shortLabel: "Tickets",
    Icon: Ticket,
    tone: TONES.indigo,
  },
  "rewards.ticket_visit": {
    label: "Visit — QR scanned",
    shortLabel: "Visits",
    Icon: Footprints,
    tone: TONES.amber,
  },
  // v3b (MESITA-890): the close is "marks as done", not a payment event.
  "rewards.ticket_closed": {
    label: "Visit closed",
    shortLabel: "Closed",
    Icon: BadgeCheck,
    tone: TONES.emerald,
  },
  "rewards.review_submitted": {
    label: "Review submitted",
    shortLabel: "Reviews",
    Icon: Star,
    tone: TONES.rose,
  },
  // The one event in this feed that asks the operator to DO something: a
  // guest says a place didn't honor their ticket (v3c, MESITA-851).
  "rewards.ticket_reported": {
    label: "Ticket reported by guest",
    shortLabel: "Reports",
    Icon: Flag,
    tone: TONES.indigo,
  },
  "reservations.reservation_created": {
    label: "Reservation requested",
    shortLabel: "Reservations",
    Icon: CalendarCheck,
    tone: TONES.emerald,
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
  "consumer.place_saved",
  "rewards.ticket_created",
  "rewards.ticket_visit",
  "rewards.ticket_closed",
  "rewards.review_submitted",
  "rewards.ticket_reported",
  "reservations.reservation_created",
];

type CategoryDef = {
  key: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  live: boolean;
};

export const CATEGORIES: CategoryDef[] = [
  { key: "atlas", label: "Intake", Icon: Compass, live: true },
  { key: "consumer", label: "Guests", Icon: Users, live: true },
  { key: "rewards", label: "Rewards", Icon: Ticket, live: true },
  { key: "reservations", label: "Reservations", Icon: CalendarCheck, live: true },
  { key: "billing", label: "Billing", Icon: CreditCard, live: false },
  { key: "verifications", label: "Verifications", Icon: ShieldCheck, live: false },
];
