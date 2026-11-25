import { Pressable, StyleSheet, View } from "react-native";

import { CoverWordmark, PhotoCover } from "@/components/photo-cover";
import { Text } from "@/components/text";
import { Window } from "@/components/window";
import { cardVeil, colors, pressedOpacity, radius } from "@/theme";

import { HEADLINE, VALUE_LINE } from "../model";

/** Asked when the app opens signed out: sign in, or just browse. */
export function WelcomeScreen({ onSignIn, onBrowse }: { onSignIn: () => void; onBrowse: () => void }) {
  return (
    <Window label="Welcome to Mesita" onClose={onBrowse}>
      <View style={styles.card}>
        <PhotoCover veil={cardVeil}>
          <View style={styles.page}>
            <CoverWordmark />
            <View>
              <Text role="cover" tone="onPhoto">
                {HEADLINE}
              </Text>
              <Text role="small" tone="onPhotoSoft" style={styles.line}>
                {VALUE_LINE}
              </Text>
              <Choice label="Sign in" filled onPress={onSignIn} />
              <Choice label="Just browse" onPress={onBrowse} />
            </View>
          </View>
        </PhotoCover>
      </View>
    </Window>
  );
}

function Choice({ label, filled = false, onPress }: { label: string; filled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.choice, filled ? styles.filled : styles.plain, pressed && { opacity: pressedOpacity }]}
    >
      <Text role="label" tone={filled ? "ink" : "onPhoto"}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", aspectRatio: 4 / 5 },
  page: { flex: 1, justifyContent: "space-between", padding: 20 },
  line: { marginTop: 8 },
  choice: { height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.field },
  filled: { marginTop: 16, backgroundColor: colors.paper },
  plain: { marginTop: 4 },
});
