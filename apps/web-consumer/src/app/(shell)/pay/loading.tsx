import PayPage from "./page";

// /pay's fallback is the page itself (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"). Pay reads
// nothing, but a tap on the bar still waits a server round trip, and that
// wait was the (shell) spinner; the one Soon state has no data to stand in
// for, so it is drawn as it lands, from the page's own module so the two
// cannot drift. A file, not a child: Pay stays one page.
export default function PayLoading() {
  return <PayPage />;
}
