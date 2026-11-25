import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";

import { useGate } from "@/features/auth";
import { colors } from "@/theme";

// Material tints its bar from the wallpaper; iPhone's glass stays the system's.
const android = Platform.OS === "android";

export default function TabsLayout() {
  const { member } = useGate();
  return (
    <NativeTabs tintColor={colors.ink} backgroundColor={android ? colors.paper : undefined} indicatorColor={colors.fill}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="account_circle" />
        <NativeTabs.Trigger.Label>{member ? "Me" : "Sign"}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
