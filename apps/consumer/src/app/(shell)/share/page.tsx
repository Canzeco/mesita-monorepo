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
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Top header (SimpleHeader title="Invite") is owned by the shell
// layout via TopBar — see src/components/consumer/TopBar.tsx.
//
// The body is exported separately as `ShareBody` so the Profile page
// can mount it as its "Share" sub-tab without duplicating the
// Friends/Restaurants/Others tab logic (the "byebye coupons-as-entity"
// checkpoint folded Share + Coupons into Profile sub-tabs while
// keeping the standalone /invite route primary while /share stays as
// a deep-link alias).

type Tab = "friends" | "restaurants" | "others";

const TABS: { id: Tab; label: string }[] = [
  { id: "friends", label: "Friends" },
  { id: "restaurants", label: "Restaurantes" },
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

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-6">
        {tab === "friends" && <FriendsTab />}
        {tab === "restaurants" && <RestaurantsTab />}
        {tab === "others" && <OthersTab />}
      </div>
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
    <div className="flex flex-col gap-3">
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

      <div className="mt-1">
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
  icon: LucideIcon;
  iconBg: string;
  body: string;
  websiteUrl: string;
};

const OTHER_GROUPS: PartnerGroup[] = [
  {
    id: "influencers",
    title: "Influencers",
    icon: Megaphone,
    iconBg: "bg-pink-gradient text-white",
    body:
      "Create content about travel, food, nightlife or lifestyle? You just found a gold mine. 20% of Mesita's equity is reserved for creators. Let's partner.",
    websiteUrl: "https://www.mesita.ai",
  },
  {
    id: "agencies",
    title: "Marketing agencies",
    icon: Briefcase,
    iconBg: "bg-sky-500 text-white",
    body:
      "Do you manage marketing for restaurants or bars? Add Mesita to your stack.",
    websiteUrl: "https://www.mesita.ai",
  },
  {
    id: "models",
    title: "Model & talent agencies",
    icon: Star,
    iconBg: "bg-tier-premium text-white",
    body:
      "Our partner venues want your talent in the room to enhance the ambience. Make all your talent Mesita Premium, for free, no tricks.",
    websiteUrl: "https://www.mesita.ai",
  },
];

const RESTAURANTS_GROUP: PartnerGroup = {
  id: "restaurants",
  title: "Restaurants & bars",
  icon: UtensilsCrossed,
  iconBg: "bg-pink-gradient text-white",
  body:
    "More customers from priority placement on swipe, map, and catalog. Better customers with higher spend and repeat visits. Setup takes ~8 minutes in any browser.",
};

function RestaurantsTab() {
  const group = RESTAURANTS_GROUP;
  const Icon = group.icon;
  const websiteUrl = "https://www.mesita.ai";
  const contactMailto =
    "mailto:partners@mesita.ai?subject=" +
    encodeURIComponent(`Mesita: ${group.title}`);
  const [inviteFlash, setInviteFlash] = useState<null | "shared" | "copied">(
    null,
  );
  const onInvite = async () => {
    const share = {
      title: "Mesita for restaurants",
      text: "I think you'd love Mesita — setup is ~8 min and free to start.",
      url: websiteUrl,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(share);
        setInviteFlash("shared");
        window.setTimeout(() => setInviteFlash(null), 1600);
        return;
      } catch {
        // fall through to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(`${share.text} ${share.url}`);
      setInviteFlash("copied");
      window.setTimeout(() => setInviteFlash(null), 1600);
    } catch {
      // clipboard unavailable — keep idle
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-[13px] leading-relaxed">
        Know someone who runs a restaurant, bar, nightclub, cafe, or lounge?
      </p>
      <section className="border-border bg-card rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm",
              group.iconBg,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <h3 className="font-display text-[15px] font-bold tracking-tight">
            {group.title}
          </h3>
        </div>
        <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
          {group.body}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <a
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="border-border bg-card text-foreground hover:bg-muted flex items-center justify-center rounded-full border py-2.5 text-[12.5px] font-semibold transition"
          >
            Website
          </a>
          <button
            type="button"
            onClick={onInvite}
            className="border-border bg-card text-foreground hover:bg-muted flex items-center justify-center rounded-full border py-2.5 text-[12.5px] font-semibold transition"
          >
            {inviteFlash === "shared"
              ? "Shared"
              : inviteFlash === "copied"
                ? "Copied"
                : "Invite"}
          </button>
          <a
            href={contactMailto}
            className="border-border bg-card text-foreground hover:bg-muted flex items-center justify-center rounded-full border py-2.5 text-[12.5px] font-semibold transition"
          >
            Contact
          </a>
        </div>
      </section>
    </div>
  );
}

function OthersTab() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-[13px] leading-relaxed">
        Other ways to partner with Mesita.
      </p>
      {OTHER_GROUPS.map((g) => (
        <PartnerCard key={g.id} group={g} />
      ))}
    </div>
  );
}

function PartnerCard({ group: g }: { group: PartnerGroup }) {
  const Icon = g.icon;
  const mailto = `mailto:partners@mesita.ai?subject=${encodeURIComponent(
    `Mesita: ${g.title}`,
  )}`;
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
        <h3 className="font-display text-[15px] font-bold tracking-tight">
          {g.title}
        </h3>
      </div>
      <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
        {g.body}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          href={g.websiteUrl}
          target="_blank"
          rel="noreferrer"
          className="border-border bg-card text-foreground hover:bg-muted flex items-center justify-center rounded-full border py-2.5 text-[13px] font-semibold transition"
        >
          Website
        </a>
        <a
          href={mailto}
          className="border-border bg-card text-foreground hover:bg-muted flex items-center justify-center gap-1.5 rounded-full border py-2.5 text-[13px] font-semibold transition"
        >
          Contact
          <ChevronRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
