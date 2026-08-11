"use client";

// Real brand marks for the reward rungs (Pato, 2026-08-11: "add fucking logos
// … white with logos for example google and instagram").
//
// A lucide outline said "camera-ish shape" where the guest needs to recognise
// INSTAGRAM in a dark venue at arm's length. These are the official marks in
// their own colours — the one place colour is allowed on this deliberately
// neutral screen, because a Google G that isn't Google-coloured is not a
// recognition cue, it's decoration.
//
// Inline rather than <Image src="/channels/…"> so they inherit sizing, need no
// network round trip on a screen that must paint in one frame, and can carry
// their own gradient (Instagram's mark is a gradient, not a flat fill).

export function GoogleGlyph({ className }: { className?: string }) {
  // Google's four-colour G.
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

export function InstagramGlyph({ className }: { className?: string }) {
  // Instagram's rounded-square camera in its brand gradient.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="ig-g" cx="0.3" cy="1.05" r="1.3">
          <stop offset="0" stopColor="#FED576" />
          <stop offset="0.26" stopColor="#F47133" />
          <stop offset="0.61" stopColor="#BC3081" />
          <stop offset="1" stopColor="#4C63D2" />
        </radialGradient>
      </defs>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="url(#ig-g)" />
      <circle
        cx="12"
        cy="12"
        r="4.6"
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
      />
      <circle cx="17.6" cy="6.4" r="1.35" fill="#fff" />
    </svg>
  );
}

export function MesitaGlyph({ className }: { className?: string }) {
  // Mesita's own mark, flat — the house rung next to two foreign brands.
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M81.3,28.5c-4.9,0-8.4,5.1-8.4,14.9c0,4.1-2.1,7.3-5.5,7.3c-4.1,0-5.6-2.9-5.6-6.2c0-6,5.7-6.7,5.7-16.2c0-6.9-8.8-12.2-8.8-12.2c2.8,9.9-2.3,15.1-7.5,15.1c-3,0-7.2-2.3-7.2-7.6c0-6.4,4.6-8.1,4.6-8.1s-13.9,1.9-13.9,13.4c0,7.9,5.6,10.3,5.6,15.4c0,3.4-2.3,6.4-6.3,6.4c-4.6,0-6.6-3.9-6.6-9.2c0-8.4-3.9-12.9-8.6-12.9c-5,0-8.8,4.2-8.8,10.2c0,17.6,17.9,32.4,39.9,32.4s39.9-14.8,39.9-32.4C89.9,32.6,86.1,28.5,81.3,28.5z"
      />
    </svg>
  );
}
