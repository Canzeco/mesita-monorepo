"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Instagram,
  Linkedin,
  ChevronRight,
  Check,
  User as UserIcon,
  CreditCard,
  Bell,
  Shield,
  HelpCircle,
  Mail,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  VerifySocialSheet,
  type SocialPlatform,
} from "@/components/consumer/VerifySocialSheet";
import { ClassUpsellBox } from "@/app/(shell)/coupons/ClassUpsellBox";
import { CouponsList } from "@/app/(shell)/coupons/CouponsList";
import { ShareBody } from "@/app/(shell)/share/page";
import {
  CURRENT_USER,
  TIERS,
  TIER_ORDER,
  tierBadgeClass,
} from "@/lib/consumer-data";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

// Four-tab Profile. Coupons and Share folded in as sub-tabs on the
// "byebye coupons-as-entity" checkpoint: the standalone /coupons and
// /share routes are still alive (deep links, modal interception, etc.),
// but the BottomNav entry points for both are gone — the primary entry
// is here now.
type Tab = "class" | "settings" | "coupons" | "share";

const TABS: { id: Tab; label: string }[] = [
  { id: "class", label: "Class" },
  { id: "coupons", label: "Coupons" },
  { id: "share", label: "Share" },
  { id: "settings", label: "Settings" },
];

// Profile shell. The previous large avatar + name + "country · age ·
// sex" hero block was removed — the TopBar already renders the user's
// display name in the center column and the class chip on the right,
// so the inline block was duplicate chrome that ate vertical space.
// Identity-driven copy ships back here when there's something
// genuinely useful to surface (e.g. a per-user CTA), not before.
//
// The consumer (shell) layout enforces onboarding completion before
// this page renders, so all identity fields are already guaranteed
// real upstream.

export function ProfileClient() {
  const [tab, setTab] = useState<Tab>("class");
  const [verifyPlatform, setVerifyPlatform] = useState<SocialPlatform | null>(
    null,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4">
        <div className="border-border bg-card flex rounded-full border p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 rounded-full px-2 py-1.5 text-[12px] font-medium whitespace-nowrap transition",
                tab === t.id
                  ? "bg-pink-gradient text-white shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto">
        {tab === "class" && (
          <div className="px-5 pt-5 pb-8">
            <ClassTab onConnectSocial={(p) => setVerifyPlatform(p)} />
          </div>
        )}
        {tab === "settings" && (
          <div className="px-5 pt-5 pb-8">
            <SettingsTab />
          </div>
        )}
        {tab === "coupons" && (
          <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
            <ClassUpsellBox />
            <CouponsList />
          </div>
        )}
        {tab === "share" && <ShareBody />}
      </div>

      {verifyPlatform && (
        <VerifySocialSheet
          platform={verifyPlatform}
          onClose={() => setVerifyPlatform(null)}
        />
      )}
    </div>
  );
}

function ClassTab({
  onConnectSocial,
}: {
  onConnectSocial: (platform: SocialPlatform) => void;
}) {
  // Two-card stack. Status (current tier + next-tier progress) and
  // action (how to climb) — everything else (perks pitch, four-tier
  // ladder) was reference content that bloated the tab without
  // changing what a user can do on it. The /coupons promo carries
  // the "why climb" pitch when it's needed.
  return (
    <div className="flex flex-col gap-4">
      <CurrentClassCard />
      <FourWaysToClimb onConnectSocial={onConnectSocial} />
    </div>
  );
}

