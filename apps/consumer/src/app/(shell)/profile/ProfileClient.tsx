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
  Camera,
  Mail,
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
  // Three-card stack:
  //   1. CurrentClassCard — what tier the user holds today + how they got it.
  //   2. ClassLadderBox    — the four-tier overview, current position
  //      highlighted, so the user sees the full landscape.
  //   3. FourWaysToClimb   — horizontal carousel of the four upgrade
  //      paths (Subscription, Instagram, LinkedIn, Invitation), each
  //      with its own CTA.
  // When Instagram is connected, the Story-auto-upload toggle appears
  // below the carousel as a full-width row.
  const igConnected = CURRENT_USER.tierOrigin === "instagram";
  const [storyAutoUpload, setStoryAutoUpload] = useState(true);
  return (
    <div className="flex flex-col gap-4">
      <CurrentClassCard />
      <ClassLadderBox />
      <FourWaysToClimb onConnectSocial={onConnectSocial} />
      {igConnected && (
        <StoryAutoUploadToggle
          checked={storyAutoUpload}
          onChange={setStoryAutoUpload}
        />
      )}
    </div>
  );
}

// The four-tier ladder visualized as a non-scrollable 4-column grid.
// Current tier is highlighted with a ring + bg-card. Tiers below the
// current rung read "held"; tiers above read as the requirement to
// reach them (subscription price or followers).
function ClassLadderBox() {
  const currentIdx = TIER_ORDER.indexOf(CURRENT_USER.tier);
  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      <p className="text-foreground/70 text-[10px] font-medium tracking-[0.14em] uppercase">
        The class ladder
      </p>
      <p className="font-display mt-0.5 text-base font-semibold tracking-tight">
        All four classes
      </p>
      <p className="text-muted-foreground mt-0.5 text-[12px]">
        Bronze ascends to Diamond. You sit at{" "}
        <span className="text-foreground font-semibold">
          Mesita {TIERS.find((t) => t.id === CURRENT_USER.tier)?.label}
        </span>
        .
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {TIERS.map((t) => {
          const tierIdx = TIER_ORDER.indexOf(t.id);
          const isCurrent = tierIdx === currentIdx;
          const isHeld = tierIdx < currentIdx;
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
              <span className="text-muted-foreground text-[9px] leading-none">
                {isCurrent
                  ? "Current"
                  : isHeld
                    ? "Held"
                    : t.priceMxn > 0
                      ? `MX$${t.priceMxn.toLocaleString()}`
                      : "Default"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Horizontal carousel of the four upgrade paths. Equal-width tiles
// (w-44) so 2.3 fit at a time on a 400px viewport — visually telegraphs
// "more to the right". -mx-5 lets the strip bleed past the parent's
// p-5 padding so the first card kisses the left edge and the scroll
// has full breathing room.
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
  return (
    <section>
      <p className="text-foreground/70 px-1 text-[10px] font-medium tracking-[0.14em] uppercase">
        Four ways to climb
      </p>
      <div className="scrollbar-hide -mx-5 mt-2 flex gap-3 overflow-x-auto px-5 pb-1">
        <ClimbCard
          eyebrow="Subscribe"
          title="Pay monthly"
          sub="Cancel anytime · jump straight to the tier."
          icon={CreditCard}
          iconBg="bg-pink-gradient"
          state={isSubscribed ? "active" : "default"}
          cta={isSubscribed ? "Active" : "Subscribe"}
          href={nextTier ? `/subscribe/${nextTier}` : undefined}
        />
        <ClimbCard
          eyebrow="Instagram"
          title="Post a story"
          sub="Connect and post each time you visit a partner."
          icon={Instagram}
          iconBg="bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))]"
          state={igConnected ? "connected" : "default"}
          cta={igConnected ? "Connected" : "Connect"}
          onClick={() => onConnectSocial("instagram")}
        />
        <ClimbCard
          eyebrow="LinkedIn"
          title="Verify role"
          sub="Connect to claim Silver / Gold / Diamond by network."
          icon={Linkedin}
          iconBg="bg-[#0A66C2]"
          state="default"
          cta="Connect"
          onClick={() => onConnectSocial("linkedin")}
        />
        <ClimbCard
          eyebrow="Invitation"
          title="Request access"
          sub="For models, founders, press, locals with real influence."
          icon={Mail}
          iconBg="bg-amber-500"
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

// One horizontally-scrolled tile inside FourWaysToClimb. Equal width
// (w-48) and equal height (min-h enforced via flex) so the carousel
// reads as a uniform row.
function ClimbCard({
  eyebrow,
  title,
  sub,
  icon: Icon,
  iconBg,
  state,
  cta,
  href,
  onClick,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  icon: LucideIcon;
  iconBg: string;
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
    <div className="flex h-full w-48 shrink-0 flex-col gap-2 rounded-2xl border border-border bg-card p-3.5">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl text-white",
          iconBg,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[9px] font-bold tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
        <p className="font-display mt-0.5 text-[14px] leading-tight font-semibold tracking-tight">
          {title}
        </p>
        <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
          {sub}
        </p>
      </div>
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
    <button type="button" onClick={onClick} className="block text-left">
      {body}
    </button>
  );
}

// Subordinate toggle that sits right under a connected Instagram row.
// When ON, the consumer agrees to drop a Story tagging the partner each
// time they visit — in exchange Mesita upgrades the per-visit promo.
// Indented (ml-3) so it visually nests under the IG row it belongs to.
function StoryAutoUploadToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="bg-muted/20 hover:bg-muted/40 ml-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 ring-1 ring-pink-500/25">
        <Camera className="h-3.5 w-3.5 text-pink-600" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] leading-tight font-semibold">
          Upload Story when I visit
        </span>
        <span className="text-muted-foreground mt-0.5 block text-[10.5px] leading-snug">
          Bigger promo every time you tag a partner.
        </span>
      </span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-pink-gradient" : "bg-muted",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "bg-card absolute top-0.5 h-4 w-4 rounded-full shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
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
