"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Crown,
  Instagram,
  Linkedin,
  ChevronRight,
  Check,
  User as UserIcon,
  CreditCard,
  Bell,
  Shield,
  HelpCircle,
  Utensils,
  BookOpen,
  MessageCircle,
  Server,
  Code2,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  VerifySocialSheet,
  type SocialPlatform,
} from "@/components/consumer/VerifySocialSheet";
import {
  CURRENT_USER,
  TIERS,
  TIER_ORDER,
  tierBadgeClass,
} from "@/lib/consumer-data";
import { cn, firstInitial } from "@/lib/utils";
import { toast } from "@/lib/toast";

type Tab = "class" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "class", label: "Class" },
  { id: "settings", label: "Settings" },
];

// The identity bits that survive real onboarding — name, email, country,
// birthday, sex — flow in from the server page. The tier ladder rendered
// on the Class tab is still mock until the corresponding schema columns +
// Edge Functions ship.
export type RealIdentity = {
  fullName: string | null;
  email: string | null;
  country: string | null;
  birthday: string | null;
  sex: string | null;
};

export function ProfileClient({ identity }: { identity: RealIdentity }) {
  const [tab, setTab] = useState<Tab>("class");
  const [verifyPlatform, setVerifyPlatform] = useState<SocialPlatform | null>(
    null,
  );

  // Display name: prefer the onboard-supplied full_name; otherwise the
  // email local-part as a fallback. Never the mock CURRENT_USER.name.
  const displayName =
    identity.fullName ??
    (identity.email ? identity.email.split("@")[0] : null) ??
    "Consumer";
  const initial = firstInitial(displayName, "?");

  // Identity facts shown next to the avatar — only the ones the consumer
  // actually filled. No mock fallbacks.
  const age = identity.birthday ? yearsSince(identity.birthday) : null;
  const subtitleParts: string[] = [];
  if (identity.country) subtitleParts.push(identity.country);
  if (age != null) subtitleParts.push(`${age}`);
  if (identity.sex) subtitleParts.push(prettySex(identity.sex));

  // The consumer (shell) layout already enforces onboarding completion, so by
  // the time we render here all four identity fields are guaranteed real.
  // No banner / no half-state path.

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5">
        <p className="bg-secondary/10 text-secondary rounded-xl px-3 py-2 text-[11px]">
          Preview — tier, communities and achievements below are mock values.
          Your name, email, country, age and sex are real. Your cashback
          balance and activity live on /pay/wallet.
        </p>
      </div>

      <div className="px-5 pt-5">
        <div className="flex items-center gap-4">
          <div className="bg-pink-gradient shadow-glow ring-card flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white ring-2">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-2xl font-semibold tracking-tight">
              {displayName}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {subtitleParts.join(" · ")}
            </p>
            {identity.email && (
              <p className="text-muted-foreground/80 mt-0.5 truncate text-[11px]">
                {identity.email}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="border-border bg-card flex rounded-full border p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 rounded-full px-3 py-2 text-sm font-medium transition",
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

      <div className="scrollbar-hide flex-1 overflow-y-auto px-5 pt-5 pb-8">
        {tab === "class" && (
          <ClassTab onConnectSocial={(p) => setVerifyPlatform(p)} />
        )}
        {tab === "settings" && <SettingsTab />}
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
  // Order: current class anchors the tab, then the two upgrade paths
  // (social connect + subscription) lay out the actual routes up, then
  // the manual appeal sits as the rare-case escape hatch. The class
  // ladder card is gone — SubscriptionPathBox already lists every tier
  // with its cashback so it was duplicate context.
  return (
    <div className="flex flex-col gap-4">
      <CurrentClassCard />
      <SocialPathBox onConnect={onConnectSocial} />
      <SubscriptionPathBox />
      <DonMemoToolsBox />
      <DevelopersBox />
      <AppealForUpgradeButton />
    </div>
  );
}

// Don Memo's tool kit — reservation-platform integrations that power the
// agentic side of /discover/ai. Listed as preview affordances: the Connect
// buttons fire an inline notice instead of an OAuth flow until Don Memo
// himself is live. Lives in the Class tab as a sibling of the upgrade
// paths since both sections are "connect external accounts that Mesita
// uses on your behalf".
//
// Calendar connectors moved out of this list — they now live on the
// /reservations surface (CalendarConnectBox) since calendar sync is a
// reservation-page concern, not an account-settings concern. The
// remaining tools are pure reservation/comms integrations.
const DON_MEMO_TOOLS = [
  {
    id: "opentable" as const,
    label: "OpenTable",
    sub: "Auto-confirm reservations",
    Icon: Utensils,
    badge: "bg-[#DA3743] text-white",
  },
  {
    id: "resy" as const,
    label: "Resy",
    sub: "Auto-confirm reservations",
    Icon: BookOpen,
    badge: "bg-black text-white",
  },
  {
    id: "whatsapp" as const,
    label: "WhatsApp",
    sub: "Confirmaciones por chat",
    Icon: MessageCircle,
    badge: "bg-[#25D366] text-white",
  },
];

type DonMemoToolId = (typeof DON_MEMO_TOOLS)[number]["id"];

function DonMemoToolsBox() {
  // Inline notice that auto-clears — same UX feel as the /discover/ai
  // submit affordance so users learn the "Don Memo isn't live yet" tone.
  const [notice, setNotice] = useState<string | null>(null);
  function ping(id: DonMemoToolId) {
    const label = DON_MEMO_TOOLS.find((t) => t.id === id)?.label ?? id;
    setNotice(`Don Memo still warming up — the ${label} connector activates once he's live.`);
    setTimeout(() => setNotice(null), 4000);
  }
  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      <p className="text-foreground/70 text-[10px] font-medium tracking-[0.14em] uppercase">
        Don Memo · Tools
      </p>
      <p className="font-display mt-0.5 text-base font-semibold tracking-tight">
        Let Don Memo book for you
      </p>
      <p className="text-muted-foreground mt-0.5 text-[12px]">
        Connect your reservation apps so Don Memo can check availability
        and confirm bookings for you. (Calendar sync lives on the
        Reservations tab.)
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {DON_MEMO_TOOLS.map((t) => (
          <DonMemoToolRow key={t.id} tool={t} onConnect={() => ping(t.id)} />
        ))}
      </div>
      {notice && (
        <p className="bg-secondary/10 text-secondary mt-3 rounded-xl px-3 py-2 text-[11px]">
          {notice}
        </p>
      )}
    </section>
  );
}

function DonMemoToolRow({
  tool,
  onConnect,
}: {
  tool: (typeof DON_MEMO_TOOLS)[number];
  onConnect: () => void;
}) {
  const { Icon, label, sub, badge } = tool;
  return (
    <button
      type="button"
      onClick={onConnect}
      className="bg-muted/40 hover:bg-muted flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition"
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          badge,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="text-muted-foreground block text-[11px]">{sub}</span>
      </span>
      <span className="bg-pink-gradient rounded-full px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
        Connect
      </span>
    </button>
  );
}

function SocialPathBox({
  onConnect,
}: {
  onConnect: (platform: SocialPlatform) => void;
}) {
  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      <p className="text-foreground/70 text-[10px] font-medium tracking-[0.14em] uppercase">
        Path 1 · Free
      </p>
      <p className="font-display mt-0.5 text-base font-semibold tracking-tight">
        Connect a social account
      </p>
      <p className="text-muted-foreground mt-0.5 text-[12px]">
        1K / 5K / 20K followers maps to Silver / Gold / Diamond instantly.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <SocialRow
          platform="instagram"
          label="Instagram"
          onClick={() => onConnect("instagram")}
        />
        <SocialRow
          platform="linkedin"
          label="LinkedIn"
          onClick={() => onConnect("linkedin")}
        />
      </div>
    </section>
  );
}

