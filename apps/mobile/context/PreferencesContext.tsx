import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DarkColors,
  LightColors,
  SLOT_LABELS,
  SLOT_LABELS_EN,
  ThemeColors,
} from "../constants/theme";

type ThemeMode = "dark" | "light";
type Language = "tr" | "en";

type TranslationKey =
  | "appearance"
  | "allTime"
  | "back"
  | "buildNow"
  | "cancel"
  | "candidatesLoading"
  | "choose"
  | "coach"
  | "disclaimer"
  | "emptyAllTime"
  | "emptyDaily"
  | "emptyProfileSubtitle"
  | "emptyProfileTitle"
  | "english"
  | "enterNickname"
  | "error"
  | "languageLabel"
  | "light"
  | "leaderboard"
  | "leaderboardSave"
  | "leaderboardSaved"
  | "loading"
  | "nicknameHint"
  | "nicknamePlaceholder"
  | "preferences"
  | "players"
  | "playerPowerRatings"
  | "power"
  | "powerRevealHidden"
  | "powerRevealShown"
  | "profile"
  | "retry"
  | "roster"
  | "rosterReady"
  | "save"
  | "saveAndContinue"
  | "scoreSaved"
  | "seasonPrediction"
  | "selectRoster"
  | "simulate"
  | "slotsMissing"
  | "subtitle"
  | "success"
  | "themeLabel"
  | "teamPower"
  | "today"
  | "todayRoster"
  | "todaysResult"
  | "tomorrowRoster"
  | "turkish"
  | "dark"
  | "wins"
  | "winsSeason"
  | "winsUpper"
  | "reroll"
  | "rerollRemaining"
  | "rerollLimitReached"
  | "rerollConfirmTitle"
  | "rerollUsedAlert"
  | "yes";

const translations: Record<Language, Record<TranslationKey, string>> = {
  tr: {
    appearance: "Görünüm",
    allTime: "Tüm Zamanlar",
    back: "← Geri",
    buildNow: "Hemen Kadro Kur 🚀",
    cancel: "Vazgeç",
    candidatesLoading: "Adaylar yükleniyor...",
    choose: "Seç",
    coach: "Koç",
    disclaimer: "Bu uygulama NBA veya NBPA ile bağlantılı değildir.",
    emptyAllTime: "Henüz kayıt yok.",
    emptyDaily: "Bugün henüz kimse oynamadı. İlk sen ol!",
    emptyProfileSubtitle:
      "Günün en iyi basketbol kadrosunu bir araya getir, simüle et ve sıralamada yerini al!",
    emptyProfileTitle: "Bugün Henüz Kadro Kurmadın",
    english: "İngilizce",
    enterNickname: "Lütfen bir takma ad girin.",
    error: "Hata",
    languageLabel: "Dil",
    light: "Aydınlık",
    leaderboard: "Sıralama",
    leaderboardSave: "Skorunu Liderlik Tablosuna Kaydet",
    leaderboardSaved: "Başarıyla kaydedildi! Takma ad:",
    loading: "Yükleniyor...",
    nicknameHint: "Bu isim sıralama tablosunda diğer oyunculara gösterilecektir.",
    nicknamePlaceholder: "Takma ad (örn: Jordan23)",
    preferences: "Tercihler",
    players: "Oyuncular",
    playerPowerRatings: "Oyuncu Güç Puanları",
    power: "güç",
    powerRevealHidden: "⏳ Hesaplanıyor...",
    powerRevealShown: "✨ İşte gerçek güç puanları!",
    profile: "Profil",
    retry: "Tekrar Dene",
    roster: "Kadro",
    rosterReady: "Kadron Hazır!",
    save: "Kaydet",
    saveAndContinue: "Kaydet ve Devam Et",
    scoreSaved: "Skorunuz liderlik tablosuna kaydedildi!",
    seasonPrediction: "Sezon Tahmini",
    selectRoster: "Seçtiğin Kadro",
    simulate: "Kadroyu Simüle Et 🚀",
    slotsMissing: "Tüm slotları doldur",
    subtitle:
      "Her slota dokunarak pozisyonuna uygun oyuncular arasından seçim yap. Takımın 82 maçlık sanal sezonda kaç galibiyet alır?",
    success: "Başarılı",
    themeLabel: "Tema",
    teamPower: "Takım Gücü",
    today: "Bugün",
    todayRoster: "Bugünkü Kadrom",
    todaysResult: "Bugünkü Sonucun",
    tomorrowRoster: "⏰ Yarın yeni kadro kurabilirsin",
    turkish: "Türkçe",
    dark: "Karanlık",
    wins: "Galibiyet",
    winsSeason: "82 Maçlık Sezonda",
    winsUpper: "GALİBİYET",
    reroll: "Yeniden Öner",
    rerollRemaining: "1 Reroll Hakkı Mevcut",
    rerollLimitReached: "Reroll Hakkı Tükendi",
    rerollConfirmTitle: "Reroll Kullanılsın mı?",
    rerollUsedAlert: "Bu pozisyon için yeni adaylar getirilecek. Günlük 1 olan reroll hakkınız kullanılacaktır. Onaylıyor musunuz?",
    yes: "Evet",
  },
  en: {
    appearance: "Appearance",
    allTime: "All Time",
    back: "← Back",
    buildNow: "Build Roster 🚀",
    cancel: "Cancel",
    candidatesLoading: "Loading candidates...",
    choose: "Choose",
    coach: "Coach",
    disclaimer: "This app is not affiliated with the NBA or NBPA.",
    emptyAllTime: "No entries yet.",
    emptyDaily: "Nobody has played today. Be the first!",
    emptyProfileSubtitle:
      "Build today's best basketball roster, simulate it, and claim your spot on the leaderboard.",
    emptyProfileTitle: "You Haven't Built a Roster Today",
    english: "English",
    enterNickname: "Please enter a nickname.",
    error: "Error",
    languageLabel: "Language",
    light: "Light",
    leaderboard: "Leaderboard",
    leaderboardSave: "Save Your Score to the Leaderboard",
    leaderboardSaved: "Saved successfully! Nickname:",
    loading: "Loading...",
    nicknameHint: "This name will be shown to other players on the leaderboard.",
    nicknamePlaceholder: "Nickname (e.g. Jordan23)",
    preferences: "Preferences",
    players: "Players",
    playerPowerRatings: "Player Power Ratings",
    power: "power",
    powerRevealHidden: "⏳ Calculating...",
    powerRevealShown: "✨ Here are the real power ratings!",
    profile: "Profile",
    retry: "Try Again",
    roster: "Roster",
    rosterReady: "Your Roster Is Ready!",
    save: "Save",
    saveAndContinue: "Save and Continue",
    scoreSaved: "Your score has been saved to the leaderboard!",
    seasonPrediction: "Season Prediction",
    selectRoster: "Your Roster",
    simulate: "Simulate Roster 🚀",
    slotsMissing: "Fill every slot",
    subtitle:
      "Tap each slot to choose eligible players. How many wins can your team get in a virtual 82-game season?",
    success: "Success",
    themeLabel: "Theme",
    teamPower: "Team Power",
    today: "Today",
    todayRoster: "Today's Roster",
    todaysResult: "Today's Result",
    tomorrowRoster: "⏰ You can build a new roster tomorrow",
    turkish: "Turkish",
    dark: "Dark",
    wins: "Wins",
    winsSeason: "In an 82-Game Season",
    winsUpper: "WINS",
    reroll: "Reroll",
    rerollRemaining: "1 Reroll Available",
    rerollLimitReached: "Reroll Limit Reached",
    rerollConfirmTitle: "Use Reroll?",
    rerollUsedAlert: "This will fetch new candidate players for this position. Your daily 1-time reroll right will be used. Do you confirm?",
    yes: "Yes",
  },
};

