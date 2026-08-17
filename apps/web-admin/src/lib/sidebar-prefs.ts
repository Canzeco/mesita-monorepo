// The desktop rail's collapsed state rides a cookie rather than localStorage:
// the admin shell is a server component, so reading it during render paints the
// rail at its final width on the first frame — no expand-then-snap flash, and
// no setState in an effect to reconcile it.
export const SIDEBAR_COLLAPSED_COOKIE = "admin_sidebar_collapsed";
