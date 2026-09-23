import { ActivityIndicator, Text, View } from "react-native";

import { PayClient } from "@/components/rewards/PayClient";
import { ShellWash } from "@/components/ui/HeroBackdrop";
import { COLORS } from "@/constants/brand";
import { useAuth } from "@/providers/auth";
import { SafeAreaView } from "react-native-safe-area-context";

// Visit › Pay (MESITA-2050) — web's /new-visit, the place list that starts a
// visit. The route stays `(tabs)/rewards`; only the label and the frame moved.
// No `profile` read: the list needs the user id and nothing else (MESITA-820).
export default function RewardsScreen() {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <ShellWash>
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={COLORS.primary} />
          </View>
        </SafeAreaView>
      </ShellWash>
    );
  }

  if (!session?.user) {
    return (
      <ShellWash>
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          <View className="p-6">
            <Text
              className="font-semibold text-foreground"
              style={{ fontSize: 16 }}
            >
              Sign in to pay
            </Text>
          </View>
        </SafeAreaView>
      </ShellWash>
    );
  }

  return (
    <ShellWash>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <PayClient userId={session.user.id} />
      </SafeAreaView>
    </ShellWash>
  );
}
