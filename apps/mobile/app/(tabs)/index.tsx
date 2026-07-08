/**
 * Ana ekran — 6 oyuncu slotu + koç slotu ızgarası
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGame, SelectedPlayer, SelectedCoach } from "../../context/GameContext";
import { useAuth } from "../../context/AuthContext";
import {
  Spacing,
  BorderRadius,
  SLOTS,
  SLOT_COLORS,
  SlotKey,
  ThemeColors,
} from "../../constants/theme";
import { CandidateModal } from "../../components/CandidateModal";
import { AuthModal } from "../../components/AuthModal";
import { PreferenceQuickActions } from "../../components/PreferenceQuickActions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePreferences } from "../../context/PreferencesContext";
import { getLocalDateKey } from "../../lib/date";

export default function HomeScreen() {
  const { roster, setSlot, isRosterComplete, allPlayerIds, rerollUsed } = useGame();
  const { nickname } = useAuth();
  const { colors, language, slotLabels, t } = usePreferences();
  const styles = createStyles(colors);

  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Bugün zaten oynadı mı kontrol et (Yerel Cache)
  useEffect(() => {
    const checkLocalRoster = async () => {
      const today = getLocalDateKey();
      const cachedStr = await AsyncStorage.getItem("kadromu_kur_today_roster");
      if (cachedStr) {
        try {
          const cached = jsonParse(cachedStr);
          if (cached && cached.date === today && cached.result) {
            router.replace({
              pathname: "/result",
              params: { data: JSON.stringify(cached.result) },
            });
          }
        } catch (e) {
          console.error("Yerel kadro okunurken hata:", e);
        }
      }
    };
    checkLocalRoster();
  }, []);

  const jsonParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  };

  const handleSlotPress = (slot: SlotKey) => {
    setActiveSlot(slot);
  };

  const handleCandidateSelect = (
    slot: SlotKey,
    entity: SelectedPlayer | SelectedCoach
  ) => {
    setSlot(slot, entity);
    setActiveSlot(null);
  };

  const handleSubmit = async () => {
    if (!isRosterComplete) return;
    await executeSubmit();
  };

  const executeSubmit = async () => {
    setSubmitting(true);
    try {
      const playerIds = SLOTS.map((s) => roster[s]!.id);
      const coachId = roster.COACH!.id;
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
          body: JSON.stringify({ playerIds, coachId, playDate: getLocalDateKey() }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("submit-roster hata:", res.status, data);
        throw new Error(data.error ?? `Sunucu hatası (${res.status})`);
      }

      // Bugünün kadrosunu yerel hafızaya kaydet
      const playDate = getLocalDateKey();
      const cacheData = {
        date: playDate,
        result: data,
      };
      await AsyncStorage.setItem("kadromu_kur_today_roster", JSON.stringify(cacheData));

      router.replace({
        pathname: "/result",
        params: {
          data: JSON.stringify(data),
          playerIds: playerIds.join(","),
          coachId: coachId,
        },
      });
    } catch (err) {
      Alert.alert(
        t("error"),
        (err as Error).message ?? "Kadro gönderilemedi."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toLocaleDateString(language === "tr" ? "tr-TR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={["#F7B731", "#FFD06B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logoGradient}
          >
            <Text style={styles.logoText}>🏀</Text>
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={styles.appTitle}>ShaqLee</Text>
            <Text style={styles.dateText}>{today}</Text>
          </View>
          <PreferenceQuickActions />
        </View>

        {/* Feragatname */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            {t("disclaimer")}
          </Text>
        </View>

        {/* Açıklama */}
        <Text style={styles.subtitle}>{t("subtitle")}</Text>

        {/* Reroll Durumu */}
        <View style={[styles.rerollBadge, { borderColor: rerollUsed ? colors.surfaceBorder : colors.gold + "33" }]}>
          <Text style={[styles.rerollBadgeText, { color: rerollUsed ? colors.textMuted : colors.gold }]}>
            {rerollUsed
              ? `🔁 ${t("rerollLimitReached")}`
              : `🔁 ${t("rerollRemaining")}`}
          </Text>
        </View>

        {/* Oyuncu slotları */}
        <Text style={styles.sectionTitle}>{t("players")}</Text>
        <View style={styles.slotsGrid}>
          {SLOTS.map((slot) => (
            <SlotCard
              key={slot}
              slot={slot}
              player={roster[slot]}
              onPress={() => handleSlotPress(slot)}
              colors={colors}
              slotLabel={slotLabels[slot]}
            />
          ))}
        </View>

        {/* Koç slotu */}
        <Text style={styles.sectionTitle}>{t("coach")}</Text>
        <SlotCard
          slot="COACH"
          player={roster.COACH as SelectedPlayer | undefined}
          onPress={() => handleSlotPress("COACH")}
          fullWidth
          colors={colors}
          slotLabel={slotLabels.COACH}
        />

        {/* Gönder butonu */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            !isRosterComplete && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!isRosterComplete || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <LinearGradient
              colors={
                isRosterComplete
                  ? [colors.gold, colors.goldDark]
                  : [colors.textMuted, colors.textMuted]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              <Text style={styles.submitText}>
                {isRosterComplete ? t("simulate") : t("slotsMissing")}
              </Text>
            </LinearGradient>
          )}
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Seçim modalı */}
      {activeSlot && (
        <CandidateModal
          slot={activeSlot}
          excludeIds={allPlayerIds}
          onSelect={(entity) => handleCandidateSelect(activeSlot, entity)}
          onClose={() => setActiveSlot(null)}
        />
      )}

      {/* Auth modalı */}
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSubmitNickname={executeSubmit}
      />
    </SafeAreaView>
  );
}

