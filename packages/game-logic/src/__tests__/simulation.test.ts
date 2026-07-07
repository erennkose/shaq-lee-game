import {
  sampleNormal,
  eloWinProbability,
  simulateSeason,
  simulateSeasonMany,
} from "../simulation";

// ────────────────────────────────────────────────────────────
// sampleNormal
// ────────────────────────────────────────────────────────────
describe("sampleNormal", () => {
  it("deterministik RNG ile tekrarlanabilir sonuç üretir", () => {
    // Sabit sıralı sayı üreteci
    let counter = 0;
    const values = [0.5, 0.5, 0.3, 0.7, 0.2, 0.8];
    const seededRng = () => values[counter++ % values.length];

    const a = sampleNormal(seededRng, 50, 15);
    counter = 0;
    const b = sampleNormal(seededRng, 50, 15);
    expect(a).toBeCloseTo(b, 5);
  });

  it("büyük örneklemde ortalama yaklaşık olarak doğru", () => {
    const rng = Math.random;
    const samples = Array.from({ length: 10000 }, () =>
      sampleNormal(rng, 50, 15)
    );
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(45);
    expect(mean).toBeLessThan(55);
  });
});

// ────────────────────────────────────────────────────────────
// eloWinProbability
// ────────────────────────────────────────────────────────────
describe("eloWinProbability", () => {
  it("eşit güçte %50 olasılık", () => {
    expect(eloWinProbability(50, 50)).toBeCloseTo(0.5, 5);
  });

  it("çok üstün takım %50'den fazla kazanır", () => {
    expect(eloWinProbability(90, 30)).toBeGreaterThan(0.9);
  });

  it("çok zayıf takım %50'den az kazanır", () => {
    expect(eloWinProbability(10, 90)).toBeLessThan(0.1);
  });

  it("0-1 arasında olasılık döner", () => {
    const prob = eloWinProbability(75, 55);
    expect(prob).toBeGreaterThan(0);
    expect(prob).toBeLessThan(1);
  });
});

// ────────────────────────────────────────────────────────────
// simulateSeason
// ────────────────────────────────────────────────────────────
describe("simulateSeason", () => {
  it("her zaman 0-82 arasında galibiyet döner", () => {
    for (let i = 0; i < 20; i++) {
      const wins = simulateSeason(50);
      expect(wins).toBeGreaterThanOrEqual(0);
      expect(wins).toBeLessThanOrEqual(82);
    }
  });

  it("deterministik RNG → her seferinde aynı sonuç", () => {
    const makeRng = () => {
      let seed = 42;
      return () => {
        seed = (seed * 1664525 + 1013904223) & 0xffffffff;
        return (seed >>> 0) / 0x100000000;
      };
    };
    const wins1 = simulateSeason(60, makeRng());
    const wins2 = simulateSeason(60, makeRng());
    expect(wins1).toBe(wins2);
  });

  it("güç 10 → çok az galibiyet (ortalama < 20)", () => {
    const results = Array.from({ length: 200 }, () => simulateSeason(10));
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    expect(avg).toBeLessThan(20);
  });

  it("güç 90 → çok fazla galibiyet (ortalama > 60)", () => {
    const results = Array.from({ length: 200 }, () => simulateSeason(90));
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    expect(avg).toBeGreaterThan(60);
  });

  it("güç 58 → ortalama ~41 galibiyet (%50'ye yakın)", () => {
    const results = Array.from({ length: 1000 }, () => simulateSeason(58));
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    // %50 * 82 = 41, ±4 tolerans
    expect(avg).toBeGreaterThan(37);
    expect(avg).toBeLessThan(45);
  });
});

// ────────────────────────────────────────────────────────────
// simulateSeasonMany
// ────────────────────────────────────────────────────────────
describe("simulateSeasonMany", () => {
  it("min ≤ mean ≤ max", () => {
    const { mean, min, max } = simulateSeasonMany(50, 100);
    expect(min).toBeLessThanOrEqual(mean);
    expect(mean).toBeLessThanOrEqual(max);
  });

  it("1 iterasyonda min === max === mean", () => {
    const { mean, min, max } = simulateSeasonMany(50, 1);
    expect(min).toBe(mean);
    expect(max).toBe(mean);
  });
});
