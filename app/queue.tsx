import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { usePlayerStore } from "@/src/stores";
import { Palette } from "@/constants/theme";

function formatTimeFromSeconds(seconds?: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function QueueScreen() {
  const insets = useSafeAreaInsets();
  const {
    queue,
    currentIndex,
    removeFromQueue,
    skipTo,
    clearQueue,
    currentTrack,
    moveQueueItem,
  } = usePlayerStore();

  if (!queue.length) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.emptyState}>
          <Ionicons name="list" size={40} color={Palette.textMuted} />
          <ThemedText style={styles.emptyText}>Queue is empty</ThemedText>
        </View>
      </View>
    );
  }

  const previous = queue.slice(0, currentIndex);
  const current = queue[currentIndex];
  const next = queue.slice(currentIndex + 1);

  function renderQueueItem(track: (typeof queue)[number], index: number) {
    const isCurrent = index === currentIndex;
    const canMoveUp = index > 0;
    const canMoveDown = index < queue.length - 1;

    function handleRemove() {
      if (!isCurrent) {
        removeFromQueue(index);
      }
    }

    const rightActions = () => (
      <View style={styles.swipeActions}>
        <View style={styles.swipeRemoveButton}>
          <Ionicons name="trash" size={20} color="#ffffff" />
        </View>
      </View>
    );

    const content = (
      <View style={[styles.row, isCurrent && styles.rowActive]}>
        <View style={styles.rowMain}>
          <View style={styles.rowTitleBlock}>
            <ThemedText
              style={[styles.title, isCurrent && styles.titleActive]}
              numberOfLines={1}
            >
              {track.title}
            </ThemedText>
            <ThemedText style={styles.subtitle} numberOfLines={1}>
              {track.album}
            </ThemedText>
          </View>
          <ThemedText style={styles.duration}>
            {formatTimeFromSeconds(track.duration)}
          </ThemedText>
          {!isCurrent && (
            <View style={styles.reorderButtons}>
              <Pressable
                onPress={() => moveQueueItem(index, index - 1)}
                disabled={!canMoveUp}
                style={styles.reorderButton}
              >
                <Ionicons
                  name="chevron-up"
                  size={16}
                  color={canMoveUp ? Palette.textSecondary : Palette.textMuted}
                />
              </Pressable>
              <Pressable
                onPress={() => moveQueueItem(index, index + 1)}
                disabled={!canMoveDown}
                style={styles.reorderButton}
              >
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={
                    canMoveDown ? Palette.textSecondary : Palette.textMuted
                  }
                />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );

    if (isCurrent) {
      return content;
    }

    return (
      <Swipeable
        key={`${track.trackhash}:${index}`}
        renderRightActions={rightActions}
        onSwipeableOpen={handleRemove}
      >
        <Pressable
          onPress={() => {
            void skipTo(index);
          }}
        >
          {content}
        </Pressable>
      </Swipeable>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.headerTitle}>Queue</ThemedText>
          {currentTrack ? (
            <ThemedText style={styles.headerSubtitle} numberOfLines={1}>
              Now playing: {currentTrack.title}
            </ThemedText>
          ) : null}
        </View>
        <Text
          style={styles.clearLabel}
          onPress={() => {
            void clearQueue();
          }}
        >
          Clear
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* now playing */}
        {current && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Now Playing</ThemedText>
            <View style={[styles.row, styles.nowPlayingRow]}>
              <View style={styles.rowMain}>
                <View style={styles.rowTitleBlock}>
                  <ThemedText
                    style={[styles.title, styles.titleActive]}
                    numberOfLines={1}
                  >
                    {current.title}
                  </ThemedText>
                  <ThemedText style={styles.subtitle} numberOfLines={1}>
                    {current.album}
                  </ThemedText>
                </View>
                <ThemedText style={styles.duration}>
                  {formatTimeFromSeconds(current.duration)}
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* next up */}
        {next.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Next Up</ThemedText>
            <View style={styles.sectionList}>
              {next.map((track, idx) =>
                renderQueueItem(track, currentIndex + 1 + idx)
              )}
            </View>
          </View>
        )}

        {/* previously played */}
        {previous.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>History</ThemedText>
            <View style={styles.sectionList}>
              {previous.map((track, idx) => renderQueueItem(track, idx))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Palette.textPrimary,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: Palette.textMuted,
  },
  clearLabel: {
    fontSize: 14,
    color: Palette.caution,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Palette.textPrimary,
    marginBottom: 8,
  },
  sectionList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.border,
  },
  nowPlayingRow: {
    backgroundColor: Palette.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 0,
  },
  rowActive: {
    backgroundColor: Palette.surfaceVariant,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reorderButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  reorderButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    color: Palette.textSecondary,
  },
  titleActive: {
    color: Palette.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  duration: {
    fontSize: 12,
    color: Palette.textMuted,
    fontVariant: ["tabular-nums"],
  },
  swipeActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: Palette.caution,
  },
  swipeRemoveButton: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Palette.textMuted,
  },
});
