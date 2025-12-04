import { Pressable, StyleSheet, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import { ThemedText } from "@/components/themed-text";
import { Colors, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type TabItem = {
  name: string;
  path: string;
  icon: IconSymbolName;
};

const tabs: TabItem[] = [
  { name: "Home", path: "/", icon: "house.fill" },
  { name: "Search", path: "/search", icon: "magnifyingglass" },
  { name: "Library", path: "/library", icon: "rectangle.stack" },
  { name: "Settings", path: "/settings", icon: "gearshape.fill" },
];

export function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();

  function handlePress(path: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(path as never);
  }

  return (
    <View style={[styles.container, { height: 60 + insets.bottom, paddingBottom: 8 + insets.bottom }]}>
      {tabs.map((tab) => {
        const isActive = pathname === tab.path;
        const color = isActive
          ? Colors[colorScheme ?? "dark"].tint
          : Palette.textMuted;

        return (
          <Pressable
            key={tab.path}
            style={styles.tab}
            onPress={() => handlePress(tab.path)}
          >
            <IconSymbol size={24} name={tab.icon} color={color} />
            <ThemedText style={[styles.label, { color }]}>{tab.name}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderTopColor: Palette.borderVariant,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.2,
    marginTop: 2,
  },
});
