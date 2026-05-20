"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRIES, COUNTRY_BY_CODE, type Country } from "@/lib/guest-data";

// Phone input with a built-in dial-code + flag picker. The visible
// surface is a single rounded pill — the left side is a styled "button"
// that opens the OS-native picker (we overlay a transparent <select> so
// mobile gets its proper picker and desktop gets a click-to-open). The
// right side is the local subscriber number.
//
// onChange returns the FULL E.164-ish string (`+52 55 1234 5678`) so the
// parent can submit it as a single field — no schema changes needed on
// the EF side. The country itself is also exposed via onCountryChange for
// callers that want to keep it in sync with a residence dropdown.

type Props = {
  // Local subscriber number (no dial code). Storing it separately means
  // we can switch the dial code without losing what the user typed.
  value: string;
  onChange: (next: string) => void;
  // ISO country code (e.g. "MX"). Defaults to "MX" if omitted.
  countryCode?: string;
  onCountryChange?: (code: string) => void;
  placeholder?: string;
  required?: boolean;
  // Hidden form field name — if set we render a hidden input that
  // contains the combined "+<dial> <number>" value, so this component
  // works inside plain <form> submissions without a parent state hook.
  formName?: string;
};

export function PhoneInputWithCountry({
  value,
  onChange,
  countryCode,
  onCountryChange,
  placeholder = "55 1234 5678",
  required,
  formName,
}: Props) {
  const [internalCode, setInternalCode] = useState(countryCode ?? "MX");
  // If the parent controls countryCode, use that — else fall back to
  // local state so the picker still works in uncontrolled mode.
  const code = countryCode ?? internalCode;
  const country: Country = COUNTRY_BY_CODE[code] ?? COUNTRY_BY_CODE.MX;

  const setCode = (next: string) => {
    if (countryCode == null) setInternalCode(next);
    onCountryChange?.(next);
  };

  const combined = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    return `+${country.dial} ${trimmed}`;
  }, [country.dial, value]);

  return (
    <div className="border-border bg-card focus-within:border-foreground/40 relative flex h-11 w-full items-stretch overflow-hidden rounded-xl border transition">
      {/* Country picker chip + transparent native select overlaying just
          the chip width. The select is absolutely positioned to the left
          half of the row so the phone input on the right stays clickable. */}
      <div className="border-border flex shrink-0 items-center gap-1.5 border-r pr-2 pl-3">
        <span className="text-base leading-none" aria-hidden>
          {country.flag}
        </span>
        <span className="text-sm font-medium tabular-nums">
          +{country.dial}
        </span>
        <ChevronDown className="text-muted-foreground h-3 w-3" aria-hidden />
      </div>
      <select
        value={code}
        onChange={(e) => setCode(e.target.value)}
        aria-label="Country dial code"
        className="absolute inset-y-0 left-0 w-[5.5rem] cursor-pointer appearance-none bg-transparent text-transparent opacity-0"
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete="tel-national"
        className="placeholder:text-muted-foreground h-11 flex-1 bg-transparent px-3 text-sm outline-none"
      />

      {formName && <input type="hidden" name={formName} value={combined} />}
    </div>
  );
}
