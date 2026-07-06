"use client";

import { useState } from "react";
import {
  ChevronRight,
  Check,
  Plus,
  Share2,
  Megaphone,
  Briefcase,
  Star,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// One scrolling page, five audience cards — each is a self-contained share
// card. No tabs, no subpages. The top header (SimpleHeader title="Invite")
// is owned by the shell layout via TopBar.
//
// Order (Pato, 2026-07-05): Consumers · Businesses · Influencers · Marketing
// agencies · Modeling agencies. The Consumers card is the richer gift card
// (it's the primary invite); the other four are partner banner cards. Every
// card carries a share button.

export default function SharePage() {
  return (
    <div className="scrollbar-hide h-full overflow-y-auto px-4 pt-4 pb-6">
      <div className="flex flex-col gap-4">
        <ConsumersCard />
        {PARTNERS.map((p) => (
          <PartnerCard key={p.id} group={p} />
        ))}
      </div>
    </div>
  );
}

// ─── Share primitives ──────────────────────────────────────────────────────

type SharePayload = { title: string; text: string; url?: string };

// navigator.share when available, clipboard copy as the fallback. Returns the
// flash state ("shared" | "copied") so callers can echo it in the button.
async function runShare(
  share: SharePayload,
  setFlash: (v: null | "shared" | "copied") => void,
) {
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
}

function PrimaryCta({
  label,
  share,
}: {
  label: string;
  share?: SharePayload;
}) {
  const [flash, setFlash] = useState<null | "shared" | "copied">(null);
  return (
    <button
      type="button"
      onClick={() => share && runShare(share, setFlash)}
      disabled={!share}
      className="bg-foreground text-background flex w-full items-center justify-center gap-2 rounded-lg py-3.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-60"
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

// ─── Consumers (the gift card) ─────────────────────────────────────────────

function ConsumersCard() {
  const joined = [
    { initials: "CV", name: "Camila", date: "May 2" },
    { initials: "MF", name: "Mateo", date: "May 5" },
  ];
  const slots = 5;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-[13px] leading-snug">
        Send a friend their way into Mesita — a warm invite into the club. No
        points, no catch, just a nicer way to eat out together.
      </p>

      {/* Invite card — a filled pink-gradient gift card. It gifts a seat at
          Mesita, not money and not a code: bow + a warm headline, shared
          straight from the "Send a gift" button (no code to redeem). */}
      <div className="bg-pink-gradient shadow-glow relative overflow-hidden rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-white/80 uppercase">
              Mesita · Gift card
            </p>
            <p className="mt-1 text-[11px] text-white/85">
              To a friend, from you
            </p>
          </div>
          <span className="text-2xl leading-none" aria-hidden>
            🎀
          </span>
        </div>

        <p className="font-display mt-8 text-4xl leading-none font-semibold tracking-tight">
          You&apos;re invited
        </p>
        <p className="mt-2 mb-1 text-[13px] text-white/85">
          Your seat at the table.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between px-1">
          <p className="text-muted-foreground text-[10px] font-medium tracking-[0.18em] uppercase">
            Friends who joined
          </p>
          <p className="text-secondary text-[10px] font-semibold">
            {joined.length} joined
          </p>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {Array.from({ length: slots }).map((_, i) => {
            const f = joined[i];
            if (f) {
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="bg-pink-gradient relative aspect-square w-full overflow-hidden rounded-xl">
                    <span className="font-display absolute inset-0 flex items-center justify-center text-base font-bold text-white">
                      {f.initials}
                    </span>
                    <span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
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
                  Invite
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
            title: "Come join me on Mesita",
            text: "Join me on Mesita — your seat at the table.",
          }}
        />
      </div>
    </div>
  );
}

// ─── Partner cards (businesses + the three agency programs) ────────────────

type PartnerGroup = {
  id: string;
  title: string;
  icon: LucideIcon;
  iconBg: string;
  body: string;
  share: SharePayload;
};

const PARTNERS: PartnerGroup[] = [
  {
    id: "businesses",
    title: "Restaurants & bars",
    icon: UtensilsCrossed,
    iconBg: "bg-pink-gradient text-white",
    body: "More customers from priority placement on swipe, map, and catalog — with higher spend and repeat visits. Setup takes ~8 minutes in any browser.",
    share: {
      title: "Mesita for restaurants",
      text: "I think you'd love Mesita — setup is ~8 min and free to start.",
      url: "https://www.mesita.ai",
    },
  },
  {
    id: "influencers",
    title: "Influencers",
    icon: Megaphone,
    iconBg: "bg-violet-500 text-white",
    body: "Create content about travel, food, nightlife or lifestyle? You just found a gold mine. 20% of Mesita's equity is reserved for creators. Let's partner.",
    share: {
      title: "Mesita for creators",
      text: "Mesita reserves 20% of its equity for creators — you should partner with them.",
      url: "https://www.mesita.ai",
    },
  },
  {
    id: "agencies",
    title: "Marketing agencies",
    icon: Briefcase,
    iconBg: "bg-sky-500 text-white",
    body: "Do you manage marketing for restaurants or bars? Add Mesita to your stack.",
    share: {
      title: "Mesita for marketing agencies",
      text: "If you run marketing for restaurants or bars, Mesita is worth adding to your stack.",
      url: "https://www.mesita.ai",
    },
  },
  {
    id: "models",
    title: "Model & talent agencies",
    icon: Star,
    iconBg: "bg-tier-premium text-white",
    body: "Our partner places want your talent in the room to enhance the ambience. Make all your talent Mesita Premium, for free, no tricks.",
    share: {
      title: "Mesita for talent agencies",
      text: "Mesita makes your talent Premium for free — partner places want them in the room.",
      url: "https://www.mesita.ai",
    },
  },
];

function PartnerCard({ group: g }: { group: PartnerGroup }) {
  const Icon = g.icon;
  const [flash, setFlash] = useState<null | "shared" | "copied">(null);
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
        <button
          type="button"
          onClick={() => runShare(g.share, setFlash)}
          className="bg-foreground text-background flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-semibold transition hover:opacity-90"
        >
          {flash === "shared" ? (
            <>
              <Check className="h-4 w-4" />
              Shared
            </>
          ) : flash === "copied" ? (
            <>
              <Check className="h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" />
              Share
            </>
          )}
        </button>
        <a
          href={mailto}
          className="border-border bg-card text-foreground hover:bg-muted flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-[13px] font-semibold transition"
        >
          Contact
          <ChevronRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
