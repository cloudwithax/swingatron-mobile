import {
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
  useState,
} from "react";
import { Animated, StyleSheet, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration = 3000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const toast: ToastMessage = { id, type, message, duration };
      setToasts((prev) => [...prev, toast]);
    },
    []
  );

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <ToastContainer toasts={toasts} onHide={hideToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onHide: (id: string) => void;
}

function ToastContainer({ toasts, onHide }: ToastContainerProps) {
  const insets = useSafeAreaInsets();

  if (!toasts.length) return null;

  return (
    <View
      style={[styles.container, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onHide={onHide} />
      ))}
    </View>
  );
}

interface ToastItemProps {
  toast: ToastMessage;
  onHide: (id: string) => void;
}

function ToastItem({ toast, onHide }: ToastItemProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    // animate in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // auto hide after duration
    const timer = setTimeout(() => {
      handleHide();
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleHide() {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide(toast.id);
    });
  }

  const icon = getToastIcon(toast.type);
  const colors = getToastColors(toast.type);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: colors.background,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }]}>
        <Ionicons name={icon} size={18} color={colors.icon} />
      </View>
      <ThemedText
        style={[styles.message, { color: colors.text }]}
        numberOfLines={2}
      >
        {toast.message}
      </ThemedText>
      <Pressable onPress={handleHide} style={styles.closeButton} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.text} />
      </Pressable>
    </Animated.View>
  );
}

function getToastIcon(type: ToastType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "success":
      return "checkmark-circle";
    case "error":
      return "alert-circle";
    case "warning":
      return "warning";
    case "info":
    default:
      return "information-circle";
  }
}

function getToastColors(type: ToastType) {
  switch (type) {
    case "success":
      return {
        background: "#1a2e1a",
        icon: "#4caf50",
        iconBg: "rgba(76,175,80,0.2)",
        text: "#e0e0e0",
      };
    case "error":
      return {
        background: "#2e1a1a",
        icon: "#ef5350",
        iconBg: "rgba(239,83,80,0.2)",
        text: "#e0e0e0",
      };
    case "warning":
      return {
        background: "#2e2a1a",
        icon: "#ffc107",
        iconBg: "rgba(255,193,7,0.2)",
        text: "#e0e0e0",
      };
    case "info":
    default:
      return {
        background: "#1a1a2e",
        icon: "#2196f3",
        iconBg: "rgba(33,150,243,0.2)",
        text: "#e0e0e0",
      };
  }
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  closeButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
