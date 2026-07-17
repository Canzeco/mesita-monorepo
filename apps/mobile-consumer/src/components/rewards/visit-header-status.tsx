import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';

export function VisitHeaderStatus({
  transactionSummaryLine,
  statusLine,
}: {
  transactionSummaryLine?: string | null;
  statusLine?: string | null;
}) {
  return transactionSummaryLine ? (
    <LinearGradient
      colors={[...GRADIENTS.pink]}
      start={GRADIENT_DIAGONAL.start}
      end={GRADIENT_DIAGONAL.end}
      style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
    >
      <Text
        style={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        Status summary
      </Text>
      <Text
        style={{
          marginTop: 4,
          color: '#fff',
          fontSize: 12,
          fontWeight: '500',
          lineHeight: 16,
        }}
      >
        {transactionSummaryLine}
      </Text>
    </LinearGradient>
  ) : statusLine ? (
    <View
      style={{
        backgroundColor: 'rgba(255,247,248,0.7)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(235,217,219,0.5)',
      }}
    >
      <Text
        style={{
          color: '#775254',
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        Status summary
      </Text>
      <Text
        style={{
          marginTop: 2,
          color: '#260409',
          fontSize: 14,
          fontWeight: '500',
        }}
      >
        {statusLine}
      </Text>
    </View>
  ) : null;
}
