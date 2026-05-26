"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Crown,
  Instagram,
  BadgeCheck,
  ChevronRight,
  Check,
  User as UserIcon,
  CreditCard,
  Bell,
  Shield,
  HelpCircle,
} from "lucide-react";
import { SimpleHeader } from "@/components/consumer/SimpleHeader";
import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  CURRENT_USER,
  TIERS,
  TIER_ORDER,
  tierBadgeClass,
} from "@/lib/consumer-data";
import { cn } from "@/lib/utils";

type Tab = "class" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "class", label: "Class" },
  { id: "settings", label: "Settings" },
];

// The identity bits that survive real onboarding — name, email, country,
// birthday, sex — flow in from the server page. Everything else on this
// page (tier ladder, communities, achievements, transactions) is still
// mock until the corresponding schema columns + Edge Functions ship.
export type RealIdentity = {
  fullName: string | null;
  email: string | null;
  country: string | null;
  birthday: string | null;
  sex: string | null;
};

export function ProfileClient({ identity }: { identity: RealIdentity }) {
  const [tab, setTab] = useState<Tab>("class");
  const [verifyOpen, setVerifyOpen] = useState(false);

  // Display name: prefer the onboard-supplied full_name; otherwise the
  // email local-part as a fallback. Never the mock CURRENT_USER.name.
  const displayName =
    identity.fullName ??
    (identity.email ? identity.email.split("@")[0] : null) ??
    "Consumer";
  const initial = displayName.trim().slice(0, 1).toUpperCase() || "?";

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
      <SimpleHeader title="Mesita" eyebrow="Profile" />

      <div className="px-5 pt-3">
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
            <div className="flex items-center gap-2">
              <h1 className="font-display truncate text-2xl font-semibold tracking-tight">
                {displayName}
              </h1>
              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold tracking-wider uppercase">
                <Crown className="h-3 w-3" />
                {CURRENT_USER.tier}
              </span>
            </div>
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
          <ClassTab onConnectInstagram={() => setVerifyOpen(true)} />
        )}
        {tab === "settings" && <SettingsTab />}
      </div>

      {verifyOpen && (
        <VerifyInstagramSheet onClose={() => setVerifyOpen(false)} />
      )}
    </div>
  );
}

function ClassTab({ onConnectInstagram }: { onConnectInstagram: () => void }) {
  // Order matters: the current class anchors the tab, then the two upgrade
  // paths (Instagram + Subscribe) sit side by side as the two real routes
  // up, then the class ladder explains what each tier actually gets, then
  // the manual appeal sits at the bottom as the rare-case escape hatch.
  // Communities is hidden for now — gated behind a settings/admin page
  // until the community boosts ship for real.
  return (
    <div className="flex flex-col gap-4">
      <CurrentClassCard />
      <InstagramPathBox onConnect={onConnectInstagram} />
      <SubscriptionPathBox />
      <ClassLadderCard />
      <AppealForUpgradeButton />
    </div>
  );
}

function InstagramPathBox({ onConnect }: { onConnect: () => void }) {
  return (
    <button
      type="button"
      onClick={onConnect}
      className="border-border bg-card flex items-center gap-4 rounded-2xl border p-4 text-left transition hover:shadow-md"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))] text-white">
        <Instagram className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground/70 text-[10px] font-medium tracking-[0.14em] uppercase">
          Path 1 · Free
        </p>
        <p className="font-display mt-0.5 text-base font-semibold tracking-tight">
          Connect Instagram
        </p>
        <p className="text-muted-foreground mt-0.5 text-[12px]">
          1K / 5K / 20K followers maps to Silver / Gold / Diamond instantly.
        </p>
      </div>
      <span className="bg-pink-gradient rounded-full px-4 py-2 text-[12px] font-semibold text-white shadow-sm">
        Connect
      </span>
    </button>
  );
}

