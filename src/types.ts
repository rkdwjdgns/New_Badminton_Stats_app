/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Opponent {
  name: string;
  name2?: string; // 상대 2 (복식 파트너)
  age: string; // 상대 1 연령층 (예: 20대)
  age2?: string; // 상대 2 연령층 (예: 20대)
  club: string; // 상대 1 클럽
  club2?: string; // 상대 2 클럽
  tier1?: string; // 상대 1 급수 (A, B, C, D, 초심 등)
  tier2?: string; // 상대 2 급수
}

export interface MatchRecord {
  id: string; // Unique ID for list items, editing and deleting
  date: string;
  tournament_name: string;
  tournament_type: '전국' | '지역' | '클럽내';
  my_tier?: string; // 나의 급수
  my_club?: string; // 나의 클럽
  my_age?: string; // 나의 연령층 (예: 20대, 30대)
  partner: string;
  partner_tier?: string; // 파트너 급수
  partner_club?: string; // 파트너 클럽
  partner_age?: string; // 파트너 연령층
  opponent: Opponent;
  score: string;
  result: 'WIN' | 'LOSE';
  raw_text?: string; // Storing the original text input
  createdAt: string;
}

export interface Statistics {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  streakType: 'WIN' | 'LOSE' | 'NONE';
  avgOurScore: number;
  avgOppScore: number;
}
