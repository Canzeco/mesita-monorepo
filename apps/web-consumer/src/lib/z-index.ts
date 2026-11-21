// Overlay z-scale (package AGENTS.md): BottomNav 40 · pending tab 110 · @modal 120 · location gate 125 · local 130 · Toaster 140 · RouteBadge 150.
// Exported as Tailwind class tokens so class names stay statically discoverable.

export const Z_BOTTOM_NAV = "z-40";
// The tapped tab's placeholder over the old screen (MESITA-2846): above the
// page's own layers, under a route modal.
export const Z_PENDING_SCREEN = "z-[110]";
export const Z_ROUTE_MODAL = "z-[120]";
// No location, no Mesita (MESITA-4589): the ask covers every screen and a
// route modal, and the locations sheet (a local overlay) opens over it.
export const Z_LOCATION_GATE = "z-[125]";
export const Z_LOCAL_OVERLAY = "z-[130]";

export const Z_TOASTER = "z-[140]";
// The route read-out sits above everything: a modal or toast covering it
// would hide the route exactly when you most need to know which one opened.
export const Z_ROUTE_BADGE = "z-[150]";
