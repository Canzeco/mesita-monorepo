// Join conditional class names, dropping falsy values. The admin console
// keeps this dependency-free (no clsx / tailwind-merge) — call sites only
// append additive classes to a base constant, so there are no conflicting
// Tailwind utilities to de-duplicate.
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
