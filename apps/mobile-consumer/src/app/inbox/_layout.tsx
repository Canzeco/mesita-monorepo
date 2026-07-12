import { Stack } from 'expo-router';

export default function InboxLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#fff7f8' },
      }}
    />
  );
}
