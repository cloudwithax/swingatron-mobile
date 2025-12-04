import { useState, useRef } from "react";
import {
  ActivityIndicator,
  TextInput,
  View,
  Pressable,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthStore } from "@/src/stores";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Palette, Radii } from "@/constants/theme";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    users,
    isLoading,
    error,
    serverUrl,
    isServerConfigured,
    fetchUsers,
    login,
    validateServer,
  } = useAuthStore();

  const [step, setStep] = useState<"server" | "user">("server");
  const [urlInput, setUrlInput] = useState(serverUrl ?? "");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  function animateTransition(callback: () => void) {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(callback, 150);
  }

  async function handleValidateServer() {
    const ok = await validateServer(urlInput.trim());
    if (!ok) return;
    await fetchUsers();
    animateTransition(() => setStep("user"));
  }

  async function handleLogin() {
    if (!selectedUser || !password) return;
    await login(selectedUser, password);
    router.replace("/");
  }

  function handleBack() {
    animateTransition(() => {
      setStep("server");
      setSelectedUser(null);
      setPassword("");
    });
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* logo section */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Ionicons
                name="musical-notes"
                size={48}
                color={Palette.primary}
              />
            </View>
            <ThemedText type="title" style={styles.title}>
              Swingatron
            </ThemedText>
            <Text style={styles.tagline}>Your Music, Everywhere</Text>
          </View>

          <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
            {step === "server" && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.stepIndicator}>
                    <Text style={styles.stepNumber}>1</Text>
                  </View>
                  <View style={styles.sectionHeaderText}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>
                      Connect to Server
                    </ThemedText>
                    <Text style={styles.description}>
                      Enter your Swing Music server address
                    </Text>
                  </View>
                </View>

                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconContainer}>
                    <Ionicons
                      name="server-outline"
                      size={20}
                      color={Palette.textMuted}
                    />
                  </View>
                  <TextInput
                    value={urlInput}
                    onChangeText={setUrlInput}
                    placeholder="http://192.168.1.100:1970"
                    placeholderTextColor={Palette.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={styles.input}
                  />
                </View>

                {error ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color="#ef5350" />
                    <Text style={styles.error}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  disabled={!urlInput.trim() || isLoading}
                  onPress={handleValidateServer}
                  style={({ pressed }) => [
                    styles.button,
                    (!urlInput.trim() || isLoading) && styles.buttonDisabled,
                    pressed && !isLoading && styles.buttonPressed,
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Palette.onPrimary} />
                  ) : (
                    <>
                      <Text style={styles.buttonLabel}>Continue</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={18}
                        color={Palette.onPrimary}
                      />
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {step === "user" && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Pressable onPress={handleBack} style={styles.backButton}>
                    <Ionicons
                      name="arrow-back"
                      size={20}
                      color={Palette.textMuted}
                    />
                  </Pressable>
                  <View style={styles.stepIndicator}>
                    <Text style={styles.stepNumber}>2</Text>
                  </View>
                  <View style={styles.sectionHeaderText}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>
                      Sign In
                    </ThemedText>
                    {isServerConfigured ? (
                      <View style={styles.serverBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color="#4caf50"
                        />
                        <Text style={styles.serverUrl} numberOfLines={1}>
                          {serverUrl}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Select User</Text>
                <View style={styles.userList}>
                  {users.map((user) => (
                    <Pressable
                      key={user.id}
                      onPress={() => setSelectedUser(user.username)}
                      style={({ pressed }) => [
                        styles.userItem,
                        selectedUser === user.username &&
                          styles.userItemSelected,
                        pressed && styles.userItemPressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.userAvatar,
                          selectedUser === user.username &&
                            styles.userAvatarSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.userInitial,
                            selectedUser === user.username &&
                              styles.userInitialSelected,
                          ]}
                        >
                          {user.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.userName,
                          selectedUser === user.username &&
                            styles.userNameSelected,
                        ]}
                      >
                        {user.username}
                      </Text>
                      {selectedUser === user.username && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={Palette.onPrimary}
                        />
                      )}
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconContainer}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={Palette.textMuted}
                    />
                  </View>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={Palette.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.passwordToggle}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={Palette.textMuted}
                    />
                  </Pressable>
                </View>

                {error ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color="#ef5350" />
                    <Text style={styles.error}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  disabled={!selectedUser || !password || isLoading}
                  onPress={handleLogin}
                  style={({ pressed }) => [
                    styles.button,
                    (!selectedUser || !password || isLoading) &&
                      styles.buttonDisabled,
                    pressed && !isLoading && styles.buttonPressed,
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Palette.onPrimary} />
                  ) : (
                    <>
                      <Text style={styles.buttonLabel}>Sign In</Text>
                      <Ionicons
                        name="log-in-outline"
                        size={18}
                        color={Palette.onPrimary}
                      />
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </Animated.View>

          {/* footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Powered by Swing Music</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: Palette.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    color: Palette.textMuted,
    marginTop: 8,
  },
  formContainer: {
    flex: 1,
    justifyContent: "center",
  },
  section: {
    backgroundColor: Palette.surface,
    borderRadius: Radii.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.surfaceVariant,
    justifyContent: "center",
    alignItems: "center",
  },
  stepIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: Palette.onPrimary,
  },
  sectionHeaderText: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  serverBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  serverUrl: {
    fontSize: 13,
    color: Palette.textMuted,
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.textSecondary,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surfaceVariant,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: 16,
  },
  inputIconContainer: {
    paddingLeft: 14,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 14,
    color: Palette.textPrimary,
    fontSize: 16,
  },
  passwordToggle: {
    padding: 14,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 83, 80, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.sm,
    marginBottom: 16,
  },
  error: {
    color: "#ef5350",
    fontSize: 13,
    flex: 1,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radii.xl,
    paddingVertical: 14,
    backgroundColor: Palette.primary,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Palette.onPrimary,
  },
  userList: {
    gap: 10,
    marginBottom: 20,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radii.md,
    backgroundColor: Palette.surfaceVariant,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  userItemSelected: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  userItemPressed: {
    opacity: 0.85,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  userAvatarSelected: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderColor: "transparent",
  },
  userInitial: {
    fontSize: 16,
    fontWeight: "600",
    color: Palette.textPrimary,
  },
  userInitialSelected: {
    color: Palette.onPrimary,
  },
  userName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: Palette.textPrimary,
  },
  userNameSelected: {
    color: Palette.onPrimary,
  },
  footer: {
    alignItems: "center",
    marginTop: 32,
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 13,
    color: Palette.textMuted,
  },
});
