import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

function TabIcon({ name, focused }: { name: FeatherName; focused: boolean }) {
  return (
    <Feather
      name={name}
      size={16}
      color={focused ? Colors.textPrimary : Colors.textMuted}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.mono,
          fontSize: 7,
          letterSpacing: 1.0,
        },
        tabBarActiveTintColor: Colors.textPrimary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'VOICE',
          tabBarIcon: ({ focused }) => <TabIcon name="mic" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'MAP',
          tabBarIcon: ({ focused }) => <TabIcon name="map" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'VAULT',
          tabBarIcon: ({ focused }) => <TabIcon name="lock" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
