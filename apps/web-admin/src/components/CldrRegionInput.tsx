"use client";

import { useMemo, useState } from "react";

// Optional ISO-3166-1 country for Google Places. Empty omits the param.
// Operators pick a country by name — they do not memorize codes.

const REGION_CODES =
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
    .split(" ");

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

type Country = { code: string; name: string };

const COUNTRIES: Country[] = REGION_CODES.map((code) => ({
  code,
  name: regionNames.of(code) ?? code,
})).sort((a, b) => a.name.localeCompare(b.name, "en"));

export function CldrRegionInput({
  value,
  onChange,
  disabled,
  compact = false,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Inline trigger for a sticky search row (no stacked label). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = COUNTRIES.find((c) => c.code === value) ?? null;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.code.toLowerCase().includes(needle),
    );
  }, [q]);

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label="Optional country"
      title="Optional country for Google Places. Empty = no country param."
      onClick={() => {
        setQ("");
        setOpen((v) => !v);
      }}
      className={
        compact
          ? "border-border bg-background focus:border-foreground inline-flex h-8 max-w-[10.5rem] shrink-0 items-center justify-between gap-1.5 rounded-lg border px-2 text-left text-xs outline-none disabled:cursor-not-allowed"
          : "border-border bg-background focus:border-foreground inline-flex h-8 min-w-40 items-center justify-between gap-2 rounded-lg border px-2.5 text-left text-xs outline-none disabled:cursor-not-allowed"
      }
    >
      <span
        className={
          (selected ? "text-foreground" : "text-muted-foreground") +
          (compact ? " truncate" : "")
        }
      >
        {selected ? selected.name : compact ? "Country" : "Any"}
      </span>
      <span aria-hidden className="text-muted-foreground">
        ▾
      </span>
    </button>
  );

  return (
    <div className="relative shrink-0">
      {compact ? (
        trigger
      ) : (
        <label className="text-muted-foreground flex shrink-0 flex-col gap-1">
          <span className="type-label font-semibold tracking-[0.12em] uppercase">
            Country
          </span>
          {trigger}
        </label>
      )}
      {open && !disabled ? (
        <div className="border-border bg-card absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-xl border shadow-card">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search countries"
            aria-label="Filter countries"
            className="border-border w-full border-b bg-transparent px-3 py-2 text-sm outline-none"
          />
          <ul
            role="listbox"
            className="max-h-56 overflow-y-auto py-1"
          >
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="hover:bg-muted w-full px-3 py-1.5 text-left text-sm"
              >
                Any country
              </button>
            </li>
            {filtered.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.code === value}
                  onClick={() => {
                    onChange(c.code);
                    setOpen(false);
                  }}
                  className={
                    "hover:bg-muted w-full px-3 py-1.5 text-left text-sm " +
                    (c.code === value ? "text-foreground font-medium" : "")
                  }
                >
                  {c.name}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="text-muted-foreground px-3 py-2 text-xs">
                No match
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
