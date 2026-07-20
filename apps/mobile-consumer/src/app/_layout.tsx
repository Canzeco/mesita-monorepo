import '@/global.css';

import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Toaster } from '@/components/ui/Toaster';
import { Sentry } from '@/lib/sentry';
import { AuthProvider } from '@/providers/auth';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

const MODAL_SCREEN = {
  presentation: 'modal' as const,
  animation: 'slide_from_bottom' as const,
  gestureEnabled: true,
  contentStyle: { backgroundColor: '#fff7f8' },
};

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Branded wash while fonts load — avoids blank flash before splash hide (#50).
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#fff7f8' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#fff7f8' },
            }}
          >
            {/* Place / coupon / reservation — web @modal / SlideOver peers. */}
            <Stack.Screen name="place/[id]" options={MODAL_SCREEN} />
            <Stack.Screen name="coupon/[id]" options={MODAL_SCREEN} />
            <Stack.Screen
              name="saved/reservation/[id]"
              options={MODAL_SCREEN}
            />
          </Stack>
          <Toaster />
          {/* PortalHost for @rn-primitives; sheets use RN Modal. */}
          <PortalHost />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
