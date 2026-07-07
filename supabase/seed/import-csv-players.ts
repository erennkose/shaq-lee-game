/**
 * import-csv-players.ts
 * current_nba_players.csv dosyasını okuyup Supabase players tablosuna yazar.
 *
 * CSV'deki "overall" sütunu (0-99 arası NBA 2K benzeri genel rating) doğrudan
 * power_rating olarak kullanılır. 0-99 → 0-100'e ölçeklenir.
 *
 * Çalıştır: yarn import-players
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌  Eksik ortam değişkeni. .env dosyanı kontrol et.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Tip tanımları ─────────────────────────────────────────────────────

interface CsvRow {
  index: string;
  name: string;
  nationality_1: string;
  nationality_2: string;
  team: string;
  jersey: string;
  position_1: string;
  position_2: string;
  archetype: string;
  height_feet: string;
  height_cm: string;
  weight_lbs: string;
  weight_kg: string;
  wingspan_feet: string;
  wingspan_cm: string;
  season_salary: string;
  years_in_the_nba: string;
  birthdate: string;
  hometown: string;
  prior_to_nba: string;
  overall: string;
  group_outside_scoring: string;
  group_athleticism: string;
  group_inside_scoring: string;
  group_playmaking: string;
  group_defense: string;
  group_rebounding: string;
  // ... (kalan badge ve stat sütunları önemsiz)
  [key: string]: string;
}

// ─── CSV Parser (tırnak içindeki virgülleri doğru işler) ───────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // çift tırnak → tek tırnak
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(content: string): CsvRow[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  // İlk satır başlıklar — ama başlık satırı virgülle başlıyor (boş indeks)
  const rawHeaders = parseCSVLine(lines[0]);
  // Boş ilk başlığı "index" olarak adlandır
  rawHeaders[0] = "index";

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: CsvRow = {} as CsvRow;
    rawHeaders.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

// ─── Pozisyon normalizasyonu ────────────────────────────────────────────

const VALID_POSITIONS = new Set(["PG", "SG", "SF", "PF", "C"]);

function normalizePosition(pos: string): string | null {
  const cleaned = pos.trim().toUpperCase();
  return VALID_POSITIONS.has(cleaned) ? cleaned : null;
}

function buildPositions(pos1: string, pos2: string): string[] {
  const positions: string[] = [];
  const p1 = normalizePosition(pos1);
  const p2 = normalizePosition(pos2);
  if (p1) positions.push(p1);
  if (p2 && p2 !== p1) positions.push(p2);
  return positions.length > 0 ? positions : ["SF"]; // fallback
}

// ─── Takım kısaltması türet ──────────────────────────────────────────────

const TEAM_ABBR: Record<string, string> = {
  "Atlanta Hawks": "ATL",
  "Boston Celtics": "BOS",
  "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA",
  "Chicago Bulls": "CHI",
  "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL",
  "Denver Nuggets": "DEN",
  "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW",
  "Houston Rockets": "HOU",
  "Indiana Pacers": "IND",
  "Los Angeles Clippers": "LAC",
  "LA Clippers": "LAC",
  "Los Angeles Lakers": "LAL",
  "LA Lakers": "LAL",
  "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL",
  "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP",
  "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC",
  "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI",
  "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR",
  "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS",
  "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA",
  "Washington Wizards": "WAS",
};

function getTeamAbbr(fullName: string): string {
  return TEAM_ABBR[fullName.trim()] ?? fullName.trim().slice(0, 3).toUpperCase();
}

// ─── Güç puanı hesaplama ─────────────────────────────────────────────────

/**
 * CSV'deki overall rating (60-99 arası) doğrudan power_rating olarak kullanılır.
 * 0-100 skalasına taşımak için olduğu gibi bırakıyoruz (zaten 0-100 içinde).
 * overall 0 veya boşsa, grup ortalamasından tahmini hesapla.
 */
function calculatePowerRating(row: CsvRow): number {
  const overall = parseFloat(row.overall);
  if (!isNaN(overall) && overall > 0) {
    return parseFloat(Math.min(overall, 100).toFixed(2));
  }

  // overall yoksa grup ortalamalarından tahmin et
  const groups = [
    parseFloat(row.group_outside_scoring),
    parseFloat(row.group_athleticism),
    parseFloat(row.group_inside_scoring),
    parseFloat(row.group_playmaking),
    parseFloat(row.group_defense),
    parseFloat(row.group_rebounding),
  ].filter((v) => !isNaN(v) && v > 0);

  if (groups.length > 0) {
    const avg = groups.reduce((a, b) => a + b, 0) / groups.length;
    return parseFloat(Math.min(avg, 100).toFixed(2));
  }

  return 70; // varsayılan (genellikle rookie'ler için)
}

