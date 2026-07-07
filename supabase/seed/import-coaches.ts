/**
 * import-coaches.ts
 * coaches.json → Supabase coaches tablosuna aktarım.
 *
 * Çalıştır: yarn import-coaches
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌  Eksik ortam değişkeni.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface CoachJson {
  id: string;
  full_name: string;
  team: string;
  career_win_pct: number;
  playoff_titles: number;
}

/**
 * Koç güç puanı formülü:
 * career_win_pct → 0-100 (zaten 0-1 arasında, *100)
 * playoff_titles → her şampiyonluk +5 bonus (max +25)
 * Toplam normalize edilir 0-100 aralığına.
 */
function calculateCoachPower(
  winPct: number,
  playoffTitles: number
): number {
  const base = winPct * 100;
  const bonus = Math.min(playoffTitles * 5, 25);
  return Math.min(100, base + bonus);
}

async function main() {
  const jsonPath = path.join(__dirname, "coaches.json");
  const raw = fs.readFileSync(jsonPath, "utf-8");
  const coaches: CoachJson[] = JSON.parse(raw);

  const rows = coaches.map((c) => ({
    id: c.id,
    full_name: c.full_name,
    team: c.team,
    power_rating: parseFloat(
      calculateCoachPower(c.career_win_pct, c.playoff_titles).toFixed(2)
    ),
    career_win_pct: c.career_win_pct,
    playoff_titles: c.playoff_titles,
  }));

  console.log(`⏳  ${rows.length} koç aktarılıyor...`);

  const { error } = await supabase
    .from("coaches")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.error("❌  Upsert hatası:", error.message);
    process.exit(1);
  }

  console.log("✅  Koç verisi aktarıldı:");
  rows.forEach((r) =>
    console.log(`  ${r.full_name} (${r.team}) → güç: ${r.power_rating}`)
  );
}

main().catch((err) => {
  console.error("Beklenmeyen hata:", err);
  process.exit(1);
});
