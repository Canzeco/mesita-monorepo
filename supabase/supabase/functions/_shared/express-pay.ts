// Express pay's pure pieces (MESITA-4384): which wallets a setup offers and
// the line the Apple Pay / Google Pay sheet shows.

import type { ExpressWallet } from "./money-config.ts";
import type { WalletDomains } from "./pm-domains.ts";

/** The wallet sheet's line is at most this long. */
export const EXPRESS_LABEL_MAX = 60;

/** The kill switch's list, narrowed to the wallets whose domain is active
 *  on the place's account, in the switch's order. Pure. */
export function expressWalletsFor(allowed: readonly ExpressWallet[], domains: WalletDomains): ExpressWallet[] {
  return allowed.filter((w) => domains[w]);
}

/** "<voucher> · <place>": control characters stripped, spaces collapsed,
 *  trimmed and capped at 60 characters (an ellipsis when cut). Pure. */
export function expressLabel(voucher: string, placeName: string | null): string {
  // deno-lint-ignore no-control-regex
  const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim();
  const place = clean(placeName ?? "") || "Mesita";
  const full = `${clean(voucher)} · ${place}`;
  const chars = Array.from(full);
  return chars.length <= EXPRESS_LABEL_MAX ? full : `${chars.slice(0, EXPRESS_LABEL_MAX - 1).join("").trimEnd()}…`;
}
