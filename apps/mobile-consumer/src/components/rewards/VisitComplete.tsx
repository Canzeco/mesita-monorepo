import { CheckCircle2 } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { SHADOW_ELEV } from '@/constants/brand';

export function VisitComplete() {
  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#ebd9db',
        padding: 16,
        alignItems: 'center',
        ...SHADOW_ELEV,
      }}
    >
      <CheckCircle2 color="#059669" size={48} strokeWidth={1.75} />
      <Text
        style={{
          marginTop: 12,
          fontSize: 20,
          fontWeight: '700',
          color: '#260409',
        }}
      >
        Visit complete
      </Text>
      <Text
        style={{
          marginTop: 4,
          maxWidth: 280,
          textAlign: 'center',
          fontSize: 14,
          color: '#775254',
          lineHeight: 20,
        }}
      >
        Thanks for using Mesita at this restaurant. Your discount was applied to
        the bill.
      </Text>
    </View>
  );
}
