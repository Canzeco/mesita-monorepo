"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Instagram,
  ChevronRight,
  Check,
  Crown,
  Sparkles,
  User as UserIcon,
  CreditCard,
  Bell,
  Shield,
  HelpCircle,
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
  // Three labeled sections, top to bottom: your current class, a Free-vs-
  // Premium comparison, and the ways to join Premium.
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <SectionEyebrow>Current class</SectionEyebrow>
        <CurrentClassCard />
      </section>
      <section className="flex flex-col gap-2">
        <SectionEyebrow>Comparison</SectionEyebrow>
        <FreeVsPremium />
      </section>
      <section className="flex flex-col gap-2">
        <SectionEyebrow>Join Premium</SectionEyebrow>
        <WaysToClimb onConnectSocial={onConnectSocial} />
      </section>
    </div>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-foreground/60 text-[10px] font-semibold tracking-[0.16em] uppercase">
      {children}
    </p>
  );
}

// ─── Free vs Premium ──────────────────────────────────────────────────────

// Quick at-a-glance comparison. The three perks that actually differ, with
// the Premium column tinted + emphasized.
const COMPARE_ROWS: { label: string; free: string; premium: string }[] = [
  { label: "Cashback & discounts", free: "Base", premium: "Boosted" },
  { label: "Recommendations", free: "Standard", premium: "Personalized" },
  { label: "Reservations / month", free: "2", premium: "Unlimited" },
];

function FreeVsPremium() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border">
      <div className="grid grid-cols-[1.3fr_0.8fr_1fr] items-end gap-1 px-3 pt-3">
        <span />
        <CompareHead label="Free" />
        <CompareHead label="Premium" accent />
      </div>
      <div className="mt-1">
        {COMPARE_ROWS.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "grid grid-cols-[1.3fr_0.8fr_1fr] items-center gap-1 px-3 py-2.5",
              i > 0 && "border-border/50 border-t",
            )}
          >
            <span className="text-foreground/80 text-[12px] leading-tight font-medium">
              {row.label}
            </span>
            <span className="text-foreground/70 text-center text-[12px] font-semibold">
              {row.free}
            </span>
            <span className="bg-tier-premium/[0.07] text-premium rounded-md py-1.5 text-center text-[12px] font-semibold">
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

// Horizontal scroller, one card per path: stay Free, or reach Premium by
// Instagram / Subscription / Invitation. Each card states the requirement +
// its action; the user's current path is flagged.
type ClimbCardData = {
  key: string;
  icon: LucideIcon;
  iconBg: string;
  title: string;
  via?: string;
  accent?: boolean;
  price: string;
  desc: string;
  reached: boolean;
  reachedLabel: string;
  action?: { label: string; href?: string; onClick?: () => void };
  note?: string;
};

function WaysToClimb({
  onConnectSocial,
}: {
  onConnectSocial: (platform: SocialPlatform) => void;
}) {
  const premium = TIERS.find((t) => t.id === "premium")!;
  const origin = CURRENT_USER.tierOrigin;
  const isFree = CURRENT_USER.tier === "free";

  const cards: ClimbCardData[] = [
    {
      key: "free",
      icon: Sparkles,
      iconBg: "bg-muted text-foreground",
      title: "Free",
      price: "$0",
      desc: "Your default account — base cashback, standard recs, and 2 reservations a month.",
      reached: isFree,
      reachedLabel: "Current",
      note: isFree ? undefined : "Included in every account",
    },
    {
      key: "instagram",
      icon: Instagram,
      iconBg:
        "bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))] text-white",
      title: "Premium",
      via: "by Instagram",
      accent: true,
      price: "Free",
      desc: `${formatFollowers(premium.followerThreshold)}+ followers and post a story each visit.`,
      reached: origin === "instagram",
      reachedLabel: "Connected",
      action: { label: "Connect", onClick: () => onConnectSocial("instagram") },
    },
    {
      key: "subscription",
      icon: CreditCard,
      iconBg: "bg-pink-gradient text-white",
      title: "Premium",
      via: "by Subscription",
      accent: true,
      price: `$${premium.priceMxn} MXN / mo`,
      desc: "Subscribe monthly. Cancel anytime.",
      reached: origin === "subscription",
      reachedLabel: "Active",
      action: { label: "Subscribe", href: "/subscribe/premium" },
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {cards.map((c) => (
        <ClimbCard key={c.key} data={c} />
      ))}
    </div>
  );
}

function ClimbCard({ data }: { data: ClimbCardData }) {
  const Icon = data.icon;

  let action: ReactNode = null;
  if (data.reached) {
    action = (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        <Check className="h-3 w-3" strokeWidth={3} />
        {data.reachedLabel}
      </span>
    );
  } else if (data.action) {
    const cls =
      "bg-pink-gradient inline-flex items-center justify-center rounded-full px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm";
    action = data.action.href ? (
      <Link href={data.action.href} className={cls}>
        {data.action.label}
      </Link>
    ) : (
      <button type="button" onClick={data.action.onClick} className={cls}>
        {data.action.label}
      </button>
    );
  } else if (data.note) {
    action = (
      <span className="text-muted-foreground text-right text-[10px] leading-tight">
        {data.note}
      </span>
    );
  }

  return (
    <article
      className={cn(
        "bg-card flex w-full items-center gap-3 rounded-2xl border p-4",
        data.accent ? "border-tier-premium/40" : "border-border",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          data.iconBg,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display flex items-center gap-1 text-[14px] leading-tight font-bold tracking-tight">
          {data.accent && (
            <Crown className="text-premium h-3.5 w-3.5 shrink-0 fill-current" />
          )}
          <span className={cn(data.accent && "text-premium")}>{data.title}</span>
          {data.via && (
            <span className="text-muted-foreground text-[11px] font-medium">
              · {data.via}
            </span>
          )}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-snug">
          {data.desc}
        </p>
        <p className="text-foreground/80 mt-1 text-[11px] font-semibold tabular-nums">
          {data.price}
        </p>
      </div>
      <div className="shrink-0">{action}</div>
    </article>
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
    <div
      className={cn(
        "rounded-2xl px-4 py-3.5 shadow-sm",
        tierBadgeClass(CURRENT_USER.tier),
      )}
    >
      <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight">
        {brand}
      </h2>
      <p className="mt-0.5 text-[11px] leading-snug opacity-90">{origin}</p>
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
