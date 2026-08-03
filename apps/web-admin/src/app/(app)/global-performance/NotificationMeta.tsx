import type { ReactNode } from "react";
import { CheckCircle2, Clock, ExternalLink, XCircle } from "lucide-react";
import type { NotificationItem } from "./actions";
import { enricherPhase } from "./notification-enricher-phase";

const CLAIM_METHOD_LABEL: Record<string, string> = {
  ai_call: "Phone OTP",
  video: "Video walkthrough",
  postcard: "Postcard",
};

export function MetaRow({ item }: { item: NotificationItem }) {
  const tags: ReactNode[] = [];
  const m = item.meta ?? {};

  if (item.type === "atlas.place_created") {
    if (typeof m.listingType === "string") tags.push(<MetaTag key="lt">{m.listingType}</MetaTag>);
    if (typeof m.status === "string") tags.push(<MetaTag key="st">{m.status}</MetaTag>);
    if (m.enriched === true) tags.push(<MetaTag key="en">enriched</MetaTag>);
  }

  if (item.type === "atlas.place_enriched") {
    if (typeof m.detailsFields === "number" && m.detailsFields > 0) {
      tags.push(<MetaTag key="df">{m.detailsFields} detail fields</MetaTag>);
    }
    tags.push(
      <MetaTag key="hs">{m.hasSummary ? "summary written" : "no summary"}</MetaTag>,
    );
  }

  if (item.type === "atlas.ownership_claimed") {
    if (typeof m.method === "string") {
      tags.push(
        <MetaTag key="me">{CLAIM_METHOD_LABEL[m.method] ?? m.method}</MetaTag>,
      );
    }
    if (typeof m.status === "string") {
      tags.push(<ClaimStatusTag key="cs" status={m.status} />);
    }
  }

  if (item.type === "atlas.enrichment_step") {
    const step = typeof m.step === "string" ? m.step : null;
    const stepName = typeof m.stepName === "string" ? m.stepName : null;
    const phase = enricherPhase(m);
    if (phase) {
      tags.push(
        <MetaTag key="phase" className={phase.tone.chip} title={phase.blurb}>
          {phase.label}
        </MetaTag>,
      );
    }
    if (step || stepName) {
      tags.push(
        <MetaTag key="step" title={phase?.blurb}>
          <span className="font-mono">{step ?? "S?"}</span>
          {stepName ? <span>&nbsp;·&nbsp;{stepName}</span> : null}
        </MetaTag>,
      );
    }
    if (typeof m.status === "string") {
      tags.push(<StepStatusTag key="ss" status={m.status} />);
    }
  }

  // Consumer-activity tags (per-place Performance feed — MESITA-834).
  if (item.type === "rewards.ticket_created" || item.type === "rewards.ticket_visit") {
    if (typeof m.status === "string") tags.push(<MetaTag key="ts">{m.status}</MetaTag>);
  }

  if (item.type === "rewards.ticket_paid") {
    if (typeof m.subtotalCents === "number" && m.subtotalCents > 0) {
      tags.push(
        <MetaTag key="sub">
          bill ${(m.subtotalCents / 100).toLocaleString()}
          {typeof m.currency === "string" ? ` ${m.currency}` : ""}
        </MetaTag>,
      );
    }
    if (typeof m.discountPercent === "number" && m.discountPercent > 0) {
      tags.push(<MetaTag key="dp">−{m.discountPercent}%</MetaTag>);
    }
  }

  if (item.type === "rewards.review_submitted") {
    if (typeof m.overall === "number") {
      tags.push(<MetaTag key="ov">★ {m.overall} overall</MetaTag>);
    }
    for (const [key, label] of [
      ["food", "food"],
      ["service", "service"],
      ["ambiance", "ambiance"],
    ] as const) {
      const v = m[key];
      if (typeof v === "number") {
        tags.push(<MetaTag key={key}>{label} {v}</MetaTag>);
      }
    }
  }

  if (item.type === "reservations.reservation_created") {
    if (typeof m.status === "string") tags.push(<MetaTag key="rs">{m.status}</MetaTag>);
    if (typeof m.partySize === "number") {
      tags.push(<MetaTag key="ps">party of {m.partySize}</MetaTag>);
    }
    if (m.isTest === true) tags.push(<MetaTag key="tt">test</MetaTag>);
  }

  if (item.place?.googlePlaceId) {
    tags.push(
      <a
        key="gmap"
        href={`https://www.google.com/maps/place/?q=place_id:${item.place.googlePlaceId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px] font-medium transition"
      >
        <ExternalLink className="h-3 w-3" />
        Maps
      </a>,
    );
  }

  if (tags.length === 0) return null;
  return <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">{tags}</div>;
}

export function MetaTag({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${
        className ?? "bg-muted text-muted-foreground"
      }`}
      title={title}
    >
      {children}
    </span>
  );
}

// Status chip for enrichment step events: completed = green-ish (secondary
// accent, same as approved claims), failed = destructive, started/skipped =
// muted secondary chips.
function StepStatusTag({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="bg-secondary/10 text-secondary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium">
        <CheckCircle2 className="h-3 w-3" />
        completed
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium">
        <XCircle className="h-3 w-3" />
        failed
      </span>
    );
  }
  if (status === "started") {
    return (
      <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium">
        <Clock className="h-3 w-3" />
        started
      </span>
    );
  }
  return (
    <span className="bg-muted text-muted-foreground/70 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium">
      {status}
    </span>
  );
}

function ClaimStatusTag({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="bg-secondary/10 text-secondary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium">
        <CheckCircle2 className="h-3 w-3" />
        approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium">
        <XCircle className="h-3 w-3" />
        rejected
      </span>
    );
  }
  return (
    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium">
      <Clock className="h-3 w-3" />
      pending
    </span>
  );
}
