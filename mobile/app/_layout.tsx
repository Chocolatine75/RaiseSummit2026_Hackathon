import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SituationProvider } from '@/context/SituationContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SituationProvider>
        <StatusBar style="light" backgroundColor="#0A0A0A" />
        <Stack screenOptions={{ headerShown: false }} />
      </SituationProvider>
    </SafeAreaProvider>
  );
}
