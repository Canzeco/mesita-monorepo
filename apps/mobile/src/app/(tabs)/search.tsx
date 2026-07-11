import { MapPin } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Search = map + catalog search on the web. The map (react-native-maps,
// Google provider) needs platform Google Maps keys — tracked in the Linear
// project as its own issue.
export default function SearchScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-8">
        <View className="size-12 items-center justify-center rounded-xl bg-primary/10">
          <MapPin color="#fb2b7b" size={22} />
        </View>
        <Text className="mt-4 font-display text-2xl text-foreground">Search</Text>
        <Text className="mt-2 text-center text-sm leading-5 text-muted-foreground">
          Map + catalog search port lands here (react-native-maps · Google provider).
        </Text>
      </View>
    </SafeAreaView>
  );
}
