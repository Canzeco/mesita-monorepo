"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Instagram,
  ChevronRight,
  Check,
  Minus,
  Crown,
  Sparkles,
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
  // Three sections: where you stand (current plan), what the plans actually
  // get you (Free vs Premium comparison), and — when you're not yet Premium —
  // how to upgrade (the three doors).
  const isPremium = CURRENT_USER.tier === "premium";
  return (
    <div className="flex flex-col gap-4">
      <CurrentClassCard />
      <PlanComparison />
      {isPremium ? (
        <PremiumActiveCard />
      ) : (
        <UnlockPremiumCard onConnectSocial={onConnectSocial} />
      )}
    </div>
  );
}

// ─── Plan comparison ──────────────────────────────────────────────────────

// Free vs Premium at a glance. The whole point of the tab: make the value of
// Premium obvious. Each row is one promise; the Premium column is tinted +
// emphasized so the eye lands on what you gain.
type CompareCell = { text?: string; yes?: boolean };
const COMPARE_ROWS: { label: string; free: CompareCell; premium: CompareCell }[] =
  [
    {
      label: "Cashback & discounts",
      free: { text: "Base" },
      premium: { text: "Boosted" },
    },
    {
      label: "Recommendations",
      free: { text: "Standard" },
      premium: { text: "Personalized" },
    },
    {
      label: "Reservations / month",
      free: { text: "2" },
      premium: { text: "Unlimited" },
    },
    {
      label: "Hidden coupons & cashback",
      free: { yes: true },
      premium: { yes: true },
    },
    {
      label: "Priority tables & invites",
      free: { yes: false },
      premium: { yes: true },
    },
  ];

function PlanComparison() {
  const current = CURRENT_USER.tier;
  const premium = TIERS.find((t) => t.id === "premium")!;
  return (
    <section className="border-border bg-card overflow-hidden rounded-2xl border">
      <p className="text-foreground/70 px-4 pt-3.5 pb-3 text-[10px] font-medium tracking-[0.14em] uppercase">
        Compare plans
      </p>

      {/* Header row: plan names + price, current plan flagged. */}
      <div className="grid grid-cols-[1.25fr_0.85fr_1fr] items-end gap-1 px-3">
        <span />
        <PlanHeader label="Free" price="$0" isCurrent={current === "free"} />
        <PlanHeader
          label="Premium"
          price={`$${premium.priceMxn} MXN`}
          accent
          isCurrent={current === "premium"}
        />
      </div>

      {/* Feature rows. Premium column carries a soft tint band so it reads as
          the highlighted choice. */}
      <div className="mt-2">
        {COMPARE_ROWS.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "grid grid-cols-[1.25fr_0.85fr_1fr] items-center gap-1 px-3 py-2.5",
              i > 0 && "border-border/50 border-t",
            )}
          >
            <span className="text-foreground/80 text-[12px] leading-tight font-medium">
              {row.label}
            </span>
            <span className="flex justify-center">
              <CompareValue cell={row.free} />
            </span>
            <span className="bg-tier-premium/[0.07] flex justify-center rounded-md py-1.5">
              <CompareValue cell={row.premium} accent />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlanHeader({
  label,
  price,
  accent,
  isCurrent,
}: {
  label: string;
  price: string;
  accent?: boolean;
  isCurrent: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-t-xl px-1 py-2",
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
      <span className="text-muted-foreground text-[10px] font-medium">
        {price}
        {accent && <span className="opacity-70"> /mo</span>}
      </span>
      {isCurrent && (
        <span className="bg-foreground text-background mt-0.5 rounded-full px-1.5 py-px text-[8px] font-bold tracking-wider uppercase">
          Current
        </span>
      )}
    </div>
  );
}

function CompareValue({ cell, accent }: { cell: CompareCell; accent?: boolean }) {
  if (cell.yes !== undefined) {
    return cell.yes ? (
      <Check
        className={cn("h-4 w-4", accent ? "text-premium" : "text-emerald-600")}
        strokeWidth={3}
      />
    ) : (
      <Minus className="text-muted-foreground/40 h-4 w-4" strokeWidth={3} />
    );
  }
  return (
    <span
      className={cn(
        "text-center text-[12px] font-semibold tabular-nums",
        accent ? "text-premium" : "text-foreground/70",
      )}
    >
      {cell.text}
    </span>
  );
}

// Shown to Premium members in place of the upgrade doors — there's nothing
// left to sell, so confirm the perks instead.
function PremiumActiveCard() {
  return (
    <section className="border-border bg-card flex items-center gap-3 rounded-2xl border p-4">
      <span className="bg-tier-premium flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white">
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="font-display text-[14px] font-semibold tracking-tight">
          You&apos;re on Premium
        </p>
        <p className="text-muted-foreground text-[12px]">
          Best rates, personalized picks, and unlimited reservations are on.
        </p>
      </div>
    </section>
  );
}

// The three doors into Premium. One row per door (Instagram / Subscribe /
// Invitation), each showing its single requirement + a full-width CTA.
// With two tiers there's exactly one target (Premium), so the old
// multi-column tier ladder collapses to a clean requirement-per-door list.
function UnlockPremiumCard({
  onConnectSocial,
}: {
  onConnectSocial: (platform: SocialPlatform) => void;
}) {
  const igConnected = CURRENT_USER.tierOrigin === "instagram";
  const isSubscribed = CURRENT_USER.tierOrigin === "subscription";
  const premium = TIERS.find((t) => t.id === "premium")!;

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
    <section className="border-border bg-card overflow-hidden rounded-2xl border">
      <p className="text-foreground/70 px-4 pt-3.5 pb-1 text-[10px] font-medium tracking-[0.14em] uppercase">
        Ways to upgrade · 3 doors
      </p>
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
  // Top of the Class tab. The class IS the brand — "Mesita Premium" reads as
  // a proper noun. Origin determines the subtitle: how Premium was earned
  // (followers / subscription / invitation / default). Free guests get a
  // path-to-Premium affordance; Premium guests have no rung left to sell.
  const meta = TIERS.find((t) => t.id === CURRENT_USER.tier)!;
  const brand = `Mesita ${meta.label}`;
  const isPremium = CURRENT_USER.tier === "premium";
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
      {!isPremium && <PathToPremium />}
    </section>
  );
}

function PathToPremium() {
  // Free guests: show how close their Instagram following is to the Premium
  // threshold, plus the alternative doors. The bar answers "how close am I?".
  const premium = TIERS.find((t) => t.id === "premium")!;
  const followers = CURRENT_USER.followers;
  const pct =
    premium.followerThreshold > 0
      ? Math.min(100, (followers / premium.followerThreshold) * 100)
      : 0;
  const remaining = Math.max(0, premium.followerThreshold - followers);
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-[10px] font-semibold tracking-wide opacity-85 uppercase">
        <span>Mesita Free</span>
        <span>Mesita Premium</span>
      </div>
      <div className="bg-current/15 mt-1.5 h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-current/80 h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-[12px] opacity-90">
        {remaining > 0 ? (
          <>
            <span className="font-semibold">
              {formatFollowers(remaining)} more
            </span>{" "}
            Instagram followers — or subscribe for ${premium.priceMxn} MXN/mo —
            to unlock Premium.
          </>
        ) : (
          <>Post a story to claim Mesita Premium.</>
        )}
      </p>
    </div>
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
