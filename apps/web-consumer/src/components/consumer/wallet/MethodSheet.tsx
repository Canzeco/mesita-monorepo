"use client";

import { useState } from "react";
import { Banknote, ChevronLeft, QrCode } from "lucide-react";
import { PANEL_CLASS, PanelHeading } from "@/components/shared/Panel";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { brandLabel, expiryLabel, type SavedCard } from "@/lib/api/cards";
import { EFError } from "@/lib/api/_invoke";
import { apiEmulateStory, money, STORY_EMULATOR_REFUSAL, type WaitingStory } from "@/lib/api/wallet";
import { storyLine } from "@/lib/story-lines";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { TestModeNote } from "@/components/consumer/activity/TicketParts";
import { cardFace } from "@/components/shared/card-brand-marks";
import { cn } from "@/lib/utils";
import { SECONDARY } from "./wallet-buttons";
import { useStoryNow } from "./use-story-now";

// A PAYMENT METHOD, FULL SCREEN (Pato, MESITA-3533): a saved card or a
// Story whose bonus is waiting (MESITA-4296), opened from a Wallet rail. A place's credit is a
// page of its own, /wallet/place/<placeId> (PlaceCredit.tsx, MESITA-3614).

export type Method =
  | { kind: "card"; card: SavedCard }
  | { kind: "story"; story: WaitingStory }
  | { kind: "cash" };

export function MethodSheet({
  method: opened,
  onClose,
  onRemoveCard,
  stories,
  onStoryChanged,
}: {
  method: Method | null;
  onClose: () => void;
  /** Remove a saved card (MESITA-3523); resolves once the server answered. */
  onRemoveCard?: (card: SavedCard) => Promise<void>;
  /** The Wallet's current Story vouchers (MESITA-4264): an open Story sheet
   *  shows the newest read of its own voucher, not the one it opened on. */
  stories?: WaitingStory[];
  /** A simulated story changed the voucher: read the Wallet again. */
  onStoryChanged?: () => void;
}) {
  const fresh = opened?.kind === "story" ? stories?.find((s) => s.purchase_id === opened.story.purchase_id) : undefined;
  const method: Method | null = fresh ? { kind: "story", story: fresh } : opened;
  const title = method?.kind === "cash"
      ? "Cash"
      : method?.kind === "story"
      ? "Story voucher"
      : method?.kind === "card"
        ? `${brandLabel(method.card.brand)} •••• ${method.card.last4}`
        : "Card · Apple Pay · Google Pay";
  return (
    <LocalSheet open={method !== null} onClose={onClose} ariaLabel={title} fullScreen>
      <div className="border-border flex items-center gap-2 border-b px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="hover:bg-muted flex h-11 w-11 items-center justify-center rounded-xl transition"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <h2 className="min-w-0 truncate text-base font-semibold">{title}</h2>
      </div>
      <div className="scrollbar-thin-dark flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-5 pb-8">
        {method?.kind === "card" ? <CardBody card={method.card} onRemove={onRemoveCard} /> : null}
        {method?.kind === "story" ? <StoryBody story={method.story} onChanged={onStoryChanged} /> : null}
        {method?.kind === "cash" ? <CashBody /> : null}
      </div>
    </LocalSheet>
  );
}

/** A saved card (MESITA-3523): what Stripe told us about it, and Remove.
 *  A card a Premier plan renews with says so and offers no Remove. */
function CardBody({ card, onRemove }: { card: SavedCard; onRemove?: (card: SavedCard) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const face = cardFace(card.brand, brandLabel(card.brand));
  return (
    <>
      <div className={cn("flex aspect-[1.586/1] w-full flex-col justify-between rounded-2xl p-5", face.className)} style={face.style}>
        {face.mark}
        <div>
          <p className="text-xl font-semibold tabular-nums">•••• {card.last4}</p>
          <p className="mt-0.5 text-sm tabular-nums opacity-70">Expires {expiryLabel(card)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed">
        <p>Saved on your Mesita account. Stripe keeps the card number; Mesita only sees the last four digits.</p>
        {card.in_use ? <p data-card-in-use>This card pays your Premier plan. To remove it, change the plan&apos;s card first.</p> : null}
      </div>
      {card.in_use || !onRemove ? null : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onRemove(card).finally(() => setBusy(false));
          }}
          className={`${SECONDARY} mt-5 disabled:opacity-60`}
          data-card-remove
        >
          {busy ? "Removing…" : "Remove card"}
        </button>
      )}
    </>
  );
}

