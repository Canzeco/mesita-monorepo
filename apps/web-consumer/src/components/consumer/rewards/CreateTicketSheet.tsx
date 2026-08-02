"use client";

// "Start a ticket" — the Tickets v2 create flow (MESITA-806): pick the place,
// optionally opt into the Story bonus (Influencer-exclusive, segments v6),
// create. Welcome is deliberately NOT a toggle: the server detects a first
// visit at billing time, so the sheet only explains it. The place search
// rides consumer-web-suggest-places and offers only on-Mesita rows (a web
// listing can't run rewards).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  DoorOpen,
  Instagram,
  Loader2,
  Search,
  Sparkles,
  Star,
} from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { useConsumerClass } from "@/lib/class-context";
import { apiSuggestPlaces, type PlacePrediction } from "@/lib/api/places";
import { apiCreateTicket } from "@/lib/api/tickets";
import { newSessionToken } from "@/components/consumer/search/search-utils";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

// Verified partners run the program; web listings and off-Mesita rows don't.
const ELIGIBLE = new Set(["verified_partner_other", "verified_partner_self"]);

export function CreateTicketSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const supabase = useBrowserSupabase();
  const { key: classKey } = useConsumerClass();
  const isInfluencer = classKey === "influencer";

  // NB the sheet is remounted per open (keyed by the parent), so state
  // starts clean without a reset effect — the React 19 set-state-in-effect
  // rule forbids the sync-reset pattern.
  const [input, setInput] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<PlacePrediction | null>(null);
  const [wantsStory, setWantsStory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef = useRef(newSessionToken());

  // Debounced suggest — 300ms, mirrors discovery-zone-field. All setState
  // happens inside the async timeout callback, never sync in the effect.
  useEffect(() => {
    if (!open || picked) return;
    const trimmed = input.trim();
    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (trimmed.length < 2) {
        if (!cancelled) setPredictions([]);
        return;
      }
      if (!cancelled) setSearching(true);
      try {
        const rows = await apiSuggestPlaces(
          supabase,
          trimmed,
          sessionTokenRef.current,
        );
        if (!cancelled) setPredictions(rows);
      } catch {
        if (!cancelled) setPredictions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, trimmed.length < 2 ? 0 : 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [input, open, picked, supabase]);

  const eligible = useMemo(
    () => predictions.filter((p) => ELIGIBLE.has(p.status) && (p.mesitaId || p.mesitaSlug)),
    [predictions],
  );

  const create = useCallback(async () => {
    if (!picked?.mesitaId) return;
    setCreating(true);
    setError(null);
    try {
      await apiCreateTicket(supabase, picked.mesitaId, wantsStory);
      await onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't create the ticket.",
      );
    } finally {
      setCreating(false);
    }
  }, [picked, wantsStory, supabase, onCreated, onClose]);

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Start a ticket">
      <div className="flex flex-col gap-4 px-5 pt-4 pb-8">
        <div className="flex items-center gap-2.5">
          <span className="bg-pink-gradient grid size-9 place-items-center rounded-xl text-white">
            <Sparkles className="size-[18px]" />
          </span>
          <div>
            <h2 className="text-foreground text-lg leading-tight font-bold tracking-tight">
              Start a ticket
            </h2>
            <p className="text-muted-foreground text-[12px]">
              Pick the place — your QR is the ticket.
            </p>
          </div>
        </div>

        {/* Place picker */}
        {picked ? (
          <div className="border-border bg-muted/40 flex items-center gap-3 rounded-2xl border px-3.5 py-3">
            <BadgeCheck className="size-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold">{picked.mainText}</p>
              <p className="text-muted-foreground truncate text-[11px]">
                {picked.secondaryText}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="text-muted-foreground text-[12px] font-semibold underline-offset-2 hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="border-border bg-card flex items-center gap-2 rounded-2xl border px-3.5">
              <Search className="text-muted-foreground size-4 shrink-0" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search the place you're visiting"
                className="text-foreground placeholder:text-muted-foreground h-11 w-full bg-transparent text-sm outline-none"
              />
              {searching ? (
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              ) : null}
            </div>
            {eligible.length > 0 ? (
              <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border">
                {eligible.slice(0, 5).map((p) => (
                  <li key={p.placeId}>
                    <button
                      type="button"
                      onClick={() => setPicked(p)}
                      className="hover:bg-muted/50 flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition"
                    >
                      <BadgeCheck className="size-4 shrink-0 text-emerald-600" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold">
                          {p.mainText}
                        </span>
                        <span className="text-muted-foreground block truncate text-[11px]">
                          {p.secondaryText}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : input.trim().length >= 2 && !searching ? (
              <p className="text-muted-foreground px-1 text-[12px]">
                No Verified Partners match — only Verified places run Mesita
                rewards.
              </p>
            ) : null}
          </div>
        )}

        {/* Bonuses */}
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
            Your bonuses
          </p>

          <div className="border-border flex items-start gap-3 rounded-2xl border px-3.5 py-3">
            <span className="bg-secondary/10 text-secondary grid size-8 shrink-0 place-items-center rounded-lg">
              <DoorOpen className="size-4" />
            </span>
            <p className="text-muted-foreground text-[12px] leading-snug">
              <span className="text-foreground font-semibold">Welcome Visit.</span>{" "}
              Applied automatically if it&apos;s your first time at this place —
              nothing to select.
            </p>
          </div>

          {isInfluencer ? (
            <button
              type="button"
              onClick={() => setWantsStory((v) => !v)}
              aria-pressed={wantsStory}
              className={cn(
                "flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition",
                wantsStory
                  ? "border-secondary/40 bg-secondary/5"
                  : "border-border",
              )}
            >
              <span className="bg-secondary/10 text-secondary grid size-8 shrink-0 place-items-center rounded-lg">
                <Instagram className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-[13px] font-semibold">
                  Instagram Story — yours alone
                </span>
                <span className="text-muted-foreground block text-[12px] leading-snug">
                  Post a tagged story at the table for a bigger reward.
                </span>
              </span>
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold",
                  wantsStory
                    ? "border-secondary bg-secondary text-white"
                    : "border-border text-transparent",
                )}
              >
                ✓
              </span>
            </button>
          ) : null}

          <div className="border-border flex items-start gap-3 rounded-2xl border px-3.5 py-3">
            <span className="bg-secondary/10 text-secondary grid size-8 shrink-0 place-items-center rounded-lg">
              <Star className="size-4" />
            </span>
            <p className="text-muted-foreground text-[12px] leading-snug">
              <span className="text-foreground font-semibold">Google Review.</span>{" "}
              Available at the table, once per place — you can add it during
              the visit.
            </p>
          </div>
        </div>

        {error ? (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-[12.5px]">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!picked?.mesitaId || creating}
          onClick={() => void create()}
          className="bg-pink-gradient shadow-glow flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
        >
          {creating ? <Loader2 className="size-4 animate-spin" /> : null}
          Create my ticket
        </button>
      </div>
    </LocalSheet>
  );
}
