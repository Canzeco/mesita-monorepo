import type { ReactNode } from "react";

// ─── Me's colour icons (MESITA-3538) ─────────────────────────────────────────
//
// Pato, 2026-11-09: "build some fucking better icons, like color icons, but
// not dumb colors, like pretty fucking icons, like in the uber eats and in the
// didi app" — "only for the me page". Each hub cell wears its own filled,
// two-tone glyph on a soft wash of its own hue. This replaces the neutral ink
// chip (MESITA-1132, MESITA-2569) on Me's grid ONLY; every other surface keeps
// its line icons.
//
// One glyph per cell, drawn in a 40×40 box: the wash is the whole box (the
// chip's rounded square), the glyph sits inside 7…33. Gradient ids are fixed
// strings, not useId(): each icon appears once on the page and this module is
// read by the server-rendered loading fallback too.
//
// Hues, one per cell, spread round the wheel so no two neighbours match:
// indigo · Instagram · gold · violet · orange · red · pink · blue · slate ·
// green · lime · cyan · grey (slate left with Cards, MESITA-3561).

export type MeIcon = (props: { className?: string }) => ReactNode;

function Frame({
  id,
  from,
  to,
  className,
  children,
  wash,
}: {
  id: string;
  from: string;
  to: string;
  className?: string;
  children: ReactNode;
  /** The chip's wash; the glyph's deep end at 14% unless given. */
  wash?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="7" x2="0" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={wash ?? to} fillOpacity={0.14} />
      {children}
    </svg>
  );
}

/** A soft white sheen, the "glossy" half of the look. */
const SHEEN = { fill: "#fff", fillOpacity: 0.38 } as const;

export const ProfileIcon: MeIcon = ({ className }) => (
  <Frame id="me-ic-profile" from="#A5B4FC" to="#4F46E5" className={className}>
    <circle cx="20" cy="15" r="6.2" fill="url(#me-ic-profile)" />
    <path
      d="M9 31.5c0-6.2 4.9-10 11-10s11 3.8 11 10a1.5 1.5 0 0 1-1.5 1.5h-19A1.5 1.5 0 0 1 9 31.5z"
      fill="url(#me-ic-profile)"
    />
    <ellipse cx="17.6" cy="12.8" rx="2" ry="1.4" {...SHEEN} />
  </Frame>
);

export const InstagramIcon: MeIcon = ({ className }) => (
  <svg
    viewBox="0 0 40 40"
    className={className}
    aria-hidden
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="me-ic-ig" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#FEDA75" />
        <stop offset="0.28" stopColor="#FA7E1E" />
        <stop offset="0.55" stopColor="#D62976" />
        <stop offset="0.8" stopColor="#962FBF" />
        <stop offset="1" stopColor="#4F5BD5" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="12" fill="#D62976" fillOpacity={0.12} />
    <rect x="9" y="9" width="22" height="22" rx="7" fill="url(#me-ic-ig)" />
    <circle cx="20" cy="20" r="5" fill="none" stroke="#fff" strokeWidth="2.4" />
    <circle cx="26" cy="14" r="1.5" fill="#fff" />
  </svg>
);

export const ClassIcon: MeIcon = ({ className }) => (
  <Frame id="me-ic-class" from="#FDE68A" to="#F59E0B" className={className}>
    <path
      d="M9.5 15.5l5.6 4.8L20 11.5l4.9 8.8 5.6-4.8-2.3 11.2H11.8z"
      fill="url(#me-ic-class)"
      stroke="url(#me-ic-class)"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <rect x="11.5" y="27" width="17" height="3.4" rx="1.7" fill="#D97706" />
    <circle cx="9.5" cy="15.5" r="2" fill="#FBBF24" />
    <circle cx="20" cy="11" r="2" fill="#FBBF24" />
    <circle cx="30.5" cy="15.5" r="2" fill="#FBBF24" />
    <circle cx="20" cy="22" r="2" fill="#E11D48" />
    <ellipse cx="15" cy="21" rx="1.4" ry="1" {...SHEEN} />
  </Frame>
);

export const PlanIcon: MeIcon = ({ className }) => (
  <Frame id="me-ic-plan" from="#D8B4FE" to="#7C3AED" className={className}>
    <path d="M20 19.5l11 6-11 6-11-6z" fill="#7C3AED" fillOpacity={0.4} />
    <path d="M20 14.5l11 6-11 6-11-6z" fill="#8B5CF6" fillOpacity={0.7} />
    <path
      d="M20 8.5l11 6-11 6-11-6z"
      fill="url(#me-ic-plan)"
      stroke="url(#me-ic-plan)"
      strokeWidth="1"
      strokeLinejoin="round"
    />
    <ellipse cx="17" cy="13.2" rx="2.6" ry="1.1" {...SHEEN} />
  </Frame>
);

export const NotificationsIcon: MeIcon = ({ className }) => (
  <Frame id="me-ic-bell" from="#FDBA74" to="#EA580C" className={className}>
    <path
      d="M20 9a7 7 0 0 0-7 7v4.6l-2.3 4.1a1 1 0 0 0 .9 1.5h16.8a1 1 0 0 0 .9-1.5L27 20.6V16a7 7 0 0 0-7-7z"
      fill="url(#me-ic-bell)"
    />
    <path d="M17 28.5a3 3 0 0 0 6 0z" fill="#C2410C" />
    <ellipse cx="16.6" cy="15" rx="1.3" ry="2.6" {...SHEEN} />
    <circle cx="27.5" cy="11.5" r="3.4" fill="#EF4444" stroke="#fff" strokeWidth="1.6" />
  </Frame>
);

