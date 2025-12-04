import { useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useFolderStore } from "@/src/stores";

export default function FoldersScreen() {
  const insets = useSafeAreaInsets();
  const folderStore = useFolderStore();

  useEffect(() => {
    if (!folderStore.rootFolders.length && !folderStore.folders.length) {
      void folderStore.loadRootFolders();
    }
  }, [folderStore]);

  function renderContent() {
    if (folderStore.isLoading && !folderStore.folders.length) {
      return <ActivityIndicator style={styles.loading} />;
    }
    if (folderStore.error) {
      return <Text style={styles.error}>{folderStore.error}</Text>;
    }
    if (!folderStore.rootFolders.length && !folderStore.folders.length) {
      return <ThemedText style={styles.placeholder}>No folders</ThemedText>;
    }
    return (
      <FlatList
        data={folderStore.folders}
        keyExtractor={(item) => item.path}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              void folderStore.navigateToFolder(item);
            }}
            style={styles.row}
          >
            <ThemedText numberOfLines={1}>{item.name}</ThemedText>
          </Pressable>
        )}
      />
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ThemedText type="title">Folders</ThemedText>
      </View>
      <View style={styles.content}>{renderContent()}</View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loading: {
    marginTop: 16,
  },
  error: {
    marginTop: 8,
    color: "#ef5350",
  },
  placeholder: {
    marginTop: 16,
    color: "#9e9e9e",
  },
  row: {
    paddingVertical: 6,
  },
});