/** A Story voucher (MESITA-4296): the story was found before payment and
 *  what was paid is already credit; the bonus lands 3 hours after payment if
 *  the story is still up. The story the voucher stands on shows here. In
 *  test mode, while Instagram is not connected, the test band can delete the
 *  story so the re-check finds it gone. */
function StoryBody({ story, onChanged }: { story: WaitingStory; onChanged?: () => void }) {
  const getSupabase = useLazyBrowserSupabase();
  const [busy, setBusy] = useState(false);
  // The countdown moves on every minute and turns to "Checking…" on time.
  const now = useStoryNow([story]);

  const simulateDelete = async () => {
    setBusy(true);
    try {
      await apiEmulateStory(getSupabase(), "delete");
      onChanged?.();
    } catch (err) {
      const code = err instanceof EFError ? err.code : null;
      toast((code && STORY_EMULATOR_REFUSAL[code]) || STORY_EMULATOR_REFUSAL.emulate_failed, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const name = story.place?.name ?? "this place";
  const media = story.mention?.media_url ? story.mention : null;
  return (
    <div className="flex flex-col items-center gap-4 text-center" data-story-sheet={story.state}>
      <div className="flex flex-col gap-1">
        <p className="text-2xl font-bold tabular-nums">+{money(story.bonus_cents, story.currency)} bonus</p>
        <p className="text-sm leading-relaxed" data-story-line aria-live="polite">
          {storyLine(story, now)}
        </p>
        <p className="text-muted-foreground text-sm tabular-nums">
          {money(story.amount_cents, story.currency)} you paid is already your credit at {name}.
        </p>
      </div>
      {media ? (
        <div className="bg-muted aspect-[9/16] w-3/5 overflow-hidden rounded-2xl" data-story-media={media.media_kind}>
          {media.media_kind === "video" ? (
            <video src={media.media_url ?? undefined} className="h-full w-full object-cover" playsInline muted controls preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- the story's own media URL
            <img src={media.media_url ?? undefined} alt="Your story" className="h-full w-full object-cover" />
          )}
        </div>
      ) : null}
      {story.emulator && story.state === "waiting" ? (
        // THE TEST BAND (MESITA-4264): under the main content, never the
        // primary button; only while payments are in test mode and Meta is off.
        <div className="border-border flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed p-3" data-story-emulator>
          <TestModeNote className="self-center" />
          <button
            type="button"
            disabled={busy}
            onClick={() => void simulateDelete()}
            className="text-muted-foreground min-h-11 px-3 text-sm font-semibold underline disabled:opacity-60"
            data-story-simulate="delete"
          >
            {busy ? "Deleting…" : "Simulate deleting the story"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Cash (MESITA-4116; redesigned MESITA-4125, Pato: "don't make cash look as
 *  a card ... just mention like pay with cash, or pay in their terminal ...
 *  redesign this page from scratch"). No card face: two panels and a line.
 *  How you pay: cash, or the place's terminal, both outside the app. Every
 *  icon disc is grey (MESITA-4129, Pato: "why all fucking green").
 *  The rates are the most a place gives; each place turns either on or off. */
function CashBody() {
  return (
    // KEEP IT SIMPLE (MESITA-4129, Pato: "remove the box How to Pay, just
    // say in description Cash or terminal outside of Mesita App ... don't
    // overexplain"): one panel, two rows, no footnote.
    <div className="flex flex-col gap-4">
      <section className={cn(PANEL_CLASS, "divide-border flex flex-col divide-y")} aria-label="Ways to pay">
        <div className="px-4 pt-4 pb-3">
          <PanelHeading>Ways to pay</PanelHeading>
        </div>
        <WayLine
          icon={<QrCode className="h-5 w-5" />}
          tone="bg-foreground text-white"
          title="Mesita Pay"
          line="In the Mesita app"
        />
        <WayLine
          icon={<Banknote className="h-5 w-5" />}
          tone="bg-muted text-foreground"
          title="Cash or terminal"
          line="Outside the Mesita app"
        />
      </section>
    </div>
  );
}

function WayLine({
  icon,
  tone,
  title,
  line,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  line: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone)} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="text-muted-foreground block text-sm">{line}</span>
      </span>
    </div>
  );
}
