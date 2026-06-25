import { PlaceKvField } from "./PlaceKvField";

/** @deprecated Prefer PlaceKvField with blocked */
export function PlaceReadOnlyRow({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <PlaceKvField
      label={label}
      hint={hint}
      value={value}
      blocked
      valueClassName={valueClassName}
    />
  );
}
