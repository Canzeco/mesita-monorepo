/**
 * The type scale, as DATA.
 *
 * Docs > Design writes the law in ROLES ("eyebrow", "group label", "dense
 * meta"); the code wrote it in PIXELS. That mismatch is why 21 distinct
 * arbitrary sizes accumulated with nothing to bind them to. This module is the
 * binding surface: `globals.css` generates the `type-*` utilities from it, and
 * the ESLint guard asserts against it. One source, two consumers.
 *
 * THREE RULES, each learned the hard way:
 *
 * 1. VALUES ARE REM, NEVER PX. `text-[12px]` is frozen at 12px for every
 *    guest; `text-xs` (0.75rem) scales with their browser font-size setting.
 *    Both ticket files used zero named sizes, so THE TICKET did not respond to
 *    that setting at all. Snapping an off-scale size to the nearest PX would
 *    have made the lock permanent — always snap to a rem token.
 *
 * 2. THE PREFIX IS `type-`, NEVER `text-`. web-consumer's `cn()` is
 *    `twMerge(clsx(...))`, and tailwind-merge classifies any unrecognized
 *    `text-<word>` as a text COLOUR, so it silently drops the loser:
 *      twMerge("text-eyebrow", "text-white/70")  =>  "text-white/70"
 *    The size vanishes with green typecheck, lint and tests. `type-eyebrow`
 *    passes through untouched. web-admin has no cn(), so it would never
 *    reproduce there — which makes it worse, not better.
 *
 * 3. THIS FILE STAYS PLATFORM-FREE. No CSS, no React, no imports. apps/
 *    mobile-consumer is NativeWind and has no `@utility` layer; keeping the
 *    roles as plain data is what lets that app consume them when it unfreezes,
 *    the same property that lets ticket-journey.ts be byte-shared today.
 *
 * Widening the set is a NOTION edit first, then this file, in that order and
 * in the same session. A role that exists only in code is drift with a nicer
 * name. (MESITA-1220)
 */

export type TypeRole = {
  /** Utility suffix: `type-<name>`. Must be a word Docs > Design uses. */
  name: string;
  /** rem, always. See rule 1. */
  size: string;
  weight?: string;
  tracking?: string;
  transform?: "uppercase";
  /** Which Docs > Design role this encodes, for the guard's message. */
  doc: string;
};

/** Sub-`text-xs` sizes the law needs and Tailwind's named scale does not cover. */
export const TYPE_ROLES: readonly TypeRole[] = [
  {
    name: "meta",
    size: "0.625rem", // 10px at root 16 — §D's documented FLOOR
    doc: "§C dense meta / §D eyebrow-meta lower bound",
  },
  {
    name: "label",
    size: "0.6875rem", // 11px
    doc: "§C group label size / §C dense meta upper bound",
  },
  {
    name: "body",
    size: "0.8125rem", // 13px
    doc: "§C field label (manage) / §D body",
  },
  {
    name: "eyebrow",
    size: "0.75rem", // 12px
    weight: "500",
    tracking: "0.14em",
    transform: "uppercase",
    doc: "§C eyebrow / §D eyebrow-meta",
  },
] as const;

/**
 * Tailwind's named steps are all rem and all legal. Listed so the guard can
 * name the alternative in its failure message rather than just saying "no".
 */
export const NAMED_STEPS = [
  "text-xs",
  "text-sm",
  "text-base",
  "text-lg",
  "text-xl",
  "text-2xl",
  "text-3xl",
  "text-4xl",
  "text-5xl",
  "text-6xl",
] as const;

/**
 * The ONLY arbitrary font-size values that may still appear literally.
 * Everything else is a role or a named step.
 *
 * `clamp()` is permitted for fluid display type: a machine computed it, and a
 * fluid ramp is the one legitimate source of a fractional size. A fractional
 * px a HUMAN typed is always a bug — 0.5px at 11px is a 4.5% step, and a
 * perceptible type step needs roughly 12%, so it reads as misalignment rather
 * than rank.
 */
export const ALLOWED_ARBITRARY = /^(clamp\(|length:var\(|[0-9.]+rem$)/;

/** Tracking on the uppercase idiom. Two values, per §C. */
export const LEGAL_TRACKING = ["0.12em", "0.14em"] as const;
