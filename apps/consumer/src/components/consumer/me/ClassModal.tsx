"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Check, Crown, Instagram, Smile } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SectionEyebrow } from "@/components/consumer/me/settings-rows";
import { CLASSES, classBadgeClass } from "@/lib/consumer-data";
import {
  useConsumerClass,
  useMockClass,
  setMockClass,
  type MockClass,
} from "@/lib/class-context";
import { cn } from "@/lib/utils";

// The full class surface, lifted out of the old Class tab into a bottom sheet
// the Me page opens from the Class box. Three labeled sections top to bottom:
// current class, a Free-vs-Premium comparison, and the ways to reach Premium.
// `onConnectInstagram` bubbles up so the parent can close this sheet before
// opening the verify sheet (two LocalSheets must never stack at the same
// z-layer).

export function ClassModal({
  open,
  onClose,
  onConnectInstagram,
}: {
  open: boolean;
  onClose: () => void;
  onConnectInstagram: () => void;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Your class">
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="bg-pink-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white">
            <Crown className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Your class
            </h2>
            <p className="text-muted-foreground text-[12px]">
              Free or Premium — and how to climb
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <ClassPreviewToggle />
          <section className="flex flex-col gap-2">
            <SectionEyebrow>Current class</SectionEyebrow>
            <CurrentClassCard />
          </section>
          <section className="flex flex-col gap-2">
            <SectionEyebrow>Comparison</SectionEyebrow>
            <FreeVsPremium />
          </section>
          <section className="flex flex-col gap-2">
            <SectionEyebrow>Classes</SectionEyebrow>
            <WaysToClimb onConnectInstagram={onConnectInstagram} />
          </section>
        </div>
      </div>
    </LocalSheet>
  );
}

// ─── Demo: class preview toggle ───────────────────────────────────────────

// Dev/demo affordance — flip the signed-in consumer between the three class
// states (Free / Premium via subscription / Premium via Instagram) so every
// surface that reads useConsumerClass() can be previewed without real billing
// or a 1K-follower Instagram. Writes a client-only localStorage override that
// wins over the real server-seeded class. Remove with the MOCK_ paths once the
// three states can be produced with real data.
const CLASS_PREVIEW_OPTIONS: { value: MockClass; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "subscription", label: "Subscription" },
  { value: "instagram", label: "Instagram" },
];

