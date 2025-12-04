import { Stack } from "expo-router";

export default function HomeStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="album/[hash]" />
      <Stack.Screen name="artist/[hash]" />
      <Stack.Screen name="playlist/[id]" />
    </Stack>
  );
}
