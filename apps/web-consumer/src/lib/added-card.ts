"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

// ADD A CARD IS A MODAL (MESITA-4398, Pato, 2026-11-18: "card must not be
// another page. it must be a modal."; reverses MESITA-4092/4101's page).
// Every Add a card (Wallet, Pay's Method, the Offers page, the member tab)
// opens ONE modal, AddCardModal, mounted once in the shell. The opener hands
// a callback; on save the modal calls it with the new card's id and closes,
// so the screen under it never moved and selects or lists the card at once.
// /wallet/cards/new (AddCardPage) stays only for old links.

type Opened = { onAdded: (paymentMethodId: string) => void } | null;

let opened: Opened = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function openAddCardModal(onAdded: (paymentMethodId: string) => void = () => {}): void {
  opened = { onAdded };
  emit();
}

export function closeAddCardModal(): void {
  opened = null;
  emit();
}

/** AddCardModal's view of the store: who opened it, or null when closed. */
export function useAddCardModalState(): Opened {
  return useSyncExternalStore(subscribe, () => opened, () => null);
}

/** Opens the Add a card modal; on save calls `onAdded` with the new card's
 *  id, once. */
export function useAddCardModal(onAdded: (paymentMethodId: string) => void): () => void {
  const latest = useRef(onAdded);
  useEffect(() => {
    latest.current = onAdded;
  });
  return useCallback(() => openAddCardModal((id) => latest.current(id)), []);
}

// ---- The old page's hand-back (/wallet/cards/new?pick=1), kept for old links.

const KEY = "mesita.added-card";
/** The query that asks AddCardPage to hand the card back. */
export const PICK_PARAM = "pick";

/** AddCardPage, on save: leave the id for the screen under it. */
export function handOverAddedCard(paymentMethodId: string): void {
  try {
    window.sessionStorage.setItem(KEY, paymentMethodId);
  } catch {
    // The card is saved either way; the screen just won't preselect it.
  }
}
