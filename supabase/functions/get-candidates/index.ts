/**
 * get-candidates/index.ts
 * Supabase Edge Function — Rastgele oyuncu/koç adayı çekme
 *
 * POST /functions/v1/get-candidates
 * Body: { slot: 'PG'|'SG'|'SF'|'PF'|'C'|'6TH'|'COACH', excludeIds: string[] }
 * Yanıt: { candidates: CandidatePlayer[] }  (güç puanı dahil DEĞİL)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type Slot = "PG" | "SG" | "SF" | "PF" | "C" | "6TH" | "COACH";

interface RequestBody {
  slot: Slot;
  excludeIds?: string[];
}

interface CandidatePlayer {
  id: string;
  full_name: string;
  team: string | null;
  positions: string[];
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
  // NOT: power_rating kasıtlı olarak gönderilmiyor
}

interface CandidateCoach {
  id: string;
  full_name: string;
  team: string | null;
  career_win_pct: number | null;
  // NOT: power_rating kasıtlı olarak gönderilmiyor
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const body: RequestBody = await req.json();
    const { slot, excludeIds = [] } = body;

    if (!slot) {
      return new Response(
        JSON.stringify({ error: "slot parametresi gerekli" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── KOÇLAR ───────────────────────────────────────────
    if (slot === "COACH") {
      let query = supabase
        .from("coaches")
        .select("id, full_name, team, career_win_pct");

      if (excludeIds.length > 0) {
        query = query.not("id", "in", `(${excludeIds.join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const shuffled = shuffleArray(data ?? []);
      const candidates: CandidateCoach[] = shuffled.slice(0, 5);

      return new Response(JSON.stringify({ candidates }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── OYUNCULAR ────────────────────────────────────────
    let query = supabase
      .from("players")
      .select("id, full_name, team, positions, ppg, rpg, apg");

    // 6TH slotu pozisyon kısıtı olmadan tüm havuzu kullanır
    if (slot !== "6TH") {
      query = query.contains("positions", [slot]);
    }

    if (excludeIds.length > 0) {
      query = query.not("id", "in", `(${excludeIds.join(",")})`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Sunucu tarafında Fisher-Yates shuffle → 5 rastgele aday
    const shuffled = shuffleArray(data ?? []);
    const candidates: CandidatePlayer[] = shuffled.slice(0, 5);

    return new Response(JSON.stringify({ candidates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Fisher-Yates shuffle
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
