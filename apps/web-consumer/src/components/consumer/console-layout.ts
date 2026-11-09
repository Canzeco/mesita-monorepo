"use client";

import { useSyncExternalStore } from "react";

import {
  type ConsoleMode,
  readConsoleMode,
  readConsoleModeOnServer,
  subscribeConsoleMode,
} from "@/lib/console-mode";

// WHERE THE DESKTOP EMULATOR SITS, PER CONSOLE MODE (MESITA-3580). Pato:
// "center shit if only phone or if only phone and ef".
//   - phone: the 30rem card alone, centered.
//   - functions: card + 0.75rem gap + 26rem call log (56.75rem), centered
//     as one group.
//   - terminal: card at the left edge, 1rem in; the log and the
//     request/response panel fill the rest.
// Never closer than 1rem to the window's left edge (the max()).
// Whole literals, so Tailwind sees every class.

export function useConsoleMode(): ConsoleMode {
  return useSyncExternalStore(
    subscribeConsoleMode,
    readConsoleMode,
    readConsoleModeOnServer,
  );
}

/** The frame's left padding: where the card's left edge lands. */
export const CARD_INSET: Record<ConsoleMode, string> = {
  phone: "md:pl-[max(1rem,calc(50%-15rem))]",
  functions: "md:pl-[max(1rem,calc(50%-28.375rem))]",
  terminal: "md:pl-4",
};

/** 0.75rem right of the card: the call log and the route badge. */
export const BESIDE_CARD: Record<ConsoleMode, string> = {
  phone: "md:left-[max(31.75rem,calc(50%+15.75rem))]",
  functions: "md:left-[max(31.75rem,calc(50%+2.375rem))]",
  terminal: "md:left-[31.75rem]",
};
