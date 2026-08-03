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

type StatusTone = "positive" | "negative" | "neutral";

const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  positive: "bg-secondary/10 text-secondary",
  negative: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

function StatusTag({
  tone,
  icon: Icon,
  children,
}: {
  tone: StatusTone;
  icon: typeof CheckCircle2;
  children: ReactNode;
}) {
  return (
    <span
      className={`${STATUS_TONE_CLASSES[tone]} inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium`}
    >
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}

function StepStatusTag({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <StatusTag tone="positive" icon={CheckCircle2}>
        completed
      </StatusTag>
    );
  }
  if (status === "failed") {
    return (
      <StatusTag tone="negative" icon={XCircle}>
        failed
      </StatusTag>
    );
  }
  if (status === "started") {
    return (
      <StatusTag tone="neutral" icon={Clock}>
        started
      </StatusTag>
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
      <StatusTag tone="positive" icon={CheckCircle2}>
        approved
      </StatusTag>
    );
  }
  if (status === "rejected") {
    return (
      <StatusTag tone="negative" icon={XCircle}>
        rejected
      </StatusTag>
    );
  }
  return (
    <StatusTag tone="neutral" icon={Clock}>
      pending
    </StatusTag>
  );
}
