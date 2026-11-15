"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";

// ADD A CARD, FROM THE MIDDLE OF A PURCHASE (MESITA-4101, Pato: "add card as
// its own subpage everywhere"). Pay's Method step, the Offers page and the
// member tab push /wallet/cards/new?pick=1 (AddCardPage); on save the page
// leaves the new card's id here and goes Back, and the screen that opened it
// takes the id once and selects that card. It is taken on mount AND on every
// return to the screen's address, so it lands whether the screen remounted
// or stayed mounted under the page. Wallet's own Add a card has no ?pick:
// Wallet reads again and lists it.

const KEY = "mesita.added-card";
/** The query that asks AddCardPage to hand the card back. */
export const PICK_PARAM = "pick";

export function addCardPickHref(): string {
  return `${CONSUMER_ROUTES.walletAddCard}?${PICK_PARAM}=1`;
}

/** AddCardPage, on save: leave the id for the screen under it. */
export function handOverAddedCard(paymentMethodId: string): void {
  try {
    window.sessionStorage.setItem(KEY, paymentMethodId);
  } catch {
    // The card is saved either way; the screen just won't preselect it.
  }
}

function takeAddedCard(): string | null {
  try {
    const id = window.sessionStorage.getItem(KEY);
    if (id) window.sessionStorage.removeItem(KEY);
    return id;
  } catch {
    return null;
  }
}

/** Opens the Add a card page and, back here, calls `onAdded` with the new
 *  card's id, once. */
export function useAddCardPage(onAdded: (paymentMethodId: string) => void): () => void {
  const router = useRouter();
  const pathname = usePathname();
  const latest = useRef(onAdded);
  useEffect(() => {
    latest.current = onAdded;
  });
  useEffect(() => {
    const id = takeAddedCard();
    if (id) latest.current(id);
  }, [pathname]);
  return () => navigateTo(router, addCardPickHref(), { motion: "push" });
}
