"use client";

import { ChevronDown } from "lucide-react";
import { COUNTRIES, COUNTRY_BY_CODE, type Country } from "@/lib/consumer-data";

// Phone input with a built-in dial-code + flag picker. The visible
// surface is a single rounded pill — the left side is a styled "button"
// that opens the OS-native picker (we overlay a transparent <select> so
// mobile gets its proper picker and desktop gets a click-to-open). The
// right side is the local subscriber number. It sits on the sign-in photo
// (MESITA-4309): a white field as tall as the green button, no border.
//
// Fully controlled: the parent owns both the local number (onChange) and the
// ISO country code (onCountryChange), and combines them itself.

type Props = {
  // Local subscriber number (no dial code). Storing it separately means
  // we can switch the dial code without losing what the user typed.
  value: string;
  onChange: (next: string) => void;
  // ISO country code (e.g. "MX"). An unknown code falls back to MX.
  countryCode: string;
  onCountryChange: (code: string) => void;
  placeholder?: string;
  required?: boolean;
};

export function PhoneInputWithCountry({
  value,
  onChange,
  countryCode,
  onCountryChange,
  placeholder = "55 1234 5678",
  required,
}: Props) {
  const country: Country = COUNTRY_BY_CODE[countryCode] ?? COUNTRY_BY_CODE.MX;

  return (
    <div className="bg-card text-foreground relative flex h-13 w-full items-stretch overflow-hidden rounded-[14px] border border-transparent transition focus-within:border-white focus-within:ring-2 focus-within:ring-white/40">
      {/* Country picker chip + transparent native select overlaying just
          the chip width. The select is absolutely positioned to the left
          half of the row so the phone input on the right stays clickable. */}
      <div className="border-border flex shrink-0 items-center gap-1.5 border-r pr-2 pl-3">
        <span className="text-base leading-none" aria-hidden>
          {country.flag}
        </span>
        <span className="text-base font-semibold tabular-nums">
          +{country.dial}
        </span>
        <ChevronDown className="text-muted-foreground h-3 w-3" aria-hidden />
      </div>
      <select
        value={countryCode}
        onChange={(e) => onCountryChange(e.target.value)}
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
        className="placeholder:text-muted-foreground h-13 min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
      />
    </div>
  );
}
