"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Phone, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Minimal E.164 phone picker.
//
//   <PhonePicker value={value} onChange={setValue} />
//
// `value` is always a full E.164-ish string ("+523312345678") or "".
// The flag + dial-code chip on the left selects a country; the input
// holds the national portion. Defaults to Mexico because that's where
// the product is.

export type CountryCode =
  | "MX" | "US" | "CA" | "ES" | "AR" | "CO" | "CL" | "PE" | "BR" | "UY"
  | "EC" | "GT" | "CR" | "PA" | "DO" | "VE" | "BO" | "PY" | "SV" | "HN"
  | "NI" | "PR" | "GB" | "FR" | "DE" | "IT" | "NL" | "PT" | "AU" | "JP";

type Country = {
  code: CountryCode;
  name: string;
  dial: string; // includes leading '+'
  flag: string; // emoji
};

// Hand-picked list with Latin America + the major partner countries.
// Mexico ships first so the default flag matches our home market.
const COUNTRIES: Country[] = [
  { code: "MX", name: "Mexico",        dial: "+52",  flag: "🇲🇽" },
  { code: "US", name: "United States", dial: "+1",   flag: "🇺🇸" },
  { code: "CA", name: "Canada",        dial: "+1",   flag: "🇨🇦" },
  { code: "ES", name: "Spain",         dial: "+34",  flag: "🇪🇸" },
  { code: "AR", name: "Argentina",     dial: "+54",  flag: "🇦🇷" },
  { code: "CO", name: "Colombia",      dial: "+57",  flag: "🇨🇴" },
  { code: "CL", name: "Chile",         dial: "+56",  flag: "🇨🇱" },
  { code: "PE", name: "Peru",          dial: "+51",  flag: "🇵🇪" },
  { code: "BR", name: "Brazil",        dial: "+55",  flag: "🇧🇷" },
  { code: "UY", name: "Uruguay",       dial: "+598", flag: "🇺🇾" },
  { code: "EC", name: "Ecuador",       dial: "+593", flag: "🇪🇨" },
  { code: "GT", name: "Guatemala",     dial: "+502", flag: "🇬🇹" },
  { code: "CR", name: "Costa Rica",    dial: "+506", flag: "🇨🇷" },
  { code: "PA", name: "Panama",        dial: "+507", flag: "🇵🇦" },
  { code: "DO", name: "Dominican Rep.", dial: "+1809", flag: "🇩🇴" },
  { code: "VE", name: "Venezuela",     dial: "+58",  flag: "🇻🇪" },
  { code: "BO", name: "Bolivia",       dial: "+591", flag: "🇧🇴" },
  { code: "PY", name: "Paraguay",      dial: "+595", flag: "🇵🇾" },
  { code: "SV", name: "El Salvador",   dial: "+503", flag: "🇸🇻" },
  { code: "HN", name: "Honduras",      dial: "+504", flag: "🇭🇳" },
  { code: "NI", name: "Nicaragua",     dial: "+505", flag: "🇳🇮" },
  { code: "PR", name: "Puerto Rico",   dial: "+1787", flag: "🇵🇷" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "FR", name: "France",        dial: "+33",  flag: "🇫🇷" },
  { code: "DE", name: "Germany",       dial: "+49",  flag: "🇩🇪" },
  { code: "IT", name: "Italy",         dial: "+39",  flag: "🇮🇹" },
  { code: "NL", name: "Netherlands",   dial: "+31",  flag: "🇳🇱" },
  { code: "PT", name: "Portugal",      dial: "+351", flag: "🇵🇹" },
  { code: "AU", name: "Australia",     dial: "+61",  flag: "🇦🇺" },
  { code: "JP", name: "Japan",         dial: "+81",  flag: "🇯🇵" },
];

// Sorted by descending dial-code length so a stored "+1809..." matches
// Dominican Rep. before USA's "+1".
const COUNTRIES_BY_DIAL = [...COUNTRIES].sort(
  (a, b) => b.dial.length - a.dial.length,
);

function countryFromValue(value: string): {
  country: Country;
  national: string;
} {
  if (value) {
    for (const c of COUNTRIES_BY_DIAL) {
      if (value.startsWith(c.dial)) {
        return { country: c, national: value.slice(c.dial.length) };
      }
    }
  }
  return { country: COUNTRIES[0], national: value };
}

export function PhonePicker({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  required,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const initial = useMemo(() => countryFromValue(value), [value]);
  const [country, setCountry] = useState<Country>(initial.country);
  const [national, setNational] = useState(initial.national);
  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync if the outer value changes externally (controlled reset
  // after a successful submit, or hydration with a pre-filled number).
  //
  // Empty `value` deliberately does NOT reset the selected country —
  // otherwise picking a flag before typing snaps you back to the
  // default, which is exactly the bug that bit us first time around.
  useEffect(() => {
    if (!value) {
      if (national !== "") setNational("");
      return;
    }
    if (value === country.dial + national) return;
    const next = countryFromValue(value);
    setCountry(next.country);
    setNational(next.national);
  }, [value, country.dial, national]);

  const emit = (nextCountry: Country, nextNational: string) => {
    const digitsOnly = nextNational.replace(/[^0-9]/g, "");
    onChange(digitsOnly ? `${nextCountry.dial}${digitsOnly}` : "");
  };

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(f) ||
        c.dial.replace("+", "").includes(f.replace("+", "")) ||
        c.code.toLowerCase().includes(f),
    );
  }, [filter]);

  return (
    <div
      className={cn(
        "border-border bg-background focus-within:border-foreground/40 flex items-center overflow-hidden rounded-full border transition",
        disabled && "opacity-60",
        className,
      )}
    >
      <DropdownMenu
        modal={false}
        onOpenChange={(open) => {
          if (!open) setFilter("");
        }}
      >
        <DropdownMenuTrigger
          disabled={disabled}
          className="hover:bg-muted/60 flex items-center gap-1.5 rounded-l-full py-2 pr-2 pl-3 text-[13px] font-medium transition disabled:cursor-not-allowed"
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span className="text-muted-foreground font-mono text-[12px]">
            {country.dial}
          </span>
          <ChevronDown className="text-muted-foreground h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-72 w-72 overflow-hidden p-0"
        >
          <div className="border-border sticky top-0 z-10 flex items-center gap-2 border-b bg-popover px-3 py-2">
            <Search className="text-muted-foreground h-3.5 w-3.5" />
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search country or code"
              className="placeholder:text-muted-foreground flex-1 bg-transparent text-[12px] outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground px-3 py-4 text-center text-[12px]">
                No matches.
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    setCountry(c);
                    setFilter("");
                    emit(c, national);
                    // Defer focus until after Radix closes the popover.
                    window.setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  className={cn(
                    "hover:bg-muted/60 flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition",
                    c.code === country.code && "bg-muted/40",
                  )}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {c.dial}
                  </span>
                  {c.code === country.code && (
                    <Check className="text-secondary h-3 w-3" />
                  )}
                </button>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="border-border h-5 w-px border-l" aria-hidden />

      <Phone className="text-muted-foreground ml-3 h-3.5 w-3.5" />
      <input
        ref={inputRef}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={placeholder ?? "33 1234 5678"}
        value={national}
        required={required}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          setNational(next);
          emit(country, next);
        }}
        className="placeholder:text-muted-foreground flex-1 bg-transparent px-2 py-2 font-mono text-[13px] outline-none"
      />
    </div>
  );
}
