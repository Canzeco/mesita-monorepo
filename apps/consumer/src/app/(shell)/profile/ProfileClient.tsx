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
  TicketPercent,
  Star,
  CalendarCheck,
  Martini,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { PreviewBadge } from "@/components/consumer/PreviewBadge";
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
  firstName: string | null;
  lastName: string | null;
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

  // Display name preference, in order:
  //   1. `${first_name} ${last_name}` if both present — the canonical
  //      form. Restaurants need a full name on the reservation, so the
  //      profile must show what's actually attached to bookings.
  //   2. either first_name OR last_name alone (whichever's set).
  //   3. legacy full_name (rows from before the onboarding split).
  //   4. email local-part fallback.
  //   5. "Consumer" placeholder.
  const composedName =
    identity.firstName && identity.lastName
      ? `${identity.firstName} ${identity.lastName}`
      : identity.firstName || identity.lastName || null;
  const displayName =
    composedName ??
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
      <div className="px-5 pt-4">
        <PreviewBadge label="Preview · tier and activity are mock" />
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
  // Four-card stack, ordered status → action → motivation → context so a
  // first-time user immediately sees both where they sit AND what to do
  // next without scrolling:
  //   1. CurrentClassCard — your tier today + the progress bar / next-tier
  //      affordance baked into the hero.
  //   2. FourWaysToClimb  — the actionable grid (Instagram, LinkedIn,
  //      Subscribe, Invitation). Promoted above perks/ladder because it's
  //      the only section with CTAs; everything below is explanation.
  //   3. ClassPerksBox    — the "why care": coupons up to 70% off plus
  //      lifestyle perks. Comes after the actions so users only need to
  //      read it if they're undecided.
  //   4. ClassLadderBox   — the four-tier visual overview. Reference, not
  //      drive — last because it's the most static piece of info.
  //
  // Story-auto-upload used to live below as an opt-in toggle. It's
  // mandatory now (every Instagram-tier visit posts a story), so the
  // toggle was removed — implicit in connecting IG, not a separate UI.
  return (
    <div className="flex flex-col gap-4">
      <CurrentClassCard />
      <FourWaysToClimb onConnectSocial={onConnectSocial} />
      <ClassPerksBox />
      <ClassLadderBox />
    </div>
  );
}

