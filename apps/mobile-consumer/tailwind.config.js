/** @type {import('tailwindcss').Config} */
// Token values re-synced 2026-07-20 from apps/web-consumer/src/app/globals.css
// (Tailwind v4 oklch vars → sRGB hex — NativeWind runs Tailwind 3, which can't
// read the web app's CSS-first config). Keep in lockstep with
// src/constants/brand.ts `COLORS`. Light theme only.
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Light-only app, but app.json's userInterfaceStyle:"light" makes Expo set
  // the scheme manually, which NativeWind only permits with class-mode dark.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // BRAND-TOKENS:START (generated — do not hand-edit; run: deno task sync-brand)
        'brand-pink-50': '#fef2f4',
        'brand-pink-100': '#fee4e9',
        'brand-pink-200': '#ffccd6',
        'brand-pink-300': '#ffa9bc',
        'brand-pink-400': '#ff789d',
        'brand-pink-500': '#fb2b7b',
        'brand-pink-600': '#e10069',
        'brand-pink-700': '#bb0056',
        'brand-pink-800': '#940543',
        'brand-pink-900': '#710b34',
        'brand-pink-950': '#47071f',
        // THE Mesita pink (== web --primary / --brand-pink-500).
        'brand-pink': '#fb2b7b',
        // Pink text at body size — clears AA (4.77:1). brand-pink does NOT (3.66:1).
        'brand-pink-text': '#e10069',
        'brand-pink-deep': '#bb0056',
        // BRAND-TOKENS:END
        // ── THE ACHROMATIC SEMANTIC LAYER (MESITA-1954) ────────────────────
        // Pato 2026-09-16: *"do the mobile consumer app too"* — after the mock
        // (MESITA-1934) and web-business + web-consumer (MESITA-1936).
        //
        // THE RULE: every neutral keeps its LIGHTNESS and loses its CHROMA.
        // Chroma survives ONLY where a third party owns the colour, where money
        // is at risk, or where a tier is named. Never on state, never on
        // hierarchy, never on hover.
        //
        // THESE ARE COPIED VALUES, and for once that is literal: they were read
        // off the SHIPPED consumer.mesita.ai stylesheet rather than re-derived
        // from oklch, so this file cannot drift from web by a rounding step.
        // The BRAND-TOKENS block above is still generated and still pink;
        // nothing here writes to it, and `brand.json` is untouched, so
        // web-landing, web-admin and web-validate keep the brand.
        //
        // `page` is what a surface SITS ON and `card` is what one is MADE OF —
        // the split web took in MESITA-1938. White is reserved for a surface
        // that carries something, so a card is lifted by tone rather than by a
        // shadow this palette no longer has.
        background: '#efefef',
        foreground: '#171717',
        card: { DEFAULT: '#ffffff', foreground: '#171717' },
        popover: { DEFAULT: '#ffffff', foreground: '#171717' },
        primary: { DEFAULT: '#171717', foreground: '#ffffff' },
        secondary: { DEFAULT: '#404040', foreground: '#ffffff' },
        muted: { DEFAULT: '#efefef', foreground: '#5d5d5d' },
        accent: { DEFAULT: '#efefef', foreground: '#171717' },
        // The hover/pressed step for FILLED controls. Opacity cannot do this
        // job on ink: it fades the white LABEL with the fill, so a pressed
        // black pill reads as greying OUT.
        ink: { hover: '#404040' },
        // ── RESERVED SIGNALS: the only chroma left ─────────────────────────
        // Red is the one thing that says "this destroys something".
        destructive: { DEFAULT: '#e6000f', foreground: '#ffffff' },
        border: '#dbdbdb',
        input: '#efefef',
        ring: '#171717',
        // THE CLASS LADDER KEEPS ITS HUES — four metals the product NAMES OUT
        // LOUD to the guest, on the Passport and in the header chip, which is
        // the "where a tier is named" clause exactly. A metal read as a grey is
        // no longer a metal.
        //
        // AND IT CONVERGES ON WEB'S VALUES HERE. These had drifted badly: gold
        // was #f6c330 against web's #906b00, diamond #ce74e3 against #0072a0,
        // and `premium` was sharing diamond's purple. web-consumer pins each
        // metal to an exclusive hue band in class-palette.test.ts; mobile has
        // no such test, which is how it drifted unnoticed.
        tier: {
          bronze: '#954c28',
          silver: '#757070',
          gold: '#906b00',
          diamond: '#0072a0',
          free: '#757070',
          premium: '#32191b',
        },
        // The swipe card's panel was a blue nobody names — decoration, so ink.
        swipepanel: { DEFAULT: '#171717', foreground: '#ffffff' },
      },
      // Web's deliberately tightened radius scale (base 0.5rem, flatter corners).
      borderRadius: {
        sm: '5px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '12px',
        '3xl': '14px',
      },
      fontFamily: {
        sans: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold: ['Inter_700Bold'],
        // Web display stack: Fraunces with -0.015em tracking (applied via
        // `tracking-display` utility below). Variable weights loaded in root.
        display: ['Fraunces_600SemiBold'],
        'display-regular': ['Fraunces_400Regular'],
        'display-medium': ['Fraunces_500Medium'],
        'display-bold': ['Fraunces_700Bold'],
      },
      letterSpacing: {
        // Web `h1–h3, .font-display { letter-spacing: -0.015em }`
        display: '-0.015em',
      },
    },
  },
  plugins: [],
};
