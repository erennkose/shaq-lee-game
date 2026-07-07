import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { BorderRadius, Spacing, ThemeColors } from "../constants/theme";
import { usePreferences } from "../context/PreferencesContext";

export function PreferenceQuickActions() {
  const { colors, language, themeMode, toggleLanguage, toggleTheme } = usePreferences();
  const styles = createStyles(colors);

  return (
    <View style={styles.preferenceRow}>
      <TouchableOpacity
        style={styles.preferenceBtn}
        onPress={toggleTheme}
        activeOpacity={0.75}
      >
        <Text style={styles.preferenceText}>{themeMode === "dark" ? "☾" : "☀"}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.preferenceBtn}
        onPress={toggleLanguage}
        activeOpacity={0.75}
      >
        <Text style={styles.preferenceText}>{language === "tr" ? "EN" : "TR"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    preferenceRow: {
      flexDirection: "row",
      gap: Spacing.xs,
    },
    preferenceBtn: {
      minWidth: 36,
      height: 36,
      borderRadius: BorderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    preferenceText: {
      fontFamily: "Inter_700Bold",
      fontSize: 12,
      color: colors.textPrimary,
    },
  });
