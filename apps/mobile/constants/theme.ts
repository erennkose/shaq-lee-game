/**
 * Renk paleti ve tasarım sabitleri
 * Karanlık tema odaklı, NBA estetiği
 */

export const DarkColors = {
  // Arkaplanlar
  background: "#0A0E1A",
  surface: "#141824",
  surfaceElevated: "#1C2235",
  surfaceBorder: "#252D45",

  // Vurgu renkleri
  gold: "#F7B731",
  goldLight: "#FFD06B",
  goldDark: "#C8911A",
  blue: "#3D5AFE",
  blueLight: "#738FFE",
  blueDark: "#1A34C8",

  // Metin
  textPrimary: "#FFFFFF",
  textSecondary: "#9BA3C0",
  textMuted: "#4A5468",

  // Durum renkleri
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",

  // Slot pozisyon renkleri
  slotPG: "#3D5AFE",
  slotSG: "#7C3AED",
  slotSF: "#059669",
  slotPF: "#D97706",
  slotC: "#DC2626",
  slot6TH: "#0891B2",
  slotCoach: "#F7B731",
} as const;

export type ThemeColors = { readonly [K in keyof typeof DarkColors]: string };

export const LightColors: ThemeColors = {
  // Arkaplanlar
  background: "#F5F7FB",
  surface: "#FFFFFF",
  surfaceElevated: "#EEF2F8",
  surfaceBorder: "#D7DEE9",

  // Vurgu renkleri
  gold: "#B7791F",
  goldLight: "#E9B949",
  goldDark: "#8A5A14",
  blue: "#2454D6",
  blueLight: "#4C7DFF",
  blueDark: "#183B9A",

  // Metin
  textPrimary: "#101828",
  textSecondary: "#475467",
  textMuted: "#7A8699",

  // Durum renkleri
  success: "#15803D",
  warning: "#B45309",
  error: "#DC2626",

  // Slot pozisyon renkleri
  slotPG: "#2454D6",
  slotSG: "#6D28D9",
  slotSF: "#047857",
  slotPF: "#B45309",
  slotC: "#B91C1C",
  slot6TH: "#0E7490",
  slotCoach: "#B7791F",
} as const;

export const Colors: ThemeColors = DarkColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Typography = {
  // Font family Inter yüklendikten sonra geçerli olur
  fontFamily: "Inter_400Regular",
  fontFamilyMedium: "Inter_500Medium",
  fontFamilySemiBold: "Inter_600SemiBold",
  fontFamilyBold: "Inter_700Bold",
  fontFamilyExtraBold: "Inter_800ExtraBold",

  h1: { fontSize: 32, lineHeight: 40 },
  h2: { fontSize: 24, lineHeight: 32 },
  h3: { fontSize: 20, lineHeight: 28 },
  h4: { fontSize: 17, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 18 },
  label: { fontSize: 11, lineHeight: 16 },
} as const;

export const SLOT_LABELS: Record<string, string> = {
  PG: "Oyun Kurucu",
  SG: "Şutör Gard",
  SF: "Kısa Forvet",
  PF: "Uzun Forvet",
  C: "Pivot",
  "6TH": "6. Adam",
  COACH: "Baş Antrenör",
};

export const SLOT_LABELS_EN: Record<string, string> = {
  PG: "Point Guard",
  SG: "Shooting Guard",
  SF: "Small Forward",
  PF: "Power Forward",
  C: "Center",
  "6TH": "Sixth Man",
  COACH: "Head Coach",
};

export const SLOT_COLORS: Record<string, string> = {
  PG: Colors.slotPG,
  SG: Colors.slotSG,
  SF: Colors.slotSF,
  PF: Colors.slotPF,
  C: Colors.slotC,
  "6TH": Colors.slot6TH,
  COACH: Colors.slotCoach,
};

export const SLOTS = ["PG", "SG", "SF", "PF", "C", "6TH"] as const;
export type SlotKey = (typeof SLOTS)[number] | "COACH";
