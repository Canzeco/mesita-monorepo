"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Instagram,
  ChevronRight,
  Check,
  Crown,
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
import { ShareBody } from "@/app/(shell)/share/page";
import {
  CURRENT_USER,
  TIERS,
  tierBadgeClass,
} from "@/lib/consumer-data";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

// Three-tab Profile. Share is folded in as a sub-tab; the standalone
// /share route stays alive (deep links). The Coupons tab was removed —
// coupons are "hidden" (users save the place, redeem a QR at the venue),
// so the wallet surface didn't earn its spot in the Profile.
type Tab = "class" | "settings" | "share";

const TABS: { id: Tab; label: string }[] = [
  { id: "class", label: "Class" },
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
  // A slim current-class banner, then a horizontal-scroll pair of plan
  // cards (Free, then Premium) — each self-contained with its perks, and
  // Premium also carrying the three ways to unlock it.
  return (
    <div className="flex flex-col gap-4">
      <CurrentClassCard />
      <PlanCarousel onConnectSocial={onConnectSocial} />
    </div>
  );
}

// ─── Plan carousel ────────────────────────────────────────────────────────

// Two self-contained plan cards in a horizontal scroller: Free first, then
// Premium. Each lists its perks; Premium also carries the three doors to
// unlock it. The user's current plan is flagged.
function PlanCarousel({
  onConnectSocial,
}: {
  onConnectSocial: (platform: SocialPlatform) => void;
}) {
  const current = CURRENT_USER.tier;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-foreground/70 text-[10px] font-medium tracking-[0.14em] uppercase">
          Plans
        </p>
        <p className="text-muted-foreground text-[10px]">Swipe to compare →</p>
      </div>
      <div className="scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
        <FreePlanCard isCurrent={current === "free"} />
        <PremiumPlanCard
          isCurrent={current === "premium"}
          onConnectSocial={onConnectSocial}
        />
      </div>
    </div>
  );
}

function PlanCardHeader({
  label,
  price,
  priceSuffix,
  sub,
  accent,
  isCurrent,
}: {
  label: string;
  price: string;
  priceSuffix?: string;
  sub?: string;
  accent?: boolean;
  isCurrent: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-1.5">
          {accent && <Crown className="text-premium h-4 w-4 fill-current" />}
          <span
            className={cn(
              "font-display text-xl font-bold tracking-tight",
              accent && "text-premium",
            )}
          >
            {label}
          </span>
        </span>
        <p className="font-display text-foreground mt-1 text-lg leading-none font-bold tabular-nums">
          {price}
          {priceSuffix && (
            <span className="text-muted-foreground text-[12px] font-medium">
              {" "}
              {priceSuffix}
            </span>
          )}
        </p>
        {sub && <p className="text-muted-foreground mt-1 text-[11px]">{sub}</p>}
      </div>
      {isCurrent && (
        <span className="bg-foreground text-background shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
          Current
        </span>
      )}
    </div>
  );
}

function PerkList({ perks, accent }: { perks: string[]; accent?: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {perks.map((p) => (
        <li key={p} className="flex items-start gap-2 text-[13px]">
          <Check
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              accent ? "text-premium" : "text-emerald-600",
            )}
            strokeWidth={3}
          />
          <span className="text-foreground/85 leading-snug">{p}</span>
        </li>
      ))}
    </ul>
  );
}

function FreePlanCard({ isCurrent }: { isCurrent: boolean }) {
  const perks = [
    "Base cashback & discounts",
    "Standard recommendations",
    "2 reservations / month",
    "Hidden coupons, redeemed by QR at the venue",
  ];
  return (
    <article className="border-border bg-card flex w-[80%] shrink-0 snap-start flex-col gap-4 rounded-2xl border p-5">
      <PlanCardHeader
        label="Free"
        price="$0"
        sub="Every Mesita account starts here"
        isCurrent={isCurrent}
      />
      <PerkList perks={perks} />
      <p className="text-muted-foreground mt-auto text-[11px] leading-snug">
        No upgrade needed — Free is yours by default.
      </p>
    </article>
  );
}

