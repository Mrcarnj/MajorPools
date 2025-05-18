export type GolferScore = {
  player_id: string;
  first_name?: string;
  last_name?: string;
  total: string;
  position: string;
};

export type Entry = {
  entry_name: string;
  calculated_score: number;
  display_score: number | "CUT";
  topFiveGolfers: GolferScore[];
  allGolfers?: GolferScore[];
};

export function calculateEntryScore(golferScores: GolferScore[]): number {
  // Convert scores to numbers, handling special cases
  const numericScores = golferScores.map(golfer => {
    if (['CUT', 'WD', 'DQ'].includes(golfer.position)) {
      return 99;
    }
    if (golfer.total === 'E') return 0;
    return golfer.total.startsWith('-') 
      ? -Number(golfer.total.slice(1)) 
      : Number(golfer.total.replace('+', ''));
  });

  // Sort scores from lowest to highest
  numericScores.sort((a, b) => a - b);

  // Calculate weighted scores (for tiebreaker)
  let weightedScore = 0;
  numericScores.forEach((score, index) => {
    const divisor = Math.pow(10, (index + 3)); // Starts at 1000 and increases
    weightedScore += score / divisor;
  });

  // Take best 5 scores and sum them
  const bestFiveSum = numericScores.slice(0, 5).reduce((sum, score) => sum + score, 0);

  // Combine both scores - raw sum for display, weighted for tiebreakers
  return bestFiveSum + weightedScore;
}

export function calculateDisplayScore(golferScores: GolferScore[]): number | "CUT" {
  // Exclude CUT/WD/DQ golfers
  const nonCutGolfers = golferScores.filter(
    golfer => !['CUT', 'WD', 'DQ'].includes(golfer.position)
  );

  // If fewer than 5 non-CUT golfers, entry is CUT
  if (nonCutGolfers.length < 5) return "CUT";

  // Map scores to numbers
  const numericScores = nonCutGolfers.map(golfer => {
    if (golfer.total === 'E') return 0;
    return golfer.total.startsWith('-') 
      ? -Number(golfer.total.slice(1)) 
      : Number(golfer.total.replace('+', ''));
  });

  // Sort and sum the best 5
  numericScores.sort((a, b) => a - b);
  const top5Scores = numericScores.slice(0, 5);
  return top5Scores.reduce((sum, score) => sum + score, 0);
}

export function calculateRankings(entries: Entry[]): (string | null)[] {
  const rankings: (string | null)[] = new Array(entries.length).fill(null);
  let currentRank = 1;
  let sameScoreCount = 1;

  for (let i = 0; i < entries.length; i++) {
    if (i === 0) {
      rankings[i] = currentRank.toString();
      continue;
    }

    if (entries[i].calculated_score === entries[i - 1].calculated_score) {
      if (sameScoreCount === 1) {
        rankings[i - 1] = `T${currentRank}`;
      }
      sameScoreCount++;
      rankings[i] = null;
    } else {
      currentRank += sameScoreCount;
      sameScoreCount = 1;
      rankings[i] = currentRank.toString();
    }
  }

  return rankings;
}

const PAYOUT_PERCENTAGES = {
  1: 0.202765957446809,
  2: 0.149574468085106,
  3: 0.12298,
  4: 0.09638,
  5: 0.06979, //i took away 1% from here to first to bring down to 85%
  6: 0.06383,
  7: 0.05319,
  8: 0.04255,
  9: 0.03191,
  10: 0.02128
};

// Helper function to round up to nearest 5
function roundUpToNearest5(num: number): number {
  return Math.ceil(num / 5) * 5;
}

export function calculatePrizePool(entries: Entry[]): { 
  totalPot: number;
  rawPot: number;
  displayPot: number;
  donation: number;
  payouts: Map<string, number>;
} {
  // Use full pot (entries * $25)
  const entryFee = 25;
  const rawPot = entries.length * entryFee;
  const totalPot = roundUpToNearest5(rawPot);
  
  // Calculate donation (10% of raw pot) and display pot (85% of raw pot)
  const donation = rawPot * 0.1; // Don't round down - keep decimal precision
  const displayPot = Math.floor(rawPot * 0.85); // Display pot for leaderboard
  
  const payouts = new Map<string, number>();
  
  // Get rankings with ties
  const rankings = calculateRankings(entries);
  
  // Group entries by their actual position for payout calculation
  // We'll handle this differently - first group by calculated_score
  const scoreGroups = new Map<number, Entry[]>();
  
  // Group entries by their score
  entries.forEach(entry => {
    if (!scoreGroups.has(entry.calculated_score)) {
      scoreGroups.set(entry.calculated_score, []);
    }
    scoreGroups.get(entry.calculated_score)?.push(entry);
  });
  
  // Process in score order (lowest to highest)
  const sortedScores = Array.from(scoreGroups.keys()).sort((a, b) => a - b);
  
  let currentPosition = 1;
  
  sortedScores.forEach(score => {
    const entriesWithScore = scoreGroups.get(score) || [];
    const numTied = entriesWithScore.length;
    
    // Calculate total payout for this position group
    let totalPayout = 0;
    
    // Sum payouts for all positions occupied by this score group
    for (let i = 0; i < numTied; i++) {
      const payoutPosition = currentPosition + i;
      if (payoutPosition <= 10) { // Only include payouts through position 10
        const percentage = PAYOUT_PERCENTAGES[payoutPosition as keyof typeof PAYOUT_PERCENTAGES] || 0;
        totalPayout += rawPot * percentage;
      }
    }
    
    // Split the total payout evenly among all tied entries
    if (totalPayout > 0 && numTied > 0) {
      const payoutPerEntry = Math.ceil(totalPayout / numTied);
      
      // Assign the same payout to all entries in this score group
      entriesWithScore.forEach(entry => {
        payouts.set(entry.entry_name, payoutPerEntry);
      });
    }
    
    // Update current position for next group
    currentPosition += numTied;
  });
  
  return { totalPot, rawPot, displayPot, donation, payouts };
} 