export type ElementTypeId = 1 | 2 | 3 | 4;

export type FplChipName = "wildcard" | "freehit" | "bboost" | "3xc";

export type FplElement = {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  team_code: number;
  element_type: ElementTypeId;
  now_cost: number;
  selected_by_percent: string;
  form: string;
  points_per_game: string;
  total_points: number;
  status: string;
  news: string;
  chance_of_playing_this_round: number | null;
  chance_of_playing_next_round: number | null;
  minutes: number;
  starts: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  yellow_cards: number;
  red_cards: number;
  bonus: number;
  bps: number;
  saves: number;
  defensive_contribution: number;
  defensive_contribution_per_90: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  expected_goals_per_90: number;
  expected_assists_per_90: number;
  expected_goals_conceded_per_90: number;
  clean_sheets_per_90: number;
  saves_per_90: number;
  ep_this: string;
  ep_next: string;
  event_points: number;
  code: number;
  photo: string;
  can_select: boolean;
  removed: boolean;
  transfers_in_event: number;
  transfers_out_event: number;
  squad_number: number | null;
};

export type FplTeam = {
  id: number;
  name: string;
  short_name: string;
  code: number;
  strength: number | null;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
};

export type FplEvent = {
  id: number;
  name: string;
  deadline_time: string | null;
  finished: boolean;
  is_previous: boolean;
  is_current: boolean;
  is_next: boolean;
  average_entry_score: number;
};

export type FplChip = {
  id: number;
  name: FplChipName;
  number: number;
  start_event: number;
  stop_event: number;
  chip_type: string;
};

export type FplScoring = {
  long_play: number;
  short_play: number;
  goals_scored: Record<string, number>;
  assists: number;
  clean_sheets: Record<string, number>;
  defensive_contribution: Record<string, number>;
  goals_conceded: Record<string, number>;
  saves: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
};

export type FplBootstrap = {
  events: FplEvent[];
  teams: FplTeam[];
  elements: FplElement[];
  chips: FplChip[];
  total_players: number;
  game_settings: {
    squad_squadsize: number;
    squad_team_limit: number;
    squad_total_spend: number;
    ui_currency_multiplier: number;
    transfers_sell_on_fee: number;
    max_extra_free_transfers: number;
  };
  game_config?: {
    scoring?: FplScoring;
    rules?: Record<string, unknown>;
  };
};

export type FplFixture = {
  id: number;
  event: number | null;
  finished: boolean;
  finished_provisional?: boolean;
  kickoff_time: string | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  team_h_score: number | null;
  team_a_score: number | null;
  started?: boolean;
  minutes?: number;
  provisional_start_time?: boolean;
};

export type FplPick = {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  purchase_price?: number;
  selling_price?: number;
};

export type FplEntry = {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  summary_overall_points: number;
  summary_overall_rank: number | null;
  last_deadline_bank: number;
  last_deadline_value: number;
  last_deadline_total_transfers: number;
  current_event: number | null;
  started_event: number | null;
};

export type FplHistoryRow = {
  event: number;
  points: number;
  total_points: number;
  rank: number | null;
  overall_rank?: number | null;
  bank: number;
  value: number;
  event_transfers: number;
  event_transfers_cost: number;
};

export type FplChipPlay = {
  name: FplChipName;
  time: string | null;
  event: number;
};

export type FplEntryHistory = {
  current: FplHistoryRow[];
  chips: FplChipPlay[];
};

export type FplPicks = {
  active_chip: FplChipName | null;
  picks: FplPick[];
  entry_history: {
    event: number;
    points: number;
    total_points: number;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
  };
};

export type FplElementHistory = {
  element: number;
  fixture: number;
  opponent_team: number;
  total_points: number;
  minutes: number;
  round: number;
  was_home: boolean;
  kickoff_time?: string;
  team_h_score?: number | null;
  team_a_score?: number | null;
  goals_scored?: number;
  assists?: number;
  clean_sheets?: number;
  goals_conceded?: number;
  yellow_cards?: number;
  red_cards?: number;
  saves?: number;
  bonus?: number;
  bps?: number;
  starts?: number;
  defensive_contribution?: number;
  expected_goals?: string | number;
  expected_assists?: string | number;
  expected_goal_involvements?: string | number;
  expected_goals_conceded?: string | number;
  value?: number;
};

export type FplHistoryPast = {
  season_name: string;
  total_points: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  starts: number;
  expected_goals: string | number;
  expected_assists: string | number;
  defensive_contribution: number;
};

export type FplElementSummary = {
  history: FplElementHistory[];
  history_past?: FplHistoryPast[];
  fixtures: Array<{
    id: number;
    event: number | null;
    is_home: boolean;
    difficulty: number;
    month: number;
    event_name?: string;
  }>;
};