function AppealForUpgradeButton() {
  return (
    <button
      type="button"
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

// Read-only explainer of what each class gets. The buy/connect surfaces
// are above — this is the reference card that helps a consumer understand
// why upgrading is worth it.
function ClassLadderCard() {
  return (
    <section className="border-border bg-card rounded-2xl border p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <p className="text-secondary text-[10px] font-medium tracking-[0.14em] uppercase">
          Class ladder
        </p>
        <span className="text-muted-foreground text-[11px]">
          Same at every partner
        </span>
      </header>
      <p className="text-muted-foreground mt-2 text-[12px] leading-relaxed">
        Higher class = more cashback at every Verified Partner. The rate per
        class is set by each venue inside Mesita.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {TIERS.map((t) => (
          <li
            key={t.id}
            className="bg-muted/30 flex items-center gap-3 rounded-xl px-3 py-2.5"
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                tierBadgeClass(t.id),
              )}
            >
              {t.label[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold tracking-tight">
                Mesita {t.label}
              </p>
              <p className="text-muted-foreground text-[11px]">{t.cashback}</p>
            </div>
            <p className="text-foreground shrink-0 text-[11px] font-semibold">
              {t.perk}
            </p>
          </li>
        ))}
      </ul>
    </section>
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
                    ? `$${t.priceMxn.toLocaleString()} MXN / mo · ${t.cashback.toLowerCase()}`
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

function SettingsTab() {
  const items = [
    { Icon: UserIcon, label: "Personal details", sub: "Name, email, phone" },
    {
      Icon: CreditCard,
      label: "Payment methods",
      sub: "Apple Pay · Visa · 4242",
    },
    { Icon: Bell, label: "Notifications", sub: "Push, email" },
    { Icon: Shield, label: "Privacy & data", sub: "Permissions, export" },
    { Icon: HelpCircle, label: "Help & support", sub: "FAQ · contact us" },
  ];
  return (
    <div className="flex flex-col">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
        Account
      </p>
      <div className="divide-border border-border bg-card mt-3 divide-y overflow-hidden rounded-2xl border">
        {items.map(({ Icon, label, sub }) => (
          <button
            key={label}
            type="button"
            className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition"
          >
            <span className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="text-muted-foreground block text-[11px]">
                {sub}
              </span>
            </span>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          </button>
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

function VerifyInstagramSheet({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("");
  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <div
        className="bg-foreground/30 absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="bg-card shadow-elev relative z-10 w-full rounded-t-3xl p-5">
        <div className="bg-foreground/30 mx-auto mb-3 h-1 w-12 rounded-full" />
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))] text-white">
            <Instagram className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Verify Instagram
            </h2>
            <p className="text-muted-foreground text-[12px]">
              via <span className="text-foreground">@mesita.bot</span> ·
              1-minute setup
            </p>
          </div>
        </div>
        <ol className="mt-5 flex flex-col gap-3">
          {[
            <>
              Follow <span className="text-secondary">@mesita.bot</span> on
              Instagram.
            </>,
            <>
              DM <span className="text-secondary">@mesita.bot</span> with the
              word <span className="text-secondary font-mono">VERIFY</span>.
            </>,
            <>
              Mesita will reply with an 8-digit verification code. Paste it
              here.
            </>,
            <>Your class is set instantly from your follower count.</>,
          ].map((line, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-[13px] leading-snug"
            >
              <span className="bg-secondary/15 text-secondary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                {i + 1}
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste 8-digit code"
          className="border-border bg-muted/30 placeholder:text-muted-foreground/70 mt-4 h-12 w-full rounded-full border px-5 text-center text-sm outline-none"
          maxLength={8}
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border-border bg-card hover:bg-muted flex-1 rounded-full border py-3 text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={code.length < 8}
            className="bg-pink-gradient flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white transition disabled:opacity-60"
          >
            <BadgeCheck className="h-4 w-4" />
            Verify
          </button>
        </div>
        <p className="text-muted-foreground mt-3 text-center text-[11px]">
          We never ask for your Instagram password.
        </p>
      </div>
    </div>
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
