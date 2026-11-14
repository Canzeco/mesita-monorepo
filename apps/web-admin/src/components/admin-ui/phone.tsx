"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";
import { FieldWell } from "./field";
import {
  COUNTRIES,
  COUNTRY_BY_CODE,
  combinePhoneE164,
  splitStoredPhone,
} from "@/lib/phone-countries";

// Phone input with a dial-code + flag picker. The left chip is styled text
// with a transparent native <select> over it, so desktop gets click-to-open
// and any touch device its proper picker. `value` is the FULL stored phone;
// onChange always emits strict E.164 (+<dial><digits>).
export function PhoneField({
  label,
  icon,
  labelRight,
  value,
  onChange,
  placeholder = "55 1234 5678",
  disabled,
}: {
  label: string;
  icon?: React.ReactNode;
  labelRight?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  // Draft = the country + local text as last typed/picked, kept only while it
  // still matches the stored value's digits; an EXTERNAL value change
  // mismatches and the derived split takes over. Pure derivation.
  const [draft, setDraft] = useState<{ code: string; local: string; digits: string } | null>(null);
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
    <FieldWell label={label} icon={icon} labelRight={labelRight}>
      <span
        className={cn(
          "border-border bg-background focus-within:ring-ring focus-within:ring-offset-background relative flex h-11 w-full items-stretch overflow-hidden rounded-xl border transition focus-within:ring-2 focus-within:ring-offset-2 sm:h-10",
          disabled && "opacity-50",
        )}
      >
        <span className="border-border flex shrink-0 items-center gap-1.5 border-r pr-2.5 pl-3">
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
          className="placeholder:text-muted-foreground/60 h-full flex-1 bg-transparent px-3 text-base outline-none sm:text-sm"
        />
      </span>
    </FieldWell>
  );
}
