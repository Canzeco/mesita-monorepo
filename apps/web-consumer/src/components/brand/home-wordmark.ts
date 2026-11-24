import { Outfit } from "next/font/google";

const wordmarkFont = Outfit({ subsets: ["latin"], weight: "700" });

/** The word "Mesita" as Home's and the Wallet's headers write it (Pato,
 *  MESITA-4830: "i like the one in home"): set as type, not a drawn logo
 *  (MESITA-2480). A BIT TALLER (Pato, 2026-11-23, MESITA-4758): text-3xl,
 *  30px; 24px before. Not a client module: the Wallet's loading frame reads
 *  it on the server. */
export const HOME_WORDMARK_CLASS = `${wordmarkFont.className} text-foreground shrink-0 text-3xl leading-none tracking-[-0.03em] select-none`;
