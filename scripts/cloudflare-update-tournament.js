var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// scripts/cloudflare-update-tournament.js
var API_CONFIG = {
  orgId: "1",
  // PGA Tour
  baseUrl: "https://live-golf-data.p.rapidapi.com",
  headers: {
    "x-rapidapi-host": "live-golf-data.p.rapidapi.com",
    "x-rapidapi-key": "4053a88438msh3d3dd8247f6707fp12e8e0jsne0eb00858f8d"
  }
};
async function pgaFetch(endpoint, params = {}) {
  const queryString = new URLSearchParams({
    ...params,
    orgId: API_CONFIG.orgId
  }).toString();
  const url = `${API_CONFIG.baseUrl}${endpoint}?${queryString}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: API_CONFIG.headers
    });
    const result = await response.text();
    return JSON.parse(result);
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}
__name(pgaFetch, "pgaFetch");
async function getTournament(tournId) {
  return pgaFetch("/tournament", {
    tournId,
    year: "2026"
    // You might want to make this parameter configurable
  });
}
__name(getTournament, "getTournament");
async function getTournamentLeaderboard(tournId) {
  const response = await pgaFetch("/leaderboard", {
    tournId,
    year: "2026"
  });
  return response;
}
__name(getTournamentLeaderboard, "getTournamentLeaderboard");
function calculateEntryScore(golferScores) {
  const numericScores = golferScores.map((golfer) => {
    if (["CUT", "WD", "DQ"].includes(golfer.position)) {
      return 99;
    }
    if (golfer.total === "E") return 0;
    return golfer.total.startsWith("-") ? -Number(golfer.total.slice(1)) : Number(golfer.total.replace("+", ""));
  });
  numericScores.sort((a, b) => a - b);
  let weightedScore = 0;
  numericScores.forEach((score, index) => {
    const divisor = Math.pow(10, index + 3);
    weightedScore += score / divisor;
  });
  const bestFiveSum = numericScores.slice(0, 5).reduce((sum, score) => sum + score, 0);
  return bestFiveSum + weightedScore;
}
__name(calculateEntryScore, "calculateEntryScore");
function createSupabaseClient(supabaseUrl, supabaseKey) {
  return {
    from: /* @__PURE__ */ __name((table) => ({
      select: /* @__PURE__ */ __name((columns) => ({
        eq: /* @__PURE__ */ __name((column, value) => ({
          single: /* @__PURE__ */ __name(async () => {
            try {
              console.log(`Executing single query for ${table} where ${column}=${value}`);
              const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=eq.${value}`, {
                headers: {
                  "apikey": supabaseKey,
                  "Authorization": `Bearer ${supabaseKey}`,
                  "Content-Type": "application/json"
                }
              });
              if (!response.ok) {
                console.error(`Supabase error (${response.status}): ${response.statusText}`);
                return { data: null, error: { message: response.statusText } };
              }
              const data = await response.json().catch((e) => {
                console.error("JSON parse error:", e);
                return [];
              });
              if (!Array.isArray(data)) {
                console.warn(`Expected array but got ${typeof data}`);
                return { data: null, error: null };
              }
              return { data: data[0] || null, error: null };
            } catch (error) {
              console.error("Single query error:", error);
              return { data: null, error: { message: String(error) } };
            }
          }, "single"),
          execute: /* @__PURE__ */ __name(async () => {
            try {
              console.log(`Executing query for ${table} where ${column}=${value}`);
              const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}&${column}=eq.${value}`, {
                headers: {
                  "apikey": supabaseKey,
                  "Authorization": `Bearer ${supabaseKey}`,
                  "Content-Type": "application/json"
                }
              });
              if (!response.ok) {
                console.error(`Supabase error (${response.status}): ${response.statusText}`);
                return { data: [], error: { message: response.statusText } };
              }
              let data;
              try {
                const text = await response.text();
                console.log(`Response for ${table} query:`, text.substring(0, 100) + (text.length > 100 ? "..." : ""));
                data = JSON.parse(text);
              } catch (e) {
                console.error("JSON parse error:", e);
                return { data: [], error: { message: String(e) } };
              }
              if (!Array.isArray(data)) {
                console.warn(`Expected array but got ${typeof data}:`, data);
                if (data === null || data === void 0) {
                  return { data: [], error: null };
                } else if (typeof data === "object") {
                  return { data: [data], error: null };
                } else {
                  return { data: [], error: null };
                }
              }
              return { data, error: null };
            } catch (error) {
              console.error("Execute error:", error);
              return { data: [], error: { message: String(error) } };
            }
          }, "execute")
        }), "eq")
      }), "select"),
      update: /* @__PURE__ */ __name((data) => ({
        eq: /* @__PURE__ */ __name(async (column, value) => {
          const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`, {
            method: "PATCH",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal"
            },
            body: JSON.stringify(data)
          });
          if (!response.ok) {
            const error = await response.json();
            return { error };
          }
          return { error: null };
        }, "eq")
      }), "update"),
      insert: /* @__PURE__ */ __name(async (data) => {
        const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const error = await response.json();
          return { error };
        }
        return { error: null };
      }, "insert"),
      upsert: /* @__PURE__ */ __name(async (data, options = {}) => {
        console.log(`Upserting ${Array.isArray(data) ? data.length : 1} records to ${table}`);
        console.log("Upsert options:", options);
        let url = `${supabaseUrl}/rest/v1/${table}`;
        if (options.onConflict) {
          url += `?on_conflict=${options.onConflict}`;
        }
        console.log("Upsert URL:", url);
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            message: response.statusText,
            status: response.status
          }));
          console.error(`Upsert error (${response.status}):`, errorData);
          return { error: errorData };
        }
        return { error: null };
      }, "upsert")
    }), "from")
  };
}
__name(createSupabaseClient, "createSupabaseClient");
async function updateTournament(env) {
  try {
    const supabaseAdmin = createSupabaseClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: activeTournament, error: tournamentError } = await supabaseAdmin.from("tournaments").select("id,name,pga_tournament_id").eq("is_active", true).single();
    if (tournamentError || !activeTournament) {
      throw new Error("No active tournament found");
    }
    const tournamentData = await getTournament(activeTournament.pga_tournament_id);
    const leaderboard = await getTournamentLeaderboard(activeTournament.pga_tournament_id);
    const cutScore = leaderboard.cutLines?.[0]?.cutScore;
    const { error: updateTournamentError } = await supabaseAdmin.from("tournaments").update({
      status: tournamentData.status,
      current_round: tournamentData.currentRound.$numberInt || tournamentData.currentRound,
      cut_score: cutScore || null
      // Include cut score in the same update
    }).eq("id", activeTournament.id);
    if (updateTournamentError) {
      throw updateTournamentError;
    }
    if (!leaderboard.leaderboardRows?.length) {
      throw new Error("No players found in leaderboard");
    }
    console.log(`Processing ${leaderboard.leaderboardRows.length} players in batches`);
    const playersToUpsert = [];
    for (const player of leaderboard.leaderboardRows) {
      const playerData = {
        last_name: player.lastName,
        first_name: player.firstName,
        player_id: player.playerId,
        is_amateur: player.isAmateur || false,
        course_id: player.courseId,
        status: player.status,
        position: player.position,
        total: player.total,
        current_round_score: player.currentRoundScore || null,
        current_hole: player.currentHole?.$numberInt ? Number(player.currentHole.$numberInt) : null,
        starting_hole: player.startingHole?.$numberInt ? Number(player.startingHole.$numberInt) : null,
        round_complete: player.roundComplete,
        thru: player.thru,
        current_round: player.currentRound?.$numberInt ? Number(player.currentRound.$numberInt) : null,
        tee_time: player.teeTime || null,
        tournament_id: activeTournament.id
      };
      playersToUpsert.push(playerData);
    }
    if (playersToUpsert.length > 0) {
      console.log(`Upserting ${playersToUpsert.length} players in batch (conflict on player_id)`);
      try {
        const { error: upsertError } = await supabaseAdmin.from("golfer_scores").upsert(playersToUpsert, { onConflict: "player_id" });
        if (upsertError) {
          console.error("Player upsert error:", upsertError);
          throw new Error(`Failed to upsert players: ${JSON.stringify(upsertError)}`);
        }
      } catch (error) {
        console.error("Unexpected player upsert error:", error);
        throw new Error(`Failed to upsert players: ${JSON.stringify(error)}`);
      }
    }
    console.log(`Fetching entries for tournament ${activeTournament.id}`);
    const { data: entries, error: entriesError } = await supabaseAdmin.from("entries").select("*").eq("tournament_id", activeTournament.id).execute();
    if (entriesError) {
      console.error("Error fetching entries:", entriesError);
      throw new Error(`Failed to fetch entries: ${JSON.stringify(entriesError)}`);
    }
    if (!entries) {
      console.log("No entries found (entries is undefined)");
      console.log("Skipping entry score calculations");
      return { success: true, message: "Tournament updated successfully (no entries to update)" };
    }
    if (!Array.isArray(entries)) {
      console.log("Entries is not an array:", typeof entries, entries);
      console.log("Skipping entry score calculations");
      return { success: true, message: "Tournament updated successfully (entries data is invalid)" };
    }
    if (entries.length === 0) {
      console.log("No entries found for this tournament (empty array)");
      return { success: true, message: "Tournament updated successfully (no entries to update)" };
    }
    console.log(`Found ${entries.length} entries to process`);
    console.log(`Fetching golfer scores for tournament ${activeTournament.id}`);
    const { data: scores, error: scoresError } = await supabaseAdmin.from("golfer_scores").select("player_id,total,position,first_name,last_name").eq("tournament_id", activeTournament.id).execute();
    if (scoresError) {
      console.error("Error fetching golfer scores:", scoresError);
      throw new Error(`Failed to fetch golfer scores: ${JSON.stringify(scoresError)}`);
    }
    const scoresMap = /* @__PURE__ */ new Map();
    if (!scores) {
      console.log("No golfer scores found (scores is undefined)");
    } else if (!Array.isArray(scores)) {
      console.log("Golfer scores is not an array:", typeof scores, scores);
    } else if (scores.length === 0) {
      console.log("No golfer scores found for this tournament (empty array)");
    } else {
      console.log(`Found ${scores.length} golfer scores to use for calculations`);
      console.log("Sample of golfer scores:");
      for (let i = 0; i < Math.min(5, scores.length); i++) {
        console.log(`  Player ${scores[i].player_id}: position=${scores[i].position}, total=${scores[i].total}`);
      }
      scores.forEach((score) => {
        if (score && score.player_id) {
          scoresMap.set(score.player_id, score);
        }
      });
    }
    const entryUpdates = [];
    for (const entry of entries) {
      try {
        if (!entry || typeof entry !== "object") {
          console.log("Skipping invalid entry:", entry);
          continue;
        }
        if (!entry.id) {
          console.log("Skipping entry without ID:", entry);
          continue;
        }
        console.log(`Processing entry ${entry.id} (${entry.entry_name || "unnamed"})`);
        const golferIds = [
          entry.tier1_golfer1,
          entry.tier1_golfer2,
          entry.tier2_golfer1,
          entry.tier2_golfer2,
          entry.tier3_golfer1,
          entry.tier3_golfer2,
          entry.tier4_golfer1,
          entry.tier4_golfer2,
          entry.tier5_golfer1,
          entry.tier5_golfer2
        ].filter((id) => id);
        if (golferIds.length === 0) {
          console.log(`Entry ${entry.id} has no golfers, skipping`);
          continue;
        }
        const golferScores = golferIds.map((id) => {
          const score = scoresMap.get(id);
          if (!score) {
            console.log(`  No score found for golfer ${id}`);
          }
          return score;
        }).filter((score) => {
          if (!score) return false;
          return "total" in score && "position" in score && "player_id" in score;
        });
        if (golferScores.length === 0) {
          console.log(`  No valid golfer scores found for entry ${entry.id}, skipping`);
          continue;
        }
        console.log(`Calculating score for entry ${entry.id} (${entry.entry_name || "unnamed"}):`);
        golferScores.forEach((score) => {
          console.log(`  Player ${score.player_id}: position=${score.position}, total=${score.total}`);
        });
        const entryScore = calculateEntryScore(golferScores);
        console.log(`  Calculated score: ${entryScore}`);
        entryUpdates.push({
          id: entry.id,
          calculated_score: entryScore,
          tournament_id: activeTournament.id
          // Include tournament_id to satisfy not-null constraint
        });
      } catch (error) {
        console.error(`Error processing entry ${entry?.id || "unknown"}:`, error);
      }
    }
    if (entryUpdates.length > 0) {
      console.log(`Updating scores for ${entryUpdates.length} entries`);
      for (const entryUpdate of entryUpdates) {
        try {
          console.log(`Updating entry ${entryUpdate.id} with score ${entryUpdate.calculated_score}`);
          const { error: updateError } = await supabaseAdmin.from("entries").update({ calculated_score: entryUpdate.calculated_score }).eq("id", entryUpdate.id);
          if (updateError) {
            console.error(`Error updating entry ${entryUpdate.id}:`, updateError);
          } else {
            console.log(`Successfully updated entry ${entryUpdate.id}`);
          }
        } catch (error) {
          console.error(`Failed to update entry ${entryUpdate.id}:`, error);
        }
      }
    }
    console.log(`
=== VERIFICATION SUMMARY ===`);
    console.log(`Verifying all entries for tournament ${activeTournament.id} have calculated scores`);
    const { data: verifyEntries, error: verifyError } = await supabaseAdmin.from("entries").select("id, entry_name, calculated_score").eq("tournament_id", activeTournament.id).execute();
    if (verifyError) {
      console.error("Error verifying entries:", verifyError);
      throw new Error(`Failed to verify entries: ${JSON.stringify(verifyError)}`);
    }
    if (!verifyEntries || !Array.isArray(verifyEntries)) {
      console.log("Could not verify entries - verify data is not an array:", verifyEntries);
      return { success: true, message: "Tournament updated successfully but could not verify entries" };
    }
    console.log(`Total entries: ${verifyEntries.length}`);
    const entriesWithScore = verifyEntries.filter((e) => e.calculated_score !== null);
    console.log(`Entries with calculated score: ${entriesWithScore.length}`);
    if (entriesWithScore.length < verifyEntries.length) {
      console.log("WARNING: Some entries do not have calculated scores:");
      verifyEntries.filter((e) => e.calculated_score === null).forEach((e) => console.log(`  - Entry ${e.id}: ${e.entry_name || "unnamed"}`));
      return { success: true, message: `Tournament updated but ${verifyEntries.length - entriesWithScore.length} entries missing scores` };
    } else {
      console.log("SUCCESS: All entries have calculated scores updated.");
    }
    return { success: true, message: "Tournament updated successfully" };
  } catch (error) {
    console.error("Error details:", error);
    let errorMessage;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object") {
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        errorMessage = "Unknown error object that cannot be stringified";
      }
    } else {
      errorMessage = String(error);
    }
    return { success: false, message: `Error: ${errorMessage}` };
  }
}
__name(updateTournament, "updateTournament");
var cloudflare_update_tournament_default = {
  async scheduled(event, env, ctx) {
    const result = await updateTournament(env);
    if (!result.success) {
      console.error(result.message);
    }
    return result;
  },
  async fetch(request, env, ctx) {
    const result = await updateTournament(env);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });
  }
};
export {
  cloudflare_update_tournament_default as default
};
//# sourceMappingURL=cloudflare-update-tournament.js.map
