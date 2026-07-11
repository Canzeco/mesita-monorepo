import { QrCode } from 'lucide-react-native';
import { View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

// Parked on the web too (BottomNav soon=true, MESITA-383).
export default function RewardsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff7f8' }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
        }}
      >
        <Card
          mode="elevated"
          style={{ width: '100%', maxWidth: 360, borderRadius: 16 }}
        >
          <Card.Content style={{ alignItems: 'center', paddingVertical: 28 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: '#ffe4ef',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <QrCode color="#fb2b7b" size={28} />
            </View>
            <Text variant="headlineSmall" style={{ textAlign: 'center' }}>
              Rewards coming soon
            </Text>
            <Text
              variant="bodyMedium"
              style={{
                marginTop: 8,
                textAlign: 'center',
                color: '#775254',
              }}
            >
              Pay with QR and claim Mesita rewards from here shortly. Hang tight.
            </Text>
          </Card.Content>
        </Card>
      </View>
    </SafeAreaView>
  );
}
