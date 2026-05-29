"use client";

import { useState } from "react";
import {
  Copy,
  ChevronRight,
  Check,
  Plus,
  Megaphone,
  Briefcase,
  Star,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Top header (SimpleHeader title="Share Mesita") is owned by the shell
// layout via TopBar — see src/components/consumer/TopBar.tsx.
//
// The body is exported separately as `ShareBody` so the Profile page
// can mount it as its "Share" sub-tab without duplicating the
// Friends/Restaurants/Others tab logic (the "byebye coupons-as-entity"
// checkpoint folded Share + Coupons into Profile sub-tabs while
// keeping the standalone /share + /coupons routes reachable).

type Tab = "friends" | "restaurants" | "others";

const TABS: { id: Tab; label: string }[] = [
  { id: "friends", label: "Friends" },
  { id: "restaurants", label: "Restaurants" },
  { id: "others", label: "Others" },
];

export default function SharePage() {
  return <ShareBody />;
}

export function ShareBody() {
  const [tab, setTab] = useState<Tab>("friends");

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4">
        <div className="border-border bg-card grid grid-cols-3 gap-0 rounded-full border p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-1 py-1.5 text-center text-[12px] font-medium transition",
                tab === t.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-hidden px-4 pt-3 pb-4">
        {tab === "friends" && <FriendsTab />}
        {tab === "restaurants" && <RestaurantsTab />}
        {tab === "others" && <OthersTab />}
      </div>
    </div>
  );
}

function FeatureCard({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="border-border bg-card rounded-2xl border p-3.5">
      <p className="text-sm leading-tight font-semibold">{title}</p>
      <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
        {sub}
      </p>
    </div>
  );
}

