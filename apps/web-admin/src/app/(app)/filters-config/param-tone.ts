// Discovery param chrome. Exponent is the super-param; every other number
// on the row is a normal hyperparameter. Ink vs mute is the distinction.

export type DiscoveryParamKind = "super" | "normal";

const BOX =
  "h-8 w-16 shrink-0 rounded-lg border bg-card px-2 text-right text-sm tabular-nums outline-none disabled:opacity-50";

export function discoveryParamChrome(kind: DiscoveryParamKind) {
  if (kind === "super") {
    return {
      label: "text-foreground type-label font-mono font-semibold",
      input: `${BOX} border-foreground text-foreground font-semibold focus:border-foreground`,
    };
  }
  return {
    label: "text-muted-foreground type-label font-mono",
    input: `${BOX} border-border text-foreground focus:border-foreground`,
  };
}
