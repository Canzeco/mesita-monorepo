import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, BadgeCheck } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GRADIENTS } from '@/constants/brand';

export function InstagramConnectedSummary({ followers }: { followers: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.25)',
        backgroundColor: 'rgba(16,185,129,0.05)',
        padding: 16,
      }}
    >
      <LinearGradient
        colors={[...GRADIENTS.instagram]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AtSign color="#fff" size={20} />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontWeight: '700' }}>
            Profile connected
          </Text>
          <BadgeCheck color="#059669" size={16} />
        </View>
        <Text style={{ color: '#775254', marginTop: 4 }}>
          {followers > 0
            ? `${followers.toLocaleString('en-US')} followers · Premium active`
            : 'Premium active'}
        </Text>
        <Text
          style={{ color: 'rgba(119,82,84,0.8)', marginTop: 2 }}
        >
          Post a story each visit to keep Premium.
        </Text>
      </View>
    </View>
  );
}
