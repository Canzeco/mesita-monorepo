// Brand constants for mobile-business. The block between the BRAND-TOKENS markers is
// generated from assets/brand/brand.json — everything else is hand-written.

// BRAND-TOKENS:START (generated — do not hand-edit; run: deno task sync-brand)
export const BRAND_PINK = '#fb2b7b';
/** Pink text at body size on white — clears AA (4.77:1). BRAND_PINK does NOT (3.66:1). */
export const BRAND_PINK_TEXT = '#e10069';
export const BRAND_PINK_DEEP = '#bb0056';
/** was oklch(0.72 0.22 355) -> oklch(0.6 0.25 5); both clipped out of sRGB */
export const BRAND_GRADIENT_PINK = ['#ff65ab', '#e9006d'] as const;
/** Three-stop brand wash for full-bleed panels and tiles (auth panes, 404, badges). was --gradient-peacock, a pre-pivot name on a pink gradient; first stop clipped out of sRGB (0.24 -> ceiling 0.221) */
export const BRAND_GRADIENT = ['#ff4886', '#ed1c80', '#ed4096'] as const;
export const BRAND_PINK_RAMP = {
  50: '#fef2f4',
  100: '#fee4e9',
  200: '#ffccd6',
  300: '#ffa9bc',
  400: '#ff789d',
  500: '#fb2b7b',
  600: '#e10069',
  700: '#bb0056',
  800: '#940543',
  900: '#710b34',
  950: '#47071f',
} as const;
// BRAND-TOKENS:END
