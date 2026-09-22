import { Stack } from 'expo-router';

import { COLORS } from '@/constants/brand';

export default function MeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    />
  );
}