function ClassPreviewToggle() {
  const override = useMockClass();
  const { key, origin } = useConsumerClass();
  const selected: MockClass =
    override ??
    (key === "free"
      ? "free"
      : origin === "instagram"
        ? "instagram"
        : "subscription");

  return (
    <div className="border-border/70 rounded-2xl border border-dashed p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] text-amber-600 uppercase">
          Demo
        </span>
        <span className="text-muted-foreground text-[11px] font-medium">
          Preview class state
        </span>
      </div>
      <div className="bg-muted/60 flex rounded-lg p-1">
        {CLASS_PREVIEW_OPTIONS.map((o) => {
          const active = selected === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setMockClass(o.value)}
              aria-pressed={active}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-center text-[12px] font-semibold whitespace-nowrap transition",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Free vs Premium ──────────────────────────────────────────────────────

const COMPARE_ROWS: { label: string; free: string; premium: string }[] = [
  { label: "Discounts", free: "Base", premium: "Boosted" },
  { label: "Recommendations", free: "Standard", premium: "Personalized" },
  { label: "Max monthly reservations", free: "2", premium: "Unlimited" },
];

function FreeVsPremium() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border px-2 py-1.5">
      <div className="grid grid-cols-[1.3fr_0.8fr_1fr] items-end gap-1 px-2 pt-2">
        <span />
        <CompareHead label="Free" />
        <CompareHead label="Premium" accent />
      </div>
      <div className="mt-1">
        {COMPARE_ROWS.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "grid grid-cols-[1.3fr_0.8fr_1fr] items-center gap-1 px-2 py-3.5",
              i > 0 && "border-border/50 border-t",
            )}
          >
            <span className="text-foreground/80 text-[12.5px] leading-tight font-medium">
              {row.label}
            </span>
            <span className="text-foreground/70 text-center text-[12.5px] font-semibold">
              {row.free}
            </span>
            <span className="bg-tier-premium/[0.07] text-premium rounded-lg py-1.5 text-center text-[12.5px] font-semibold">
              {row.premium}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareHead({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-t-lg px-1 py-1.5",
        accent && "bg-tier-premium/[0.07]",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {accent && <Crown className="text-premium h-3 w-3 fill-current" />}
        <span
          className={cn(
            "font-display text-[13px] font-bold tracking-tight",
            accent && "text-premium",
          )}
        >
          {label}
        </span>
      </span>
    </div>
  );
}

// ─── Ways to climb ────────────────────────────────────────────────────────

type ClimbCardData = {
  key: string;
  icon: LucideIcon;
  iconBg: string;
  title: string;
  via?: string;
  accent?: boolean;
  price: string;
  priceNote?: string;
  desc: string;
  reached: boolean;
  reachedLabel: string;
  action?: { label: string; href?: string; onClick?: () => void };
  note?: string;
};

function WaysToClimb({
  onConnectInstagram,
}: {
  onConnectInstagram: () => void;
}) {
  const premium = CLASSES.find((c) => c.id === "premium")!;
  const { key, origin, followers } = useConsumerClass();
  const isFree = key === "free";

  const cards: ClimbCardData[] = [
    {
      key: "free",
      icon: Smile,
      iconBg: "bg-muted text-foreground",
      title: "Free",
      price: "$0",
      priceNote: "always free",
      desc: "Your default account at no cost. Get a base discount at Verified Partners, standard recommendations, and book up to 2 reservations every month.",
      reached: isFree,
      reachedLabel: "Current class",
      note: isFree ? undefined : "Included in every account",
    },
    {
      key: "instagram",
      icon: Instagram,
      iconBg:
        "bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))] text-white",
      title: "Premium",
      via: "Instagram",
      accent: true,
      price: `${premium.followerThreshold.toLocaleString("en-US")}+ followers`,
      priceNote: "no payment — earned with reach",
      desc: "Connect an Instagram with 1,000+ followers and post a story each time you visit. You get full Premium — boosted discounts, personalized recommendations, and unlimited reservations — without paying a peso.",
      reached: origin === "instagram",
      reachedLabel: "Connected",
      action: { label: "Connect", onClick: onConnectInstagram },
    },
    {
      key: "subscription",
      icon: Crown,
      iconBg: "bg-pink-gradient text-white",
      title: "Premium",
      via: "Subscription",
      accent: true,
      price: `$${premium.priceMxn} MXN`,
      priceNote: "per month · cancel anytime",
      desc: "Subscribe and unlock full Premium instantly — boosted discounts, personalized recommendations, and unlimited reservations. No follower count needed; cancel whenever you want.",
      reached: origin === "subscription",
      reachedLabel: "Active",
      action: { label: "Subscribe", href: "/subscribe/premium" },
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {cards.map((c) => (
        <Fragment key={c.key}>
          <ClimbCard data={c} />
          {c.key === "instagram" && origin === "instagram" && (
            <InstagramConnectedSummary followers={followers} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

function InstagramConnectedSummary({ followers }: { followers: number }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))] text-white shadow-sm">
        <Instagram className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[14px] leading-none font-bold tracking-tight">
            Profile connected
          </span>
          <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
        </div>
        <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
          {followers > 0
            ? `${followers.toLocaleString("en-US")} followers · Premium active`
            : "Premium active"}
        </p>
        <p className="text-muted-foreground/80 mt-0.5 text-[11px] leading-snug">
          Post a story each visit to keep Premium.
        </p>
      </div>
    </div>
  );
}

function ClimbCard({ data }: { data: ClimbCardData }) {
  const Icon = data.icon;

  let footer: ReactNode = null;
  if (data.reached) {
    footer = (
      <span className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 py-2.5 text-[12px] font-semibold text-emerald-700">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
        {data.reachedLabel}
      </span>
    );
  } else if (data.action) {
    const cls =
      "bg-pink-gradient shadow-sm flex items-center justify-center rounded-lg py-2.5 text-[13px] font-semibold text-white transition active:scale-[0.99]";
    footer = data.action.href ? (
      <Link href={data.action.href} className={cls}>
        {data.action.label}
      </Link>
    ) : (
      <button
        type="button"
        onClick={data.action.onClick}
        className={cn(cls, "w-full")}
      >
        {data.action.label}
      </button>
    );
  } else if (data.note) {
    footer = (
      <span className="border-border bg-muted/40 text-muted-foreground flex items-center justify-center rounded-lg border py-2.5 text-[12px] font-medium">
        {data.note}
      </span>
    );
  }

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5",
        data.accent
          ? "border-tier-premium/30 bg-tier-premium/[0.03]"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-3.5">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm",
            data.iconBg,
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {data.accent && (
              <Crown className="text-premium h-4 w-4 shrink-0 fill-current" />
            )}
            <span
              className={cn(
                "font-display text-[16px] leading-none font-bold tracking-tight",
                data.accent && "text-premium",
              )}
            >
              {data.title}
            </span>
            {data.via && (
              <span className="text-muted-foreground text-[13px] font-medium">
                via {data.via}
              </span>
            )}
          </div>
          <p className="font-display text-foreground mt-2 text-xl leading-tight font-bold tracking-tight">
            {data.price}
          </p>
          {data.priceNote && (
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
              {data.priceNote}
            </p>
          )}
        </div>
      </div>
      <p className="text-muted-foreground mt-4 text-[12.5px] leading-relaxed">
        {data.desc}
      </p>
      <div className="mt-4">{footer}</div>
    </article>
  );
}

function CurrentClassCard() {
  const { key, origin } = useConsumerClass();
  const meta = CLASSES.find((c) => c.id === key)!;
  const brand = `Mesita ${meta.label}`;
  const isPremium = key === "premium";
  const { Icon, via } = (() => {
    if (!isPremium) return { Icon: Smile, via: null as string | null };
    switch (origin) {
      case "instagram":
        return { Icon: Instagram, via: "via Instagram" };
      case "subscription":
        return { Icon: Crown, via: "via subscription" };
      case "invitation":
        return { Icon: Crown, via: "via invitation" };
      default:
        return { Icon: Crown, via: null as string | null };
    }
  })();
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-4 shadow-sm",
        classBadgeClass(key),
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl backdrop-blur",
          isPremium ? "bg-white/20" : "bg-foreground/[0.06]",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight [text-shadow:0_1px_6px_rgba(0,0,0,0.35)]">
          {brand}
        </h2>
        {via && (
          <p className="text-[11px] leading-snug opacity-100 [text-shadow:0_1px_4px_rgba(0,0,0,0.3)]">
            {via}
          </p>
        )}
      </div>
    </div>
  );
}
