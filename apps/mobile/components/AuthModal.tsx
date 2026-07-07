/**
 * AuthModal — Liderlik tablosu kaydı için takma ad (nickname) belirleme modalı
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";
import { Spacing, BorderRadius, ThemeColors } from "../constants/theme";
import { usePreferences } from "../context/PreferencesContext";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmitNickname?: (nickname: string) => void;
}

export function AuthModal({ visible, onClose, onSubmitNickname }: Props) {
  const { nickname, saveNickname } = useAuth();
  const { colors, language, t } = usePreferences();
  const styles = createStyles(colors);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (nickname) {
      setName(nickname);
    }
  }, [nickname, visible]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(t("error"), t("enterNickname"));
      return;
    }
    if (trimmed.length < 2) {
      Alert.alert(t("error"), language === "tr" ? "Takma ad en az 2 karakter olmalı." : "Nickname must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 20) {
      Alert.alert(t("error"), language === "tr" ? "Takma ad en fazla 20 karakter olmalı." : "Nickname can be at most 20 characters.");
      return;
    }

    setLoading(true);
    try {
      await saveNickname(trimmed);
      if (onSubmitNickname) {
        onSubmitNickname(trimmed);
      }
      onClose();
    } catch (err) {
      Alert.alert(t("error"), language === "tr" ? "Takma ad kaydedilemedi." : "Nickname could not be saved.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayBg} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Logo ve Başlık */}
          <View style={styles.logoRow}>
            <LinearGradient
              colors={[colors.gold, colors.goldDark]}
              style={styles.logoBadge}
            >
              <Text style={styles.logoEmoji}>🏀</Text>
            </LinearGradient>
            <View style={styles.titleInfo}>
              <Text style={styles.title}>{t("leaderboard")}</Text>
              <Text style={styles.subtitle}>
                {language === "tr"
                  ? "Skorunu kaydetmek için bir takma ad belirle"
                  : "Choose a nickname to save your score"}
              </Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={t("nicknamePlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.inputHint}>
              {t("nicknameHint")}
            </Text>
          </View>

          {/* Gönder butonu */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[colors.gold, colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.submitText}>{t("saveAndContinue")}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Vazgeç butonu */}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>{t("cancel")}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Platform.OS === "ios" ? Spacing.xxl : Spacing.xl,
    gap: Spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.surfaceBorder,
    borderRadius: BorderRadius.full,
    alignSelf: "center",
    marginBottom: Spacing.xs,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmoji: { fontSize: 26 },
  titleInfo: {
    flex: 1,
  },
  title: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 20,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  inputContainer: {
    gap: Spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  inputHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: colors.textMuted,
    paddingHorizontal: Spacing.xs,
  },
  submitBtn: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    marginTop: Spacing.sm,
  },
  submitGradient: {
    paddingVertical: Spacing.md + 2,
    alignItems: "center",
  },
  submitText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: colors.background,
  },
  cancelBtn: {
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  cancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: colors.textMuted,
  },
});
