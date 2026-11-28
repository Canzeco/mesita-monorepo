import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";

import { useGate } from "@/features/auth";
import { colors } from "@/theme";

// Material tints its bar from the wallpaper; iPhone's glass stays the system's.
const HOME = require("../../../assets/icons/tab-mark.png");

const android = Platform.OS === "android";

export default function TabsLayout() {
  const { member } = useGate();
  return (
    <NativeTabs tintColor={colors.ink} backgroundColor={android ? colors.paper : undefined} indicatorColor={colors.fill}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon src={HOME} renderingMode="template" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="pay">
        <NativeTabs.Trigger.Icon sf="creditcard" md="payments" />
        <NativeTabs.Trigger.Label>Pay</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bookings" hidden={!member}>
        <NativeTabs.Trigger.Icon sf="calendar.badge.checkmark" md="event_available" />
        <NativeTabs.Trigger.Label>Bookings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="account_circle" />
        <NativeTabs.Trigger.Label>{member ? "Me" : "Sign"}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
