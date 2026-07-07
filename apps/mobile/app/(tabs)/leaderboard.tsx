/**
 * Liderlik Tablosu — Günlük ve Tüm Zamanlar
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import {
  Spacing,
  BorderRadius,
  SLOTS,
  SLOT_COLORS,
  ThemeColors,
} from "../../constants/theme";
import { usePreferences } from "../../context/PreferencesContext";
import { PreferenceQuickActions } from "../../components/PreferenceQuickActions";
import { formatPlayDate, getLocalDateKey } from "../../lib/date";

type Tab = "daily" | "alltime";

interface AttemptRow {
  id: string;
  nickname: string;
  play_date: string;
  predicted_wins: number;
  team_power: number;
  chosen_player_ids: string[];
  chosen_coach_id: string;
}

interface DetailedAttempt extends AttemptRow {
  players: { id: string; full_name: string; team: string; positions: string[] }[];
  coach: { id: string; full_name: string; team: string };
}

export default function LeaderboardScreen() {
  const { colors, language, t } = usePreferences();
  const styles = createStyles(colors);
  const [tab, setTab] = useState<Tab>("daily");
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DetailedAttempt | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const today = getLocalDateKey();

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("daily_attempts")
      .select("id, nickname, play_date, predicted_wins, team_power, chosen_player_ids, chosen_coach_id")
      .order("predicted_wins", { ascending: false })
      .limit(50);

    if (tab === "daily") {
      query = query.eq("play_date", today);
    }

    const { data, error } = await query;
    if (!error && data) setRows(data);
    setLoading(false);
  }, [tab, today]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleRowPress = async (row: AttemptRow) => {
    setDetailLoading(true);
    setSelected({ ...row, players: [], coach: { id: "", full_name: "", team: "" } });

    const [playersRes, coachRes] = await Promise.all([
      supabase
        .from("players")
        .select("id, full_name, team, positions")
        .in("id", row.chosen_player_ids),
      supabase
        .from("coaches")
        .select("id, full_name, team")
        .eq("id", row.chosen_coach_id)
        .single(),
    ]);

    const playersById = new Map((playersRes.data ?? []).map((player) => [player.id, player]));
    const orderedPlayers = row.chosen_player_ids
      .map((id) => playersById.get(id))
      .filter((player): player is NonNullable<typeof player> => Boolean(player));

    setSelected({
      ...row,
      players: orderedPlayers,
      coach: coachRes.data ?? { id: "", full_name: "Bilinmiyor", team: "" },
    });
    setDetailLoading(false);
  };

  const getMedalEmoji = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}.`;
  };

  const locale = language === "tr" ? "tr-TR" : "en-US";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Başlık */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>{t("leaderboard")}</Text>
          <PreferenceQuickActions />
        </View>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "daily" && styles.tabBtnActive]}
            onPress={() => setTab("daily")}
          >
            <Text
              style={[
                styles.tabBtnText,
                tab === "daily" && styles.tabBtnTextActive,
              ]}
            >
              {t("today")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "alltime" && styles.tabBtnActive]}
            onPress={() => setTab("alltime")}
          >
            <Text
              style={[
                styles.tabBtnText,
                tab === "alltime" && styles.tabBtnTextActive,
              ]}
            >
              {t("allTime")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {tab === "daily" ? t("emptyDaily") : t("emptyAllTime")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.row, index < 3 && styles.rowTop]}
              onPress={() => handleRowPress(item)}
              activeOpacity={0.8}
            >
              <Text style={[styles.rank, index >= 3 && styles.rankNormal]}>
                {getMedalEmoji(index)}
              </Text>
              <View style={styles.rowInfo}>
                <Text style={styles.nickname}>{item.nickname}</Text>
                {tab === "alltime" && (
                  <Text style={styles.rowDate}>
                    {formatPlayDate(item.play_date, locale)}
                  </Text>
                )}
              </View>
              <View style={styles.winsBox}>
                <Text style={styles.winsText}>{item.predicted_wins}</Text>
                <Text style={styles.winsUnit}>{t("wins")}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Detay Modalı */}
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.detailSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            {selected && (
              <>
                <Text style={styles.detailTitle}>
                  {language === "tr"
                    ? `${selected.nickname}'in Kadrosu`
                    : `${selected.nickname}'s Roster`}
                </Text>
                <Text style={styles.detailDate}>
                  {formatPlayDate(selected.play_date, locale, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
                <LinearGradient
                  colors={[colors.gold + "33", colors.surface]}
                  style={styles.detailWinsCard}
                >
                  <Text style={styles.detailWinsNumber}>
                    {selected.predicted_wins}
                  </Text>
                  <Text style={styles.detailWinsLabel}>{t("wins")}</Text>
                </LinearGradient>

                {detailLoading ? (
                  <ActivityIndicator color={colors.gold} style={{ marginTop: 20 }} />
                ) : (
                  <>
                    {SLOTS.map((slot, idx) => {
                      const player = selected.players[idx];
                      const color = SLOT_COLORS[slot];
                      return (
                        <View key={slot} style={styles.detailRow}>
                          <View style={[styles.detailBadge, { backgroundColor: color + "22" }]}>
                            <Text style={[styles.detailBadgeText, { color }]}>{slot}</Text>
                          </View>
                          <Text style={styles.detailPlayerName}>
                            {player?.full_name ?? "—"}
                          </Text>
                          <Text style={styles.detailPlayerTeam}>
                            {player?.team ?? ""}
                          </Text>
                        </View>
                      );
                    })}
                    {/* Koç */}
                    <View style={styles.detailRow}>
                      <View style={[styles.detailBadge, { backgroundColor: colors.gold + "22" }]}>
                        <Text style={[styles.detailBadgeText, { color: colors.gold }]}>
                          {language === "tr" ? "KOÇ" : "COACH"}
                        </Text>
                      </View>
                      <Text style={styles.detailPlayerName}>
                        {selected.coach.full_name}
                      </Text>
                      <Text style={styles.detailPlayerTeam}>
                        {selected.coach.team}
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 28,
    color: colors.textPrimary,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.sm,
  },
  tabBtnActive: {
    backgroundColor: colors.gold,
  },
  tabBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.textMuted,
  },
  tabBtnTextActive: {
    color: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xxl,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  rowTop: {
    borderColor: colors.gold + "44",
  },
  rank: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    lineHeight: 36,
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    textAlign: "center",
    textAlignVertical: "center",
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    overflow: "hidden",
  },
  rankNormal: {
    color: colors.textPrimary,
  },
  rowInfo: {
    flex: 1,
  },
  nickname: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: colors.textMuted,
  },
  winsBox: {
    alignItems: "center",
  },
  winsText: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 22,
    color: colors.gold,
  },
  winsUnit: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  detailSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: "80%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.surfaceBorder,
    borderRadius: BorderRadius.full,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  detailTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  detailDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: Spacing.md,
    textTransform: "capitalize",
  },
  detailWinsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  detailWinsNumber: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 40,
    color: colors.gold,
  },
  detailWinsLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: colors.textSecondary,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  detailBadge: {
    width: 44,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  detailBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  detailPlayerName: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.textPrimary,
  },
  detailPlayerTeam: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.textMuted,
  },
});
