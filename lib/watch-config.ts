/**
 * Where to watch config per tournament.
 * Update this when switching to a new tournament to show correct TV/streaming and times.
 * Times are in tournament venue timezone (e.g. America/New_York for TPC Sawgrass).
 */

export type TvScheduleSlot = {
  day: string;
  timeRange: string;
  channel: string;
};

export type WatchConfigTv = {
  intro: string;
  slots: TvScheduleSlot[];
};

export type StreamingOption = {
  label: string;
  description: string;
  url?: string;
};

export type WatchConfigStreaming = {
  intro: string;
  options: StreamingOption[];
};

export type WatchItem = {
  label: string;
  channel?: string;
  description?: string;
  time?: string;
  day?: string;
  url?: string;
};

export type WatchConfig = {
  timezone: string;
  timezoneLabel: string;
  /** Optional structured TV schedule (intro + daily slots) */
  tv?: WatchConfigTv;
  /** Optional structured streaming section (intro + options) */
  streaming?: WatchConfigStreaming;
  /** Legacy: flat list of items (used if tv/streaming not set) */
  items: WatchItem[];
  note?: string;
};

const PLAYERS_2026_CONFIG: WatchConfig = {
  timezone: 'America/New_York',
  timezoneLabel: 'ET',
  tv: {
    intro: 'NBC and Golf Channel will air TV coverage of the 2026 Players Championship this week. Check out the full TV schedule below.',
    slots: [
      { day: 'Thursday, March 12', timeRange: '1-7 p.m.', channel: 'Golf Channel' },
      { day: 'Friday, March 13', timeRange: '1-7 p.m.', channel: 'Golf Channel' },
      { day: 'Saturday, March 14', timeRange: '2-7 p.m.', channel: 'NBC' },
      { day: 'Sunday, March 15', timeRange: '1-6 p.m.', channel: 'NBC' },
    ],
  },
  streaming: {
    intro: 'You can watch the 2026 Players Championship online via PGA Tour Live on ESPN+, including exclusive early coverage beginning at 7:30 a.m. ET on Thursday, Friday and Sunday, and 8 a.m. ET on Saturday. PGA Tour Live on ESPN+ will also provide featured group and featured hole coverage throughout the round. You can stream NBC\'s coverage on Peacock.',
    options: [
      { label: 'PGA Tour Live on ESPN+', description: 'Early coverage 7:30 a.m. ET (Thu/Fri/Sun), 8 a.m. ET (Sat); featured groups & holes', url: 'https://www.espn.com/watch/espnplus/' },
      { label: 'Peacock', description: 'Stream NBC\'s TV coverage', url: 'https://www.peacocktv.com/' },
    ],
  },
  items: [],
  note: 'All times Eastern. Check pgatour.com for latest.',
};

/**
 * Key by tournament name (as stored in DB) or a slug.
 */
export const WATCH_BY_TOURNAMENT: Record<string, WatchConfig> = {
  'THE PLAYERS Championship': PLAYERS_2026_CONFIG,
  'The Players Championship': PLAYERS_2026_CONFIG,
  '2026 Players Championship': PLAYERS_2026_CONFIG,
};

export const DEFAULT_WATCH_CONFIG: WatchConfig = {
  timezone: 'America/New_York',
  timezoneLabel: 'ET',
  items: [
    { label: 'PGA Tour Live', description: 'Streaming on ESPN+', day: 'Thu', time: 'TBD', url: 'https://www.pgatour.com/pga-tour-live' },
    { label: 'NBC / Golf Channel', description: 'Weekend coverage', day: 'Sat–Sun', time: 'Check local listings' },
  ],
  note: 'Times in Eastern. Check pgatour.com for current schedule.',
};

export function getWatchConfig(tournamentName: string | null | undefined): WatchConfig {
  if (!tournamentName?.trim()) return DEFAULT_WATCH_CONFIG;
  return WATCH_BY_TOURNAMENT[tournamentName] ?? DEFAULT_WATCH_CONFIG;
}
