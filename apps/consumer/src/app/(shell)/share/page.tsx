"use client";

import { useState } from "react";
import { Copy, ChevronRight, Check, Plus } from "lucide-react";
import { SimpleHeader } from "@/components/consumer/SimpleHeader";
import { cn } from "@/lib/utils";

type Tab = "consumers" | "venues" | "creators" | "others";

const TABS: { id: Tab; label: string }[] = [
  { id: "consumers", label: "Consumers" },
  { id: "venues", label: "Venues" },
  { id: "creators", label: "Creators" },
  { id: "others", label: "Others" },
];

export default function SharePage() {
  const [tab, setTab] = useState<Tab>("consumers");

  return (
    <div className="flex h-full flex-col">
      <SimpleHeader title="Mesita" eyebrow="Share with friends" />

      <div className="px-4 pt-4">
        <div className="border-border bg-card grid grid-cols-4 gap-0 rounded-full border p-1">
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
        {tab === "consumers" && <ConsumersTab />}
        {tab === "venues" && <VenuesTab />}
        {tab === "creators" && <CreatorsTab />}
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
}: {
  label: string;
  share?: { title: string; text: string; url?: string };
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
      className="bg-foreground text-background flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-60"
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

function ConsumersTab() {
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
        You&apos;ve got {slots} $100 MXN gift cards. Share your code; the first
        friends to use it each get $100 on us.
      </p>

      {/* ISO/IEC 7810 ID-1 ratio (≈1.586:1) — the physical credit-card
          aspect. Constrains the box so it reads as an actual card no
          matter how wide its container is. */}
      <div className="border-border bg-card flex aspect-[1.586/1] w-full items-stretch gap-3 rounded-2xl border p-4">
        <div className="flex w-[32%] flex-col items-center justify-between py-1">
          <span className="text-3xl leading-none" aria-hidden>
            🎀
          </span>
          <p className="text-muted-foreground/80 text-[9px] leading-snug font-medium tracking-[0.18em] uppercase">
            To a
            <br />
            friend
            <br />
            from <span className="text-foreground font-bold">you</span>
          </p>
        </div>
        <div
          className="w-px shrink-0 self-stretch"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, var(--border) 50%, transparent 50%)",
            backgroundSize: "1px 6px",
            backgroundRepeat: "repeat-y",
          }}
          aria-hidden
        />
        <div className="flex flex-1 flex-col justify-between gap-1 text-right">
          <p className="text-muted-foreground text-[9px] font-medium tracking-[0.18em] uppercase">
            Mesita 🌲 · Gift card
          </p>
          <div>
            <p className="font-display text-4xl leading-none font-semibold tracking-tight">
              $100
            </p>
            <p className="text-muted-foreground mt-1 text-[9px] font-medium tracking-[0.4em]">
              MXN
            </p>
          </div>
          <div className="flex items-end justify-end gap-2">
            <div>
              <p className="text-muted-foreground text-[9px] font-medium tracking-[0.18em] uppercase">
                Code
              </p>
              <p className="mt-0.5 font-mono text-[13px] font-semibold">
                {giftCode}
              </p>
            </div>
            <button
              type="button"
              aria-label={copied ? "Copied" : "Copy code"}
              onClick={onCopy}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md"
            >
              {copied ? (
                <Check className="text-secondary h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
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
                    <span className="bg-tier-gold absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full text-black shadow-sm">
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
            text: `Use my code ${giftCode.replace(/\s+/g, "")} for $100 MXN on your first Mesita visit.`,
          }}
        />
      </div>
    </div>
  );
}

// Three lighter partner programs collapsed into one page — Creators,
// Creators get their own top-level tab. Others stacks the remaining
// lighter partner programs — agencies + modeling talent — in compact
// cards on one scroll.
type PartnerGroup = {
  id: string;
  title: string;
  blurb: string;
  bullets: string[];
  url: string;
  shareUrl: string;
  shareTitle: string;
  shareText: string;
  cta: string;
};

const CREATOR_GROUP: PartnerGroup = {
  id: "creators",
  title: "Creators",
  blurb:
    "Food, nightlife, travel, lifestyle, hotels, coffee, wine, city guides. Custom codes, revenue share, private events, equity for long-term partners.",
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
  {
    id: "agencies",
    title: "Marketing agencies",
    blurb:
      "Add Mesita to the stack you sell to restaurants & bars — measurable lift, no extra hardware.",
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
    blurb:
      "Activate the models you manage on Mesita — Diamond perks, boosted cashback, priority tables. Earn on every visit.",
    bullets: [
      "Diamond by default — your roster skips tiers",
      "Boosted cashback at partner venues",
      "Priority tables on Fri & Sat",
      "Agency dashboard for bookings + earnings",
    ],
    url: "mesita.ai/models",
    shareUrl: "https://www.mesita.ai/models",
    shareTitle: "Mesita for talent agencies",
    shareText:
      "Get your talent roster Diamond access + revenue share on Mesita.",
    cta: "Activate your roster",
  },
];

function CreatorsTab() {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm leading-relaxed">
        {CREATOR_GROUP.blurb}
      </p>
      <PartnerCard group={CREATOR_GROUP} />
    </div>
  );
}

function OthersTab() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Two lighter partner programs Mesita runs alongside venues. Pick the one
        that fits — each has its own onboarding flow.
      </p>
      {OTHER_GROUPS.map((g) => (
        <PartnerCard key={g.id} group={g} />
      ))}
    </div>
  );
}

function PartnerCard({ group: g }: { group: PartnerGroup }) {
  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
      <header>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          {g.title}
        </h3>
        <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
          {g.blurb}
        </p>
      </header>
      <ul className="flex flex-col gap-1.5">
        {g.bullets.map((b) => (
          <li
            key={b}
            className="text-foreground before:bg-foreground/40 text-[12px] leading-snug before:mr-2 before:inline-block before:h-1 before:w-1 before:rounded-full before:align-middle"
          >
            {b}
          </li>
        ))}
      </ul>
      <UrlField url={g.url} />
      <PrimaryCta
        label={g.cta}
        share={{ title: g.shareTitle, text: g.shareText, url: g.shareUrl }}
      />
    </section>
  );
}

function VenuesTab() {
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
          title="Auto IG stories"
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
          title: "Mesita for venues",
          text: "I think you'd love Mesita — setup is ~8 min and free to start.",
          url: "https://www.mesita.ai",
        }}
      />
    </div>
  );
}