function SocialRow({
  platform,
  label,
  onClick,
}: {
  platform: SocialPlatform;
  label: string;
  onClick: () => void;
}) {
  const Icon = platform === "instagram" ? Instagram : Linkedin;
  const badge =
    platform === "instagram"
      ? "bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))]"
      : "bg-[#0A66C2]";
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-muted/40 hover:bg-muted flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition"
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white",
          badge,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <span className="bg-pink-gradient rounded-full px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
        Connect
      </span>
    </button>
  );
}

// Power-user surface — bring Mesita into your own AI client (MCP) or build
// on the public API. Same eyebrow + headline + bg-card shape as the other
// Class-tab cards, but the audience is technical so the copy assumes
// familiarity with the protocols. Both CTAs are inert until the developer
// portal lands.
const DEVELOPER_TOOLS = [
  {
    id: "mcp" as const,
    label: "MCP server",
    sub: "Add Mesita to Claude, ChatGPT, Cursor",
    Icon: Server,
    badge: "bg-[#1A1A1A] text-white",
    cta: "Setup",
  },
  {
    id: "api" as const,
    label: "API access",
    sub: "REST + OAuth · docs at mesita.dev",
    Icon: Code2,
    badge: "bg-[linear-gradient(135deg,#6366F1,#8B5CF6)] text-white",
    cta: "Get key",
  },
];

type DeveloperToolId = (typeof DEVELOPER_TOOLS)[number]["id"];

function DevelopersBox() {
  const [notice, setNotice] = useState<string | null>(null);
  function ping(id: DeveloperToolId) {
    const label = DEVELOPER_TOOLS.find((t) => t.id === id)?.label ?? id;
    setNotice(
      `${label} ships with the developer portal. Email dev@mesita.ai for early access.`,
    );
    setTimeout(() => setNotice(null), 5000);
  }
  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      <p className="text-foreground/70 text-[10px] font-medium tracking-[0.14em] uppercase">
        Developers · Beta
      </p>
      <p className="font-display mt-0.5 text-base font-semibold tracking-tight">
        Build with Mesita
      </p>
      <p className="text-muted-foreground mt-0.5 text-[12px]">
        Bring Mesita into your own AI client, or build on the public API.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {DEVELOPER_TOOLS.map((t) => (
          <DeveloperToolRow key={t.id} tool={t} onClick={() => ping(t.id)} />
        ))}
      </div>
      {notice && (
        <p className="bg-secondary/10 text-secondary mt-3 rounded-xl px-3 py-2 text-[11px]">
          {notice}
        </p>
      )}
    </section>
  );
}

