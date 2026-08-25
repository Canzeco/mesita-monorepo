import Link from "next/link";
import { useId, useState } from "react";
import { ChevronDown, Flag, MapPin } from "lucide-react";
import { formatAbsoluteUtc, timeAgo } from "@/lib/format";
import type { NotificationItem } from "./actions";
import { MetaRow } from "./NotificationMeta";
import { enricherPhase } from "./notification-enricher-phase";
import { TONES, TYPE_CONFIG, UNKNOWN_TYPE_CONFIG } from "./notification-config";
import {
  REPORT_TYPE,
  STEP_TYPE,
  groupHasFailure,
  intakeFactChips,
  reportReasonLabel,
  showCategoryOnCompact,
} from "./notification-feed";

export function NotificationRow({
  item,
  now,
  pinned = false,
}: {
  item: NotificationItem;
  now: number | null;
  pinned?: boolean;
}) {
  return (
    <ExpandableRow
      item={item}
      now={now}
      verb={verbFor(item)}
      failed={item.meta?.status === "failed"}
      pinned={pinned}
    />
  );
}

export function NotificationStepGroup({
  items,
  now,
}: {
  items: NotificationItem[];
  now: number | null;
}) {
  const lead = items[0];
  const failed = groupHasFailure(items);
  return (
    <ExpandableRow
      item={lead}
      now={now}
      verb={`Intaker · ${items.length} steps`}
      failed={failed}
      group={items}
    />
  );
}

function verbFor(item: NotificationItem): string {
  if (item.type === REPORT_TYPE) {
    return reportReasonLabel(item.meta ?? {}) ?? "Ticket reported";
  }
  if (item.type === STEP_TYPE) {
    const phase = enricherPhase(item.meta ?? {});
    const stepName =
      typeof item.meta?.stepName === "string" ? item.meta.stepName : null;
    if (phase && stepName) return `${phase.label} · ${stepName}`;
    if (phase) return phase.label;
    return TYPE_CONFIG[STEP_TYPE].shortLabel;
  }
  return (TYPE_CONFIG[item.type] ?? UNKNOWN_TYPE_CONFIG).shortLabel;
}

function ExpandableRow({
  item,
  now,
  verb,
  failed,
  pinned = false,
  group,
}: {
  item: NotificationItem;
  now: number | null;
  verb: string;
  failed: boolean;
  pinned?: boolean;
  group?: NotificationItem[];
}) {
  const [open, setOpen] = useState(pinned && item.type === REPORT_TYPE);
  const panelId = useId();
  const cfg = TYPE_CONFIG[item.type] ?? UNKNOWN_TYPE_CONFIG;
  const Icon = pinned ? Flag : cfg.Icon;
  const phase =
    item.type === STEP_TYPE && !group ? enricherPhase(item.meta ?? {}) : null;
  const tone = failed
    ? {
        tile: "bg-destructive/10 text-destructive",
        kicker: "text-destructive",
      }
    : (phase?.tone ?? cfg.tone);
  const when =
    now === null
      ? formatAbsoluteUtc(item.occurredAt)
      : timeAgo(item.occurredAt, now);
  const place = item.place;
  const href = place?.id ? `/manage-single/${place.id}/place` : null;

  return (
    <li className={pinned ? "bg-destructive/5" : undefined}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-muted/30 flex w-full items-start gap-3 px-4 py-3 text-left transition sm:gap-4 sm:px-5"
      >
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.tile}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-semibold">
              {place?.name ?? "(place removed)"}
            </span>
            <time
              className="text-muted-foreground type-label shrink-0 tabular-nums"
              title={formatAbsoluteUtc(item.occurredAt)}
              suppressHydrationWarning
            >
              {when}
            </time>
          </span>
          <span className={`mt-0.5 block truncate text-xs ${failed ? tone.kicker : "text-muted-foreground"}`}>
            {verb}
            {place?.categoryLabel && !group && showCategoryOnCompact(item) ? (
              <span className="font-normal">
                {" "}
                · {place.categoryLabel}
              </span>
            ) : null}
          </span>
          {!group && item.type.startsWith("atlas.") ? (
            <CompactStatusChips item={item} />
          ) : null}
        </span>
        <ChevronDown
          className={
            "text-muted-foreground mt-1 h-4 w-4 shrink-0 transition " +
            (open ? "rotate-180" : "")
          }
        />
      </button>
      {open && (
        <div id={panelId} className="border-border/60 border-t px-4 pt-3 pb-4 sm:px-5">
          <div className="ml-11 space-y-2 sm:ml-12">
            {group ? (
              <ol className="space-y-3">
                {group.map((step) => (
                  <li key={step.id}>
                    <p className="text-foreground text-xs font-medium">
                      {verbFor(step)}
                      {step.meta?.status === "failed" ? (
                        <span className="text-destructive ml-2">failed</span>
                      ) : null}
                    </p>
                    {step.detail && (
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        {step.detail}
                      </p>
                    )}
                    <MetaRow item={step} />
                  </li>
                ))}
              </ol>
            ) : (
              <ExpandedBody item={item} href={href} />
            )}
            {group && href && (
              <Link
                href={href}
                className="text-secondary inline-flex text-xs font-medium hover:underline"
              >
                Open place
              </Link>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function ExpandedBody({
  item,
  href,
}: {
  item: NotificationItem;
  href: string | null;
}) {
  const place = item.place;
  return (
    <>
      {place?.address && (
        <p className="text-muted-foreground flex items-start gap-1 text-xs">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
          <span className="min-w-0">{place.address}</span>
        </p>
      )}
      <ActorLine item={item} />
      {item.detail && (
        <p className="text-muted-foreground text-xs leading-relaxed">{item.detail}</p>
      )}
      <MetaRow item={item} />
      {href && (
        <Link
          href={href}
          className="text-secondary inline-flex text-xs font-medium hover:underline"
        >
          Open place
        </Link>
      )}
    </>
  );
}

function CompactStatusChips({ item }: { item: NotificationItem }) {
  const general = intakeFactChips(item);
  if (general.length === 0) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {general.map((chip) => (
        <span
          key={chip.key}
          className={
            "inline-flex rounded px-1.5 py-0.5 type-meta font-medium " +
            (chip.on ? TONES.indigo.chip : TONES.muted.chip)
          }
        >
          {chip.label}
        </span>
      ))}
    </span>
  );
}

function ActorLine({ item }: { item: NotificationItem }) {
  // No owner on create is the catalog default (Created / Listed), not a
  // missing "claim". Unclaimed is listing_type — it is not a status fact.
  if (!item.actor) return null;
  if (item.actor === "Intaker") return null;

  const prefix =
    item.type === "atlas.place_created"
      ? "Owner"
      : item.type === "atlas.ownership_claimed"
        ? "Verified by"
        : "By";

  return (
    <p className="text-muted-foreground text-xs">
      {prefix} <span className="text-foreground font-medium">{item.actor}</span>
    </p>
  );
}
