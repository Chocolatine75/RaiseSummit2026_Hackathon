import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SituationProvider } from '@/context/SituationContext';

export default function RootLayout() {
  return (
    <SituationProvider>
      <StatusBar style="light" backgroundColor="#0A0A0A" />
      <Stack screenOptions={{ headerShown: false }} />
    </SituationProvider>
  );
}
