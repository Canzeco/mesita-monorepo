// An unknown /me/<segment> redirects to the hub, so while it resolves it
// draws the hub's own fallback (Pato, MESITA-2701: "the placeholders must be
// similar to the page you are loading, like the sizes").
export { default } from "../(hub)/loading";
