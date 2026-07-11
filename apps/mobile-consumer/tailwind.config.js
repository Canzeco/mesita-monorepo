/** @type {import('tailwindcss').Config} */
// Token values are copied from mesita-web-consumer src/app/globals.css
// (Tailwind v4 oklch vars, converted to sRGB hex — NativeWind runs Tailwind 3,
// which can't read the web app's CSS-first config). Light theme only.
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
        display: ['Fraunces_600SemiBold'],
      },
    },
  },
  plugins: [],
};
