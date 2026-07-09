/**
 * Sonuç ekranı — Takım gücü reveal, 82 maç simülasyon sonucu,
 * güç puanı açıklaması ve liderlik tablosu kaydı
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import {
  Spacing,
  BorderRadius,
  SLOTS,
  SLOT_COLORS,
  ThemeColors,
} from "../constants/theme";
import { usePreferences } from "../context/PreferencesContext";
import { getLocalDateKey } from "../lib/date";

interface PlayerDetail {
  id: string;
  full_name: string;
  team: string | null;
  positions: string[];
  power_rating: number;
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
}

interface CoachDetail {
  id: string;
  full_name: string;
  team: string | null;
  power_rating: number;
  career_win_pct: number | null;
}

interface ResultData {
  alreadyPlayed: boolean;
  teamPower: number;
  predictedWins: number;
  playerDetails: PlayerDetail[];
  coachDetail: CoachDetail;
}

export default function ResultScreen() {
  const { colors, language, t } = usePreferences();
  const styles = createStyles(colors);
  const params = useLocalSearchParams<{
    data?: string;
    fromCache?: string;
    playerIds?: string;
    coachId?: string;
  }>();
  const [data, setData] = useState<ResultData | null>(null);
  const [revealed, setRevealed] = useState(false);

  const { nickname, saveNickname } = useAuth();
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (nickname) {
      setSaveName(nickname);
    }
  }, [nickname]);

  const handleSaveScore = async () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      Alert.alert(t("error"), t("enterNickname"));
      return;
    }
    if (trimmed.length < 2) {
      Alert.alert(t("error"), language === "tr" ? "Takma ad en az 2 karakter olmalı." : "Nickname must be at least 2 characters.");
      return;
    }

    setSaving(true);
    try {
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
      const pIds = params.playerIds ? params.playerIds.split(",") : [];

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/submit-roster`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            playerIds: pIds,
            coachId: params.coachId,
            nickname: trimmed,
            teamPower: data?.teamPower,
            predictedWins: data?.predictedWins,
            playDate: getLocalDateKey(),
            saveOnly: true,
          }),
        }
      );

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error ?? (language === "tr" ? "Skor kaydedilemedi." : "Score could not be saved."));
      }

      await saveNickname(trimmed);
      setSaved(true);
      if (resData.id) {
        await AsyncStorage.setItem("kadromu_kur_today_attempt_id", resData.id);
      }
      Alert.alert(t("success"), t("scoreSaved"));
    } catch (err) {
      Alert.alert(t("error"), (err as Error).message ?? (language === "tr" ? "Skor kaydedilemedi." : "Score could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  // Animasyon değerleri
  const winsAnim = useRef(new Animated.Value(0)).current;
  const powerAnim = useRef(new Animated.Value(0)).current;
  const revealAnim = useRef(new Animated.Value(0)).current;
  const [animatedWins, setAnimatedWins] = useState(0);

  useEffect(() => {
    if (params.data) {
      try {
        setData(JSON.parse(params.data));
      } catch {}
    }
  }, [params.data]);

  useEffect(() => {
    if (!data) return;

    // Power bar animasyonu
    Animated.timing(powerAnim, {
      toValue: data.teamPower / 100,
      duration: 1200,
      useNativeDriver: false,
    }).start();

    // Galibiyet sayacı
    const listener = winsAnim.addListener(({ value }) => {
      setAnimatedWins(Math.round(value));
    });

    setTimeout(() => {
      Animated.timing(winsAnim, {
        toValue: data.predictedWins,
        duration: 2000,
        useNativeDriver: false,
      }).start(() => {
        // Güç puanları reveal
        setTimeout(() => {
          setRevealed(true);
          Animated.timing(revealAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }).start();
        }, 400);
      });
    }, 600);

    return () => winsAnim.removeListener(listener);
  }, [data]);

  const getWinsColor = (wins: number) => {
    if (wins >= 60) return colors.gold;
    if (wins >= 50) return colors.success;
    if (wins >= 40) return colors.blue;
    if (wins >= 30) return colors.warning;
    return colors.error;
  };

  const getWinsLabel = (wins: number) => {
    if (language === "en") {
      if (wins >= 60) return "🏆 Championship Favorite!";
      if (wins >= 50) return "🔥 Playoff Force";
      if (wins >= 41) return "✅ Solid Playoff Team";
      if (wins >= 33) return "⚠️ Bubble Team";
      return "😬 Lottery Bound...";
    }
    if (wins >= 60) return "🏆 Şampiyonluk Favorisi!";
    if (wins >= 50) return "🔥 Playoff Güçlüsü";
    if (wins >= 41) return "✅ Sağlam Playoff Takımı";
    if (wins >= 33) return "⚠️ Kabarcık Bölgesi";
    return "😬 Piyango Sırası...";
  };

  if (!data) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "right", "bottom", "left"]}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>{t("loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const winsColor = getWinsColor(data.predictedWins);

  return (
    <SafeAreaView style={styles.container} edges={["top", "right", "bottom", "left"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Başlık */}
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>
            {data.alreadyPlayed ? t("todaysResult") : t("rosterReady")}
          </Text>
        </View>

        {/* Galibiyet kutusu */}
        <LinearGradient
          colors={[winsColor + "33", colors.surface]}
          style={styles.winsCard}
        >
          <Text style={styles.winsLabel}>{t("winsSeason")}</Text>
          <Text style={[styles.winsNumber, { color: winsColor }]}>
            {animatedWins}
          </Text>
          <Text style={styles.winsUnit}>{t("winsUpper")}</Text>
          <Text style={styles.winsComment}>{getWinsLabel(data.predictedWins)}</Text>

          {/* Güç çubuğu */}
          <View style={styles.powerBarContainer}>
            <View style={styles.powerBarRow}>
              <Text style={styles.powerBarLabel}>{t("teamPower")}</Text>
              <Text style={[styles.powerBarValue, { color: winsColor }]}>
                {data.teamPower.toFixed(1)} / 100
              </Text>
            </View>
            <View style={styles.powerBarBg}>
              <Animated.View
                style={[
                  styles.powerBarFill,
                  {
                    backgroundColor: winsColor,
                    width: powerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
          </View>
        </LinearGradient>

        {/* Liderlik Tablosuna Kaydet Kartı */}
        {data && params.fromCache !== "true" && (
          <View style={styles.saveCard}>
            <Text style={styles.saveCardTitle}>{t("leaderboardSave")}</Text>
            {saved ? (
              <View style={styles.savedRow}>
                <Text style={styles.savedText}>
                  ✨ {t("leaderboardSaved")} <Text style={styles.savedName}>{saveName}</Text>
                </Text>
              </View>
            ) : (
              <View style={styles.saveFormRow}>
                <TextInput
                  style={styles.saveInput}
                  placeholder={t("nicknamePlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  value={saveName}
                  onChangeText={setSaveName}
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!saving}
                />
                <TouchableOpacity
                  style={styles.saveSubmitBtn}
                  onPress={handleSaveScore}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <Text style={styles.saveSubmitText}>{t("save")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Oyuncu güç puanları (reveal) */}
        <Text style={styles.sectionTitle}>{t("playerPowerRatings")}</Text>
        <Text style={styles.sectionHint}>
          {revealed ? t("powerRevealShown") : t("powerRevealHidden")}
        </Text>

        {SLOTS.map((slot, idx) => {
          const player = data.playerDetails[idx];
          if (!player) return null;
          const color = SLOT_COLORS[slot];

          return (
            <Animated.View
              key={slot}
              style={[
                styles.playerRevealCard,
                {
                  opacity: revealAnim,
                  transform: [
                    {
                      translateY: revealAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={[styles.revealSlotBadge, { backgroundColor: color + "22" }]}>
                <Text style={[styles.revealSlotText, { color }]}>{slot}</Text>
              </View>
              <View style={styles.revealInfo}>
                <Text style={styles.revealName}>{player.full_name}</Text>
                <Text style={styles.revealTeam}>{player.team}</Text>
              </View>
              <View style={[styles.powerBadge, { backgroundColor: color + "22" }]}>
                <Text style={[styles.powerBadgeText, { color }]}>
                  {player.power_rating.toFixed(0)}
                </Text>
                <Text style={styles.powerBadgeLabel}>{t("power")}</Text>
              </View>
            </Animated.View>
          );
        })}

        {/* Koç güç puanı */}
        {data.coachDetail && (
          <Animated.View
            style={[
              styles.playerRevealCard,
              {
                opacity: revealAnim,
                borderColor: colors.gold + "44",
              },
            ]}
          >
            <View style={[styles.revealSlotBadge, { backgroundColor: colors.gold + "22" }]}>
              <Text style={[styles.revealSlotText, { color: colors.gold }]}>
                {language === "tr" ? "KOÇ" : "COACH"}
              </Text>
            </View>
            <View style={styles.revealInfo}>
              <Text style={styles.revealName}>{data.coachDetail.full_name}</Text>
              <Text style={styles.revealTeam}>{data.coachDetail.team}</Text>
            </View>
            <View style={[styles.powerBadge, { backgroundColor: colors.gold + "22" }]}>
              <Text style={[styles.powerBadgeText, { color: colors.gold }]}>
                {data.coachDetail.power_rating.toFixed(0)}
              </Text>
              <Text style={styles.powerBadgeLabel}>{t("power")}</Text>
            </View>
          </Animated.View>
        )}

        {/* Liderlik tablosu butonu */}
        <TouchableOpacity
          style={styles.leaderboardBtn}
          onPress={() => router.push("/(tabs)/leaderboard")}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[colors.blue, colors.blueLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.leaderboardBtnGradient}
          >
            <Text style={styles.leaderboardBtnText}>🏆 {t("leaderboard")}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Yeni kadro butonu (yarın) */}
        <TouchableOpacity
          style={styles.tomorrowBtn}
          onPress={() => router.replace("/(tabs)")}
          activeOpacity={0.75}
        >
          <Text style={styles.tomorrowBtnText}>
            {t("tomorrowRoster")}
          </Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stiller ─────────────────────────────────────────────────

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    width: "100%",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: colors.textSecondary,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  screenTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: colors.textPrimary,
  },
  winsCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  winsLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  winsNumber: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 80,
    lineHeight: 88,
  },
  winsUnit: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 3,
    marginBottom: Spacing.sm,
  },
  winsComment: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  powerBarContainer: {
    width: "100%",
    gap: Spacing.xs,
  },
  powerBarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  powerBarLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.textSecondary,
  },
  powerBarValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  powerBarBg: {
    height: 8,
    backgroundColor: colors.surfaceBorder,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  powerBarFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  sectionHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: Spacing.md,
  },
  playerRevealCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: Spacing.sm,
  },
  revealSlotBadge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  revealSlotText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  revealInfo: {
    flex: 1,
  },
  revealName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  revealTeam: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.textSecondary,
  },
  powerBadge: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: "center",
    minWidth: 52,
  },
  powerBadgeText: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 20,
  },
  powerBadgeLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  leaderboardBtn: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    marginTop: Spacing.lg,
  },
  leaderboardBtnGradient: {
    paddingVertical: Spacing.md + 2,
    alignItems: "center",
  },
  leaderboardBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  tomorrowBtn: {
    padding: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  tomorrowBtnText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.textMuted,
  },
  saveCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  saveCardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  saveFormRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  saveInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: colors.textPrimary,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  saveSubmitBtn: {
    backgroundColor: colors.gold,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  saveSubmitText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: colors.background,
  },
  savedRow: {
    paddingVertical: Spacing.xs,
  },
  savedText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: colors.success,
  },
  savedName: {
    fontFamily: "Inter_700Bold",
    color: colors.gold,
  },
});
