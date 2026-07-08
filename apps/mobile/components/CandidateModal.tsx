/**
 * CandidateModal — Oyuncu/koç seçim modalı
 * Slota dokunulduğunda açılır, 5 rastgele aday gösterir
 * Güç puanı GÖSTERILMEZ
 */

import React, { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Spacing,
  BorderRadius,
  SLOT_COLORS,
  SlotKey,
  ThemeColors,
} from "../constants/theme";
import { useGame, SelectedPlayer, SelectedCoach } from "../context/GameContext";
import { supabase } from "../lib/supabase";
import { usePreferences } from "../context/PreferencesContext";
import { getLocalDateKey } from "../lib/date";

interface Props {
  slot: SlotKey;
  excludeIds: string[];
  onSelect: (entity: SelectedPlayer | SelectedCoach) => void;
  onClose: () => void;
}

interface RawCandidate {
  id: string;
  full_name: string;
  team: string | null;
  positions?: string[];
  ppg?: number | null;
  rpg?: number | null;
  apg?: number | null;
  career_win_pct?: number | null;
}

const candidatesCache = new Map<string, RawCandidate[]>();
const CANDIDATES_CACHE_PREFIX = "kadromu_kur_candidates_cache_v1";

export function CandidateModal({ slot, excludeIds, onSelect, onClose }: Props) {
  const { colors, language, slotLabels, t } = usePreferences();
  const { rerollUsed, useReroll } = useGame();
  const styles = createStyles(colors);
  const [candidates, setCandidates] = useState<RawCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const slotColor = SLOT_COLORS[slot] ?? colors.gold;
  const cacheKey = slot;
  const persistentCacheKey = `${CANDIDATES_CACHE_PREFIX}:${cacheKey}`;

  const fetchCandidates = useCallback(async (bypassCache = false, currentIds: string[] = []) => {
    setLoading(true);
    setError(null);

    const cachedCandidates = candidatesCache.get(cacheKey);
    if (cachedCandidates && !bypassCache) {
      setCandidates(cachedCandidates);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      const today = getLocalDateKey();
      if (!bypassCache) {
        const persisted = await AsyncStorage.getItem(persistentCacheKey);
        if (persisted) {
          try {
            const parsed = JSON.parse(persisted) as { date?: string; candidates?: RawCandidate[] };
            if (parsed.date === today && Array.isArray(parsed.candidates)) {
              setCandidates(parsed.candidates);
              candidatesCache.set(cacheKey, parsed.candidates);
              setLoading(false);
              return;
            }
          } catch {
            await AsyncStorage.removeItem(persistentCacheKey);
          }
        }
      }

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

      let activeExcludeIds = [...excludeIds];
      if (bypassCache && currentIds.length > 0) {
        activeExcludeIds = [...activeExcludeIds, ...currentIds];
      }

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/get-candidates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${token ?? anonKey}`,
          },
          body: JSON.stringify({ slot, excludeIds: activeExcludeIds }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? (language === "tr" ? "Aday yüklenemedi" : "Candidates could not be loaded"));
      }
      const nextCandidates = json.candidates ?? [];
      setCandidates(nextCandidates);
      candidatesCache.set(cacheKey, nextCandidates);
      await AsyncStorage.setItem(
        persistentCacheKey,
        JSON.stringify({ date: today, candidates: nextCandidates })
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, excludeIds, language, persistentCacheKey, slot]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleReroll = () => {
    if (rerollUsed) {
      if (Platform.OS === "web") {
        window.alert(`${t("error")}: ${t("rerollLimitReached")}`);
      } else {
        Alert.alert(t("error"), t("rerollLimitReached"));
      }
      return;
    }

    const executeReroll = async () => {
      await useReroll();
      candidatesCache.delete(cacheKey);
      await AsyncStorage.removeItem(persistentCacheKey);
      const currentIds = candidates.map((c) => c.id);
      await fetchCandidates(true, currentIds);
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(`${t("rerollConfirmTitle")}\n\n${t("rerollUsedAlert")}`);
      if (confirmed) {
        executeReroll();
      }
    } else {
      Alert.alert(
        t("rerollConfirmTitle"),
        t("rerollUsedAlert"),
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("yes"),
            onPress: executeReroll,
          },
        ]
      );
    }
  };

  const handleSelect = (c: RawCandidate) => {
    if (slot === "COACH") {
      onSelect({
        id: c.id,
        full_name: c.full_name,
        team: c.team,
        career_win_pct: c.career_win_pct ?? null,
      } as SelectedCoach);
    } else {
      onSelect({
        id: c.id,
        full_name: c.full_name,
        team: c.team,
        positions: c.positions ?? [],
        ppg: c.ppg ?? null,
        rpg: c.rpg ?? null,
        apg: c.apg ?? null,
      } as SelectedPlayer);
    }
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle çubuğu */}
          <View style={styles.handle} />

          {/* Başlık */}
          <View style={styles.modalHeader}>
            <View style={[styles.slotBadge, { backgroundColor: slotColor + "22" }]}>
              <Text style={[styles.slotBadgeText, { color: slotColor }]}>
                {slot}
              </Text>
            </View>
            <Text style={styles.modalTitle}>
              {slotLabels[slot]} {t("choose")}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            {language === "tr"
              ? "💡 Güç puanları sonuçta açıklanacak! Hücum · Ribaund · Oyun Kurma puanlarına bak."
              : "💡 Power ratings are revealed in the result. Compare offense · rebounds · playmaking."}
          </Text>

          {/* Reroll Bölümü */}
          <View style={[styles.rerollSection, !rerollUsed && styles.rerollSectionAvailable]}>
            <View style={styles.rerollInfo}>
              <Text style={styles.rerollTitle}>
                {rerollUsed ? "🔁 " + t("rerollLimitReached") : "🔁 " + t("rerollRemaining")}
              </Text>
              <Text style={styles.rerollSubtitle}>
                {language === "tr"
                  ? "Kadro kurarken 1 kez rastgele yeni adaylar isteyebilirsin."
                  : "You can request random new candidates once while building your team."}
              </Text>
            </View>
            {!rerollUsed && (
              <TouchableOpacity
                style={styles.rerollButton}
                onPress={handleReroll}
                activeOpacity={0.8}
              >
                <Text style={styles.rerollButtonText}>{t("reroll")}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* İçerik */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={slotColor} />
              <Text style={styles.loadingText}>{t("candidatesLoading")}</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryBtn, { borderColor: slotColor }]}
                onPress={() => fetchCandidates()}
              >
                <Text style={[styles.retryBtnText, { color: slotColor }]}>
                  {t("retry")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={candidates}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <CandidateCard
                  candidate={item}
                  slot={slot}
                  color={slotColor}
                  index={index}
                  colors={colors}
                  language={language}
                  onPress={() => handleSelect(item)}
                />
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Aday Kartı ───────────────────────────────────────────────

interface CandidateCardProps {
  candidate: RawCandidate;
  slot: SlotKey;
  color: string;
  index: number;
  colors: ThemeColors;
  language: "tr" | "en";
  onPress: () => void;
}

function CandidateCard({ candidate, color, index, colors, language, onPress }: CandidateCardProps) {
  const styles = createStyles(colors);
  const isCoach = !candidate.positions;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[colors.surfaceElevated, colors.surface]}
        style={styles.cardGradient}
      >
        {/* Sıra numarası */}
        <View style={[styles.cardIndex, { backgroundColor: color + "22" }]}>
          <Text style={[styles.cardIndexText, { color }]}>{index + 1}</Text>
        </View>

        {/* Avatar */}
        <View style={[styles.cardAvatar, { backgroundColor: color + "22" }]}>
          <Text style={[styles.cardAvatarText, { color }]}>
            {candidate.full_name[0]}
          </Text>
        </View>

        {/* Bilgiler */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {candidate.full_name}
          </Text>
          {candidate.team && (
            <Text style={styles.cardTeam}>{candidate.team}</Text>
          )}
          {!isCoach && (
            <View style={styles.statRow}>
              {candidate.ppg !== null && candidate.ppg !== undefined && (
                <StatBadge
                  label={language === "tr" ? "HÜCUM" : "OFF"}
                  value={candidate.ppg!.toFixed(0)}
                  color={color}
                  colors={colors}
                />
              )}
              {candidate.rpg !== null && candidate.rpg !== undefined && (
                <StatBadge
                  label={language === "tr" ? "RİBAUND" : "REB"}
                  value={candidate.rpg!.toFixed(0)}
                  color={color}
                  colors={colors}
                />
              )}
              {candidate.apg !== null && candidate.apg !== undefined && (
                <StatBadge
                  label={language === "tr" ? "OYUN" : "AST"}
                  value={candidate.apg!.toFixed(0)}
                  color={color}
                  colors={colors}
                />
              )}
            </View>
          )}
        </View>

        {/* Seç işareti */}
        <View style={[styles.selectArrow, { backgroundColor: color + "22" }]}>
          <Text style={{ color, fontSize: 16 }}>→</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function StatBadge({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string;
  color: string;
  colors: ThemeColors;
}) {
  const styles = createStyles(colors);

  return (
    <View style={[styles.statBadge, { backgroundColor: color + "15" }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Stiller ─────────────────────────────────────────────────

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "85%",
    paddingBottom: Spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.surfaceBorder,
    borderRadius: BorderRadius.full,
    alignSelf: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  slotBadge: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  slotBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  modalTitle: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: colors.textSecondary,
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  center: {
    padding: Spacing.xxl,
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.error,
    textAlign: "center",
  },
  retryBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  retryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  list: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  card: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  cardGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardIndex: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIndexText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  cardAvatarText: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 20,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  cardTeam: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.textSecondary,
  },
  cardStats: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: colors.textMuted,
  },
  statRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: 2,
  },
  statBadge: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    alignItems: "center",
    minWidth: 40,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectArrow: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  shuffleBtn: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
  },
  shuffleBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.textSecondary,
  },
  rerollSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: Spacing.sm,
  },
  rerollSectionAvailable: {
    borderColor: colors.gold + "33",
  },
  rerollInfo: {
    flex: 1,
  },
  rerollTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: colors.textPrimary,
  },
  rerollSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rerollButton: {
    backgroundColor: colors.gold,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  rerollButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: "#0A0E1A",
  },
});