export const ReservationsIcon: MeIcon = ({ className }) => (
  <Frame id="me-ic-cal" from="#F87171" to="#DC2626" className={className}>
    <rect x="9" y="11" width="22" height="21" rx="4.5" fill="#fff" />
    <rect
      x="9"
      y="11"
      width="22"
      height="21"
      rx="4.5"
      fill="none"
      stroke="#DC2626"
      strokeOpacity={0.18}
    />
    <path d="M13.5 11h13a4.5 4.5 0 0 1 4.5 4.5V18H9v-2.5a4.5 4.5 0 0 1 4.5-4.5z" fill="url(#me-ic-cal)" />
    <rect x="14" y="8" width="2.6" height="6" rx="1.3" fill="#991B1B" />
    <rect x="23.4" y="8" width="2.6" height="6" rx="1.3" fill="#991B1B" />
    <path
      d="M15.5 25l3 3 6-6"
      fill="none"
      stroke="#10B981"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Frame>
);

export const FavoritesIcon: MeIcon = ({ className }) => (
  <Frame id="me-ic-fav" from="#F9A8D4" to="#DB2777" className={className}>
    <path
      d="M20 31.5s-11-6.4-11-14.2A6.1 6.1 0 0 1 20 13.8a6.1 6.1 0 0 1 11 3.5c0 7.8-11 14.2-11 14.2z"
      fill="url(#me-ic-fav)"
    />
    <ellipse cx="14.6" cy="16.6" rx="2.2" ry="1.4" transform="rotate(-35 14.6 16.6)" {...SHEEN} />
  </Frame>
);

export const TransactionsIcon: MeIcon = ({ className }) => (
  <Frame id="me-ic-tx" from="#93C5FD" to="#2563EB" className={className}>
    <path
      d="M12.5 8.5h15a1.5 1.5 0 0 1 1.5 1.5v21.5l-3-2-3 2-3-2-3 2-3-2-3 2V10a1.5 1.5 0 0 1 1.5-1.5z"
      fill="url(#me-ic-tx)"
      stroke="url(#me-ic-tx)"
      strokeWidth="1"
      strokeLinejoin="round"
    />
    <rect x="15" y="13.5" width="10" height="2.2" rx="1.1" fill="#fff" />
    <rect x="15" y="18.5" width="10" height="2.2" rx="1.1" fill="#fff" fillOpacity={0.85} />
    <rect x="15" y="23.5" width="6" height="2.2" rx="1.1" fill="#fff" fillOpacity={0.7} />
  </Frame>
);

export const RefundsIcon: MeIcon = ({ className }) => (
  <Frame id="me-ic-refund" from="#6EE7B7" to="#059669" className={className}>
    <circle cx="20" cy="20" r="11.5" fill="url(#me-ic-refund)" />
    <circle cx="20" cy="20" r="8.6" fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth="1.2" />
    <path
      d="M16.2 18.4h5.6a3.6 3.6 0 0 1 0 7.2h-3.2"
      fill="none"
      stroke="#fff"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18.8 15.4l-3 3 3 3"
      fill="none"
      stroke="#fff"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Frame>
);

export const ConnectorIcon: MeIcon = ({ className }) => (
  <Frame id="me-ic-plug" from="#BEF264" to="#65A30D" className={className}>
    <rect x="15" y="8" width="2.6" height="7" rx="1.3" fill="#4D7C0F" />
    <rect x="22.4" y="8" width="2.6" height="7" rx="1.3" fill="#4D7C0F" />
    <path
      d="M20 25.5v2.5a3 3 0 0 0 3 3h4"
      fill="none"
      stroke="#4D7C0F"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <rect x="12.5" y="13.5" width="15" height="12.5" rx="4" fill="url(#me-ic-plug)" />
    <path
      d="M21 15.8l-3.2 4.4h3l-1.8 3.8"
      fill="none"
      stroke="#fff"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Frame>
);

export const ShareIcon: MeIcon = ({ className }) => (
  <Frame id="me-ic-share" from="#67E8F9" to="#0891B2" className={className}>
    <path
      d="M31.5 8.5L8.5 18.2l8.6 3.4 3.4 8.9z"
      fill="url(#me-ic-share)"
      stroke="url(#me-ic-share)"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M17.1 21.6l3.4 8.9 2.6-6.6z" fill="#0E7490" />
    <path d="M31.5 8.5L17.1 21.6" stroke="#fff" strokeOpacity={0.55} strokeWidth="1.3" strokeLinecap="round" />
  </Frame>
);

const GEAR_TEETH = [0, 45, 90, 135, 180, 225, 270, 315];

export const SettingsIcon: MeIcon = ({ className }) => (
  <Frame id="me-ic-gear" from="#CBD5E1" to="#64748B" className={className}>
    <g fill="url(#me-ic-gear)">
      {GEAR_TEETH.map((deg) => (
        <rect key={deg} x="17.6" y="7.5" width="4.8" height="6" rx="1.4" transform={`rotate(${deg} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="9.2" />
    </g>
    <circle cx="20" cy="20" r="3.6" fill="#fff" />
    <ellipse cx="16" cy="15.6" rx="1.8" ry="1.1" transform="rotate(-35 16 15.6)" {...SHEEN} />
  </Frame>
);
