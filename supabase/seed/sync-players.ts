/**
 * sync-players.ts
 * BALLDONTLIE API'den aktif sezon oyuncu + istatistikleri çeker,
 * güç puanı hesaplayıp Supabase players tablosuna yazar.
 *
 * Çalıştır: yarn sync-players
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BALLDONTLIE_API_KEY = process.env.BALLDONTLIE_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BALLDONTLIE_API_KEY) {
  console.error("❌  Eksik ortam değişkeni. .env dosyanı kontrol et.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ------- Tip tanımları -------

interface BDLPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string; // "G", "F", "C", "G-F", "F-C" vb.
  team: { abbreviation: string } | null;
}

interface BDLSeasonAvg {
  player_id: number;
  pts: number;
  reb: number;
  ast: number;
}

interface BDLAdvancedStats {
  player_id: number;
  bpm: number | null;
  win_shares: number | null;
  win_shares_per_48: number | null;
}

// ------- Yardımcı -------

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** NBA pozisyon harflerini standart 2-karakter pozisyonlara çevirir */
function parsePositions(raw: string): string[] {
  if (!raw) return ["SF"]; // fallback
  const map: Record<string, string[]> = {
    G: ["PG", "SG"],
    F: ["SF", "PF"],
    C: ["C"],
    "G-F": ["SG", "SF"],
    "F-G": ["SG", "SF"],
    "F-C": ["PF", "C"],
    "C-F": ["PF", "C"],
    PG: ["PG"],
    SG: ["SG"],
    SF: ["SF"],
    PF: ["PF"],
  };
  return map[raw.trim()] ?? ["SF"];
}

