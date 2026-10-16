"use client";

// One binary for the run that is about to start. It is not a profile
// setting: the parent owns the state and starts it false every mount.

export function OverwriteSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="text-foreground inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="border-border h-4 w-4 rounded"
      />
      Overwrite existing data
    </label>
  );
}
