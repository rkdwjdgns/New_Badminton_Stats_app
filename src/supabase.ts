import { createClient } from "@supabase/supabase-js";
import { MatchRecord } from "./types";

const supabaseUrl = ((import.meta as any).env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || "").trim();

const getCleanUrl = (url: string) => {
  if (url.endsWith("/")) {
    return url.slice(0, -1);
  }
  return url;
};

const cleanSupabaseUrl = getCleanUrl(supabaseUrl);

export const isSupabaseConfigured = Boolean(
  cleanSupabaseUrl && 
  supabaseAnonKey && 
  cleanSupabaseUrl !== "MY_SUPABASE_URL" && 
  supabaseAnonKey !== "MY_SUPABASE_ANON_KEY"
);

export const supabase = isSupabaseConfigured
  ? createClient(cleanSupabaseUrl, supabaseAnonKey)
  : null;

/**
 * Supabase SQL DDL for matches table (Reference for the user):
 * 
 * create table matches (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid references auth.users(id) on delete cascade default auth.uid(),
 *   date text not null,
 *   tournament_name text,
 *   tournament_type text not null,
 *   my_tier text,
 *   my_club text,
 *   my_age text,
 *   partner text,
 *   partner_tier text,
 *   partner_club text,
 *   partner_age text,
 *   opponent_name text not null,
 *   opponent_name2 text,
 *   opponent_age text,
 *   opponent_age2 text,
 *   opponent_club text,
 *   opponent_club2 text,
 *   opponent_tier1 text,
 *   opponent_tier2 text,
 *   score text not null,
 *   result text not null,
 *   raw_text text,
 *   created_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * -- Set up Row Level Security (RLS)
 * alter table matches enable row level security;
 * 
 * create policy "Users can modify their own matches"
 *   on matches for all
 *   using (auth.uid() = user_id);
 */

// Format DB record to app MatchRecord
export function mapDbToMatchRecord(dbRecord: any): MatchRecord {
  return {
    id: dbRecord.id,
    date: dbRecord.date,
    tournament_name: dbRecord.tournament_name || "",
    tournament_type: dbRecord.tournament_type as "전국" | "지역" | "클럽내",
    my_tier: dbRecord.my_tier || "미정",
    my_club: dbRecord.my_club || "미정",
    my_age: dbRecord.my_age || "미정",
    partner: dbRecord.partner || "없음(단식)",
    partner_tier: dbRecord.partner_tier || "미정",
    partner_club: dbRecord.partner_club || "미정",
    partner_age: dbRecord.partner_age || "미정",
    opponent: {
      name: dbRecord.opponent_name || "",
      name2: dbRecord.opponent_name2 || "",
      age: dbRecord.opponent_age || "미정",
      age2: dbRecord.opponent_age2 || "미정",
      club: dbRecord.opponent_club || "미정",
      club2: dbRecord.opponent_club2 || "미정",
      tier1: dbRecord.opponent_tier1 || "미정",
      tier2: dbRecord.opponent_tier2 || "미정",
    },
    score: dbRecord.score,
    result: dbRecord.result as "WIN" | "LOSE",
    raw_text: dbRecord.raw_text || "",
    createdAt: dbRecord.created_at || new Date().toISOString(),
  };
}

// Format app MatchRecord to DB record details
export function mapMatchRecordToDb(record: MatchRecord, userId: string): any {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.id);
  return {
    id: isUuid ? record.id : undefined, // only keep real UUIDs, let db generate otherwise
    user_id: userId,
    date: record.date,
    tournament_name: record.tournament_name,
    tournament_type: record.tournament_type,
    my_tier: record.my_tier,
    my_club: record.my_club,
    my_age: record.my_age,
    partner: record.partner,
    partner_tier: record.partner_tier,
    partner_club: record.partner_club,
    partner_age: record.partner_age,
    opponent_name: record.opponent.name,
    opponent_name2: record.opponent.name2,
    opponent_age: record.opponent.age,
    opponent_age2: record.opponent.age2,
    opponent_club: record.opponent.club,
    opponent_club2: record.opponent.club2,
    opponent_tier1: record.opponent.tier1,
    opponent_tier2: record.opponent.tier2,
    score: record.score,
    result: record.result,
    raw_text: record.raw_text || "",
  };
}
