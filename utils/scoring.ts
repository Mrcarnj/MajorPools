export type GolferScore = {
  player_id: string;
  total: string;
  position: string;
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

  // Calculate weighted scores
  let totalScore = 0;
  numericScores.forEach((score, index) => {
    const divisor = Math.pow(10, (index + 3)); // Starts at 1000 and increases
    totalScore += score / divisor;
  });

  return totalScore;
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