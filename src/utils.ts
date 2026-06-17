/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatchRecord, Statistics } from "./types";

// Key for LocalStorage
const LOCAL_STORAGE_KEY = "badminton_match_records";

// Isolate key helper - Suffixes baseKey with user ID, or "guest" if none is logged in
export function getIsolatedKey(baseKey: string, userId?: string): string {
  return userId ? `${baseKey}_${userId}` : `${baseKey}_guest`;
}

// Get user-specific isolated localStorage item with deep fallbacks
export function getIsolatedItem(baseKey: string, userId?: string): string | null {
  try {
    // 1. Try primary suffixed key for user or guest
    const primaryKey = getIsolatedKey(baseKey, userId);
    let val = localStorage.getItem(primaryKey);
    if (val !== null) return val;

    // 2. If userId was specified but key not found, try guest key as fallback
    if (userId) {
      val = localStorage.getItem(getIsolatedKey(baseKey));
      if (val !== null) return val;
    }

    // 3. Last resort legacy check: standard unsuffixed base key
    return localStorage.getItem(baseKey);
  } catch {
    return null;
  }
}

// Set user-specific isolated localStorage item and mirror to legacy & guest keys for offline durability
export function setIsolatedItem(baseKey: string, value: string, userId?: string): void {
  try {
    localStorage.setItem(getIsolatedKey(baseKey, userId), value);
    // Mirror to default unsuffixed legacy/global keys so info doesn't disappear when logged out
    localStorage.setItem(baseKey, value);
    localStorage.setItem(getIsolatedKey(baseKey), value);
  } catch (err) {
    console.error("Failed to write to localStorage:", err);
  }
}

// Remove user-specific isolated localStorage item completely (cleanup)
export function removeIsolatedItem(baseKey: string, userId?: string): void {
  try {
    localStorage.removeItem(getIsolatedKey(baseKey, userId));
    localStorage.removeItem(baseKey);
    localStorage.removeItem(getIsolatedKey(baseKey));
  } catch (err) {
    console.error("Failed to remove from localStorage:", err);
  }
}

// Standard sample records are now empty to ensure a clean start
export const SAMPLE_RECORDS: MatchRecord[] = [];

// Helper to detect mock/test dummy records - disabled to prevent deleting or filtering any user-authored records
export function isDummyMatch(r: any): boolean {
  return false;
}

// Load records from LocalStorage with deep fallbacks
export function loadRecords(userId?: string): MatchRecord[] {
  try {
    const primaryKey = userId ? `${LOCAL_STORAGE_KEY}_${userId}` : `${LOCAL_STORAGE_KEY}_guest`;
    let data = localStorage.getItem(primaryKey);
    
    // 1. If primary key is empty, fall back to global/unsuffixed key
    if (!data) {
      data = localStorage.getItem(LOCAL_STORAGE_KEY);
    }
    
    // 2. If still empty, and we are in guest mode, try to find any existing user-bound keys to copy from
    if (!data && !userId) {
      const keys = Object.keys(localStorage);
      const userKeys = keys.filter(k => k.startsWith(`${LOCAL_STORAGE_KEY}_`) && k !== `${LOCAL_STORAGE_KEY}_guest`);
      if (userKeys.length > 0) {
        let bestData = "";
        let maxRecords = 0;
        for (const uKey of userKeys) {
          const uData = localStorage.getItem(uKey);
          if (uData) {
            try {
              const parsed = JSON.parse(uData);
              if (Array.isArray(parsed) && parsed.length > maxRecords) {
                maxRecords = parsed.length;
                bestData = uData;
              }
            } catch {}
          }
        }
        if (bestData) {
          data = bestData;
        }
      }
    }

    if (!data) {
      return [];
    }
    
    const parsed: MatchRecord[] = JSON.parse(data);
    // Filter out residual sample and dummy mock records
    return parsed.filter(record => record && record.id && !record.id.startsWith("sample-") && !isDummyMatch(record));
  } catch (err) {
    console.error("Failed to load records from localStorage", err);
    return [];
  }
}

// Save records to LocalStorage and mirror to standard/legacy/guest fallback keys
export function saveRecords(records: MatchRecord[], userId?: string): void {
  try {
    const primaryKey = userId ? `${LOCAL_STORAGE_KEY}_${userId}` : `${LOCAL_STORAGE_KEY}_guest`;
    const serialized = JSON.stringify(records);
    
    localStorage.setItem(primaryKey, serialized);
    // Mirror to global fallback and guest suffix keys so there's NO "disappearing" on logout
    localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_guest`, serialized);
  } catch (err) {
    console.error("Failed to save records to localStorage", err);
  }
}

// Compute Statistics
export function calculateStatistics(records: MatchRecord[]): Statistics {
  const totalMatches = records.length;
  if (totalMatches === 0) {
    return {
      totalMatches: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      currentStreak: 0,
      streakType: "NONE",
      avgOurScore: 0,
      avgOppScore: 0,
    };
  }

  const wins = records.filter(r => r.result === "WIN").length;
  const losses = totalMatches - wins;
  const winRate = parseFloat(((wins / totalMatches) * 100).toFixed(1));

  // Sort records by date ascending, then by createdAt to determine streak
  const sortedRecords = [...records].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.createdAt.localeCompare(b.createdAt);
  });

  let currentStreak = 0;
  let streakType: "WIN" | "LOSE" | "NONE" = "NONE";

  if (sortedRecords.length > 0) {
    const lastResult = sortedRecords[sortedRecords.length - 1].result;
    streakType = lastResult;
    currentStreak = 1;

    for (let i = sortedRecords.length - 2; i >= 0; i--) {
      if (sortedRecords[i].result === lastResult) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  let totalOurScore = 0;
  let totalOppScore = 0;
  let scoredMatchesCount = 0;

  records.forEach(r => {
    if (r.score && r.score.includes(":")) {
      const [ourStr, oppStr] = r.score.split(":");
      const our = parseInt(ourStr, 10);
      const opp = parseInt(oppStr, 10);
      if (!isNaN(our) && !isNaN(opp)) {
        totalOurScore += our;
        totalOppScore += opp;
        scoredMatchesCount++;
      }
    }
  });

  const avgOurScore = scoredMatchesCount > 0 ? parseFloat((totalOurScore / scoredMatchesCount).toFixed(1)) : 0;
  const avgOppScore = scoredMatchesCount > 0 ? parseFloat((totalOppScore / scoredMatchesCount).toFixed(1)) : 0;

  return {
    totalMatches,
    wins,
    losses,
    winRate,
    currentStreak,
    streakType,
    avgOurScore,
    avgOppScore,
  };
}


