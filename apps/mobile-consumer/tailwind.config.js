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
        // Brand pink #fb2b7b · muted #775254 · shell wash #fff7f8 → #faeff0
        background: '#fff7f8',
        foreground: '#260409',
        card: { DEFAULT: '#ffffff', foreground: '#260409' },
        popover: { DEFAULT: '#ffffff', foreground: '#260409' },
        primary: { DEFAULT: '#fb2b7b', foreground: '#fffafb' },
        secondary: { DEFAULT: '#cf0360', foreground: '#fffafb' },
        muted: { DEFAULT: '#faeff0', foreground: '#775254' },
        accent: { DEFAULT: '#ff6eb4', foreground: '#260409' },
        destructive: { DEFAULT: '#e6000c', foreground: '#fffafb' },
        border: '#ebd9db',
        input: '#f5e7e9',
        ring: '#fb2b7b',
        tier: {
          bronze: '#c16e2d',
          silver: '#9ba6b1',
          gold: '#f6c330',
          diamond: '#ce74e3',
          free: '#9ba6b1',
          premium: '#ce74e3',
        },
        swipepanel: { DEFAULT: '#116bb5', foreground: '#f9fcff' },
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
