// Brand gradients + shadows, copied from mesita-web-consumer globals.css
// (CSS gradients don't exist in RN — surfaces render these with
// expo-linear-gradient; shadows use the style objects below).

export const GRADIENTS = {
  // --gradient-pink · the primary CTA/brand surface (web class bg-pink-gradient)
  pink: ['#ff5aab', '#ec006c'] as const,
  // --gradient-premium (web class bg-tier-premium)
  premium: ['#8b6ce8', '#8cccff'] as const,
  // --gradient-hero vertical wash; use <HeroBackdrop /> for the full
  // radial-blob approximation (two soft pink blobs + this wash).
  hero: ['#fff9fa', '#f5e6e8'] as const,
  // Soft shell wash (web `from-background to-muted/30`)
  shell: ['#fff7f8', '#faeff0'] as const,
  peacock: ['#ff3a84', '#ed1c80', '#ed4096'] as const,
  // Instagram brand gradient (social verify + IG-connected chrome)
  instagram: ['#f58529', '#dd2a7b', '#8134af'] as const,
  gold: ['#f5cc58', '#eb881f'] as const,
  silver: ['#ced9e5', '#9ba6b1'] as const,
  free: ['#ced9e5', '#9ba6b1'] as const,
  bronze: ['#d58042', '#a04f27'] as const,
  diamond: ['#8ef9ff', '#8d90ff'] as const,
} as const;

// 135° like the web's `linear-gradient(135deg, …)`.
export const GRADIENT_DIAGONAL = {
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
} as const;

// --shadow-glow: pink brand glow (CTAs, active tabs)
export const SHADOW_GLOW = {
  shadowColor: '#fb2b7b',
  shadowOpacity: 0.4,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 10,
} as const;

// --shadow-elev: soft dark-rose elevation (cards)
export const SHADOW_ELEV = {
  shadowColor: '#260409',
  shadowOpacity: 0.18,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
} as const;
