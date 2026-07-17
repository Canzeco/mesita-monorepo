// Pure bill text parsers for Staff WhatsApp (no session/context I/O).

import { extractConsumerCodeFromText } from "./consumer-code.ts";

/** Remove guest codes so 1234-5678 850 100 does not treat code digits as money. */
export function stripConsumerCodesForBillParse(text: string): string {
  let t = text;
  const code = extractConsumerCodeFromText(text);
  if (code) {
    t = t.replace(code, " ");
    t = t.replace(code.replace("-", " "), " ");
    t = t.replace(code.replace("-", ""), " ");
  }
  t = t.replace(/\b[0-9]{4}[-\s]?[0-9]{4}\b/g, " ");
  t = t.replace(/\b[0-9]{8}\b/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

/** Parse subtotal/tip from one message (may be partial). */
export function parseBillParts(text: string): {
  subtotal_cents: number | null;
  tip_cents: number | null;
} {
  const t = stripConsumerCodesForBillParse(text.replace(/,/g, "")).trim();
  if (!t) return { subtotal_cents: null, tip_cents: null };

  const lower = t.toLowerCase();

  if (/^(sin\s+propina|sin\s+tip|propina\s+0|tip\s+0|no\s+tip|nada\s+de\s+propina)\b/i.test(
    lower,
  )) {
    return { subtotal_cents: null, tip_cents: 0 };
  }

  const plusPair = t.match(
    /([0-9]+(?:\.[0-9]{1,2})?)\s*(?:\+|y|and|mas|más|con)\s*(?:propina\s+)?([0-9]+(?:\.[0-9]{1,2})?)/i,
  );
  if (plusPair) {
    return {
      subtotal_cents: moneyToCents(plusPair[1]),
      tip_cents: moneyToCents(plusPair[2]),
    };
  }

  const subtotalMatch = t.match(
    /(?:subtotal|subtot|cuenta|bill|total\s+de\s+cuenta)[:\s]*\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
  );
  const tipMatch = t.match(
    /(?:tip|propina|prop)[:\s]*\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
  );

  if (subtotalMatch) {
    return {
      subtotal_cents: moneyToCents(subtotalMatch[1]),
      tip_cents: tipMatch ? moneyToCents(tipMatch[1]) : null,
    };
  }

  if (tipMatch) {
    return {
      subtotal_cents: null,
      tip_cents: moneyToCents(tipMatch[1]),
    };
  }

  const cuentaPhrase = t.match(
    /(?:cuenta|total|son|fue|eran|sale|qued[oó])\s*(?:en|de)?\s*\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
  );
  if (cuentaPhrase && !tipMatch) {
    return {
      subtotal_cents: moneyToCents(cuentaPhrase[1]),
      tip_cents: null,
    };
  }

  const dollarNums = [...t.matchAll(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g)]
    .map((m) => moneyToCents(m[1]))
    .filter((n): n is number => n != null);

  if (dollarNums.length >= 2) {
    return { subtotal_cents: dollarNums[0], tip_cents: dollarNums[1] };
  }
  if (dollarNums.length === 1) {
    return { subtotal_cents: dollarNums[0], tip_cents: null };
  }

  const nums = [...t.matchAll(/([0-9]+(?:\.[0-9]{1,2})?)/g)]
    .map((m) => moneyToCents(m[1]))
    .filter((n): n is number => n != null);

  if (nums.length >= 2) {
    return { subtotal_cents: nums[0], tip_cents: nums[1] };
  }

  if (nums.length === 1) {
    return { subtotal_cents: nums[0], tip_cents: null };
  }

  return { subtotal_cents: null, tip_cents: null };
}

export function hasBillLabels(text: string): boolean {
  return /(?:subtotal|subtot|cuenta|bill|tip|propina|prop|total)\b/i.test(text);
}

export function messageLooksLikeBill(body: string): boolean {
  const parts = parseBillParts(body);
  if (parts.subtotal_cents != null || parts.tip_cents != null) return true;
  return /^(sin\s+propina|sin\s+tip)/i.test(body.trim());
}

export function moneyToCents(v: string): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
