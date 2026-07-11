import { LinearGradient } from 'expo-linear-gradient';
import { Bot, Heart, Sparkles, Users } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import { useAuth } from '@/providers/auth';

// Home hub — the four discovery modes from the web (/home/{swipe,ai,social,
// favorites}). Mode screens are ported one by one (see Linear project);
// these tiles are the hub frame they'll mount into.
const MODES: {
  key: string;
  title: string;
  hint: string;
  Icon: ComponentType<{ color?: string; size?: number }>;
}[] = [
  { key: 'swipe', title: 'Swipe', hint: 'Discover places one card at a time', Icon: Sparkles },
  { key: 'ai', title: 'Ask AI', hint: 'Don Memo knows where to go', Icon: Bot },
  { key: 'social', title: 'Social', hint: 'What your circle is loving', Icon: Users },
  { key: 'favorites', title: 'Favorites', hint: 'Your saved places', Icon: Heart },
];

export default function HomeScreen() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0];

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        colors={[...GRADIENTS.hero]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}
      />
      <SafeAreaView className="flex-1">
        <ScrollView contentContainerClassName="px-5 pb-10">
          <Text className="mt-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Mesita
          </Text>
          <Text className="mt-1 font-display text-3xl text-foreground">
            {firstName ? `Hola, ${firstName}` : 'Hola'}
          </Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            ¿Dónde comemos hoy?
          </Text>

          <View className="mt-6 flex-row flex-wrap justify-between">
            {MODES.map(({ key, title, hint, Icon }) => (
              <View
                key={key}
                className="mb-4 w-[48%] rounded-2xl border border-border bg-card p-4"
                style={SHADOW_ELEV}
              >
                <View className="size-9 items-center justify-center rounded-xl bg-primary/10">
                  <Icon color="#fb2b7b" size={18} />
                </View>
                <Text className="mt-3 text-sm font-semibold text-foreground">{title}</Text>
                <Text className="mt-1 text-xs leading-4 text-muted-foreground">{hint}</Text>
              </View>
            ))}
          </View>

          <View className="mt-2 rounded-2xl border border-border bg-card p-5" style={SHADOW_ELEV}>
            <Text className="text-sm font-semibold text-foreground">Screens landing soon</Text>
            <Text className="mt-1 text-xs leading-5 text-muted-foreground">
              This is the mobile bootstrap — each mode above is being ported from the web app
              (mesita-web-consumer) screen by screen.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
