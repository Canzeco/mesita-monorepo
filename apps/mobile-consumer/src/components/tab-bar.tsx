import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/icon";
import { Text } from "@/components/text";
import { useKeyboardHeight } from "@/components/use-keyboard-height";
import { colors, radius, space, text } from "@/theme";

// THE WEB'S BOTTOM BAR, DRAWN (Pato, 2026-11-28, MESITA-5102: "ignore the
// Apple bubble menu. Use Mesita own components for both bottom menu and
// headers"). Copied from apps/web-consumer/src/components/consumer/BottomNav.tsx:
// white at 95% with a hairline on top; five items, each a 20pt icon in a
// 32pt circle over a 10/14 semibold label; the lit item's circle is ink with
// a paper icon, its label ink, and a 32×4 ink bar sits on the bar's top
// edge. Me wears the guest's photo (24pt) and the web's count bubble. The
// web's fake home-indicator strip is the device's own here: the bar pads
// itself by the bottom safe area instead.

export type TabItem = {
  /** The tab's route name in the (tabs) navigator. */
  route: string;
  label: string;
  icon: IconName;
};

export type TabRoute = { key: string; name: string };

type Props = {
  items: readonly TabItem[];
  routes: readonly TabRoute[];
  focusedKey: string;
  /** The tabs navigator's own press: emits tabPress (re-tap scrolls to the
   *  top or pops to the root) and switches tabs. */
  onPress: (route: TabRoute, focused: boolean) => void;
  /** The guest's photo on Me, when they have one. */
  avatarUrl: string | null;
  /** Unseen notifications: Me's bubble. */
  unseen: number;
  /** Hide the bar (a screen that owns the whole frame, as on the web). */
  hidden: boolean;
};

export function TabBar(props: Props) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  if (props.hidden || keyboard > 0) return null;
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.xs) }]} role="tablist">
      <View style={styles.row}>
        {props.items.map((item) => {
          const route = props.routes.find((r) => r.name === item.route);
          if (!route) return null;
          const focused = route.key === props.focusedKey;
          const photo = item.route === "me" && item.label === "Me" && props.avatarUrl ? props.avatarUrl : null;
          return (
            <Pressable
              key={route.key}
              role="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={item.label}
              onPress={() => {
                if (!focused) void Haptics.selectionAsync();
                props.onPress(route, focused);
              }}
              style={styles.item}
            >
              {focused ? <View style={styles.lit} /> : null}
              <View style={[styles.circle, focused && styles.circleOn]}>
                {photo ? (
                  <View style={[styles.photoFrame, focused && styles.photoOn]}>
                    <Image source={photo} style={styles.photo} contentFit="cover" />
                  </View>
                ) : (
                  <Icon
                    name={item.icon}
                    size={20}
                    color={focused ? colors.onInk : colors.muted}
                    strokeWidth={focused ? 2.25 : 1.75}
                  />
                )}
                {item.route === "me" && props.unseen > 0 ? (
                  <View style={styles.bubbleSpot}>
                    <CountBubble count={props.unseen} />
                  </View>
                ) : null}
              </View>
              <Text role="meta" tone={focused ? "ink" : "muted"} numberOfLines={1} maxFontSizeMultiplier={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The web's one badge (CountBubble.tsx): a 20pt red pill, "9+" past nine,
 *  ringed in the bar's white. */
export function CountBubble({ count }: { count: number }) {
  return (
    <View style={styles.bubble} accessible={false}>
      <Text role="meta" tone="onInk" maxFontSizeMultiplier={1} style={styles.bubbleText}>
        {count > 9 ? "9+" : String(count)}
      </Text>
    </View>
  );
}

type FallbackProps = {
  children: ReactNode;
  items: readonly TabItem[];
  onPick: (route: string) => void;
  onError: (error: unknown) => void;
};

/** A bar that throws must not strand the guest: five plain words that still
 *  switch tabs, and the drawn bar again on the next navigation. */
export class TabBarBoundary extends Component<FallbackProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={[styles.bar, styles.row, styles.fallback]}>
        {this.props.items.map((item) => (
          <Pressable
            key={item.route}
            role="tab"
            onPress={() => {
              this.setState({ failed: false });
              this.props.onPick(item.route);
            }}
            style={styles.item}
          >
            <Text role="label">{item.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  // border-border bg-card/95 border-t px-0.5 pt-2
  bar: {
    backgroundColor: colors.bar,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 2,
    paddingTop: space.sm,
  },
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around" },
  // flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "center",
    gap: space.xs,
    borderRadius: radius.lg,
    paddingHorizontal: 2,
    paddingVertical: space.xs,
  },
  // absolute -top-2 h-1 w-8 rounded-full bg-primary
  lit: { position: "absolute", top: -space.sm, width: 32, height: 4, borderRadius: radius.full, backgroundColor: colors.ink },
  circle: { width: 32, height: 32, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  circleOn: { backgroundColor: colors.ink },
  photo: { width: 24, height: 24, borderRadius: radius.full },
  // ring-2 ring-primary-foreground: the ring sits outside the 24pt photo.
  photoFrame: { width: 28, height: 28, borderRadius: radius.full, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  photoOn: { borderColor: colors.onInk },
  // absolute -top-1.5 -right-3
  // -top-1.5 -right-3 of the 20pt pill; its 2pt ring adds 2 on each side.
  bubbleSpot: { position: "absolute", top: -8, right: -14 },
  // h-5 min-w-5 rounded-full px-1.5 bg-destructive, ring-2 ring-card
  bubble: {
    height: 24,
    minWidth: 24,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleText: { fontVariant: ["tabular-nums"], lineHeight: text.meta.fontSize },
  fallback: { paddingVertical: space.md },
});