function UrlField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard API can fail on insecure origins or older browsers — fall
      // back to noop. We could select the text, but the URL is already in
      // view so the user can long-press to copy on mobile.
    }
  };
  return (
    <div className="border-border bg-card flex items-center gap-2 rounded-full border px-4 py-3">
      <span className="flex-1 truncate font-mono text-[13px]">{url}</span>
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy"}
        onClick={onCopy}
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-7 w-7 items-center justify-center rounded-full"
      >
        {copied ? (
          <Check className="text-secondary h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function PrimaryCta({
  label,
  share,
  variant = "solid",
}: {
  label: string;
  share?: { title: string; text: string; url?: string };
  variant?: "solid" | "outline";
}) {
  // Three states so the button feels alive:
  //   idle    → original label + chevron
  //   shared  → 'Shared' tick (navigator.share succeeded)
  //   copied  → 'Copied to clipboard' (fallback path)
  // Resets to idle after ~1.6s.
  const [flash, setFlash] = useState<null | "shared" | "copied">(null);
  const onClick = async () => {
    if (!share) return;
    const payload = {
      title: share.title,
      text: share.text,
      url: share.url ?? window.location.origin,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload);
        setFlash("shared");
        window.setTimeout(() => setFlash(null), 1600);
        return;
      } catch {
        // User cancelled or the share sheet refused — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(`${share.text} ${payload.url}`);
      setFlash("copied");
      window.setTimeout(() => setFlash(null), 1600);
    } catch {
      // Clipboard unavailable — fail silently; no visible state change.
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!share}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-60",
        variant === "outline"
          ? "border-border bg-card text-foreground hover:bg-muted border py-3"
          : "bg-foreground text-background py-3.5 hover:opacity-90",
      )}
    >
      {flash === "shared" ? (
        <>
          <Check className="h-4 w-4" />
          Shared
        </>
      ) : flash === "copied" ? (
        <>
          <Check className="h-4 w-4" />
          Copied to clipboard
        </>
      ) : (
        <>
          {label}
          <ChevronRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}

function FriendsTab() {
  const giftCode = "8F2K — 9XQ7";
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(giftCode.replace(/\s+/g, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard unavailable — silent.
    }
  };
  const treated = [
    { initials: "CV", name: "Camila", date: "May 2" },
    { initials: "MF", name: "Mateo", date: "May 5" },
  ];
  const slots = 5;
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-muted-foreground text-[13px] leading-snug">
        You&apos;ve got {slots} $50 MXN gift cards. Share your code; the first
        friends to use it each get $50 on us.
      </p>

      {/* Gift voucher — a filled pink-gradient card. Bow + amount up top,
          the shareable code in a frosted pill at the bottom with one-tap
          copy. */}
      <div className="bg-pink-gradient shadow-glow relative overflow-hidden rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-white/80 uppercase">
              Mesita · Gift card
            </p>
            <p className="mt-1 text-[11px] text-white/85">To a friend, from you</p>
          </div>
          <span className="text-2xl leading-none" aria-hidden>
            🎀
          </span>
        </div>

        <p className="font-display mt-6 text-5xl leading-none font-semibold tracking-tight">
          $50
          <span className="ml-1.5 align-middle text-base font-semibold tracking-[0.3em] text-white/80">
            MXN
          </span>
        </p>

        <div className="mt-6 flex items-center justify-between gap-2 rounded-xl bg-white/15 px-3.5 py-2.5 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[9px] font-bold tracking-[0.2em] text-white/70 uppercase">
              Code
            </p>
            <p className="mt-0.5 font-mono text-[15px] font-bold tracking-wide">
              {giftCode}
            </p>
          </div>
          <button
            type="button"
            aria-label={copied ? "Copied" : "Copy code"}
            onClick={onCopy}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/20"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between px-1">
          <p className="text-muted-foreground text-[10px] font-medium tracking-[0.18em] uppercase">
            Friends you&apos;ve treated
          </p>
          <p className="text-secondary text-[10px] font-semibold">
            {treated.length} gifted · {slots - treated.length} to go
          </p>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {Array.from({ length: slots }).map((_, i) => {
            const f = treated[i];
            if (f) {
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="bg-pink-gradient relative aspect-square w-full overflow-hidden rounded-xl">
                    <span className="font-display absolute inset-0 flex items-center justify-center text-base font-bold text-white">
                      {f.initials}
                    </span>
                    <span className="bg-emerald-500 absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full text-white shadow-sm">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  </div>
                  <p className="text-[10px] leading-none font-semibold">
                    {f.name}
                  </p>
                  <p className="text-muted-foreground text-[9px] leading-none">
                    {f.date}
                  </p>
                </div>
              );
            }
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="border-border text-muted-foreground/60 flex aspect-square w-full items-center justify-center rounded-xl border border-dashed">
                  <Plus className="h-4 w-4" />
                </div>
                <p className="text-muted-foreground text-center text-[9px] font-medium tracking-wider uppercase">
                  Waiting
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-auto">
        <PrimaryCta
          label="Send a gift to a friend"
          share={{
            title: "Mesita — your first visit is on me",
            text: `Use my code ${giftCode.replace(/\s+/g, "")} for $50 MXN on your first Mesita visit.`,
          }}
        />
      </div>
    </div>
  );
}

// Others stacks the lighter partner programs — creators, marketing
// agencies, and modeling/talent agencies — in compact cards on one
// scroll. Creators used to live on its own top-level tab but the share
// menu collapsed to three (Friends / Restaurants / Others) so the
// creator program folded in here as the first card.
type PartnerGroup = {
  id: string;
  title: string;
  blurb: string;
  bullets: string[];
  icon: LucideIcon;
  iconBg: string;
  url: string;
  shareUrl: string;
  shareTitle: string;
  shareText: string;
  cta: string;
};

const CREATOR_GROUP: PartnerGroup = {
  id: "creators",
  title: "Creators",
  blurb: "Food, nightlife, travel & lifestyle creators.",
  icon: Megaphone,
  iconBg: "bg-pink-gradient text-white",
  bullets: [
    "Custom code · bigger welcome gift",
    "Revenue share on your signups",
    "Private tastings & openings",
    "Equity path for long-term partners",
  ],
  url: "mesita.ai/creators",
  shareUrl: "https://www.mesita.ai/creators",
  shareTitle: "Mesita creator program",
  shareText:
    "Mesita partners with creators worldwide — custom codes, revenue share, and equity for long-term collabs.",
  cta: "Apply as a creator",
};

const OTHER_GROUPS: PartnerGroup[] = [
  CREATOR_GROUP,
  {
    id: "agencies",
    title: "Marketing agencies",
    blurb: "Add Mesita to the stack you sell to restaurants & bars.",
    icon: Briefcase,
    iconBg: "bg-sky-500 text-white",
    bullets: [
      "Recurring revenue per venue you onboard",
      "Cashback redemptions = attributable ROI",
      "White-glove onboarding for your first 5 venues",
      "Partner dashboard across every client",
    ],
    url: "mesita.ai/agencies",
    shareUrl: "https://www.mesita.ai/agencies",
    shareTitle: "Mesita partner program",
    shareText:
      "Mesita's partner program could fit your agency — recurring revenue + co-branded campaigns.",
    cta: "Become a partner",
  },
  {
    id: "models",
    title: "Modeling & talent agencies",
    blurb: "Activate the talent you manage — they go Premium, you earn.",
    icon: Star,
    iconBg: "bg-tier-premium text-white",
    bullets: [
      "Premium by default — your roster starts at the top",
      "Boosted cashback at partner venues",
      "Priority tables on Fri & Sat",
      "Agency dashboard for bookings + earnings",
    ],
    url: "mesita.ai/models",
    shareUrl: "https://www.mesita.ai/models",
    shareTitle: "Mesita for talent agencies",
    shareText:
      "Get your talent roster Premium access + revenue share on Mesita.",
    cta: "Activate your roster",
  },
];

function OthersTab() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-[13px] leading-relaxed">
        Partner programs Mesita runs alongside venues. Pick the one that fits —
        each has its own onboarding.
      </p>
      {OTHER_GROUPS.map((g) => (
        <PartnerCard key={g.id} group={g} />
      ))}
    </div>
  );
}

