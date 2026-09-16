"use client";

// A SNAPSHOT of apps/web-business/src/components/admin-ui/manage.tsx — the
// shared admin manage kit: tinted icon chips, Fraunces titles, filled inputs.
//
// TRIMMED TO WHAT PROFILE RENDERS. The real file also carries SaveBar,
// SelectField, ConfirmDialog, Spinner, GroupLabel and CopyIdButton; none of
// them appear on this screen, and a mock that ships six unrendered components
// is six things nobody will notice going stale. The ones below are verbatim.
//
// Owned by nothing here — the real file is GENERATED from shared/manage.tsx by
// `deno task sync-shared`, and this copy is deliberately outside that
// generator. Re-snapshot by hand.

import { useState } from "react";
import { ChevronDown, ExternalLink, Lock } from "lucide-react";
import {
  COUNTRIES,
  COUNTRY_BY_CODE,
  combinePhoneE164,
  splitStoredPhone,
} from "@/lib/phone-countries";

/** Fixed tint palette for card icon chips — differentiated, never loud. */
export type Tint =
  | "rose"
  | "pink"
  | "amber"
  | "sky"
  | "violet"
  | "emerald"
  | "teal"
  | "orange"
  | "indigo"
  | "slate";

const TINT_CHIP: Record<Tint, string> = {
  rose: "bg-rose-500/10 text-rose-600",
  pink: "bg-pink-500/10 text-pink-600",
  amber: "bg-amber-500/10 text-amber-600",
  sky: "bg-sky-500/10 text-sky-600",
  violet: "bg-violet-500/10 text-violet-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  teal: "bg-teal-500/10 text-teal-600",
  orange: "bg-orange-500/10 text-orange-600",
  indigo: "bg-indigo-500/10 text-indigo-600",
  slate: "bg-muted text-muted-foreground",
};

