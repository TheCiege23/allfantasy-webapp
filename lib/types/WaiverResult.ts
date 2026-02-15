export type GrokAI = {
  confidence?: "high" | "medium" | "low";
  narrative?: string[];
  tags?: string[];
  messageTemplate?: string;
  evidenceLinks?: Array<{ label: string; url: string }>;
};

export interface WaiverResult {
  team_id: string;
  league_id: string;
  waiver_type: string;
  summary: string;
  top_adds: {
    player_name: string;
    position: string;
    team: string | null;
    priority_rank: number;
    faab_bid_recommendation: number | null;
    drop_candidate: string | null;
    reasoning: string;

    player_id?: string;
    tier?: string;
    ai?: GrokAI;
  }[];
  strategy_notes: {
    faab_strategy: string | null;
    priority_strategy: string | null;
    timing_notes: string;
  };
  bench_optimization_tips: string[];
  risk_flags: string[];
}