/** 0-100 normalizasyon (min-max) */
function normalizeMinMax(
  value: number,
  min: number,
  max: number
): number {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

/** Oyuncu güç puanı formülü (ham değerler üzerinden) */
function computeRawScore(
  pts: number,
  ast: number,
  reb: number,
  bpm: number,
  winSharesPer48: number
): number {
  // BPM tipik aralığı: -10 ile +12
  // winSharesPer48 tipik aralığı: -0.1 ile +0.35
  return (
    0.3 * bpm +
    0.25 * winSharesPer48 * 100 + // *100 → benzer ölçeğe getir
    0.2 * pts +
    0.15 * ast * 2 + // assist'i biraz ağırlandır
    0.1 * reb
  );
}

// ------- BALLDONTLIE İstekleri -------

async function fetchAllPlayers(): Promise<BDLPlayer[]> {
  const players: BDLPlayer[] = [];
  let cursor: number | undefined;
  let page = 0;

  console.log("⏳  Oyuncular çekiliyor...");
  do {
    const params = new URLSearchParams({ per_page: "100" });
    if (cursor) params.set("cursor", String(cursor));

    const res = await fetch(
      `https://api.balldontlie.io/v1/players?${params}`,
      { headers: { Authorization: BALLDONTLIE_API_KEY } }
    );

    if (!res.ok) {
      console.error(`BDL players hata: ${res.status} ${await res.text()}`);
      break;
    }

    const json = (await res.json()) as {
      data: BDLPlayer[];
      meta: { next_cursor?: number };
    };

    players.push(...json.data);
    cursor = json.meta.next_cursor;
    page++;
    console.log(`  Sayfa ${page}: ${players.length} oyuncu toplam`);

    await sleep(350); // Rate limit: ~3 req/sn güvenli
  } while (cursor);

  return players;
}

async function fetchSeasonAverages(
  season: number
): Promise<Map<number, BDLSeasonAvg>> {
  const map = new Map<number, BDLSeasonAvg>();
  let cursor: number | undefined;

  console.log(`⏳  ${season} sezonu ort. istatistikler çekiliyor...`);
  do {
    const params = new URLSearchParams({
      season: String(season),
      per_page: "100",
    });
    if (cursor) params.set("cursor", String(cursor));

    const res = await fetch(
      `https://api.balldontlie.io/v1/season_averages?${params}`,
      { headers: { Authorization: BALLDONTLIE_API_KEY } }
    );

    if (!res.ok) {
      console.error(`BDL season_averages hata: ${res.status}`);
      break;
    }

    const json = (await res.json()) as {
      data: BDLSeasonAvg[];
      meta: { next_cursor?: number };
    };

    json.data.forEach((s) => map.set(s.player_id, s));
    cursor = json.meta.next_cursor;

    await sleep(350);
  } while (cursor);

  return map;
}

async function fetchAdvancedStats(
  season: number
): Promise<Map<number, BDLAdvancedStats>> {
  const map = new Map<number, BDLAdvancedStats>();
  let cursor: number | undefined;

  console.log(`⏳  ${season} sezonu ileri istatistikler çekiliyor...`);
  do {
    const params = new URLSearchParams({
      season: String(season),
      per_page: "100",
    });
    if (cursor) params.set("cursor", String(cursor));

    const res = await fetch(
      `https://api.balldontlie.io/v1/player_advanced_stats?${params}`,
      { headers: { Authorization: BALLDONTLIE_API_KEY } }
    );

    if (!res.ok) {
      // İleri istatistikler bazı katmanlarda yoksa atla
      console.warn(`BDL advanced_stats erişilemiyor (${res.status}), atlanıyor`);
      break;
    }

    const json = (await res.json()) as {
      data: BDLAdvancedStats[];
      meta: { next_cursor?: number };
    };

    json.data.forEach((s) => map.set(s.player_id, s));
    cursor = json.meta.next_cursor;

    await sleep(350);
  } while (cursor);

  return map;
}

// ------- Ana fonksiyon -------

async function main() {
  const SEASON = 2024; // 2024-25 sezonu

  const allPlayers = await fetchAllPlayers();
  const seasonAvg = await fetchSeasonAverages(SEASON);
  const advancedStats = await fetchAdvancedStats(SEASON);

  // Sadece istatistiği olan oyuncuları dahil et
  const activePlayers = allPlayers.filter((p) => seasonAvg.has(p.id));
  console.log(`✅  Aktif oyuncu sayısı: ${activePlayers.length}`);

  // Güç puanı normalizasyonu için ham puanları hesapla
  const rawScores = activePlayers.map((p) => {
    const avg = seasonAvg.get(p.id)!;
    const adv = advancedStats.get(p.id);
    return computeRawScore(
      avg.pts ?? 0,
      avg.ast ?? 0,
      avg.reb ?? 0,
      adv?.bpm ?? 0,
      adv?.win_shares_per_48 ?? 0
    );
  });

  const minScore = Math.min(...rawScores);
  const maxScore = Math.max(...rawScores);

  console.log(
    `📊  Ham puan aralığı: ${minScore.toFixed(2)} – ${maxScore.toFixed(2)}`
  );

  // Supabase upsert
  const rows = activePlayers.map((p, i) => {
    const avg = seasonAvg.get(p.id)!;
    return {
      id: String(p.id),
      full_name: `${p.first_name} ${p.last_name}`,
      positions: parsePositions(p.position),
      team: p.team?.abbreviation ?? null,
      power_rating: parseFloat(
        normalizeMinMax(rawScores[i], minScore, maxScore).toFixed(2)
      ),
      ppg: avg.pts ?? null,
      rpg: avg.reb ?? null,
      apg: avg.ast ?? null,
    };
  });

  // Batch upsert (100'lük gruplar)
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("players")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      console.error(`❌  Upsert hatası (${i}-${i + BATCH}):`, error.message);
    } else {
      console.log(`  ✔  ${i + batch.length} / ${rows.length} oyuncu yazıldı`);
    }
  }

  console.log("🏀  Oyuncu sync tamamlandı.");
}

main().catch((err) => {
  console.error("Beklenmeyen hata:", err);
  process.exit(1);
});