export function SectionCard({
  id,
  icon,
  tint = "slate",
  title,
  subtitle,
  action,
  children,
}: {
  /** Optional scroll/focus target (e.g. completeness Menu → Menus). */
  id?: string;
  icon?: React.ReactNode;
  /** Icon-chip hue — keep sibling cards on different tints. */
  tint?: Tint;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="border-border bg-card shadow-card rounded-2xl border p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon != null && (
            <span
              className={
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
                TINT_CHIP[tint]
              }
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
            {subtitle && (
              <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

// Filled fields with a visible resting edge — a hairline border on the gray
// well makes fields read as fields on the white card (the old transparent
// border left them as faint smudges at a glance).
export const INPUT_BASE =
  "w-full rounded-xl border border-border/60 bg-muted/60 text-sm outline-none transition " +
  "placeholder:text-muted-foreground/50 focus:border-ring/60 focus:bg-card focus:ring-4 " +
  "focus:ring-ring/10 disabled:opacity-50";

export function TextField({
  label,
  icon,
  leading,
  labelRight,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  maxLength,
}: {
  label: string;
  /** Optional leading mark next to the label (brand SVG or lucide). */
  icon?: React.ReactNode;
  /** Optional adornment rendered inside the input's left edge. */
  leading?: React.ReactNode;
  /** Optional trailing accessory in the label row (e.g. an "Open ↗" link). */
  labelRight?: React.ReactNode;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  disabled?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="flex min-h-4 items-center justify-between gap-2">
        <span className="text-foreground/90 flex items-center gap-1.5 type-body font-medium">
          {icon}
          {label}
        </span>
        {labelRight}
      </span>
      <span className="relative block">
        {leading ? (
          <span className="pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 items-center">
            {leading}
          </span>
        ) : null}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          readOnly={!onChange}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={INPUT_BASE + " h-10 " + (leading ? "pr-3.5 pl-9" : "px-3.5")}
        />
      </span>
    </label>
  );
}

// Phone input with a dial-code + flag picker, ported from the consumer app's
// PhoneInputWithCountry and restyled to the admin filled-input language. The
// left chip is a styled "button" with a transparent native <select> overlaid,
// so desktop gets click-to-open and any touch device its proper picker.
//
// `value` is the FULL stored phone ("+527221234567" or legacy "+1 703-858-1102");
// onChange always emits strict E.164 (+<dial><digits>) — the update EF rejects
// phones without a country code, and the picker makes the +CC unforgettable.
export function PhoneField({
  label,
  value,
  onChange,
  placeholder = "55 1234 5678",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  // Draft = the country + local text as last typed/picked, kept only while it
  // still matches the stored value's digits. Typing keeps the user's spacing
  // and an empty local keeps the picked flag; an EXTERNAL value change (form
  // reset, place switch) mismatches and the derived split takes over. Pure
  // derivation — no sync effects.
  const [draft, setDraft] = useState<{
    code: string;
    local: string;
    digits: string;
  } | null>(null);
  const storedDigits = value.replace(/\D/g, "");
  const derived = splitStoredPhone(value);
  const active = draft && draft.digits === storedDigits ? draft : null;
  const code = active ? active.code : derived.countryCode;
  const local = active ? active.local : derived.local;
  const country = COUNTRY_BY_CODE[code] ?? COUNTRY_BY_CODE.MX;

  const update = (nextCode: string, nextLocal: string) => {
    const full = combinePhoneE164(nextCode, nextLocal);
    setDraft({ code: nextCode, local: nextLocal, digits: full.replace(/\D/g, "") });
    onChange(full);
  };

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-foreground/90 flex min-h-4 items-center type-body font-medium">
        {label}
      </span>
      <span
        className={
          "bg-muted/60 border-border/60 focus-within:border-ring/60 focus-within:bg-card " +
          "focus-within:ring-ring/10 relative flex h-10 w-full items-stretch overflow-hidden " +
          "rounded-xl border transition focus-within:ring-4" +
          (disabled ? " opacity-50" : "")
        }
      >
        <span className="border-border/60 flex shrink-0 items-center gap-1.5 border-r pr-2.5 pl-3">
          <span className="text-base leading-none" aria-hidden>
            {country.flag}
          </span>
          <span className="text-sm font-medium tabular-nums">+{country.dial}</span>
          <ChevronDown className="text-muted-foreground h-3 w-3" aria-hidden />
        </span>
        <select
          value={code}
          disabled={disabled}
          onChange={(e) => update(e.target.value, local)}
          aria-label="Country dial code"
          className="absolute inset-y-0 left-0 w-[5.5rem] cursor-pointer appearance-none bg-transparent text-transparent opacity-0 disabled:cursor-default"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} +{c.dial} {c.name}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          value={local}
          disabled={disabled}
          onChange={(e) => update(code, e.target.value)}
          placeholder={placeholder}
          autoComplete="tel-national"
          className="placeholder:text-muted-foreground/50 h-full flex-1 bg-transparent px-3 text-sm outline-none"
        />
      </span>
    </label>
  );
}

export function TextArea({
  label,
  labelRight,
  value,
  onChange,
  rows = 4,
  maxLength,
  placeholder,
  disabled,
}: {
  label: string;
  labelRight?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-2">
        <span className="text-foreground/80 type-body font-medium">{label}</span>
        {labelRight}
      </span>
      <textarea
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_BASE + " px-3.5 py-2.5 leading-relaxed"}
      />
    </label>
  );
}

// ── Read-only display primitives (shared by Place + Settings cards) ──────

// Labelled read-only value used inside editable cards (Price, Category). The
// `auto` pill signals the value is Intaker-owned and not hand-edited.
export function ReadField({
  label,
  auto,
  boxed,
  labelRight,
  children,
}: {
  label: string;
  auto?: boolean;
  /** Render label + value like a (disabled) filled input, so the field sits
   *  flush with the editable TextFields around it instead of as bare text. */
  boxed?: boolean;
  /** Optional trailing accessory in the label row (e.g. an "Open ↗" link) —
   *  same slot as TextField's, so a read-only field's affordances line up with
   *  the editable fields stacked beside it instead of sitting in the box. */
  labelRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex min-h-4 items-center justify-between gap-2">
        <span
          className={
            boxed
              ? "text-foreground/90 flex items-center gap-1.5 type-body font-medium"
              : "text-muted-foreground flex items-center gap-1.5 type-label font-semibold tracking-[0.12em] uppercase"
          }
        >
          {label}
          {auto ? (
            <span className="text-muted-foreground/70 inline-flex items-center gap-0.5 type-meta font-normal tracking-normal normal-case">
              <Lock className="h-3 w-3" />
              auto
            </span>
          ) : null}
        </span>
        {labelRight}
      </span>
      <div
        className={
          boxed
            ? "bg-muted/60 border-border/60 flex min-h-10 min-w-0 items-center rounded-xl border px-3.5 text-sm"
            : "flex min-h-9 items-center text-sm"
        }
      >
        {children}
      </div>
    </div>
  );
}

// Small "Open ↗" affordance shown in a link field's label when it has a value.
export function OpenLink({ href }: { href: string }) {
  const trimmed = href.trim();
  const url = /^(https?|tel|mailto|sms):/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const external = /^https?:/i.test(url);
  return (
    <a
      href={url}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={(e) => e.stopPropagation()}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 type-label font-medium transition"
    >
      Open
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
