import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { ThemeColors } from "../../constants/theme";
import { usePreferences } from "../../context/PreferencesContext";

function TabIcon({
  emoji,
  label,
  focused,
  colors,
}: {
  emoji: string;
  label: string;
  focused: boolean;
  colors: ThemeColors;
}) {
  const styles = createStyles(colors);

  return (
    <View style={styles.tabIconContainer}>
      <Text style={[styles.emoji, focused && styles.emojiFocused]}>{emoji}</Text>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? colors.gold : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { colors, t } = usePreferences();
  const styles = createStyles(colors);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceBorder,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("roster"),
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏀" label={t("roster")} focused={focused} colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: t("leaderboard"),
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏆" label={t("leaderboard")} focused={focused} colors={colors} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile"),
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👤" label={t("profile")} focused={focused} colors={colors} />
          ),
        }}
      />
    </Tabs>
  );
}

const createStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
  tabIconContainer: {
    alignItems: "center",
    gap: 2,
  },
  emoji: {
    fontSize: 22,
    opacity: 0.5,
  },
  emojiFocused: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
});
