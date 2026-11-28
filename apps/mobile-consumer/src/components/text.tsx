import { Text as NativeText, type TextProps } from "react-native";

import { colors, maxFontSizeMultiplier, type as roles } from "@/theme";

type Props = Omit<TextProps, "role"> & { role?: keyof typeof roles; tone?: keyof typeof colors };

// includeFontPadding: the web draws no extra padding above and below a
// line; Android does unless told not to.
export function Text({ role = "body", tone = "ink", style, ...props }: Props) {
  return (
    <NativeText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...props}
      style={[roles[role], { color: colors[tone], includeFontPadding: false }, style]}
    />
  );
}
