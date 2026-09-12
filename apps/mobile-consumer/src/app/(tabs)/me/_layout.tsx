import { Stack } from 'expo-router';

export default function MeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#fff7f8' },
      }}
    />
  );
}