// ─── SlotCard Bileşeni ────────────────────────────────────────

interface SlotCardProps {
  slot: SlotKey;
  player?: SelectedPlayer;
  onPress: () => void;
  fullWidth?: boolean;
  colors: ThemeColors;
  slotLabel: string;
}

function SlotCard({ slot, player, onPress, fullWidth, colors, slotLabel }: SlotCardProps) {
  const styles = createStyles(colors);
  const color = SLOT_COLORS[slot] ?? colors.gold;
  const isFilled = !!player;

  return (
    <TouchableOpacity
      style={[styles.slotCard, fullWidth && styles.slotCardFull]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.slotBadge, { backgroundColor: color + "22" }]}>
        <Text style={[styles.slotBadgeText, { color }]}>{slot}</Text>
      </View>

      {isFilled ? (
        <View style={styles.slotFilled}>
          {/* Avatar baş harf */}
          <View style={[styles.avatar, { backgroundColor: color + "33" }]}>
            <Text style={[styles.avatarText, { color }]}>
              {player!.full_name[0]}
            </Text>
          </View>
          <View style={styles.slotInfo}>
            <Text style={styles.playerName} numberOfLines={1}>
              {player!.full_name}
            </Text>
            {"team" in player! && player!.team && (
              <Text style={styles.playerTeam}>{player!.team}</Text>
            )}
            {"ppg" in player! && player!.ppg !== null && (
              <Text style={styles.playerStats}>
                Hücum {player!.ppg?.toFixed(0)} · Rib {(player as SelectedPlayer).rpg?.toFixed(0)} · Oyun {(player as SelectedPlayer).apg?.toFixed(0)}
              </Text>
            )}
          </View>
          <Text style={styles.editHint}>✏️</Text>
        </View>
      ) : (
        <View style={styles.slotEmpty}>
          <Text style={[styles.slotPlus, { color }]}>+</Text>
          <Text style={styles.slotLabel}>{slotLabel}</Text>
        </View>
      )}
    </TouchableOpacity>
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
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  logoGradient: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 26,
  },
  appTitle: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 22,
    color: colors.textPrimary,
  },
  dateText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "capitalize",
  },
  disclaimer: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.textMuted,
  },
  disclaimerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: colors.textMuted,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  slotCard: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    minHeight: 90,
    justifyContent: "center",
  },
  slotCardFull: {
    width: "100%",
    marginBottom: Spacing.lg,
  },
  slotBadge: {
    alignSelf: "flex-start",
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginBottom: Spacing.sm,
  },
  slotBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  slotEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  slotPlus: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  slotLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  slotFilled: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 18,
  },
  slotInfo: {
    flex: 1,
  },
  playerName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.textPrimary,
  },
  playerTeam: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: colors.textSecondary,
  },
  playerStats: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: colors.textMuted,
  },
  editHint: {
    fontSize: 14,
  },
  submitButton: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    marginTop: Spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitGradient: {
    paddingVertical: Spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: colors.background,
    letterSpacing: 0.3,
  },
  rerollBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  rerollBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
});
