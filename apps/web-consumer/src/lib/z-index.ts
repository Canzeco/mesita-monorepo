// Overlay z-scale (package AGENTS.md): BottomNav 40 · @modal 120 · local 130 · Toaster 140 · RouteBadge 150.
// Exported as Tailwind class tokens so class names stay statically discoverable.

export const Z_BOTTOM_NAV = "z-40";
export const Z_ROUTE_MODAL = "z-[120]";
export const Z_LOCAL_OVERLAY = "z-[130]";
export const Z_TOASTER = "z-[140]";
// The route read-out sits above everything: a modal or toast covering it
// would hide the route exactly when you most need to know which one opened.
export const Z_ROUTE_BADGE = "z-[150]";

// In-card overlays that share the bottom-nav numeric tier (save/skip badges).
export const Z_IN_FRAME_OVERLAY = "z-40";
