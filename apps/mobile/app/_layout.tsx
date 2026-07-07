/**
 * Root layout — font yükleme, auth context
 */

import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { AuthProvider } from "../context/AuthContext";
import { GameProvider } from "../context/GameContext";
import { PreferencesProvider, usePreferences } from "../context/PreferencesContext";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  return (
    <PreferencesProvider>
      <AuthProvider>
        <GameProvider>
          <RootShell />
        </GameProvider>
      </AuthProvider>
    </PreferencesProvider>
  );
}

function RootShell() {
  const { colors, themeMode } = usePreferences();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        style={themeMode === "dark" ? "light" : "dark"}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "none",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="result" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </View>
  );
}
