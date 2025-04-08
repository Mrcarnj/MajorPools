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
  // Count CUT/WD/DQ positions
  const cutCount = golferScores.filter(golfer => 
    ['CUT', 'WD', 'DQ'].includes(golfer.position)
  ).length;

  // If 4 or more golfers are CUT/WD/DQ, return "CUT"
  if (cutCount >= 4) return "CUT";

  // Rest of the calculation remains the same
  const numericScores = golferScores.map(golfer => {
    if (golfer.total === 'E') return 0;
    return golfer.total.startsWith('-') 
      ? -Number(golfer.total.slice(1)) 
      : Number(golfer.total.replace('+', ''));
  });

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
  1: 0.212765957446809,
  2: 0.159574468085106,
  3: 0.13298,
  4: 0.10638,
  5: 0.07979,
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
  displayPot: number;
  donation: number;
  payouts: Map<string, number>;
} {
  // Use full pot (entries * $25)
  const entryFee = 25;
  const rawPot = entries.length * entryFee;
  const totalPot = roundUpToNearest5(rawPot);
  
  // Calculate displayed pot (85% of total) and donation (10% of total)
  const displayPot = Math.floor(totalPot * 0.85);
  const donation = Math.floor(totalPot * 0.1);
  
  const payouts = new Map<string, number>();
  
  // Get rankings with ties
  const rankings = calculateRankings(entries);
  
  // First, group entries by their actual position
  const positionGroups = new Map<number, string[]>();
  
  rankings.forEach((rank, index) => {
    if (!rank) {
      // For null rankings (tied positions), use the previous position
      const prevRank = rankings[index - 1];
      if (prevRank) {
        const position = parseInt(prevRank.replace('T', ''));
        if (!positionGroups.has(position)) {
          positionGroups.set(position, []);
        }
        positionGroups.get(position)?.push(entries[index].entry_name);
      }
    } else {
      const position = parseInt(rank.replace('T', ''));
      if (!positionGroups.has(position)) {
        positionGroups.set(position, []);
      }
      positionGroups.get(position)?.push(entries[index].entry_name);
    }
  });

  // Now calculate payouts for each position group
  let currentPosition = 1;
  positionGroups.forEach((entryNames, position) => {
    const numTied = entryNames.length;
    let totalPayout = 0;
    
    // Special handling for position 10 ties
    if (currentPosition === 10 || (currentPosition < 10 && currentPosition + numTied > 10)) {
      // Get the 10th position percentage and split it among ties
      const tenthPlacePercentage = PAYOUT_PERCENTAGES[10];
      const splitPercentage = tenthPlacePercentage / numTied;
      totalPayout = displayPot * splitPercentage;
      
      const splitPayout = Math.ceil(totalPayout);
      entryNames.forEach(entryName => {
        payouts.set(entryName, splitPayout);
      });
    } else {
      // For positions 1-9, sum percentages and split evenly
      for (let i = 0; i < numTied; i++) {
        const payoutPosition = currentPosition + i;
        if (payoutPosition <= 9) { // Only include payouts through position 9
          totalPayout += displayPot * PAYOUT_PERCENTAGES[payoutPosition as keyof typeof PAYOUT_PERCENTAGES];
        }
      }
      
      // For non-10th positions, split the total payout evenly
      const splitPayout = Math.ceil(totalPayout / numTied);
      entryNames.forEach(entryName => {
        payouts.set(entryName, splitPayout);
      });
    }
    
    currentPosition += numTied;
  });

  return { totalPot, displayPot, donation, payouts };
} 