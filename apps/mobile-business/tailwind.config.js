/** @type {import('tailwindcss').Config} */
// PLACEHOLDER tokens — copied from mobile-consumer (Mesita brand, light theme).
// When the business app is actually built, re-derive these from
// apps/web-business's globals.css (business console may diverge from consumer).
// NativeWind runs Tailwind 3; keep this in sync with the web app's CSS-first config.
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Light-only app, but app.json's userInterfaceStyle:"light" makes Expo set
  // the scheme manually, which NativeWind only permits with class-mode dark.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
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
      },
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
        display: ['Fraunces_600SemiBold'],
      },
    },
  },
  plugins: [],
};
