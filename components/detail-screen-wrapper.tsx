import { type ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TabBar } from "@/components/tab-bar";
import { ExpandablePlayer } from "@/components/expandable-player";
import { Palette } from "@/constants/theme";

type DetailScreenWrapperProps = {
  children: ReactNode;
};

// wraps detail screens with the tab bar and mini player
export function DetailScreenWrapper({ children }: DetailScreenWrapperProps) {
  const insets = useSafeAreaInsets();
  // tab bar height is 60 + bottom inset
  const tabBarHeight = 60 + insets.bottom;

  return (
    <View style={styles.container}>
      <View style={styles.content}>{children}</View>
      <ExpandablePlayer miniPlayerBottomOffset={tabBarHeight} />
      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  content: {
    flex: 1,
  },
});
