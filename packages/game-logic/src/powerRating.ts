/**
 * powerRating.ts
 * Oyuncu ve koç güç puanlarını hesaplayan saf (pure) fonksiyonlar.
 * Supabase Edge Function ve test ortamında kullanılır.
 */

// ────────────────────────────────────────────────────────────
// Tipler
// ────────────────────────────────────────────────────────────

export interface PlayerStats {
  ppg: number;       // Maç başı sayı ortalaması
  rpg: number;       // Maç başı ribaund ortalaması
  apg: number;       // Maç başı asist ortalaması
  bpm: number;       // Box Plus/Minus (ileri istatistik)
  winSharesPer48: number; // Win Shares / 48 dakika
}

export interface CoachStats {
  careerWinPct: number;  // 0.0 – 1.0 arasında kariyer galibiyet yüzdesi
  playoffTitles: number; // Kazanılan şampiyonluk sayısı
}

// ────────────────────────────────────────────────────────────
// Yardımcılar
// ────────────────────────────────────────────────────────────

/** Bir değeri [min, max] aralığına sıkıştırır */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Min-max normalizasyonu: value'yu [0, 100] aralığına getirir.
 * Bütün oyuncu havuzu üzerinden min/max verilmeli.
 */
export function normalizeMinMax(
  value: number,
  min: number,
  max: number
): number {
  if (max === min) return 50;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

// ────────────────────────────────────────────────────────────
// Oyuncu Güç Puanı
// ────────────────────────────────────────────────────────────

/**
 * Ham kompozit skor hesaplar (normalize edilmeden önce).
 * Formül:
 *   0.30 * BPM
 *   0.25 * (WinShares/48 * 100)   ← aynı ölçeğe getirildi
 *   0.20 * PTS
 *   0.15 * AST * 2                ← yaratıcılık ağırlığı
 *   0.10 * REB
 */
export function computePlayerRawScore(stats: PlayerStats): number {
  return (
    0.3 * stats.bpm +
    0.25 * stats.winSharesPer48 * 100 +
    0.2 * stats.ppg +
    0.15 * stats.apg * 2 +
    0.1 * stats.rpg
  );
}

/**
 * Oyuncu güç puanı (0-100).
 * Çağırana tüm oyuncu havuzunun min/max ham skoru sağlaması gerekir.
 */
export function calculatePlayerPower(
  stats: PlayerStats,
  minRaw: number,
  maxRaw: number
): number {
  const raw = computePlayerRawScore(stats);
  return normalizeMinMax(raw, minRaw, maxRaw);
}

// ────────────────────────────────────────────────────────────
// Koç Güç Puanı
// ────────────────────────────────────────────────────────────

/**
 * Koç güç puanı (0-100).
 * Formül:
 *   careerWinPct * 100           → 0-100 baz
 *   + playoff_titles * 5 (max 25) → şampiyonluk bonusu
 */
export function calculateCoachPower(stats: CoachStats): number {
  const base = clamp(stats.careerWinPct * 100, 0, 100);
  const bonus = Math.min(stats.playoffTitles * 5, 25);
  return clamp(base + bonus, 0, 100);
}

// ────────────────────────────────────────────────────────────
// Takım Güç Puanı
// ────────────────────────────────────────────────────────────

/**
 * Takım güç puanı:
 *   0.70 * ortalama(6 oyuncu gücü) + 0.30 * koç gücü
 */
export function calculateTeamPower(
  playerPowers: number[],
  coachPower: number
): number {
  if (playerPowers.length === 0) return 0;
  const avg =
    playerPowers.reduce((sum, p) => sum + p, 0) / playerPowers.length;
  return clamp(0.8 * avg + 0.2 * coachPower, 0, 100);
}