// ─── Görünür istatistikler için grup puanlarını kullan ──────────────────

/**
 * CSV'de ppg/rpg/apg yok. Görünür kart istatistikleri için
 * grup puanlarını normalize ederek kullanıyoruz:
 *
 * ppg_display  → group_outside_scoring   (skorer kapasitesi)
 * rpg_display  → group_rebounding        (ribaund kapasitesi)
 * apg_display  → group_playmaking        (yaratıcılık kapasitesi)
 *
 * Bunlar 0-100 arası değerler; 10.0 formatında gösterilecek (sanki ort. istatistik gibi).
 * Seçim ekranı "PPG / RPG / APG" yerine "OFF / REB / PLA" etiketleriyle gösterilecek.
 * Bu, UI'da minimal değişiklik gerektirir.
 */
function buildDisplayStats(row: CsvRow): {
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
} {
  const offScore = parseFloat(row.group_outside_scoring);
  const rebScore = parseFloat(row.group_rebounding);
  const plaScore = parseFloat(row.group_playmaking);

  return {
    ppg: !isNaN(offScore) && offScore > 0 ? offScore : null,
    rpg: !isNaN(rebScore) && rebScore > 0 ? rebScore : null,
    apg: !isNaN(plaScore) && plaScore > 0 ? plaScore : null,
  };
}

// ─── ID oluşturma (name-based, slug) ────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-");
}

// ─── Ana fonksiyon ───────────────────────────────────────────────────────

async function main() {
  const csvPath = path.join(
    __dirname,
    "../../datas/current_nba_players.csv"
  );

  if (!fs.existsSync(csvPath)) {
    console.error(`❌  CSV dosyası bulunamadı: ${csvPath}`);
    process.exit(1);
  }

  console.log(`📂  CSV okunuyor: ${csvPath}`);
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);
  console.log(`✅  ${rows.length} oyuncu satırı okundu`);

  // DB satırlarına çevir
  const dbRows = rows
    .filter((row) => row.name?.trim()) // boş satırları atla
    .map((row) => {
      const positions = buildPositions(row.position_1, row.position_2);
      const { ppg, rpg, apg } = buildDisplayStats(row);
      const powerRating = calculatePowerRating(row);
      const teamAbbr = getTeamAbbr(row.team);

      return {
        id: `csv-${toSlug(row.name)}`,
        full_name: row.name.trim(),
        positions,
        team: teamAbbr || null,
        power_rating: powerRating,
        ppg,
        rpg,
        apg,
      };
    });

  console.log(`📊  Dönüştürülen oyuncu sayısı: ${dbRows.length}`);

  // Power rating dağılımını göster
  const ratings = dbRows.map((r) => r.power_rating).filter((v) => v > 0);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  console.log(
    `📈  Power rating dağılımı: min=${min}, max=${max}, ort=${avg.toFixed(1)}`
  );

  // Batch upsert (100'lük gruplar)
  const BATCH = 100;
  let totalInserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < dbRows.length; i += BATCH) {
    const batch = dbRows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("players")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      console.error(`❌  Batch ${i}-${i + BATCH} hatası:`, error.message);
      totalErrors++;
    } else {
      totalInserted += batch.length;
      console.log(`  ✔  ${totalInserted} / ${dbRows.length} oyuncu yazıldı`);
    }
  }

  if (totalErrors === 0) {
    console.log("\n🏀  CSV oyuncu import tamamlandı!");
    console.log(`   Toplam: ${totalInserted} oyuncu Supabase'e yazıldı.`);
    console.log(`   Pozisyonlara örnek:`);
    const byPos: Record<string, number> = {};
    dbRows.forEach((r) => r.positions.forEach((p) => {
      byPos[p] = (byPos[p] ?? 0) + 1;
    }));
    Object.entries(byPos).sort().forEach(([pos, count]) => {
      console.log(`     ${pos}: ${count} oyuncu`);
    });
  } else {
    console.warn(`\n⚠️   ${totalErrors} batch'te hata oluştu.`);
  }
}

main().catch((err) => {
  console.error("Beklenmeyen hata:", err);
  process.exit(1);
});
