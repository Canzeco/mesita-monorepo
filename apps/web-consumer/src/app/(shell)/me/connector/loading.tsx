import { ConnectorModal } from "@/components/consumer/me/ConnectorModal";

// /me/connector's fallback is the page itself (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"). It reads nothing and has no door but Back: every word is fixed
// and every line is tagged Soon, so there is nothing to stand in for, and a
// silhouette would only blink into the same card.
export default function ConnectorLoading() {
  return <ConnectorModal />;
}