// "Why climb" pitch — coupons + lifestyle perks. Same value proposition
// as the /coupons promo box, restyled for the light profile surface with
// tinted icon circles per the Pretty UI convention. Header-only when the
// user already sits at Diamond (no upside left to sell).
function ClassPerksBox() {
  const isMaxedOut =
    TIER_ORDER.indexOf(CURRENT_USER.tier) === TIER_ORDER.length - 1;

  const perks: { icon: LucideIcon; tone: string; title: string; body: string }[] = [
    {
      icon: TicketPercent,
      tone: "bg-primary/10 text-primary",
      title: "Bigger coupons",
      body: "Up to 70% off at partners.",
    },
    {
      icon: Star,
      tone: "bg-amber-500/15 text-amber-600",
      title: "Exclusive venues",
      body: "Direct access to invite-only places.",
    },
    {
      icon: CalendarCheck,
      tone: "bg-emerald-500/15 text-emerald-600",
      title: "Priority booking",
      body: "Get a table when a place is full.",
    },
    {
      icon: Martini,
      tone: "bg-fuchsia-500/15 text-fuchsia-600",
      title: "Welcome drinks",
      body: "House drink on arrival at select partners.",
    },
  ];

  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      <p className="text-foreground/70 text-[10px] font-medium tracking-[0.14em] uppercase">
        What your class unlocks
      </p>
      <p className="font-display mt-0.5 text-base font-semibold tracking-tight">
        Better class, better coupons
      </p>
      <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
        <em className="text-foreground/85 font-display">
          Your social capital, made spendable.
        </em>{" "}
        The higher your class, the bigger the coupons our partners give
        you —{" "}
        <span className="text-foreground font-semibold">up to 70% off</span>
        {isMaxedOut
          ? ". You already sit at the top rung."
          : ". Higher classes also unlock the perks below."}
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2.5">
        {perks.map((p) => (
          <li
            key={p.title}
            className="border-border bg-muted/30 flex items-start gap-2 rounded-xl border p-2.5"
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                p.tone,
              )}
            >
              <p.icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[12px] font-semibold">
                {p.title}
              </span>
              <span className="text-muted-foreground block text-[10.5px]">
                {p.body}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Visual-first ladder. The previous version led with an abstract sentence
// ("Bronze ascends to Diamond. You sit at Mesita Gold"); replaced with a
// segmented progress strip + the 4-tier badge grid so a first-time user
// reads their position in one glance without parsing copy. The dots strip
// mirrors the one on /coupons (ClassUpsellBox) so the metaphor is shared.
function ClassLadderBox() {
  const currentIdx = TIER_ORDER.indexOf(CURRENT_USER.tier);
  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      <p className="text-foreground/70 text-[10px] font-medium tracking-[0.14em] uppercase">
        The class ladder
      </p>

      {/* Segmented strip — one bar per tier, filled up to and including the
          user's current rung. Reads as "you've climbed this much" at a
          glance, no copy required. */}
      <div className="mt-2 flex items-center gap-1.5">
        {TIER_ORDER.map((tier) => {
          const reached = TIER_ORDER.indexOf(tier) <= currentIdx;
          return (
            <span
              key={tier}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                reached ? "bg-foreground" : "bg-muted",
              )}
            />
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {TIERS.map((t) => {
          const tierIdx = TIER_ORDER.indexOf(t.id);
          const isCurrent = tierIdx === currentIdx;
          return (
            <div
              key={t.id}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl p-2 text-center",
                isCurrent
                  ? "border-foreground bg-card ring-foreground/10 border ring-2"
                  : "bg-muted/30 border border-transparent",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold",
                  tierBadgeClass(t.id),
                )}
              >
                {t.label[0]}
              </span>
              <span className="font-display text-[12px] leading-none font-semibold tracking-tight">
                {t.label}
              </span>
              <span
                className={cn(
                  "text-[9px] leading-tight",
                  isCurrent
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {isCurrent ? "You" : tierIdx < currentIdx ? "Held" : "Locked"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// 2×2 grid of the four upgrade paths. Each cell carries its own
// three-row tier ladder (Silver / Gold / Diamond requirement on this
// path) so the user can immediately see what gets them to each rung
// without having to tap through. The carousel variant moved to a grid
// per user spec — "make a beautiful table or something".
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

  // Follower threshold ladder shared by Instagram and LinkedIn. Both
  // platforms map the same follower count → same Mesita tier (1K →
  // Silver, 5K → Gold, 20K → Diamond) so we only declare it once.
  const followerLadder: LadderRow[] = TIERS.filter((t) => t.id !== "bronze").map(
    (t) => ({
      tier: t.id,
      label: t.label,
      value: `${formatFollowers(t.followerThreshold)}`,
    }),
  );

  return (
    <section>
      <p className="text-foreground/70 px-1 text-[10px] font-medium tracking-[0.14em] uppercase">
        Four ways to climb
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <ClimbCard
          eyebrow="Instagram"
          title="Post a story"
          icon={Instagram}
          iconBg="bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))]"
          ladder={followerLadder}
          ladderSuffix="followers"
          state={igConnected ? "connected" : "default"}
          cta={igConnected ? "Connected" : "Connect"}
          onClick={() => onConnectSocial("instagram")}
        />
        <ClimbCard
          eyebrow="LinkedIn"
          title="Verify role"
          icon={Linkedin}
          iconBg="bg-[#0A66C2]"
          ladder={followerLadder}
          ladderSuffix="followers"
          state="default"
          cta="Connect"
          onClick={() => onConnectSocial("linkedin")}
        />
        <ClimbCard
          eyebrow="Subscribe"
          title="Pay monthly"
          icon={CreditCard}
          iconBg="bg-pink-gradient"
          ladder={TIERS.filter((t) => t.id !== "bronze").map((t) => ({
            tier: t.id,
            label: t.label,
            value: `$${t.priceUsd}`,
          }))}
          ladderSuffix="/ mo"
          state={isSubscribed ? "active" : "default"}
          cta={isSubscribed ? "Active" : "Subscribe"}
          href={nextTier ? `/subscribe/${nextTier}` : undefined}
        />
        <ClimbCard
          eyebrow="Invitation"
          title="Request access"
          icon={Mail}
          iconBg="bg-amber-500"
          ladder={[
            { tier: "silver", label: "Silver", value: "Locals" },
            { tier: "gold", label: "Gold", value: "Creators" },
            { tier: "diamond", label: "Diamond", value: "VIPs" },
          ]}
          state="default"
          cta="Request"
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
        />
      </div>
    </section>
  );
}

type LadderRow = {
  tier: (typeof TIER_ORDER)[number];
  label: string;
  value: string;
};

// One cell of the 2×2 climb grid. Header (icon + eyebrow + title) on
// top, three-row tier ladder in the middle, CTA at the bottom. The
// ladder rows use the tier badge color for the dot so each row
// telegraphs which rung it leads to.
function ClimbCard({
  eyebrow,
  title,
  icon: Icon,
  iconBg,
  ladder,
  ladderSuffix,
  state,
  cta,
  href,
  onClick,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  iconBg: string;
  ladder: LadderRow[];
  /** Optional suffix appended to each ladder row's value (e.g. "/ mo"). */
  ladderSuffix?: string;
  state: "default" | "connected" | "active";
  cta: string;
  href?: string;
  onClick?: () => void;
}) {
  const ctaClass =
    state === "connected" || state === "active"
      ? "bg-emerald-500/15 text-emerald-700"
      : "bg-pink-gradient text-white shadow-sm";
  const ctaContent =
    state === "connected" || state === "active" ? (
      <span className="inline-flex items-center gap-1">
        <Check className="h-3 w-3" strokeWidth={3} />
        {cta}
      </span>
    ) : (
      cta
    );
  const body = (
    <div className="border-border bg-card flex h-full flex-col gap-3 rounded-2xl border p-3.5">
      <header className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white",
            iconBg,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[9px] font-bold tracking-[0.18em] uppercase">
            {eyebrow}
          </p>
          <p className="font-display mt-0.5 text-[13px] leading-tight font-semibold tracking-tight">
            {title}
          </p>
        </div>
      </header>
      <ul className="flex flex-1 flex-col gap-1">
        {ladder.map((row) => (
          <li
            key={row.tier}
            className="flex items-center justify-between gap-2 text-[11px] leading-tight"
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  tierBadgeClass(row.tier),
                )}
                aria-hidden
              />
              <span className="text-muted-foreground">{row.label}</span>
            </span>
            <span className="text-foreground truncate font-semibold tabular-nums">
              {row.value}
              {ladderSuffix && (
                <span className="text-muted-foreground ml-0.5 font-normal">
                  {ladderSuffix}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <span
        className={cn(
          "self-start rounded-full px-3 py-1 text-[11px] font-semibold",
          ctaClass,
        )}
      >
        {ctaContent}
      </span>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
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
