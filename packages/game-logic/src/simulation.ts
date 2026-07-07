/**
 * simulation.ts
 * 82 maçlık NBA sezonu simülasyonu — Elo-tarzı olasılık hesabı.
 * Tüm rastgelelik dışarıdan enjekte edilen rng() fonksiyonu ile sağlanır
 * (test edilebilirlik ve deterministik testler için).
 */

import { clamp } from "./powerRating";

// ────────────────────────────────────────────────────────────
// Yardımcılar
// ────────────────────────────────────────────────────────────

/**
 * Normal dağılımdan örnek çeker (Box-Muller dönüşümü).
 * @param rng  0-1 arası uniform rastgele sayı üreten fonksiyon
 * @param mean Ortalama
 * @param std  Standart sapma
 */
export function sampleNormal(
  rng: () => number,
  mean: number,
  std: number
): number {
  // Box-Muller dönüşümü
  const u1 = Math.max(1e-10, rng()); // log(0) önlemi
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

/**
 * Elo galibiyet olasılığı:
 *   P(win) = 1 / (1 + 10^((opponentPower - teamPower) / 20))
 */
export function eloWinProbability(
  teamPower: number,
  opponentPower: number
): number {
  return 1 / (1 + Math.pow(10, (opponentPower - teamPower) / 20));
}

// ────────────────────────────────────────────────────────────
// Ana simülasyon
// ────────────────────────────────────────────────────────────

/**
 * 82 maçlık sezon simülasyonu.
 *
 * @param teamPower  0-100 arası takım güç puanı
 * @param rng        Tekrarlanabilir rastgele sayı kaynağı (default: Math.random)
 * @returns          Kazanılan maç sayısı (0-82)
 */
export function simulateSeason(
  teamPower: number,
  rng: () => number = Math.random
): number {
  let wins = 0;

  for (let i = 0; i < 82; i++) {
    // Rakip gücü: ortalama 58, std 15, [10, 90] arasında sıkıştırılmış
    const opponentPower = clamp(sampleNormal(rng, 58, 15), 10, 90);
    const winProb = eloWinProbability(teamPower, opponentPower);

    if (rng() < winProb) wins++;
  }

  return wins;
}

/**
 * Simülasyonu birden fazla kez çalıştırıp ortalamasını döner.
 * Test ve validasyon için kullanılır.
 */
export function simulateSeasonMany(
  teamPower: number,
  iterations: number,
  rng: () => number = Math.random
): { mean: number; min: number; max: number } {
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    results.push(simulateSeason(teamPower, rng));
  }

  const mean = results.reduce((a, b) => a + b, 0) / results.length;
  return {
    mean,
    min: Math.min(...results),
    max: Math.max(...results),
  };
}
