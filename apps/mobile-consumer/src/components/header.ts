import { colors, type } from "@/theme";

/** What every Stack's native header wears. */
export const headerOptions = {
  contentStyle: { backgroundColor: colors.page },
  statusBarStyle: "dark",
  headerTintColor: colors.ink,
  headerTitleStyle: { fontFamily: type.heading.fontFamily, fontSize: type.heading.fontSize, fontWeight: "600" },
} as const;
