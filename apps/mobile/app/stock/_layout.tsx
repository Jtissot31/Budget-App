import { Stack } from 'expo-router';

export default function StockLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }} />;
}
