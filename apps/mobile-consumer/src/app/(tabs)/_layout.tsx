import { Tabs } from 'expo-router';
import { CalendarCheck, Home, QrCode, Search, User } from 'lucide-react-native';

// Mirrors the web BottomNav (src/components/consumer/BottomNav.tsx):
// Home / Search / Rewards / Reservations / Me, lucide glyphs, primary-pink
// active tint. Web's Home uses the MesitaMark brand SVG — porting that mark
// is a screen-port follow-up; lucide Home stands in until then.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#fb2b7b',
        tabBarInactiveTintColor: '#775254',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#ebd9db',
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 10,
        },
        sceneStyle: { backgroundColor: '#fff7f8' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color, size }) => <QrCode color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Reservations',
          tabBarIcon: ({ color, size }) => <CalendarCheck color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
