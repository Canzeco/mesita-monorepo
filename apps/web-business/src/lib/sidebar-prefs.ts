// The desktop rail's collapsed state rides a cookie rather than localStorage:
// the console shell is a server component, so reading it during render paints
// the rail at its final width on the first frame — no expand-then-snap flash,
// and no setState in an effect to reconcile it.
//
// Its own name, not admin's. Both consoles are served from *.mesita.ai and a
// shared cookie name would let one collapse the other.
export const SIDEBAR_COLLAPSED_COOKIE = "business_sidebar_collapsed";
