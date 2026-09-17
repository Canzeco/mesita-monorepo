import { type ReactNode } from 'react';
import { Text } from 'react-native';

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        color: 'rgba(23,23,23,0.55)',
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        fontWeight: '700',
      }}
    >
      {children}
    </Text>
  );
}
