import { Text as NativeText, type TextProps } from "react-native";

import { colors, maxFontSizeMultiplier, type as roles } from "@/theme";

type Props = Omit<TextProps, "role"> & { role?: keyof typeof roles; tone?: keyof typeof colors };

export function Text({ role = "body", tone = "ink", style, ...props }: Props) {
  return (
    <NativeText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...props}
      style={[roles[role], { color: colors[tone] }, style]}
    />
  );
}
