import type { ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { CoverWordmark, PhotoCover } from "@/components/photo-cover";
import { Text } from "@/components/text";
import { useKeyboardHeight } from "@/components/use-keyboard-height";
import { colors } from "@/theme";

import { HEADLINE, VALUE_LINE } from "../model";

type Props = {
  children: ReactNode;
  footer?: string;
  onClose?: () => void;
  /** On a tab: the photo ends above the bar, as the web's does. Android's bar
   *  already takes its own room. */
  aboveBar?: boolean;
};

/** The sign-in photo: the wordmark, the headline, the line, then the form. */
export function CoverPage({ children, footer, onClose, aboveBar = false }: Props) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  // iPhone's scroller makes its own room; Android's does not.
  const above = Platform.OS === "android" && keyboard > 0 ? keyboard + insets.bottom : 0;
  return (
    <View style={[styles.ground, { paddingBottom: above }, aboveBar && Platform.OS === "ios" && { paddingBottom: insets.bottom }]}>
      <PhotoCover>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[styles.page, { paddingTop: insets.top, paddingBottom: aboveBar ? 0 : insets.bottom }]}
        >
          <View style={styles.top}>
            <CoverWordmark />
            {onClose ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
                <Icon name="x" size={24} color={colors.onPhoto} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.form}>
            <Text role="hero" tone="onPhoto">
              {HEADLINE}
            </Text>
            <Text tone="onPhotoSoft" style={styles.line}>
              {VALUE_LINE}
            </Text>
            <View style={styles.fields}>{children}</View>
            {footer ? (
              <Text role="caption" tone="onPhotoFaint" style={styles.footer}>
                {footer}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </PhotoCover>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: colors.paper },
  page: { flexGrow: 1, justifyContent: "space-between" },
  top: { flexDirection: "row", justifyContent: "space-between", padding: 20 },
  close: { width: 44, height: 44, marginTop: -8, marginRight: -10, alignItems: "center", justifyContent: "center" },
  form: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 24 },
  line: { marginTop: 8 },
  fields: { marginTop: 24, gap: 12 },
  footer: { marginTop: 16, textAlign: "center" },
});
