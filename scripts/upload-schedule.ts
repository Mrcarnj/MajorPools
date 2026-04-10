import { config } from 'dotenv';
import path from 'path';

// Load env before other imports (supabase-admin uses .env.local)
config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), '.env.local') });

import { getSchedule, getTournament } from '../services/pga-tour/tournaments';
import { supabaseAdmin } from '../lib/supabase-admin';

const YEAR = '2026';

function formatDate(ms: number): string {
  return new Date(ms).toISOString().split('T')[0];
}

/** Parse API number: either a number or MongoDB-style { $numberLong: "..." } / { $numberInt: "..." } */
function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (value && typeof value === 'object' && '$numberLong' in value) {
    const n = Number((value as { $numberLong: string }).$numberLong);
    return Number.isNaN(n) ? null : n;
  }
  if (value != null && typeof value === 'object' && '$numberInt' in value) {
    const n = Number((value as { $numberInt: string }).$numberInt);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function locationText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length ? t : null;
}

/** PGA schedule/tournament payloads expose venue on the first course. */
function locationFromCoursesPayload(payload: unknown): {
  city: string | null;
  state: string | null;
  country: string | null;
} {
  const courses = (payload as Record<string, unknown>)?.courses;
  if (!Array.isArray(courses) || !courses[0] || typeof courses[0] !== 'object') {
    return { city: null, state: null, country: null };
  }
  const loc = (courses[0] as Record<string, unknown>).location;
  if (!loc || typeof loc !== 'object') {
    return { city: null, state: null, country: null };
  }
  const o = loc as Record<string, unknown>;
  return {
    city: locationText(o.city),
    state: locationText(o.state),
    country: locationText(o.country),
  };
}

async function uploadSchedule() {
  try {
    console.log(`📅 Fetching PGA Tour schedule for ${YEAR}...\n`);

    const schedule = await getSchedule(YEAR);

    if (!schedule?.length) {
      console.error('❌ No tournaments returned from API');
      return;
    }

    console.log(`Found ${schedule.length} tournaments. Uploading to database...\n`);

    const { data: activeRow, error: activeError } = await supabaseAdmin
      .from('tournaments')
      .select('pga_tournament_id, name')
      .eq('is_active', true)
      .maybeSingle();

    if (activeError) {
      throw new Error(`Failed to fetch active tournament: ${activeError.message}`);
    }

    const skipPgaTournamentId = activeRow?.pga_tournament_id ?? null;
    if (skipPgaTournamentId) {
      console.log(
        `⏭ Skipping updates for active tournament: ${activeRow?.name ?? '(unknown)'} (pga_tournament_id ${skipPgaTournamentId})\n`
      );
    }

    // Get existing tournaments for this year
    const { data: existingTournaments, error: fetchError } = await supabaseAdmin
      .from('tournaments')
      .select('id, pga_tournament_id')
      .eq('year', parseInt(YEAR, 10));

    if (fetchError) {
      throw new Error(`Failed to fetch existing tournaments: ${fetchError.message}`);
    }

    const existingByPgaId = new Map(
      (existingTournaments || []).map((t) => [t.pga_tournament_id, t.id])
    );

    let inserted = 0;
    let updated = 0;

    for (const event of schedule) {
      if (skipPgaTournamentId != null && event.tournId === skipPgaTournamentId) {
        console.log(`  ⏭ Skipped (active): ${event.name}`);
        continue;
      }

      const startMs = Number(event.date?.start?.$date?.$numberLong ?? event.date?.start);
      const endMs = Number(event.date?.end?.$date?.$numberLong ?? event.date?.end);

      if (!startMs || !endMs) {
        console.warn(`⚠️ Skipping ${event.name} (${event.tournId}): invalid dates`);
        continue;
      }

      // Fetch full tournament details from /tournament endpoint for status, course, par_total, etc.
      let status: string | null = null;
      let courseName: string | null = event.courses?.[0]?.courseName ?? null;
      let currentRound: number | null = parseNumber((event as Record<string, unknown>).currentRound);
      let parTotal: number | null = null;
      let { city, state, country } = locationFromCoursesPayload(event);

      try {
        const tournament = await getTournament(event.tournId, YEAR);
        if (tournament) {
          status = tournament.status ?? null;
          if (tournament.courses?.[0]?.courseName) {
            courseName = tournament.courses[0].courseName;
          }
          const tournamentRound = parseNumber((tournament as Record<string, unknown>).currentRound);
          if (tournamentRound != null) currentRound = tournamentRound;
          // par_total can be on tournament or on first course
          const t = tournament as Record<string, unknown>;
          parTotal = parseNumber(t.parTotal ?? (tournament.courses?.[0] as Record<string, unknown>)?.parTotal);
          const fromTournament = locationFromCoursesPayload(tournament);
          if (fromTournament.city) city = fromTournament.city;
          if (fromTournament.state) state = fromTournament.state;
          if (fromTournament.country) country = fromTournament.country;
        }
      } catch (err) {
        console.warn(`  ⚠️ Could not fetch /tournament for ${event.tournId} (${event.name}), using schedule data only:`, (err as Error).message);
      }

      const purse = parseNumber((event as Record<string, unknown>).purse);

      const tournamentRow = {
        name: event.name,
        year: parseInt(YEAR, 10),
        start_date: formatDate(startMs),
        end_date: formatDate(endMs),
        is_active: false,
        pga_tournament_id: event.tournId,
        pga_year: parseInt(YEAR, 10),
        course_name: courseName,
        city,
        state,
        country,
        purse: purse ?? null,
        status,
        current_round: currentRound,
        par_total: parTotal,
      };

      const existingId = existingByPgaId.get(event.tournId);

      if (existingId) {
        const { error: updateError } = await supabaseAdmin
          .from('tournaments')
          .update(tournamentRow)
          .eq('id', existingId);

        if (updateError) {
          console.error(`❌ Failed to update ${event.name}:`, updateError.message);
        } else {
          updated++;
          console.log(`  ✓ Updated: ${event.name}`);
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from('tournaments')
          .insert(tournamentRow);

        if (insertError) {
          console.error(`❌ Failed to insert ${event.name}:`, insertError.message);
        } else {
          inserted++;
          console.log(`  + Inserted: ${event.name}`);
        }
      }
    }

    console.log(`\n✅ Done! Inserted: ${inserted}, Updated: ${updated}`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

uploadSchedule();
