import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Index() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-2 px-6">
        <Text className="text-2xl font-bold text-foreground">Mesita Business</Text>
        <Text className="text-center text-base text-muted-foreground">
          Mobile app scaffold — nothing built yet.
        </Text>
      </View>
    </SafeAreaView>
  );
}
