import type { NotificationItem, NotificationType } from "./actions";
import { TYPE_ORDER } from "./notification-config";

// View-model for Global Monitor. The EF already filters by category/types;
// this file is the operator-facing fold: domain labels, which types to
// fetch, pin reports, collapse consecutive Intaker steps.

export const STEP_TYPE = "atlas.enrichment_step" satisfies NotificationType;
export const REPORT_TYPE = "rewards.ticket_reported" satisfies NotificationType;

export type DomainKey =
  | "all"
  | "atlas"
  | "consumer"
  | "rewards"
  | "reservations";

export const DOMAINS: ReadonlyArray<{ key: DomainKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "atlas", label: "Intake" },
  { key: "consumer", label: "Guests" },
  { key: "rewards", label: "Promos" },
  { key: "reservations", label: "Reservations" },
];

export const TYPES_WITHOUT_STEPS: NotificationType[] = TYPE_ORDER.filter(
  (t) => t !== STEP_TYPE,
);

export function typesInDomain(
  domain: DomainKey,
  allowed: readonly NotificationType[] = TYPE_ORDER,
): NotificationType[] {
  return allowed.filter((t) => domain === "all" || t.startsWith(`${domain}.`));
}

/** Types to send to the EF. Empty array means "do not pass `types`" (all). */
export function typesForFetch(
  domain: DomainKey,
  includeSteps: boolean,
  allowed: readonly NotificationType[] = TYPE_ORDER,
): NotificationType[] | undefined {
  const inDomain = typesInDomain(domain, allowed);
  const next = includeSteps
    ? inDomain
    : inDomain.filter((t) => t !== STEP_TYPE);
  if (next.length === 0) return undefined;
  if (next.length === inDomain.length && domain !== "all") return undefined;
  if (includeSteps && domain === "all" && next.length === allowed.length) {
    return undefined;
  }
  return next;
}

export type FeedEntry =
  | { kind: "single"; item: NotificationItem }
  | { kind: "steps"; items: NotificationItem[] };

export function pinReports(items: NotificationItem[]): {
  reports: NotificationItem[];
  rest: NotificationItem[];
} {
  const reports: NotificationItem[] = [];
  const rest: NotificationItem[] = [];
  for (const item of items) {
    if (item.type === REPORT_TYPE) reports.push(item);
    else rest.push(item);
  }
  return { reports, rest };
}

export function groupConsecutiveSteps(items: NotificationItem[]): FeedEntry[] {
  const out: FeedEntry[] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    if (item.type !== STEP_TYPE) {
      out.push({ kind: "single", item });
      i += 1;
      continue;
    }
    const placeId = item.place?.id ?? null;
    const cluster: NotificationItem[] = [item];
    let j = i + 1;
    while (j < items.length) {
      const next = items[j];
      if (next.type !== STEP_TYPE) break;
      if ((next.place?.id ?? null) !== placeId) break;
      cluster.push(next);
      j += 1;
    }
    if (cluster.length === 1) out.push({ kind: "single", item });
    else out.push({ kind: "steps", items: cluster });
    i = j;
  }
  return out;
}

export function feedEntryKey(entry: FeedEntry): string {
  if (entry.kind === "single") return entry.item.id;
  return `steps:${entry.items[0]?.id ?? "empty"}`;
}

export function groupHasFailure(items: NotificationItem[]): boolean {
  return items.some((item) => item.meta?.status === "failed");
}

export function reportReasonLabel(meta: Record<string, unknown>): string | null {
  const REPORT_REASON: Record<string, string> = {
    discount_refused: "Discount refused",
    closed_without_honoring: "Closed without honoring",
    qr_not_scanned: "QR never scanned",
    other: "Other",
  };
  if (typeof meta.reason !== "string") return null;
  return REPORT_REASON[meta.reason] ?? meta.reason;
}
