// Shared form Field primitive — label + child input + optional hint +
// optional required mark. Replaces local `Field` definitions previously
// duplicated in OnboardForm, EditVenueForm, and a few others.
//
// Pass any native input / select / textarea (or composite like
// PhoneInputWithCountry) as children. The wrapper just renders the
// surrounding label chrome and forwards click semantics.

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        {label}
        {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {hint && (
        <span className="text-muted-foreground/80 mt-1 block text-[11px]">
          {hint}
        </span>
      )}
    </label>
  );
}
