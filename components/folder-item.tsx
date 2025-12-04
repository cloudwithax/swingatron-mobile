import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { Palette, Radii } from "@/constants/theme";
import type { Folder } from "@/src/api/types";

interface FolderItemProps {
  folder: Folder;
  onPress?: (folder: Folder) => void;
}

export function FolderItem({ folder, onPress }: FolderItemProps) {
  function handlePress() {
    onPress?.(folder);
  }

  const separator = "\u2022";

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <View style={styles.iconContainer}>
        <Ionicons name="folder" size={24} color={Palette.textSecondary} />
      </View>
      <View style={styles.info}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {folder.name}
        </ThemedText>
        <ThemedText style={styles.meta}>
          {folder.trackcount !== undefined && folder.trackcount > 0 && (
            <>
              {folder.trackcount} {folder.trackcount === 1 ? "track" : "tracks"}
            </>
          )}
          {folder.foldercount !== undefined &&
            folder.foldercount > 0 &&
            folder.trackcount !== undefined &&
            folder.trackcount > 0 &&
            `  ${separator} `}
          {folder.foldercount !== undefined && folder.foldercount > 0 && (
            <>
              {folder.foldercount}{" "}
              {folder.foldercount === 1 ? "folder" : "folders"}
            </>
          )}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Palette.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 14,
    borderRadius: Radii.md,
    backgroundColor: Palette.surface,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radii.sm,
    backgroundColor: Palette.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: Palette.textPrimary,
    letterSpacing: 0.2,
  },
  meta: {
    fontSize: 13,
    color: Palette.textMuted,
  },
});
