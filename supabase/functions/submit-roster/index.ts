/**
 * submit-roster/index.ts
 * Supabase Edge Function — Kadro gönder, simüle et, kaydet
 *
 * POST /functions/v1/submit-roster
 * Headers: Authorization: Bearer <JWT>
 * Body: { playerIds: string[], coachId: string, nickname: string }
 * Yanıt:
 *   201: { teamPower, predictedWins, playerDetails[], coachDetail }
 *   409: { error: "Bu gün için zaten bir deneme var" }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ─── Oyun mantığı (Edge Function içinde inline) ──────────────
// Not: Deno ortamında npm paketleri doğrudan import edilemez,
//      bu nedenle core fonksiyonlar burada inline tanımlanmıştır.

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sampleNormal(rng: () => number, mean: number, std: number): number {
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

function eloWinProbability(teamPower: number, opponentPower: number): number {
  return 1 / (1 + Math.pow(10, (opponentPower - teamPower) / 20));
}

function simulateSeason(teamPower: number, rng: () => number): number {
  let wins = 0;
  for (let i = 0; i < 82; i++) {
    const opponentPower = clamp(sampleNormal(rng, 58, 15), 10, 90);
    const winProb = eloWinProbability(teamPower, opponentPower);
    if (rng() < winProb) wins++;
  }
  return wins;
}

function calculateTeamPower(
  playerPowers: number[],
  coachPower: number
): number {
  if (playerPowers.length === 0) return 0;
  const avg = playerPowers.reduce((s, p) => s + p, 0) / playerPowers.length;
  return clamp(0.8 * avg + 0.2 * coachPower, 0, 100);
}

// ─── Tip tanımları ────────────────────────────────────────────

interface RequestBody {
  playerIds: string[]; // 6 oyuncu id
  coachId: string;
  nickname?: string;
  teamPower?: number;
  predictedWins?: number;
  saveOnly?: boolean;
  playDate?: string;
}

interface PlayerRow {
  id: string;
  full_name: string;
  team: string | null;
  positions: string[];
  power_rating: number;
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
}

interface CoachRow {
  id: string;
  full_name: string;
  team: string | null;
  power_rating: number;
  career_win_pct: number | null;
}

// ─── Handler ─────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Deno/Supabase environment check
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: "Supabase environment variables are missing on the server" }, 500);
    }

    // Service role client (gücü görmek ve DB'ye yazmak için)
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { playerIds, coachId, nickname, teamPower, predictedWins, saveOnly, playDate } = body;

    // Validasyon
    if (!playerIds || playerIds.length !== 6) {
      return json({ error: "6 oyuncu gerekli" }, 400);
    }
    if (!coachId) {
      return json({ error: "Koç gerekli" }, 400);
    }

    // Oyuncu + koç verilerini çek (güç puanları dahil)
    const [rawPlayerDetails, coachDetail] = await Promise.all([
      fetchPlayerDetails(adminSupabase, playerIds),
      fetchCoachDetail(adminSupabase, coachId),
    ]);

    if (rawPlayerDetails.length !== 6) {
      return json({ error: "Geçersiz oyuncu ID'leri" }, 400);
    }
    if (!coachDetail) {
      return json({ error: "Geçersiz koç ID'si" }, 400);
    }

    // Oyuncu detaylarını gönderilen sıraya göre sırala (PG, SG, SF, PF, C, 6TH)
    const playerDetails = playerIds
      .map((id) => rawPlayerDetails.find((p) => p.id === id))
      .filter(Boolean) as PlayerRow[];

    if (playerDetails.length !== 6) {
      return json({ error: "Gönderilen bazı oyuncular bulunamadı" }, 400);
    }

    // Oynama tarihi: istemci yerel tarihi (YYYY-MM-DD) varsa onu kullan, yoksa UTC bugünü.
    const resolvedPlayDate = parsePlayDate(playDate);
    const ipHash = await hashClientIp(req);

    // Yalnızca kayıt işlemi (Sonuç ekranındaki isim girişinden çağrılır)
    if (saveOnly) {
      if (!nickname?.trim()) {
        return json({ error: "Takma ad gerekli" }, 400);
      }
      if (teamPower === undefined || predictedWins === undefined) {
        return json({ error: "Takım gücü ve galibiyet tahminleri eksik" }, 400);
      }

      // DB'ye kaydet (herkes için anonim kayıt)
      const { data: insertData, error: insertError } = await adminSupabase
        .from("daily_attempts")
        .insert({
          user_id: null,
          nickname: nickname.trim(),
          ip_hash: ipHash,
          play_date: resolvedPlayDate,
          chosen_player_ids: playerIds,
          chosen_coach_id: coachId,
          team_power: parseFloat(teamPower.toFixed(2)),
          predicted_wins: predictedWins,
        })
        .select("id")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          return json({ error: "Bu gün için zaten bir deneme var" }, 409);
        }
        throw insertError;
      }

      return json({ id: insertData?.id, success: true }, 201);
    }

    // Simülasyon işlemi (Ana ekranda butona tıklandığında çağrılır - Kayıt YAPMAZ)
    const playerPowers = playerDetails.map((p: PlayerRow) => p.power_rating);
    const calculatedTeamPower = calculateTeamPower(playerPowers, coachDetail.power_rating);
    const simulatedWins = simulateSeason(calculatedTeamPower, Math.random);

    return json(
      {
        alreadyPlayed: false,
        teamPower: parseFloat(calculatedTeamPower.toFixed(2)),
        predictedWins: simulatedWins,
        playerDetails,
        coachDetail,
      },
      200
    );
  } catch (err) {
    console.error("submit-roster hatası:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

// ─── Yardımcılar ─────────────────────────────────────────────

async function fetchPlayerDetails(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  playerIds: string[]
): Promise<PlayerRow[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, full_name, team, positions, power_rating, ppg, rpg, apg")
    .in("id", playerIds);

  if (error) throw error;
  return data ?? [];
}

async function fetchCoachDetail(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  coachId: string
): Promise<CoachRow | null> {
  const { data, error } = await supabase
    .from("coaches")
    .select("id, full_name, team, power_rating, career_win_pct")
    .eq("id", coachId)
    .single();

  if (error) return null;
  return data;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parsePlayDate(input?: string): string {
  if (!input) {
    return getDateInTimeZone("Europe/Istanbul");
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) {
    throw new Error("playDate formatı geçersiz. YYYY-MM-DD bekleniyor.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("playDate değeri geçersiz.");
  }

  return input;
}

function getDateInTimeZone(timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().split("T")[0];
  }

  return `${year}-${month}-${day}`;
}

async function hashClientIp(req: Request): Promise<string> {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfIp = req.headers.get("cf-connecting-ip");

  const rawIp =
    forwarded?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    cfIp?.trim() ||
    "unknown";

  const salt = Deno.env.get("IP_HASH_SALT") ?? "";
  const encoded = new TextEncoder().encode(`${salt}:${rawIp}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
