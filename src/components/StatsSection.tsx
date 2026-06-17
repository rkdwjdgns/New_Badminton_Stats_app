/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { MatchRecord } from "../types";
import { calculateStatistics } from "../utils";

interface StatsSectionProps {
  records: MatchRecord[];
}

export default function StatsSection({ records }: StatsSectionProps) {
  const stats = calculateStatistics(records);

  // Circular progress ring parameters
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.winRate / 100) * circumference;

  return (
    <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-3.5 shadow-md shadow-slate-900/10 animate-fadeIn flex items-center justify-between gap-3 font-sans">
      {/* Left: LoL Summoner Style Doughnut Ring & Record Info */}
      <div className="flex items-center gap-3">
        {/* Mini Ring Chart */}
        <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
          <svg className="w-11 h-11 transform -rotate-90">
            {/* Outer track */}
            <circle
              cx="22"
              cy="22"
              r={radius}
              className="stroke-slate-800"
              strokeWidth="3.5"
              fill="transparent"
            />
            {/* Animated win rate fill */}
            <circle
              cx="22"
              cy="22"
              r={radius}
              className="stroke-emerald-500 transition-all duration-500"
              strokeWidth="3.5"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute text-center flex flex-col items-center justify-center">
            <span className="text-[8px] font-black text-slate-500 uppercase leading-none mb-0.5">승률</span>
            <span className="text-[10px] font-black tracking-tighter text-emerald-400 leading-none">{stats.winRate}%</span>
          </div>
        </div>

        {/* Record Numbers */}
        <div>
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider leading-none mb-1">
            종합 전적
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-black text-slate-100">{stats.totalMatches}전</span>
            <span className="text-slate-700 text-xs leading-none">|</span>
            <span className="text-xs font-bold text-emerald-400">{stats.wins}승</span>
            <span className="text-xs font-bold text-rose-400">{stats.losses}패</span>
            <span className="text-slate-700 text-xs leading-none">|</span>
            <span className="text-xs font-bold text-blue-400">평균 {stats.avgOurScore}득 | {stats.avgOppScore}실</span>
          </div>
        </div>
      </div>

      {/* Right: Streak & Current Pace */}
      <div className="flex items-center gap-2 shrink-0">
        {stats.streakType !== "NONE" ? (
          <div className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold flex items-center gap-1 border ${
            stats.streakType === "WIN"
              ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-400"
              : "bg-red-950/40 border-red-900/50 text-red-400"
          }`}>
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">
              {stats.streakType === "WIN" ? "WIN STREAK" : "LOSE STREAK"}
            </span>
            <span className="font-extrabold">{stats.currentStreak}</span>
            <span>{stats.streakType === "WIN" ? "🔥" : "🧊"}</span>
          </div>
        ) : (
          <div className="px-2.5 py-1 rounded-md text-xs font-bold border border-slate-800 text-slate-550 bg-slate-900/40 select-none">
            STREAK -
          </div>
        )}
      </div>
    </div>
  );
}
