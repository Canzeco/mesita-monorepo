"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

// The Invite page is just five gift cards — one per audience — each a
// standard-size gradient card with its own Share button on top. No codes, no
// rewards, no tabs. The header (SimpleHeader title="Invite") is owned by the
// shell layout via TopBar.
//
// Order (Pato, 2026-07-05): Consumers · Businesses · Influencers · Marketing
// agencies · Modeling agencies.

type GiftCard = {
  id: string;
  audience: string;
  line: string;
  /** Card gradient — differentiated per audience. */
  gradient: string;
  share: { title: string; text: string; url?: string };
};

const CARDS: GiftCard[] = [
  {
    id: "consumers",
    audience: "Invite a friend",
    line: "Your seat at the table.",
    gradient: "bg-pink-gradient",
    share: {
      title: "Come join me on Mesita",
      text: "Join me on Mesita — your seat at the table.",
    },
  },
  {
    id: "businesses",
    audience: "Restaurants & bars",
    line: "More customers, higher spend. Setup takes ~8 minutes.",
    gradient: "bg-gradient-to-br from-amber-400 to-orange-500",
    share: {
      title: "Mesita for restaurants",
      text: "I think you'd love Mesita — setup is ~8 min and free to start.",
      url: "https://www.mesita.ai",
    },
  },
  {
    id: "influencers",
    audience: "Influencers",
    line: "20% of Mesita's equity is reserved for creators.",
    gradient: "bg-gradient-to-br from-fuchsia-500 to-purple-600",
    share: {
      title: "Mesita for creators",
      text: "Mesita reserves 20% of its equity for creators — you should partner with them.",
      url: "https://www.mesita.ai",
    },
  },
  {
    id: "agencies",
    audience: "Marketing agencies",
    line: "Manage restaurants or bars? Add Mesita to your stack.",
    gradient: "bg-gradient-to-br from-sky-400 to-blue-600",
    share: {
      title: "Mesita for marketing agencies",
      text: "If you run marketing for restaurants or bars, Mesita is worth adding to your stack.",
      url: "https://www.mesita.ai",
    },
  },
  {
    id: "models",
    audience: "Model & talent agencies",
    line: "Your talent, Mesita Premium — free, no tricks.",
    gradient: "bg-gradient-to-br from-neutral-800 to-neutral-950",
    share: {
      title: "Mesita for talent agencies",
      text: "Mesita makes your talent Premium for free — partner places want them in the room.",
      url: "https://www.mesita.ai",
    },
  },
];

export default function SharePage() {
  return (
    <div className="scrollbar-hide h-full overflow-y-auto px-4 pt-4 pb-6">
      <div className="flex flex-col gap-3">
        {CARDS.map((card) => (
          <GiftCardTile key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

function GiftCardTile({ card }: { card: GiftCard }) {
  const [flash, setFlash] = useState<null | "shared" | "copied">(null);
  const onShare = async () => {
    const payload = {
      title: card.share.title,
      text: card.share.text,
      url: card.share.url ?? window.location.origin,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload);
        setFlash("shared");
        window.setTimeout(() => setFlash(null), 1600);
        return;
      } catch {
        // Cancelled or refused — fall through to clipboard copy.
      }
    }
    try {
      await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
      setFlash("copied");
      window.setTimeout(() => setFlash(null), 1600);
    } catch {
      // Clipboard unavailable — fail silently.
    }
  };

  return (
    <div
      className={cn(
        "shadow-glow relative flex min-h-[150px] flex-col overflow-hidden rounded-2xl p-5 text-white",
        card.gradient,
      )}
    >
      {/* Button on top: eyebrow (left) + Share (right). */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold tracking-[0.2em] text-white/80 uppercase">
          Mesita · Gift card
        </p>
        <button
          type="button"
          onClick={onShare}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur transition hover:bg-white/25"
        >
          {flash === "shared" ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Shared
            </>
          ) : flash === "copied" ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5" />
              Share
            </>
          )}
        </button>
      </div>

      {/* Audience + one-liner pinned to the bottom so every card reads the
          same regardless of copy length. */}
      <div className="mt-auto pt-6">
        <p className="font-display text-2xl leading-tight font-semibold tracking-tight">
          {card.audience}
        </p>
        <p className="mt-1.5 text-[13px] text-white/85">{card.line}</p>
      </div>
    </div>
  );
}
