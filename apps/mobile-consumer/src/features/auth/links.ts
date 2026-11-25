import { isAppPath } from "./routes";

const WEB_HOSTS = ["mesita.ai", "www.mesita.ai"];
const GATES = ["update", "suspended", "onboarding", "open"] as const;

export type Link =
  | { kind: "path"; path: string }
  /** A development or preview link that forces a gate, to screenshot it. */
  | { kind: "gate"; gate: (typeof GATES)[number] }
  /** Not for the app. */
  | { kind: "ignore" };

/** Where an incoming address goes. A link never acts. A mesita.ai page this
 *  build has no screen for opens in an in-app browser, so a link the web could
 *  serve never dead-ends. Old web addresses are rewritten here and only here. */
export function readLink(address: string, allowForcedGate: boolean): Link {
  let url: URL;
  try {
    url = new URL(address.startsWith("/") ? `https://mesita.ai${address}` : address);
  } catch {
    return { kind: "path", path: "/" };
  }
  const web = url.protocol === "https:" || url.protocol === "http:";
  if (web && !WEB_HOSTS.includes(url.hostname)) return { kind: "ignore" };
  // The dev client's own link carries the bundler's address.
  if (!web && url.hostname === "expo-development-client") return { kind: "path", path: "/" };
  // mesita://place/1 and mesita:///place/1 are the same address.
  const bare = `/${[web ? "" : url.hostname, ...url.pathname.split("/")].filter(Boolean).join("/")}`;
  if (bare.startsWith("/stripe-redirect")) return { kind: "ignore" };
  if (bare.startsWith("/gate/")) {
    const gate = GATES.find((g) => bare === `/gate/${g}`);
    return allowForcedGate && gate ? { kind: "gate", gate } : { kind: "path", path: "/" };
  }
  if (bare === "/home") return { kind: "path", path: `/${url.search}` };
  if (bare === "/sign") return { kind: "path", path: "/sign-in" };
  const path = bare + url.search;
  if (bare === "/open" || !isAppPath(bare)) return { kind: "path", path: `/open?page=${encodeURIComponent(path)}` };
  return { kind: "path", path };
}
