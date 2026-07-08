/**
 * Game Context — Günlük kadro seçim durumu yönetimi
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  PropsWithChildren,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SLOTS, SlotKey } from "../constants/theme";
import { getLocalDateKey } from "../lib/date";

export interface SelectedPlayer {
  id: string;
  full_name: string;
  team: string | null;
  positions: string[];
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
  // Güç puanı seçim sırasında saklanır, sonuç ekranına kadar gösterilmez
  power_rating?: number;
}

export interface SelectedCoach {
  id: string;
  full_name: string;
  team: string | null;
  career_win_pct: number | null;
  power_rating?: number;
}

export type RosterState = {
  [key in (typeof SLOTS)[number]]?: SelectedPlayer;
} & { COACH?: SelectedCoach };

interface GameContextValue {
  roster: RosterState;
  setSlot: (slot: SlotKey, player: SelectedPlayer | SelectedCoach) => void;
  clearRoster: () => void;
  isRosterComplete: boolean;
  allPlayerIds: string[];
  rerollUsed: boolean;
  useReroll: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({ children }: PropsWithChildren) {
  const [roster, setRoster] = useState<RosterState>({});
  const [rerollUsed, setRerollUsed] = useState<boolean>(false);

  // Bugün reroll kullanıldı mı kontrol et
  useEffect(() => {
    const checkReroll = async () => {
      try {
        const today = getLocalDateKey();
        const value = await AsyncStorage.getItem(`kadromu_kur_reroll_used:${today}`);
        setRerollUsed(value === "true");
      } catch (err) {
        console.error("Reroll durumu yüklenirken hata:", err);
      }
    };
    checkReroll();
  }, []);

  const setSlot = useCallback(
    (slot: SlotKey, entity: SelectedPlayer | SelectedCoach) => {
      setRoster((prev) => ({ ...prev, [slot]: entity }));
    },
    []
  );

  const clearRoster = useCallback(() => {
    setRoster({});
  }, []);

  const useReroll = useCallback(async () => {
    try {
      const today = getLocalDateKey();
      await AsyncStorage.setItem(`kadromu_kur_reroll_used:${today}`, "true");
      setRerollUsed(true);
    } catch (err) {
      console.error("Reroll kullanılırken hata:", err);
    }
  }, []);

  const isRosterComplete =
    SLOTS.every((slot) => !!roster[slot]) && !!roster.COACH;

  const allPlayerIds = SLOTS.flatMap((slot) =>
    roster[slot] ? [roster[slot]!.id] : []
  );

  return (
    <GameContext.Provider
      value={{
        roster,
        setSlot,
        clearRoster,
        isRosterComplete,
        allPlayerIds,
        rerollUsed,
        useReroll,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
