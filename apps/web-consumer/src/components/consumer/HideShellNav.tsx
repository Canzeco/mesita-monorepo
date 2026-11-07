// A PLACE PROFILE OWNS THE WHOLE FRAME (Pato, MESITA-3300: "when seeing a
// profile, you must hide the bottom menu"). The shell's bar hides itself
// through its data hook rather than a route list: whether the bar belongs on
// a screen is that screen's statement (see BottomNav), and the @modal host
// sits above the body only, never over the bar (MESITA-2747), so a panel
// cannot cover it. Rendered by the direct-link page and its skeleton, the
// generating page, and SlideOverShell for the intercepted place routes; the
// style leaves with the subtree, so the bar is back the moment the profile is.
export function HideShellNav() {
  return <style>{`nav[data-shell-nav]{display:none}`}</style>;
}