// Table layout for the four upgrade paths. One row per method, with
// Silver / Gold / Diamond columns showing the threshold/price/audience
// for that path. CTA pill at the end of each row. Earlier shape was a
// 2×2 grid of cards — each card carried its own three-row ladder, which
// made the same Silver/Gold/Diamond labels repeat four times. Folding
// the ladder into shared column headers eats less vertical space and
// makes the cross-method comparison ("$50 a month or 5K followers?")
// readable at a glance.
function FourWaysToClimb({
  onConnectSocial,
}: {
  onConnectSocial: (platform: SocialPlatform) => void;
}) {
  const currentIdx = TIER_ORDER.indexOf(CURRENT_USER.tier);
  const nextTier =
    currentIdx < TIER_ORDER.length - 1 ? TIER_ORDER[currentIdx + 1] : null;
  const igConnected = CURRENT_USER.tierOrigin === "instagram";
  const isSubscribed = CURRENT_USER.tierOrigin === "subscription";

  const followerValues = TIERS.filter((t) => t.id !== "bronze").map((t) =>
    formatFollowers(t.followerThreshold),
  );

  const rows: ClimbRow[] = [
    {
      key: "instagram",
      icon: Instagram,
      iconBg:
        "bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))]",
      label: "Instagram",
      values: followerValues,
      state: igConnected ? "connected" : "default",
      cta: igConnected ? "Connected" : "Connect",
      onClick: () => onConnectSocial("instagram"),
    },
    {
      key: "linkedin",
      icon: Linkedin,
      iconBg: "bg-[#0A66C2]",
      label: "LinkedIn",
      values: followerValues,
      state: "default",
      cta: "Connect",
      onClick: () => onConnectSocial("linkedin"),
    },
    {
      key: "subscription",
      icon: CreditCard,
      iconBg: "bg-pink-gradient",
      label: "Subscribe",
      values: TIERS.filter((t) => t.id !== "bronze").map(
        (t) => `$${t.priceUsd}`,
      ),
      valueSuffix: "/mo",
      state: isSubscribed ? "active" : "default",
      cta: isSubscribed ? "Active" : "Subscribe",
      href: nextTier ? `/subscribe/${nextTier}` : undefined,
    },
    {
      key: "invitation",
      icon: Mail,
      iconBg: "bg-amber-500",
      label: "Invitation",
      values: ["Locals", "Creators", "VIPs"],
      state: "default",
      cta: "Request",
      onClick: () =>
        toast.action(
          "Appeal form lands soon — meanwhile email class@mesita.ai with your case",
          {
            label: "Copy email",
            onClick: () => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard
                  .writeText("class@mesita.ai")
                  .then(() => toast.success("class@mesita.ai copied"))
                  .catch(() => toast.error("Couldn't copy"));
              }
            },
          },
        ),
    },
  ];

  return (
    <section className="border-border bg-card overflow-hidden rounded-2xl border">
      <p className="text-foreground/70 px-4 pt-3.5 text-[10px] font-medium tracking-[0.14em] uppercase">
        Four ways to climb
      </p>

      {/* Tier column header — three labels aligned with the value cells
          in each row below. Uses the tier badge color as a tiny dot so
          the header reads as the rung map. The CTA moved out of the
          row (and out of this header) — it lives below each item now,
          full-width, so the data columns get room to breathe. */}
      <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-2 px-3 pt-2 pb-1.5">
        <span aria-hidden className="h-7 w-7" />
        {(["silver", "gold", "diamond"] as const).map((tier) => (
          <span
            key={tier}
            className="text-muted-foreground inline-flex items-center justify-center gap-1 text-[9px] font-bold tracking-[0.14em] uppercase"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                tierBadgeClass(tier),
              )}
              aria-hidden
            />
            {tier === "silver"
              ? "Silver"
              : tier === "gold"
                ? "Gold"
                : "Diamond"}
          </span>
        ))}
      </div>

      <div className="divide-border/60 border-border/60 divide-y border-t">
        {rows.map((row) => (
          <ClimbTableRow key={row.key} row={row} />
        ))}
      </div>
    </section>
  );
}

type ClimbRow = {
  key: string;
  icon: LucideIcon;
  iconBg: string;
  label: string;
  values: string[];
  /** Optional suffix appended to each value (e.g. "/mo"). */
  valueSuffix?: string;
  state: "default" | "connected" | "active";
  cta: string;
  href?: string;
  onClick?: () => void;
};

