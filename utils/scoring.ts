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

export function calculateDisplayScore(golferScores: GolferScore[]): number {
  const numericScores = golferScores.map(golfer => {
    if (golfer.total === 'E') return 0;
    return golfer.total.startsWith('-') 
      ? -Number(golfer.total.slice(1)) 
      : Number(golfer.total.replace('+', ''));
  });

  // Sort scores ascending and take first 5
  numericScores.sort((a, b) => a - b);
  const top5Scores = numericScores.slice(0, 5);

  // Sum the top 5 scores
  return top5Scores.reduce((sum, score) => sum + score, 0);
} 