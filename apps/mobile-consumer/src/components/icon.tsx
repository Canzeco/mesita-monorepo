import type React from "react";
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from "react-native-svg";

import { ICONS, type IconShape } from "@/components/icon-nodes";
import { colors, iconStroke } from "@/theme";

const TAGS = { path: Path, circle: Circle, rect: Rect, line: Line, polyline: Polyline, polygon: Polygon, ellipse: Ellipse } as const;

export type IconName = keyof typeof ICONS;

/** One of the web's icons (lucide, or a brand mark that keeps its own
 *  colours). Decorative: the control around it is labelled. */
export function Icon({
  name,
  size = 16,
  color = colors.ink,
  strokeWidth = iconStroke,
  fill = false,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** The web's fill-current on an outline icon (Add's Zap). */
  fill?: boolean;
}) {
  const icon: IconShape = ICONS[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={icon.box}
      fill={icon.filled || fill ? color : "none"}
      stroke={icon.stroked ? color : "none"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {icon.nodes.map(([tag, { tone, ...attrs }], i) => {
        const Shape = TAGS[tag as keyof typeof TAGS] as unknown as React.ComponentType<Record<string, string>>;
        const fill = attrs.fill === "@" ? color : tone ? colors[tone as keyof typeof colors] : attrs.fill;
        return <Shape key={String(i)} {...attrs} {...(fill ? { fill } : null)} />;
      })}
    </Svg>
  );
}

const SEAL =
  "M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34Z";
const CHECK = "M10.54 16.2 6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77Z";

/** The seal after a place's name. Red for Premier, blue for an ad slot. */
export function PremierSeal({
  size = 20,
  color = colors.premier,
  check = colors.onInk,
}: {
  size?: number;
  color?: string;
  check?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Mesita Premier">
      <Path d={SEAL} fill={color} />
      <Path d={CHECK} fill={check} />
    </Svg>
  );
}