function ClimbTableRow({ row }: { row: ClimbRow }) {
  const isReached = row.state === "connected" || row.state === "active";
  const ctaClass = isReached
    ? "bg-emerald-500/15 text-emerald-700"
    : "bg-pink-gradient text-white shadow-sm";
  const ctaContent = isReached ? (
    <span className="inline-flex items-center justify-center gap-1.5">
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
      {row.cta}
    </span>
  ) : (
    row.cta
  );
  const Icon = row.icon;
  // Each item is a two-row block:
  //   1. Data row — icon + label + 3 tier values, aligned with the
  //      column header above.
  //   2. CTA row — full-width pill so the tap target is generous and
  //      the data columns aren't squeezed by a 5th column.
  const body = (
    <div className="hover:bg-muted/30 flex flex-col gap-2.5 px-3 py-3 transition">
      <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-2">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white",
              row.iconBg,
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="font-display text-[13px] font-semibold tracking-tight whitespace-nowrap">
            {row.label}
          </span>
        </span>
        {row.values.map((v, i) => (
          <span
            key={i}
            className="text-foreground text-center text-[11px] font-semibold tabular-nums"
          >
            {v}
            {row.valueSuffix && (
              <span className="text-muted-foreground ml-0.5 font-normal">
                {row.valueSuffix}
              </span>
            )}
          </span>
        ))}
      </div>
      <span
        className={cn(
          "block rounded-full py-2 text-center text-[12px] font-semibold",
          ctaClass,
        )}
      >
        {ctaContent}
      </span>
    </div>
  );
  if (row.href) {
    return (
      <Link href={row.href} className="block">
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={row.onClick}
      className="block w-full text-left"
    >
      {body}
    </button>
  );
}

function CurrentClassCard() {
  // Top of the Class tab. The class IS the brand — "Mesita Gold" reads as a
  // proper noun, not "a Gold member". Origin determines the subtitle: who
  // earned the tier and how (followers / subscription / appeal / default).
  //
  // Below the brand line we render a "next tier" affordance:
  //   - Instagram: a progress bar from current → next threshold with the
  //     concrete delta ("12.7K more followers to climb"). The bar gives a
  //     dummy an immediate visual answer to "how close am I?".
  //   - Subscription: a single line pointing at the next price tier.
  //   - Default/appeal: a single line suggesting a path.
  // Hidden entirely at Diamond — no more rungs to sell.
  const meta = TIERS.find((t) => t.id === CURRENT_USER.tier)!;
  const brand = `Mesita ${meta.label}`;
  const currentIdx = TIER_ORDER.indexOf(CURRENT_USER.tier);
  const nextTier =
    currentIdx < TIER_ORDER.length - 1
      ? TIERS.find((t) => t.id === TIER_ORDER[currentIdx + 1])!
      : null;
  const origin = (() => {
    switch (CURRENT_USER.tierOrigin) {
      case "instagram":
        return `Earned via ${formatFollowers(CURRENT_USER.followers)} Instagram followers`;
      case "subscription":
        return CURRENT_USER.tierRenewsAt
          ? `Subscribed · renews ${CURRENT_USER.tierRenewsAt}`
          : "Subscribed · renews monthly";
      case "appeal":
        return "Granted by Mesita on appeal";
      default:
        return "Default tier — anyone with a Mesita account starts here";
    }
  })();
  return (
    <section
      className={cn(
        "rounded-2xl p-5 shadow-sm",
        tierBadgeClass(CURRENT_USER.tier),
      )}
    >
      <p className="text-[10px] font-medium tracking-[0.16em] uppercase opacity-80">
        Your class
      </p>
      <h2 className="font-display mt-1 text-3xl font-semibold tracking-tight">
        {brand}
      </h2>
      <p className="mt-1.5 text-[12px] opacity-90">{origin}</p>
      {nextTier && <NextTierProgress current={meta} next={nextTier} />}
    </section>
  );
}

function NextTierProgress({
  current,
  next,
}: {
  current: (typeof TIERS)[number];
  next: (typeof TIERS)[number];
}) {
  const isInstagram = CURRENT_USER.tierOrigin === "instagram";
  const isSubscription = CURRENT_USER.tierOrigin === "subscription";

  if (isInstagram) {
    const followers = CURRENT_USER.followers;
    const span = next.followerThreshold - current.followerThreshold;
    const within = Math.max(0, followers - current.followerThreshold);
    const pct = span > 0 ? Math.min(100, (within / span) * 100) : 0;
    const remaining = Math.max(0, next.followerThreshold - followers);
    return (
      <div className="mt-4">
        <div className="flex items-center justify-between text-[10px] font-semibold tracking-wide opacity-85 uppercase">
          <span>Mesita {current.label}</span>
          <span>Mesita {next.label}</span>
        </div>
        <div className="bg-current/15 mt-1.5 h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-current/80 h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        </div>
        <p className="mt-2 text-[12px] opacity-90">
          <span className="font-semibold">
            {formatFollowers(remaining)} more
          </span>{" "}
          Instagram followers to climb.
        </p>
      </div>
    );
  }

  if (isSubscription) {
    return (
      <p className="mt-3 text-[12px] opacity-90">
        <span className="font-semibold">Upgrade to Mesita {next.label}</span> ·
        ${next.priceUsd} / mo
      </p>
    );
  }

  // Default tier (Bronze) or appeal that landed below Diamond.
  return (
    <p className="mt-3 text-[12px] opacity-90">
      <span className="font-semibold">Next: Mesita {next.label}</span> · connect
      Instagram or subscribe to climb.
    </p>
  );
}

function formatFollowers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toString();
}

