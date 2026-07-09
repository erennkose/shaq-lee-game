/**
 * profile.tsx — Bugünkü Kadrom (Roster Today) Ekranı
 * Kullanıcının o gün kurduğu kadroyu ve simülasyon sonucunu gösterir.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Spacing, BorderRadius, SLOT_COLORS, SLOTS, ThemeColors } from "../../constants/theme";
import { usePreferences } from "../../context/PreferencesContext";
import { PreferenceQuickActions } from "../../components/PreferenceQuickActions";
import { getLocalDateKey } from "../../lib/date";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

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

interface RosterResult {
  teamPower: number;
  predictedWins: number;
  playerDetails: PlayerDetail[];
  coachDetail: CoachDetail;
}

export default function ProfileScreen() {
  const { colors, language, setLanguage, setThemeMode, t, themeMode } = usePreferences();
  const styles = createStyles(colors);
  const [todayRoster, setTodayRoster] = useState<RosterResult | null>(null);
  const [loading, setLoading] = useState(true);

  const { nickname, saveNickname } = useAuth();
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);

  const handleSaveNickname = async () => {
    const trimmed = newNickname.trim();
    if (!trimmed) {
      Alert.alert(t("error"), t("enterNickname"));
      return;
    }
    if (trimmed.length < 2) {
      Alert.alert(
        t("error"),
        language === "tr"
          ? "Takma ad en az 2 karakter olmalı."
          : "Nickname must be at least 2 characters."
      );
      return;
    }
    if (trimmed.length > 20) {
      Alert.alert(
        t("error"),
        language === "tr"
          ? "Takma ad en fazla 20 karakter olmalı."
          : "Nickname can be at most 20 characters."
      );
      return;
    }

    setSavingNickname(true);
    try {
      const oldNickname = nickname;
      await saveNickname(trimmed);

      const today = getLocalDateKey();
      let attemptId = await AsyncStorage.getItem("kadromu_kur_today_attempt_id");

      if (!attemptId && oldNickname) {
        const { data, error } = await supabase
          .from("daily_attempts")
          .select("id")
          .eq("play_date", today)
          .eq("nickname", oldNickname as string)
          .limit(1);

        if (!error && data && data.length > 0) {
          const fetchedId = data[0].id as string;
          attemptId = fetchedId;
          await AsyncStorage.setItem("kadromu_kur_today_attempt_id", fetchedId);
        }
      }

      if (attemptId) {
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
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
              updateNicknameOnly: true,
              attemptId,
              nickname: trimmed,
            }),
          }
        );

        if (!res.ok) {
          const resData = await res.json().catch(() => ({}));
          console.error("Liderlik tablosu güncelleme hatası:", resData);
        }
      }

      setIsEditingNickname(false);
      Alert.alert(
        t("success"),
        language === "tr" ? "Profil güncellendi." : "Profile updated."
      );
    } catch (err) {
      console.error("Nickname güncellenirken hata:", err);
      Alert.alert(
        t("error"),
        language === "tr"
          ? "Takma ad güncellenemedi."
          : "Could not update nickname."
      );
    } finally {
      setSavingNickname(false);
    }
  };

  // Sayfa her odaklandığında yerel hafızadaki kadroyu oku
  useFocusEffect(
    React.useCallback(() => {
      const fetchLocalRoster = async () => {
        setLoading(true);
        const today = getLocalDateKey();
        const cachedStr = await AsyncStorage.getItem("kadromu_kur_today_roster");

        if (cachedStr) {
          try {
            const cached = JSON.parse(cachedStr);
            if (cached.date === today && cached.result) {
              setTodayRoster(cached.result);
            } else {
              setTodayRoster(null); // Başka bir güne ait veri
            }
          } catch (e) {
            console.error("Yerel kadro ayrıştırılırken hata:", e);
            setTodayRoster(null);
          }
        } else {
          setTodayRoster(null);
        }
        setLoading(false);
      };

      fetchLocalRoster();
    }, [])
  );



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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  const winsColor = todayRoster ? getWinsColor(todayRoster.predictedWins) : colors.gold;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Başlık */}
        <View style={styles.header}>
          <Text style={styles.title}>{t("todayRoster")}</Text>
          <PreferenceQuickActions />
        </View>

        {todayRoster ? (
          <View style={styles.activeContainer}>
            {/* Simülasyon Sonuç Özeti */}
            <LinearGradient
              colors={[winsColor + "22", colors.surface]}
              style={styles.summaryCard}
            >
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryLabel}>{t("seasonPrediction")}</Text>
                  <Text style={[styles.summaryWins, { color: winsColor }]}>
                    {todayRoster.predictedWins} {t("wins")}
                  </Text>
                  <Text style={styles.summaryComment}>
                    {getWinsLabel(todayRoster.predictedWins)}
                  </Text>
                </View>
                <View style={styles.powerCircle}>
                  <Text style={styles.powerCircleValue}>
                    {todayRoster.teamPower.toFixed(0)}
                  </Text>
                  <Text style={styles.powerCircleLabel}>{t("teamPower")}</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Kadro Detayı */}
            <Text style={styles.sectionTitle}>{t("selectRoster")}</Text>
            <View style={styles.rosterList}>
              {SLOTS.map((slot, idx) => {
                const player = todayRoster.playerDetails[idx];
                const color = SLOT_COLORS[slot] ?? colors.gold;
                if (!player) return null;

                return (
                  <View key={slot} style={styles.playerCard}>
                    <View style={[styles.slotBadge, { backgroundColor: color + "22" }]}>
                      <Text style={[styles.slotBadgeText, { color }]}>{slot}</Text>
                    </View>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>{player.full_name}</Text>
                      <Text style={styles.playerTeam}>{player.team}</Text>
                    </View>
                    <View style={[styles.powerBadge, { backgroundColor: color + "22" }]}>
                      <Text style={[styles.powerBadgeText, { color }]}>
                        {player.power_rating.toFixed(0)}
                      </Text>
                      <Text style={styles.powerBadgeLabel}>{t("power")}</Text>
                    </View>
                  </View>
                );
              })}

              {/* Koç */}
              {todayRoster.coachDetail && (
                <View style={styles.playerCard}>
                  <View style={[styles.slotBadge, { backgroundColor: colors.gold + "22" }]}>
                    <Text style={[styles.slotBadgeText, { color: colors.gold }]}>
                      {language === "tr" ? "KOÇ" : "COACH"}
                    </Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{todayRoster.coachDetail.full_name}</Text>
                    <Text style={styles.playerTeam}>{todayRoster.coachDetail.team}</Text>
                  </View>
                  <View style={[styles.powerBadge, { backgroundColor: colors.gold + "22" }]}>
                    <Text style={[styles.powerBadgeText, { color: colors.gold }]}>
                      {todayRoster.coachDetail.power_rating.toFixed(0)}
                    </Text>
                    <Text style={styles.powerBadgeLabel}>{t("power")}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : (
          /* Boş Roster Durumu */
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>{t("emptyProfileTitle")}</Text>
            <Text style={styles.emptySubtitle}>{t("emptyProfileSubtitle")}</Text>
            <TouchableOpacity
              style={styles.buildBtn}
              onPress={() => router.push("/(tabs)")}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buildBtnGradient}
              >
                <Text style={styles.buildBtnText}>{t("buildNow")}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>{language === "tr" ? "Profil" : "Profile"}</Text>

          <View style={styles.settingCard}>
            <Text style={styles.settingsLabel}>{language === "tr" ? "Takma Ad" : "Nickname"}</Text>
            
            {!isEditingNickname ? (
              <View style={styles.displayRow}>
                <Text style={styles.nicknameText}>
                  {nickname || (language === "tr" ? "Belirlenmedi" : "Not set")}
                </Text>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => {
                    setNewNickname(nickname || "");
                    setIsEditingNickname(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.editBtnText}>
                    {language === "tr" ? "Düzenle" : "Edit"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={newNickname}
                  onChangeText={setNewNickname}
                  placeholder={t("nicknamePlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  maxLength={20}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveNickname}
                  disabled={savingNickname}
                  activeOpacity={0.8}
                >
                  {savingNickname ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Text style={styles.saveBtnText}>{t("save")}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsEditingNickname(false)}
                  disabled={savingNickname}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBtnText}>{t("cancel")}</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={[styles.settingsLabel, { fontSize: 10, marginTop: 4 }]}>
              {t("nicknameHint")}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>{t("preferences")}</Text>

          <View style={styles.settingCard}>
            <Text style={styles.settingsLabel}>{t("themeLabel")}</Text>
            <View style={styles.optionRow}>
              <TouchableOpacity
                style={[
                  styles.optionBtn,
                  themeMode === "dark" && styles.optionBtnActive,
                ]}
                onPress={() => setThemeMode("dark")}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.optionBtnText,
                    themeMode === "dark" && styles.optionBtnTextActive,
                  ]}
                >
                  {t("dark")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionBtn,
                  themeMode === "light" && styles.optionBtnActive,
                ]}
                onPress={() => setThemeMode("light")}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.optionBtnText,
                    themeMode === "light" && styles.optionBtnTextActive,
                  ]}
                >
                  {t("light")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.settingsLabel}>{t("languageLabel")}</Text>
            <View style={styles.optionRow}>
              <TouchableOpacity
                style={[
                  styles.optionBtn,
                  language === "tr" && styles.optionBtnActive,
                ]}
                onPress={() => setLanguage("tr")}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.optionBtnText,
                    language === "tr" && styles.optionBtnTextActive,
                  ]}
                >
                  {t("turkish")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionBtn,
                  language === "en" && styles.optionBtnActive,
                ]}
                onPress={() => setLanguage("en")}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.optionBtnText,
                    language === "en" && styles.optionBtnTextActive,
                  ]}
                >
                  {t("english")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 28,
    color: colors.textPrimary,
  },
  activeContainer: {
    gap: Spacing.md,
  },
  summaryCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: Spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryWins: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 24,
  },
  summaryComment: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  powerCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  powerCircleValue: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 20,
    color: colors.gold,
  },
  powerCircleLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  rosterList: {
    gap: Spacing.sm,
  },
  playerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: Spacing.sm,
  },
  slotBadge: {
    width: 44,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  slotBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.textPrimary,
  },
  playerTeam: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
  powerBadge: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: "center",
    minWidth: 44,
  },
  powerBadgeText: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 16,
  },
  powerBadgeLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 8,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  buildBtn: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  buildBtnGradient: {
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  buildBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: colors.background,
  },
  settingsSection: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  settingCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: Spacing.sm,
  },
  settingsLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: colors.textMuted,
  },
  optionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  optionBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  optionBtnActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  optionBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.textPrimary,
  },
  optionBtnTextActive: {
    color: colors.background,
  },
  displayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  nicknameText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: colors.textPrimary,
  },
  editBtn: {
    padding: Spacing.xs,
  },
  editBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: colors.gold,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 4,
  },
  editInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    color: colors.textPrimary,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  saveBtn: {
    backgroundColor: colors.gold,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  saveBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: colors.background,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.xs,
  },
  cancelBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: colors.textMuted,
  },
});
