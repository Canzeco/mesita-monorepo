import { useId } from "react";

// Brand SVG logos rendered inline so they can carry the official colors —
// Simple lucide icons render monochrome, which is fine for input adornments
// but reads as bland on the Signals tiles where the source brand is the
// whole point. Paths are simplified marks suitable for 16–24px renderings.

type LogoProps = {
  size?: number;
  className?: string;
};

// Google — the multi-color "G" mark. Four arcs in the canonical brand colors.
export function GoogleLogo({ size = 16, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// Instagram — single-path Simple Icons mark filled with the canonical
// magenta→purple→orange gradient. Each instance carries its own gradient def
// because referencing a shared id across multiple <svg> roots breaks in
// Safari + Webpack-style hashing.
export function InstagramLogo({ size = 16, className }: LogoProps) {
  const id = `ig-grad-${useId().replace(/:/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFD600" />
          <stop offset="35%" stopColor="#FF7A00" />
          <stop offset="65%" stopColor="#FF0069" />
          <stop offset="100%" stopColor="#D300C5" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"
      />
    </svg>
  );
}

// Mesita — the in-house brand mark. The official flame glyph from the
// /Logos lockup, rendered in white on a pink-gradient rounded square so it
// matches the Topbar's primary CTA when sitting next to GoogleLogo /
// InstagramLogo in the Signals tiles. Each instance carries its own gradient
// id (Safari + Webpack hashing breaks shared ids across multiple <svg>
// roots), same pattern as InstagramLogo above.
export function MesitaLogo({ size = 16, className }: LogoProps) {
  const id = `mesita-grad-${useId().replace(/:/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF4D8F" />
          <stop offset="100%" stopColor="#E60073" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx="22" fill={`url(#${id})`} />
      {/* Flame mark, scaled down ~60% and centered inside the badge. */}
      <g transform="translate(20 20) scale(0.6)" fill="#FFFFFF">
        <path d="M81.3,28.5c-4.9,0-8.4,5.1-8.4,14.9c0,4.1-2.1,7.3-5.5,7.3c-4.1,0-5.6-2.9-5.6-6.2c0-6,5.7-6.7,5.7-16.2c0-6.9-8.8-12.2-8.8-12.2c2.8,9.9-2.3,15.1-7.5,15.1c-3,0-7.2-2.1-7.2-9.9c0-10.5,8-16.5,8-16.5C32.4,5,28.8,24.2,32.7,33.6c2.5,5.8,3.1,13.3-2.9,13.3c-7.1,0-3.4-13.2-3.4-13.2c-3.1,1.5-12.1,8.4-13,22.4c-0.1,0.7-0.1,1.4-0.1,2.2c0,0.7,0,1.4,0.1,2.1c0,0,0,0.1,0,0.1C14.5,79.8,30.5,95,50,95c20.3,0,36.7-16.4,36.7-36.7C86.7,40.2,75.6,37.4,81.3,28.5z M50,90.2c0,0-16.1-3.4-16.1-18.6c0-13.4,10-22.7,18.7-22.7c0,0-7.3,4.4-7.3,15c0,7.1,3.8,9,6.5,9c4.8,0,9.4-4.8,6.8-13.8c0,0,7.4,5.2,7.4,13.5C66.1,86.1,50,90.2,50,90.2z" />
      </g>
    </svg>
  );
}