// Settings row config — each row carries the route it should drive when
// the corresponding screen ships. Rows where we already have a real route
// link directly; the rest fire a toast pointing at the support email so
// users have somewhere to go right now.
type SettingsRow = {
  Icon: LucideIcon;
  label: string;
  sub: string;
} & ({ href: string } | { stubReason: string });

function SettingsTab() {
  const items: SettingsRow[] = [
    {
      Icon: UserIcon,
      label: "Personal details",
      sub: "Name, email, phone",
      stubReason:
        "Personal details editor lands next — for now re-onboard at /onboard or email support@mesita.ai",
    },
    {
      Icon: CreditCard,
      label: "Payment methods",
      sub: "Apple Pay · Visa · 4242",
      href: "/pay/wallet",
    },
    {
      Icon: Bell,
      label: "Notifications",
      sub: "Push, email",
      stubReason: "Notification preferences land with the push-token integration.",
    },
    {
      Icon: Shield,
      label: "Privacy & data",
      sub: "Permissions, export",
      stubReason: "Privacy controls + data export land before launch — email privacy@mesita.ai.",
    },
    {
      Icon: HelpCircle,
      label: "Help & support",
      sub: "FAQ · contact us",
      stubReason: "Help center lands soon — email support@mesita.ai meanwhile.",
    },
  ];
  return (
    <div className="flex flex-col">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
        Account
      </p>
      <div className="divide-border border-border bg-card mt-3 divide-y overflow-hidden rounded-2xl border">
        {items.map((row) => (
          <SettingsRowButton key={row.label} row={row} />
        ))}
      </div>

      <SignOutButton
        redirectTo="/"
        className="border-border bg-card hover:bg-muted mt-5 flex w-full items-center justify-center gap-2 rounded-full border py-4 text-sm font-semibold transition"
      />
      <p className="text-muted-foreground mt-3 text-center text-[11px]">
        Not signed in?{" "}
        <Link
          href="/"
          className="text-foreground font-semibold hover:underline"
        >
          Sign in
        </Link>
      </p>
      <p className="text-muted-foreground mt-4 text-center text-[11px]">
        Mesita · v2.4.1
      </p>
    </div>
  );
}

// One settings row — either a Link (real route) or a button (stub toast).
// Rendering is identical; the only branch is what happens on tap.
function SettingsRowButton({ row }: { row: SettingsRow }) {
  const inner = (
    <>
      <span className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
        <row.Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{row.label}</span>
        <span className="text-muted-foreground block text-[11px]">
          {row.sub}
        </span>
      </span>
      <ChevronRight className="text-muted-foreground h-4 w-4" />
    </>
  );
  const className =
    "hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition";
  if ("href" in row) {
    return (
      <Link href={row.href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => toast(row.stubReason)} className={className}>
      {inner}
    </button>
  );
}
