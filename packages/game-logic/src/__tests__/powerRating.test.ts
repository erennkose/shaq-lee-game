import {
  clamp,
  normalizeMinMax,
  computePlayerRawScore,
  calculatePlayerPower,
  calculateCoachPower,
  calculateTeamPower,
  PlayerStats,
  CoachStats,
} from "../powerRating";

// ────────────────────────────────────────────────────────────
// clamp
// ────────────────────────────────────────────────────────────
describe("clamp", () => {
  it("değeri alt limitin altında sınırlandırır", () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });

  it("değeri üst limitin üstünde sınırlandırır", () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it("aralık içindeki değeri değiştirmez", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

// ────────────────────────────────────────────────────────────
// normalizeMinMax
// ────────────────────────────────────────────────────────────
describe("normalizeMinMax", () => {
  it("min değeri → 0 döner", () => {
    expect(normalizeMinMax(0, 0, 100)).toBe(0);
  });

  it("max değeri → 100 döner", () => {
    expect(normalizeMinMax(100, 0, 100)).toBe(100);
  });

  it("orta değer → 50 döner", () => {
    expect(normalizeMinMax(50, 0, 100)).toBe(50);
  });

  it("min === max ise 50 döner", () => {
    expect(normalizeMinMax(42, 42, 42)).toBe(50);
  });

  it("negatif aralıklar desteklenir", () => {
    expect(normalizeMinMax(0, -10, 10)).toBeCloseTo(50);
  });
});

// ────────────────────────────────────────────────────────────
// computePlayerRawScore
// ────────────────────────────────────────────────────────────
describe("computePlayerRawScore", () => {
  const zeroStats: PlayerStats = {
    ppg: 0,
    rpg: 0,
    apg: 0,
    bpm: 0,
    winSharesPer48: 0,
  };

  it("sıfır istatistikle 0 döner", () => {
    expect(computePlayerRawScore(zeroStats)).toBe(0);
  });

  it("daha iyi istatistikler daha yüksek ham puan verir", () => {
    const mvpStats: PlayerStats = {
      ppg: 30,
      rpg: 11,
      apg: 10,
      bpm: 10,
      winSharesPer48: 0.3,
    };
    const benchStats: PlayerStats = {
      ppg: 5,
      rpg: 2,
      apg: 1,
      bpm: -3,
      winSharesPer48: 0.01,
    };
    expect(computePlayerRawScore(mvpStats)).toBeGreaterThan(
      computePlayerRawScore(benchStats)
    );
  });

  it("negatif BPM ham skoru düşürür", () => {
    const goodStats: PlayerStats = {
      ppg: 20,
      rpg: 5,
      apg: 5,
      bpm: 0,
      winSharesPer48: 0.1,
    };
    const badBpmStats: PlayerStats = { ...goodStats, bpm: -5 };
    expect(computePlayerRawScore(badBpmStats)).toBeLessThan(
      computePlayerRawScore(goodStats)
    );
  });
});

// ────────────────────────────────────────────────────────────
// calculatePlayerPower
// ────────────────────────────────────────────────────────────
describe("calculatePlayerPower", () => {
  it("0-100 aralığında sonuç üretir", () => {
    const stats: PlayerStats = {
      ppg: 25,
      rpg: 7,
      apg: 6,
      bpm: 5,
      winSharesPer48: 0.2,
    };
    const power = calculatePlayerPower(stats, -10, 20);
    expect(power).toBeGreaterThanOrEqual(0);
    expect(power).toBeLessThanOrEqual(100);
  });
});

// ────────────────────────────────────────────────────────────
// calculateCoachPower
// ────────────────────────────────────────────────────────────
describe("calculateCoachPower", () => {
  it("galibiyet yüzdesi 0 ve şampiyonluk 0 → düşük puan", () => {
    const stats: CoachStats = { careerWinPct: 0, playoffTitles: 0 };
    expect(calculateCoachPower(stats)).toBe(0);
  });

  it("galibiyet yüzdesi 1.0 ve 5 şampiyonluk → 100 (üst sınır)", () => {
    const stats: CoachStats = { careerWinPct: 1.0, playoffTitles: 5 };
    // 100 + 25 = 125 → clamp → 100
    expect(calculateCoachPower(stats)).toBe(100);
  });

  it("Popovich gibi (%60 + 5 şampiyonluk) → yüksek puan", () => {
    const stats: CoachStats = { careerWinPct: 0.6, playoffTitles: 5 };
    const power = calculateCoachPower(stats);
    // 60 + 25 = 85
    expect(power).toBe(85);
  });

  it("playoff bonusu max 25 ile sınırlandırılır", () => {
    const stats5: CoachStats = { careerWinPct: 0.5, playoffTitles: 5 };
    const stats10: CoachStats = { careerWinPct: 0.5, playoffTitles: 10 };
    // Her ikisi de aynı bonus almalı (25 max)
    expect(calculateCoachPower(stats5)).toBe(calculateCoachPower(stats10));
  });
});

// ────────────────────────────────────────────────────────────
// calculateTeamPower
// ────────────────────────────────────────────────────────────
describe("calculateTeamPower", () => {
  it("tüm oyuncular 100, koç 100 → 100", () => {
    const power = calculateTeamPower([100, 100, 100, 100, 100, 100], 100);
    expect(power).toBeCloseTo(100, 1);
  });

  it("tüm oyuncular 0, koç 0 → 0", () => {
    expect(calculateTeamPower([0, 0, 0, 0, 0, 0], 0)).toBe(0);
  });

  it("boş oyuncu listesi → 0", () => {
    expect(calculateTeamPower([], 80)).toBe(0);
  });

  it("oyuncular %80, koç %20 ağırlıkla hesaplanır", () => {
    const power = calculateTeamPower([80, 80, 80, 80, 80, 80], 60);
    // 0.8 * 80 + 0.2 * 60 = 64 + 12 = 76
    expect(power).toBeCloseTo(76, 1);
  });
});
