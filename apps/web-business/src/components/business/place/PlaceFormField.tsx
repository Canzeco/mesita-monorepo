import { cn } from "@/lib/utils";
import { INPUT_CLASS as INPUT } from "@/lib/ui-classes";
import { PlaceKvField } from "./PlaceKvField";

export function PlaceFormField({
  label,
  hint,
  children,
  className,
  kv = false,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  kv?: boolean;
}) {
  if (kv) {
    return (
      <PlaceKvField label={label} hint={hint} className={className}>
        {children}
      </PlaceKvField>
    );
  }

  return (
    <label className={cn("block", className)}>
      <span className="text-muted-foreground mb-1.5 block text-[11px] font-medium">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-muted-foreground mt-1 block text-[10px] leading-snug">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function PlaceUrlField({
  label,
  placeholder,
  value,
  onChange,
  missing,
  onToggleMissing,
  hint,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  missing?: boolean;
  onToggleMissing?: (missing: boolean) => void;
  hint?: string;
}) {
  return (
    <PlaceFormField label={label} hint={hint}>
      <input
        value={missing ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={missing ? "Skipped" : placeholder}
        spellCheck={false}
        autoCapitalize="none"
        disabled={!!missing}
        className={cn(
          INPUT,
          "h-10 text-[13px] placeholder:text-muted-foreground/50",
          missing && "bg-muted/40 text-muted-foreground cursor-not-allowed",
        )}
      />
      {onToggleMissing ? (
        <button
          type="button"
          onClick={() => onToggleMissing(!missing)}
          className="text-muted-foreground hover:text-foreground mt-1.5 text-[10px] transition"
        >
          {missing ? "Add" : "Skip"}
        </button>
      ) : null}
    </PlaceFormField>
  );
}
