"use client";

/** Optional two-letter CLDR / ISO-3166-1 code for Google Places. Empty omits the param. */
export function CldrRegionInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="text-muted-foreground flex shrink-0 items-center gap-1.5">
      <span className="type-label font-semibold tracking-[0.12em] uppercase">
        CC
      </span>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        maxLength={2}
        value={value}
        placeholder="—"
        disabled={disabled}
        aria-label="Optional country code"
        title="Optional CLDR country for Google Places. Empty = no country param. Autocomplete may restrict; Text Search only biases."
        onChange={(e) =>
          onChange(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2))
        }
        className="border-border bg-background focus:border-foreground h-8 w-11 rounded-lg border px-1.5 text-center font-mono text-xs uppercase outline-none placeholder:normal-case placeholder:font-sans disabled:cursor-not-allowed"
      />
    </label>
  );
}
