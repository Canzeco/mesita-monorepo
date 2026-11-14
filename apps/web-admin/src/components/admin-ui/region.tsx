"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";
import { FOCUS_RING_CLASS, OVERLAY_SURFACE_CLASS } from "./classes";
import { INPUT_FRAME_CLASS } from "./ui/input";

// RegionField (MESITA-3950, was components/CldrRegionInput): an optional
// ISO-3166-1 country for Google Places. Empty omits the param. Operators pick
// a country by name; they do not memorize codes. Keyboard: arrows move the
// highlight, Enter picks, Esc closes and returns focus to the trigger.

const REGION_CODES =
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );

type Country = { code: string; name: string };

let countries: Country[] | null = null;
function allCountries(): Country[] {
  if (countries) return countries;
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  countries = REGION_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  );
  return countries;
}

const OPTION_CLASS = "hover:bg-muted w-full rounded-lg px-3 py-1.5 text-left text-sm";

export function RegionField({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Layout only. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = allCountries().find((c) => c.code === value) ?? null;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = allCountries();
    if (!needle) return all;
    return all.filter((c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle));
  }, [q]);
  // Row 0 is "Any country"; rows 1… are the filtered countries.
  const rows: { code: string; name: string }[] = [{ code: "", name: "Any country" }, ...filtered];

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }
  function pick(code: string) {
    onChange(code);
    close();
  }

  return (
    <div className={cn("relative shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Optional country"
        title="Optional country for Google Places. Empty = no country param."
        onClick={() => {
          setQ("");
          setHi(0);
          setOpen((v) => !v);
        }}
        className={cn(INPUT_FRAME_CLASS, "inline-flex max-w-[10.5rem] items-center justify-between gap-1.5 px-3 text-left")}
      >
        <span className={cn("truncate", selected ? "text-foreground" : "text-muted-foreground")}>
          {selected ? selected.name : "Country"}
        </span>
        <ChevronDown aria-hidden className="text-muted-foreground h-4 w-4 shrink-0" />
      </button>
      {open && !disabled ? (
        <div className={cn(OVERLAY_SURFACE_CLASS, "absolute right-0 z-30 mt-1 w-64 overflow-hidden")}>
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setHi(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHi((h) => Math.min(h + 1, rows.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHi((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const row = rows[hi];
                if (row) pick(row.code);
              } else if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
            placeholder="Search countries"
            aria-label="Filter countries"
            className={cn("border-border w-full border-b bg-transparent px-3 py-2 text-base sm:text-sm", FOCUS_RING_CLASS)}
          />
          <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
            {rows.map((c, i) => (
              <li key={c.code || "any"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.code === value}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(c.code)}
                  className={cn(OPTION_CLASS, i === hi && "bg-muted", c.code && c.code === value && "text-foreground font-medium")}
                >
                  {c.name}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? <li className="text-muted-foreground type-meta px-3 py-2">No match</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