function PremiumPlanCard({
  isCurrent,
  onConnectSocial,
}: {
  isCurrent: boolean;
  onConnectSocial: (platform: SocialPlatform) => void;
}) {
  const premium = TIERS.find((t) => t.id === "premium")!;
  const perks = [
    "Boosted cashback & discounts",
    "Personalized recommendations",
    "Unlimited reservations",
    "Everything in Free",
  ];
  const igConnected = CURRENT_USER.tierOrigin === "instagram";
  const isSubscribed = CURRENT_USER.tierOrigin === "subscription";

  const rows: ClimbRow[] = [
    {
      key: "instagram",
      icon: Instagram,
      iconBg:
        "bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))]",
      label: "Instagram",
      requirement: `${formatFollowers(premium.followerThreshold)}+ followers · post a story`,
      state: igConnected ? "connected" : "default",
      cta: igConnected ? "Connected" : "Connect",
      onClick: () => onConnectSocial("instagram"),
    },
    {
      key: "subscription",
      icon: CreditCard,
      iconBg: "bg-pink-gradient",
      label: "Subscribe",
      requirement: `$${premium.priceMxn} MXN / mo · cancel anytime`,
      state: isSubscribed ? "active" : "default",
      cta: isSubscribed ? "Active" : "Subscribe",
      href: "/subscribe/premium",
    },
    {
      key: "invitation",
      icon: Mail,
      iconBg: "bg-amber-500",
      label: "Invitation",
      requirement: "Locals · creators · talent, invited by Mesita",
      state: "default",
      cta: "Request",
      onClick: () =>
        toast.action(
          "Invitations are hand-picked — meanwhile email class@mesita.ai with your case",
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
    <article className="border-tier-premium/40 bg-card flex w-[80%] shrink-0 snap-start flex-col gap-4 rounded-2xl border-2 p-5">
      <PlanCardHeader
        label="Premium"
        price={`$${premium.priceMxn} MXN`}
        priceSuffix="/ mo"
        sub="or earned free via Instagram / invitation"
        accent
        isCurrent={isCurrent}
      />
      <PerkList perks={perks} accent />
      <div>
        <p className="text-foreground/70 mb-2 text-[10px] font-medium tracking-[0.14em] uppercase">
          {isCurrent ? "How members get Premium" : "Three ways to unlock"}
        </p>
        <div className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-xl border">
          {rows.map((row) => (
            <ClimbTableRow key={row.key} row={row} />
          ))}
        </div>
      </div>
    </article>
  );
}

type ClimbRow = {
  key: string;
  icon: LucideIcon;
  iconBg: string;
  label: string;
  /** Single requirement line for this door into Premium. */
  requirement: string;
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
  // Two-row block: a label row (icon + door name + its requirement) and a
  // full-width CTA pill so the tap target is generous.
  const body = (
    <div className="hover:bg-muted/30 flex flex-col gap-2.5 px-3 py-3 transition">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white",
            row.iconBg,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-display block text-[13px] font-semibold tracking-tight">
            {row.label}
          </span>
          <span className="text-muted-foreground block text-[11px]">
            {row.requirement}
          </span>
        </span>
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
  // Slim current-class banner. The class IS the brand — "Mesita Premium"
  // reads as a proper noun. Origin is the one-line subtitle (how it was
  // earned). The plan cards below carry the perks + upgrade paths.
  const meta = TIERS.find((t) => t.id === CURRENT_USER.tier)!;
  const brand = `Mesita ${meta.label}`;
  const origin = (() => {
    switch (CURRENT_USER.tierOrigin) {
      case "instagram":
        return `Earned via ${formatFollowers(CURRENT_USER.followers)} Instagram followers`;
      case "subscription":
        return CURRENT_USER.tierRenewsAt
          ? `Subscribed · renews ${CURRENT_USER.tierRenewsAt}`
          : "Subscribed · renews monthly";
      case "invitation":
        return "Invited by Mesita";
      default:
        return "Free — anyone with a Mesita account starts here";
    }
  })();
  return (
    <section
      className={cn(
        "rounded-2xl px-4 py-3.5 shadow-sm",
        tierBadgeClass(CURRENT_USER.tier),
      )}
    >
      <p className="text-[9px] font-semibold tracking-[0.18em] uppercase opacity-80">
        Your class
      </p>
      <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight">
        {brand}
      </h2>
      <p className="mt-0.5 text-[11px] leading-snug opacity-90">{origin}</p>
    </section>
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