const STORAGE_KEY = "kadromu_kur_preferences";

interface PreferencesValue {
  colors: ThemeColors;
  language: Language;
  setLanguage: (language: Language) => void;
  setThemeMode: (theme: ThemeMode) => void;
  slotLabels: Record<string, string>;
  t: (key: TranslationKey) => string;
  themeMode: ThemeMode;
  toggleLanguage: () => void;
  toggleTheme: () => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("dark");
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored) as Partial<{
          themeMode: ThemeMode;
          language: Language;
        }>;
        if (parsed.themeMode === "dark" || parsed.themeMode === "light") {
          setThemeModeState(parsed.themeMode);
        }
        if (parsed.language === "tr" || parsed.language === "en") {
          setLanguageState(parsed.language);
        }
      } catch (err) {
        console.error("Tercihler yüklenirken hata:", err);
      }
    };

    loadPreferences();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ themeMode, language })).catch((err) => {
      console.error("Tercihler kaydedilirken hata:", err);
    });
  }, [themeMode, language]);

  const value = useMemo<PreferencesValue>(() => {
    const colors = themeMode === "dark" ? DarkColors : LightColors;
    const setThemeMode = (nextTheme: ThemeMode) => setThemeModeState(nextTheme);
    const setLanguage = (nextLanguage: Language) => setLanguageState(nextLanguage);

    return {
      colors,
      language,
      setLanguage,
      setThemeMode,
      slotLabels: language === "tr" ? SLOT_LABELS : SLOT_LABELS_EN,
      t: (key) => translations[language][key],
      themeMode,
      toggleLanguage: () => setLanguageState((current) => (current === "tr" ? "en" : "tr")),
      toggleTheme: () => setThemeModeState((current) => (current === "dark" ? "light" : "dark")),
    };
  }, [language, themeMode]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return value;
}
