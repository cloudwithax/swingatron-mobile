import { Stack } from 'expo-router';

// auth layout handles login flow screens
// navigation guards are handled by the root layout
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
