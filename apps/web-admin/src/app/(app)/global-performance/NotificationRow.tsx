import { MapPin } from "lucide-react";
import { formatAbsoluteUtc, timeAgo } from "@/lib/format";
import type { NotificationItem } from "./actions";
import { MetaRow, MetaTag } from "./NotificationMeta";
import { enricherPhase } from "./notification-enricher-phase";
import { TYPE_CONFIG, UNKNOWN_TYPE_CONFIG } from "./notification-config";

export function NotificationRow({
  item,
  now,
}: {
  item: NotificationItem;
  now: number | null;
}) {
  const cfg = TYPE_CONFIG[item.type] ?? UNKNOWN_TYPE_CONFIG;
  const Icon = cfg.Icon;
  const place = item.place;
  const phase =
    item.type === "atlas.enrichment_step" ? enricherPhase(item.meta ?? {}) : null;
  const tone = phase?.tone ?? cfg.tone;
  const kicker = phase ? `Intaker · ${phase.label}` : cfg.label;
  const when =
    now === null
      ? formatAbsoluteUtc(item.occurredAt)
      : timeAgo(item.occurredAt, now);

  return (
    <li className="hover:bg-muted/30 flex gap-3 px-4 py-3.5 transition sm:gap-4 sm:px-5 sm:py-4">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.tile}`}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p
            className={`type-label font-semibold tracking-[0.12em] uppercase ${tone.kicker}`}
            title={phase?.blurb}
          >
            {kicker}
          </p>
          <time
            className="text-muted-foreground shrink-0 type-label"
            title={formatAbsoluteUtc(item.occurredAt)}
            suppressHydrationWarning
          >
            {when}
          </time>
        </div>

        <p className="mt-1 truncate text-sm font-semibold">
          {place?.name ?? "(place removed)"}
          {place?.categoryLabel && (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              {place.categoryLabel}
            </span>
          )}
        </p>

        {place?.address && (
          <p className="text-muted-foreground mt-0.5 flex items-start gap-1 text-xs">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
            <span className="min-w-0">{place.address}</span>
          </p>
        )}

        <ActorLine item={item} />

        {item.detail && (
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            {item.detail}
          </p>
        )}

        <MetaRow item={item} />
      </div>
    </li>
  );
}

function ActorLine({ item }: { item: NotificationItem }) {
  if (item.type === "atlas.place_created" && !item.actor) {
    return (
      <div className="mt-2">
        <MetaTag>Unclaimed</MetaTag>
      </div>
    );
  }
  if (!item.actor) return null;

  const prefix =
    item.type === "atlas.place_created"
      ? "Owner"
      : item.type === "atlas.ownership_claimed"
        ? "Claimed by"
        : "By";

  return (
    <p className="text-muted-foreground mt-2 text-xs">
      {prefix}{" "}
      <span className="text-foreground font-medium">{item.actor}</span>
    </p>
  );
}