function PartnerCard({ group: g }: { group: PartnerGroup }) {
  const Icon = g.icon;
  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm",
            g.iconBg,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-[15px] leading-tight font-bold tracking-tight">
            {g.title}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-snug">
            {g.blurb}
          </p>
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {g.bullets.map((b) => (
          <li
            key={b}
            className="text-foreground/85 flex items-start gap-2 text-[12px]"
          >
            <Check
              className="text-secondary mt-0.5 h-3.5 w-3.5 shrink-0"
              strokeWidth={3}
            />
            <span className="leading-snug">{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <PrimaryCta
          variant="outline"
          label={g.cta}
          share={{ title: g.shareTitle, text: g.shareText, url: g.shareUrl }}
        />
      </div>
    </section>
  );
}

function RestaurantsTab() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-3xl leading-tight font-semibold tracking-tight">
          Know someone who runs a restaurant or bar?
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Invite them to set up on Mesita — free, ~8 min.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <FeatureCard
          title="More customers"
          sub="Priority placement on swipe, map, catalog, AI planner."
        />
        <FeatureCard
          title="Better customers"
          sub="Socially-magnetic, higher-spend, repeat consumers."
        />
        <FeatureCard
          title="Instagram Stories"
          sub="Each visit becomes organic reach, AI-verified."
        />
        <FeatureCard
          title="Easier reservations"
          sub="AI books through your existing channel — no new tools."
        />
        <FeatureCard
          title="Marketing intelligence"
          sub="Influenced spend, repeat rate, ROAS in one dashboard."
        />
        <FeatureCard
          title="Setup in 8 minutes"
          sub="All from a browser — no app, no hardware, no POS."
        />
      </div>
      <UrlField url="www.mesita.ai" />
      <PrimaryCta
        label="Send invitation"
        share={{
          title: "Mesita for restaurants",
          text: "I think you'd love Mesita — setup is ~8 min and free to start.",
          url: "https://www.mesita.ai",
        }}
      />
    </div>
  );
}