function DeveloperToolRow({
  tool,
  onClick,
}: {
  tool: (typeof DEVELOPER_TOOLS)[number];
  onClick: () => void;
}) {
  const { Icon, label, sub, badge, cta } = tool;
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-muted/40 hover:bg-muted flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition"
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          badge,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="text-muted-foreground block text-[11px]">{sub}</span>
      </span>
      <span className="bg-pink-gradient rounded-full px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
        {cta}
      </span>
    </button>
  );
}

function AppealForUpgradeButton() {
  return (
    <button
      type="button"
      onClick={() =>
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
        )
      }
      className="border-border bg-card hover:bg-muted/40 flex w-full items-center gap-3 rounded-2xl border border-dashed px-4 py-3 text-left transition"
    >
      <Crown className="text-foreground h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Appeal for upgrade</p>
        <p className="text-muted-foreground text-[11px]">
          Model, chef, press, founder? Request a manual class upgrade.
        </p>
      </div>
      <ChevronRight className="text-muted-foreground h-4 w-4" />
    </button>
  );
}

function CurrentClassCard() {
  // Top of the Class tab. The class IS the brand — "Mesita Gold" reads as a
  // proper noun, not "a Gold member". Origin determines the subtitle: who
  // earned the tier and how (followers / subscription / appeal / default).
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
    </section>
  );
}

function SubscriptionPathBox() {
  // Path 2 — paid monthly subscription, tier-as-product. Each row links to
  // /subscribe/[tier] which today stops at the checkout CTA (Stripe
  // wiring lands next).
  const currentIdx = TIER_ORDER.indexOf(CURRENT_USER.tier);
  const isSubscribed = CURRENT_USER.tierOrigin === "subscription";

  return (
    <div className="border-border bg-card rounded-2xl border p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-secondary text-[10px] font-medium tracking-[0.14em] uppercase">
            Path 2 · Subscribe
          </p>
          <p className="font-display mt-0.5 text-base font-semibold tracking-tight">
            Buy a Mesita class
          </p>
        </div>
        <span className="text-muted-foreground text-[11px]">
          Monthly · cancel anytime
        </span>
      </div>
      <p className="text-muted-foreground mt-2 text-[12px] leading-relaxed">
        Granted upfront — you become the tier the moment you subscribe, no spend
        accumulation needed.
      </p>
      <div className="mt-4 flex flex-col gap-2.5">
        {TIERS.map((t) => {
          const isCurrent = t.id === CURRENT_USER.tier;
          const isPaidTier = t.priceMxn > 0;
          const tierIdx = TIER_ORDER.indexOf(t.id);
          const brand = `Mesita ${t.label}`;
          // A user "has" a paid tier already if their current is >= this one.
          // We surface that so they don't try to sub at a lower tier than
          // they already hold via followers.
          const alreadyAtOrAbove = tierIdx <= currentIdx;
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5",
                isCurrent
                  ? "border-foreground bg-card border"
                  : "bg-muted/40 border border-transparent",
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  tierBadgeClass(t.id),
                )}
              >
                {t.label[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-display text-base font-semibold tracking-tight">
                    {brand}
                  </p>
                  {isCurrent && (
                    <span className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-[11px]">
                  {isPaidTier
                    ? `MX$${t.priceMxn.toLocaleString()} / mo · ${t.cashback.toLowerCase()}`
                    : `Default · ${t.cashback.toLowerCase()}`}
                </p>
              </div>
              {isPaidTier ? (
                isCurrent && isSubscribed ? (
                  <span className="bg-secondary/15 text-secondary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                    <Check className="h-3 w-3" />
                    Active
                  </span>
                ) : alreadyAtOrAbove && !isCurrent ? (
                  <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-[11px] font-semibold">
                    Held
                  </span>
                ) : (
                  <Link
                    href={`/subscribe/${t.id}`}
                    className="bg-pink-gradient rounded-full px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-sm"
                  >
                    Subscribe
                  </Link>
                )
              ) : (
                <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-[11px] font-semibold">
                  Free
                </span>
              )}
            </div>
          );
        })}
      </div>
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

// Years since a YYYY-MM-DD birthday string. Returns null on bad input so
// the caller can simply skip the "27"-style age line when the consumer hasn't
// filled their birthday yet.
function yearsSince(birthday: string): number | null {
  const parsed = new Date(`${birthday}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - parsed.getUTCFullYear();
  const m = now.getUTCMonth() - parsed.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < parsed.getUTCDate())) age -= 1;
  if (age < 0 || age > 130) return null;
  return age;
}

// Display the sex string as a Title-Cased label. The DB stores raw values
// (male/female/other); the header shows "Female", "Male", "Other".
function prettySex(sex: string): string {
  const lower = sex.trim().toLowerCase();
  if (!lower) return "";
  return lower[0].toUpperCase() + lower.slice(1);
}
