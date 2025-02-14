export interface Player {
  playerId: string;
  lastName: string;
  firstName: string;
}

export interface Tournament {
  tournId: string;
  name: string;
  date: {
    weekNumber: string;
    start: {
      $date: {
        $numberLong: string;
      };
    };
    end: {
      $date: {
        $numberLong: string;
      };
    };
  };
  format: string;
  courses: Array<{
    courseName: string;
    location: {
      state: string;
      city: string;
      country: string;
    };
  }>;
  purse: number;
  fedexCupPoints: number;
  players: Array<{
    player: {
      playerId: string;
      lastName: string;
      firstName: string;
      status: string;
    };
  }>;
  currentRound: {
    $numberInt: string;
  };
  status: string;
}

export interface Scorecard {
  tournId: string;
  year: string;
  playerId: string;
  lastName: string;
  firstName: string;
  roundId: number;
  lastHole: number;
  startingHole: number;
  roundComplete: boolean;
  lastUpdated: number;
  currentRoundScore: string;
  currentHole: number;
  holes: any[]; // We can type this more specifically if needed
  totalShots: number;
}

export interface Leaderboard {
  tournId: string;
  roundId: number;
  roundStatus: string;
  year: string;
  cutLines: any[]; // We can type this more specifically if needed
  leaderboardRows: any[]; // We can type this more specifically if needed
  lastUpdated: number;
  status: string;
}

export interface ScheduleResponse {
  year: string;
  schedule: Array<{
    tournId: string;
    name: string;
    date: {
      weekNumber: string;
      start: number;
      end: number;
    };
    format: string;
    purse: number;
    fedexCupPoints: number;
  }>;
} 