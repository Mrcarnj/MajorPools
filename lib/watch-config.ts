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

const MASTERS_2026_CONFIG: WatchConfig = {
  timezone: 'America/New_York',
  timezoneLabel: 'ET',
  tv: {
    intro: 'Live TV coverage of the 2026 Masters Tournament airs across Prime Video, ESPN, Paramount+, and CBS. Full schedule below.',
    slots: [
      { day: 'Thursday, April 9 (Round 1)', timeRange: '1-3 p.m.', channel: 'Prime Video' },
      { day: 'Thursday, April 9 (Round 1)', timeRange: '3-7:30 p.m.', channel: 'ESPN' },
      { day: 'Friday, April 10 (Round 2)', timeRange: '1-3 p.m.', channel: 'Prime Video' },
      { day: 'Friday, April 10 (Round 2)', timeRange: '3-7:30 p.m.', channel: 'ESPN' },
      { day: 'Saturday, April 11 (Round 3)', timeRange: '12-2 p.m.', channel: 'Paramount+' },
      { day: 'Saturday, April 11 (Round 3)', timeRange: '2-7 p.m.', channel: 'CBS / Paramount+' },
      { day: 'Sunday, April 12 (Round 4)', timeRange: '12-2 p.m.', channel: 'Paramount+' },
      { day: 'Sunday, April 12 (Round 4)', timeRange: '2-7 p.m.', channel: 'CBS / Paramount+' },
    ],
  },
  streaming: {
    intro: 'Additional digital coverage is available daily across official Masters platforms and partner apps.',
    options: [
      {
        label: 'Masters.com & Masters App',
        description: 'Exclusive "Every Shot, Every Hole" streaming with AI-powered commentary by IBM Watson',
        url: 'https://www.masters.com/',
      },
      {
        label: 'Featured Groups & Amen Corner',
        description: 'Live daily coverage on Masters.com, Paramount+, and the ESPN App',
      },
      {
        label: 'Mornings at the Masters (YouTube)',
        description: 'Watch on the official Masters YouTube channel',
        url: 'https://www.youtube.com/@TheMasters',
      },
    ],
  },
  items: [],
  note: 'All times Eastern (ET). Coverage windows can change; check official broadcasters and masters.com for updates.',
};

const PGA_CHAMPIONSHIP_2026_CONFIG: WatchConfig = {
  timezone: 'America/New_York',
  timezoneLabel: 'EDT',
  tv: {
    intro: 'Live TV coverage of the 2026 PGA Championship airs on ESPN+, ESPN, and CBS. All times Eastern (EDT).',
    slots: [
      { day: 'Thursday, May 14 (Round 1)', timeRange: '6:30 AM–12:00 PM', channel: 'ESPN+' },
      { day: 'Thursday, May 14 (Round 1)', timeRange: '12:00–8:00 PM', channel: 'ESPN' },
      { day: 'Friday, May 15 (Round 2)', timeRange: '6:30 AM–12:00 PM', channel: 'ESPN+' },
      { day: 'Friday, May 15 (Round 2)', timeRange: '12:00–8:00 PM', channel: 'ESPN' },
      { day: 'Saturday, May 16 (Round 3)', timeRange: '8:00–10:00 AM', channel: 'ESPN+' },
      { day: 'Saturday, May 16 (Round 3)', timeRange: '10:00 AM–1:00 PM', channel: 'ESPN' },
      { day: 'Saturday, May 16 (Round 3)', timeRange: '1:00–7:00 PM', channel: 'CBS' },
      { day: 'Sunday, May 17 (Round 4)', timeRange: '8:00–10:00 AM', channel: 'ESPN+' },
      { day: 'Sunday, May 17 (Round 4)', timeRange: '10:00 AM–1:00 PM', channel: 'ESPN' },
      { day: 'Sunday, May 17 (Round 4)', timeRange: '1:00–7:00 PM', channel: 'CBS' },
    ],
  },
  items: [],
  note: 'All times Eastern (EDT). Coverage windows may change; check pga.com for updates.',
};

const OPEN_CHAMPIONSHIP_2026_CONFIG: WatchConfig = {
  timezone: 'America/New_York',
  timezoneLabel: 'ET',
  tv: {
    intro: 'The 2026 Open Championship at Royal Birkdale (July 16–19) airs across Peacock, USA Network, and NBC. All times Eastern (ET).',
    slots: [
      { day: 'Thursday, July 16 (Round 1)', timeRange: '1:30–4:00 AM', channel: 'Peacock' },
      { day: 'Thursday, July 16 (Round 1)', timeRange: '4:00 AM–3:30 PM', channel: 'USA Network' },
      { day: 'Friday, July 17 (Round 2)', timeRange: '1:30–4:00 AM', channel: 'Peacock' },
      { day: 'Friday, July 17 (Round 2)', timeRange: '4:00 AM–3:30 PM', channel: 'USA Network' },
      { day: 'Saturday, July 18 (Round 3)', timeRange: '5:00–7:00 AM', channel: 'USA Network' },
      { day: 'Saturday, July 18 (Round 3)', timeRange: '7:00 AM–3:00 PM', channel: 'NBC' },
      { day: 'Sunday, July 19 (Round 4)', timeRange: '4:00–7:00 AM', channel: 'USA Network' },
      { day: 'Sunday, July 19 (Round 4)', timeRange: '7:00 AM–2:00 PM', channel: 'NBC' },
    ],
  },
  streaming: {
    intro: 'Every round streams live. Peacock carries the exclusive early coverage plus featured groups; Golf Channel Mobile simulcasts the USA Network feed.',
    options: [
      {
        label: 'Peacock Premium',
        description: 'Exclusive early-round coverage (Rounds 1–2), featured groups all four days, and NBC simulcasts on the weekend',
        url: 'https://www.peacocktv.com/',
      },
      {
        label: 'Golf Channel Mobile',
        description: 'Simulcasts of the USA Network coverage for all four rounds',
        url: 'https://www.golfchannel.com/',
      },
    ],
  },
  items: [],
  note: 'All times Eastern (ET); play is at Royal Birkdale in England (BST). Coverage windows can change — check nbcsports.com and theopen.com for updates.',
};

/**
 * Key by tournament name (as stored in DB) or a slug.
 */
export const WATCH_BY_TOURNAMENT: Record<string, WatchConfig> = {
  'Masters Tournament': MASTERS_2026_CONFIG,
  'The Masters': MASTERS_2026_CONFIG,
  'The Masters Tournament': MASTERS_2026_CONFIG,
  '2026 Masters Tournament': MASTERS_2026_CONFIG,
  'PGA Championship': PGA_CHAMPIONSHIP_2026_CONFIG,
  '2026 PGA Championship': PGA_CHAMPIONSHIP_2026_CONFIG,
  'PGA Championship 2026': PGA_CHAMPIONSHIP_2026_CONFIG,
  'The Open': OPEN_CHAMPIONSHIP_2026_CONFIG,
  'The Open Championship': OPEN_CHAMPIONSHIP_2026_CONFIG,
  'Open Championship': OPEN_CHAMPIONSHIP_2026_CONFIG,
  '2026 Open Championship': OPEN_CHAMPIONSHIP_2026_CONFIG,
  'The 2026 Open Championship': OPEN_CHAMPIONSHIP_2026_CONFIG,
  'British Open': OPEN_CHAMPIONSHIP_2026_CONFIG,
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
