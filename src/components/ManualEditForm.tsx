/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { MatchRecord, Opponent } from "../types";
import { Check } from "lucide-react";
import { getIsolatedItem, setIsolatedItem } from "../utils";

interface ManualEditFormProps {
  key?: string | number;
  initialData: Partial<MatchRecord>;
  onSave: (record: MatchRecord) => void;
  onCancel: () => void;
  isEditingExisting?: boolean;
  existingTournaments?: string[];
  user?: any;
}

export default function ManualEditForm({ 
  initialData, 
  onSave, 
  onCancel, 
  isEditingExisting = false,
  existingTournaments = [],
  user
}: ManualEditFormProps) {
  const [date, setDate] = useState(initialData.date || new Date().toISOString().split("T")[0]);
  const [tournamentName, setTournamentName] = useState(isEditingExisting ? (initialData.tournament_name || "") : "");
  const [tournamentType, setTournamentType] = useState<"전국" | "지역" | "클럽내">(
    initialData.tournament_type || "지역"
  );
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastRegisteredTournament, setLastRegisteredTournament] = useState<string>(() => {
    try {
      return getIsolatedItem("badminton_last_tournament", user?.id) || "";
    } catch {
      return "";
    }
  });
  
  // Partner state
  const [partner, setPartner] = useState(
    isEditingExisting 
      ? (initialData.partner === "없음(단식)" ? "" : (initialData.partner || "")) 
      : (getIsolatedItem("partner_badminton_name", user?.id) || "")
  );
  const [isSingles, setIsSingles] = useState(
    isEditingExisting ? (initialData.partner === "없음(단식)" || !initialData.partner) : false // 기본 복식
  );

  // My Club and Partner Club
  const [myName, setMyName] = useState(
    isEditingExisting 
      ? ((initialData as any).my_name || getIsolatedItem("my_badminton_name", user?.id) || "") 
      : (getIsolatedItem("my_badminton_name", user?.id) || "")
  );
  const [myClub, setMyClub] = useState(
    isEditingExisting 
      ? (initialData.my_club || "") 
      : (getIsolatedItem("my_badminton_club", user?.id) || "")
  );
  const [partnerClub, setPartnerClub] = useState(
    isEditingExisting 
      ? (initialData.partner_club || "") 
      : (getIsolatedItem("partner_badminton_club", user?.id) || "")
  );

  // Age limits states
  const [myAge, setMyAge] = useState(
    isEditingExisting 
      ? (initialData.my_age || "미정") 
      : (getIsolatedItem("my_badminton_age", user?.id) || "미정")
  );
  const [partnerAge, setPartnerAge] = useState(
    isEditingExisting 
      ? (initialData.partner_age || "미정") 
      : (getIsolatedItem("partner_badminton_age", user?.id) || "미정")
  );

  // Player levels (급수) and multi-opponent states
  const [myTier, setMyTier] = useState(
    initialData.my_tier || getIsolatedItem("my_badminton_tier", user?.id) || "미정"
  );
  const [partnerTier, setPartnerTier] = useState(
    initialData.partner_tier || getIsolatedItem("partner_badminton_tier", user?.id) || "미정"
  );
  const [oppName2, setOppName2] = useState(initialData.opponent?.name2 || "");
  const [opp1Tier, setOpp1Tier] = useState(initialData.opponent?.tier1 || "미정");
  const [opp2Tier, setOpp2Tier] = useState(initialData.opponent?.tier2 || "미정");

  // Opponent state
  const [oppName, setOppName] = useState(initialData.opponent?.name || "");
  const [oppAge, setOppAge] = useState(initialData.opponent?.age || "미정");
  const [oppAge2, setOppAge2] = useState(initialData.opponent?.age2 || "미정");
  const [oppClub, setOppClub] = useState(
    isEditingExisting ? (initialData.opponent?.club === "미정" ? "" : (initialData.opponent?.club || "")) : ""
  );
  const [oppClub2, setOppClub2] = useState(
    isEditingExisting ? (initialData.opponent?.club2 === "미정" ? "" : (initialData.opponent?.club2 || "")) : ""
  );

  // Score state
  const [ourScore, setOurScore] = useState<number>(21);
  const [oppScore, setOppScore] = useState<number>(19);

  useEffect(() => {
    // Parse score from initialData (e.g. "25:23" -> ourScore: 25, oppScore: 23)
    if (initialData.score && initialData.score.includes(":")) {
      const parts = initialData.score.split(":");
      const we = parseInt(parts[0]);
      const they = parseInt(parts[1]);
      if (!isNaN(we)) setOurScore(we);
      if (!isNaN(they)) setOppScore(they);
    }
  }, [initialData.score]);

  // Handle singles toggle change
  const handleSinglesToggle = (singles: boolean) => {
    setIsSingles(singles);
    if (singles) {
      setPartner("없음(단식)");
    } else {
      setPartner(initialData.partner && initialData.partner !== "없음(단식)" ? initialData.partner : "");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!oppName.trim()) {
      alert("상대방 이름을 입력해주세요.");
      return;
    }

    if (!isSingles && !partner.trim()) {
      alert("복식 경기일 경우 파트너 이름을 입력해주세요.");
      return;
    }

    if (!isSingles && !oppName2.trim()) {
      alert("복식 경기일 경우 두 번째 상대편 이름을 입력해주세요.");
      return;
    }

    // 내 클럽이 입력된 경우 로컬스토리지에 저장하여 자동 완성 지원
    if (myClub.trim()) {
      setIsolatedItem("my_badminton_club", myClub.trim(), user?.id);
    }

    // 내 이름 로컬스토리지 저장
    if (myName.trim()) {
      setIsolatedItem("my_badminton_name", myName.trim(), user?.id);
    }

    // 내 연령층이 선택된 경우 로컬스토리지에 저장
    if (myAge && myAge !== "미정") {
      setIsolatedItem("my_badminton_age", myAge, user?.id);
    }

    // 대회 명을 직전에 적었던 대회명으로 기록
    if (tournamentName.trim()) {
      try {
        const cleanName = tournamentName.trim();
        setIsolatedItem("badminton_last_tournament", cleanName, user?.id);
        setLastRegisteredTournament(cleanName);
      } catch (err) {
        console.error(err);
      }
    }

    const calculatedResult = ourScore > oppScore ? "WIN" : "LOSE";
    const formattedScore = `${ourScore}:${oppScore}`;

    const updatedRecord: MatchRecord = {
      id: initialData.id || `match-${Date.now()}`,
      date,
      tournament_name: tournamentName.trim() || "정기 훈련",
      tournament_type: tournamentType,
      my_tier: myTier,
      my_club: myClub.trim() || "미정",
      my_age: myAge,
      partner: isSingles ? "없음(단식)" : partner.trim(),
      partner_tier: isSingles ? "미정" : partnerTier,
      partner_club: isSingles ? "" : (partnerClub.trim() || "미정"),
      partner_age: isSingles ? "미정" : partnerAge,
      opponent: {
        name: oppName.trim(),
        name2: isSingles ? "" : oppName2.trim(),
        age: oppAge,
        age2: isSingles ? "미정" : oppAge2,
        club: oppClub.trim() || "미정",
        club2: isSingles ? "" : (oppClub2.trim() || "미정"),
        tier1: opp1Tier,
        tier2: isSingles ? "미정" : opp2Tier,
      },
      score: formattedScore,
      result: calculatedResult,
      raw_text: initialData.raw_text,
      createdAt: initialData.createdAt || new Date().toISOString(),
    };

    onSave(updatedRecord);
  };

  // Preview actual automatic outcome
  const isWin = ourScore > oppScore;

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl shadow-slate-200/40 space-y-6 relative overflow-hidden transition-all duration-350">
      
      {/* Decorative top accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-600" />
      
      <div className="flex md:flex-row flex-col justify-between items-start md:items-center border-b border-slate-150 pb-4 mb-2">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900 text-white uppercase tracking-wider mb-1.5">
            <Check className="w-3 h-3" /> DIRECT INPUT FORM
          </span>
          <h3 className="text-base font-bold text-slate-800">
            {isEditingExisting ? "경기 기록 디테일 수정" : "새 배드민턴 전적 등록"}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Left Side: Match Details & Dates */}
        <div className="space-y-4">
          <h4 className="font-bold text-xs text-slate-650 tracking-wider uppercase border-l-2 border-emerald-600 pl-2">1. 매치 기본 개요</h4>
          
          {/* Match Date */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">경기 날짜 (Date)</label>
            <div className="relative">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Tournament Name */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">대회명 / 매치 이벤트명 (Tournament Name)</label>
            <input
              type="text"
              value={tournamentName}
              onChange={(e) => {
                setTournamentName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                // Small delay to allow selection before closing
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              placeholder="정기 훈련"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400/60"
            />
            {showSuggestions && lastRegisteredTournament && (
              (() => {
                const query = tournamentName.trim().toLowerCase();
                const matches = !query || lastRegisteredTournament.toLowerCase().includes(query);
                if (!matches) return null;

                return (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg select-none">
                    <button
                      type="button"
                      onMouseDown={() => {
                        setTournamentName(lastRegisteredTournament);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-705 hover:bg-emerald-50 hover:text-emerald-800 font-extrabold transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="text-emerald-505">✨ 최근 등록:</span>
                        <span>{lastRegisteredTournament}</span>
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black">
                        자동완성 선택
                      </span>
                    </button>
                  </div>
                );
              })()
            )}
          </div>

          {/* Tournament Type (National or Regional) */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">대회 종류 (League Type)</label>
            <div className="flex gap-2">
              {(["전국", "지역"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTournamentType(type)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    tournamentType === type
                      ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                      : "bg-slate-50 border-slate-205 text-slate-550 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                >
                  {type} 대회
                </button>
              ))}
            </div>
          </div>



          {/* Match Type Choice (Singles / Doubles) */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">경기 방식 (Match Mode)</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => handleSinglesToggle(true)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  isSingles
                    ? "bg-slate-100 border-slate-300 text-slate-800 font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-400"
                }`}
              >
                단식 (Singles)
              </button>
              <button
                type="button"
                onClick={() => handleSinglesToggle(false)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  !isSingles
                    ? "bg-emerald-50 border-emerald-250 text-emerald-800 font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-400"
                }`}
              >
                복식 (Doubles)
              </button>
            </div>

            {/* Players Tier (급수) Section */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <span className="block text-[10px] font-black text-slate-500 tracking-wider uppercase mb-1">
                우리 팀 (Team WE 멤버/급수/클럽)
              </span>
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">본인</label>
                  <input
                    type="text"
                    required
                    value={myName}
                    onChange={(e) => setMyName(e.target.value)}
                    placeholder="본인 이름"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-850 font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">나의 급수</label>
                  <select
                    value={myTier}
                    onChange={(e) => setMyTier(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {["미정", "S조", "A조", "B조", "C조", "D조", "초심"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">나의 연령층</label>
                  <select
                    value={myAge}
                    onChange={(e) => setMyAge(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {["미정", "20대", "30대", "40대", "50대", "60대 이상"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                
                {/* 나의 소속 클럽 필드 */}
                <div className="col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">나의 소속 클럽</label>
                  <input
                    type="text"
                    value={myClub}
                    onChange={(e) => setMyClub(e.target.value)}
                    placeholder="소속 클럽 (입력 시 자동 기억)"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none placeholder:text-slate-400/50"
                  />
                </div>
              </div>

              {!isSingles && (
                <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-200/50 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">복식 파트너</label>
                    <input
                      type="text"
                      required={!isSingles}
                      value={partner === "없음(단식)" ? "" : partner}
                      onChange={(e) => setPartner(e.target.value)}
                      placeholder="파트너 이름"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none placeholder:text-slate-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">파트너 급수</label>
                    <select
                      value={partnerTier}
                      onChange={(e) => setPartnerTier(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none cursor-pointer"
                    >
                      {["미정", "S조", "A조", "B조", "C조", "D조", "초심"].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">파트너 연령층</label>
                    <select
                      value={partnerAge}
                      onChange={(e) => setPartnerAge(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none cursor-pointer"
                    >
                      {["미정", "20대", "30대", "40대", "50대", "60대 이상"].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* 파트너 소속 클럽 필드 */}
                  <div className="col-span-3 pt-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">파트너 소속 클럽</label>
                    <input
                      type="text"
                      value={partnerClub}
                      onChange={(e) => setPartnerClub(e.target.value)}
                      placeholder="미정 (파트너 클럽)"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-805 focus:outline-none placeholder:text-slate-400/50"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right Side: Opponent & Score & Outcome */}
        <div className="space-y-4">
          <h4 className="font-bold text-xs text-slate-650 tracking-wider uppercase border-l-2 border-emerald-600 pl-2">2. 경쟁자 및 스코어 스펙</h4>

          {/* Opponent Info */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <span className="block text-[10px] font-black text-slate-500 tracking-wider uppercase mb-1">
              상대 팀 (Team THEY 멤버/급수/연령층/클럽)
            </span>

            {/* Opponent 1 Block */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">상대방 1 이름</label>
                <input
                  type="text"
                  required
                  value={oppName}
                  onChange={(e) => setOppName(e.target.value)}
                  placeholder="예: 홍길동"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">급수</label>
                <select
                  value={opp1Tier}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOpp1Tier(val);
                    setOpp2Tier(val);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none cursor-pointer"
                >
                  {["미정", "S조", "A조", "B조", "C조", "D조", "초심"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">연령층</label>
                <select
                  value={oppAge}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOppAge(val);
                    setOppAge2(val);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none cursor-pointer"
                >
                  {["미정", "20대", "30대", "40대", "50대", "60대 이상"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              
              <div className="col-span-3">
                <label className="block text-[10px] font-bold text-slate-400 mb-1">상대방 1 클럽</label>
                <input
                  type="text"
                  value={oppClub}
                  onChange={(e) => setOppClub(e.target.value)}
                  placeholder="미정 (상대 1 클럽)"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none placeholder:text-slate-400/50"
                />
              </div>
            </div>

            {/* Opponent 2 Block (Only doubles) */}
            {!isSingles && (
              <div className="grid grid-cols-3 gap-2 pt-3.5 border-t border-slate-200/50 animate-fadeIn">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">상대방 2 이름</label>
                  <input
                    type="text"
                    required={!isSingles}
                    value={oppName2}
                    onChange={(e) => setOppName2(e.target.value)}
                    placeholder="예: 김상대"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">급수</label>
                  <select
                    value={opp2Tier}
                    onChange={(e) => setOpp2Tier(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {["미정", "S조", "A조", "B조", "C조", "D조", "초심"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">연령층</label>
                  <select
                    value={oppAge2}
                    onChange={(e) => setOppAge2(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {["미정", "20대", "30대", "40대", "50대", "60대 이상"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                
                <div className="col-span-3 pt-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">상대방 2 클럽</label>
                  <input
                    type="text"
                    value={oppClub2}
                    onChange={(e) => setOppClub2(e.target.value)}
                    placeholder="미정 (상대 2 클럽)"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none placeholder:text-slate-400/50"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Interactive Score Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">경기 점수 리매핑 (Score Adjustment)</label>
            <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
              
              {/* Our team score */}
              <div className="text-center flex-1">
                <span className="text-[10px] font-bold text-emerald-700 block mb-1">우리팀 (WE)</span>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOurScore(Math.max(0, ourScore - 1))}
                    className="w-7 h-7 rounded bg-white border border-slate-250 text-slate-700 font-bold text-sm flex items-center justify-center hover:bg-slate-100"
                  >
                    -
                  </button>
                  <span className="text-2xl font-black text-slate-800 w-10">{ourScore}</span>
                  <button
                    type="button"
                    onClick={() => setOurScore(ourScore + 1)}
                    className="w-7 h-7 rounded bg-white border border-slate-250 text-slate-700 font-bold text-sm flex items-center justify-center hover:bg-slate-100"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="text-xl font-bold text-slate-300 select-none">:</div>

              {/* Opponent score */}
              <div className="text-center flex-1">
                <span className="text-[10px] font-bold text-slate-500 block mb-1">상대팀 (THEY)</span>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOppScore(Math.max(0, oppScore - 1))}
                    className="w-7 h-7 rounded bg-white border border-slate-250 text-slate-700 font-bold text-sm flex items-center justify-center hover:bg-slate-100"
                  >
                    -
                  </button>
                  <span className="text-2xl font-black text-slate-800 w-10">{oppScore}</span>
                  <button
                    type="button"
                    onClick={() => setOppScore(oppScore + 1)}
                    className="w-7 h-7 rounded bg-white border border-slate-250 text-slate-700 font-bold text-sm flex items-center justify-center hover:bg-slate-100"
                  >
                    +
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Auto Outcome Preview Badge */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-xs text-slate-500 font-bold">도출 결과:</span>
            <span className={`px-4 py-1 text-xs font-bold rounded-md uppercase text-white shadow-xs ${
              isWin 
                ? "bg-emerald-600" 
                : "bg-red-500"
            }`}>
              {isWin ? "WIN" : "LOSE"}
            </span>
          </div>

        </div>

      </div>

      {/* Form Actions */}
      <div className="flex gap-2 justify-end pt-3 border-t border-slate-150">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-slate-350 hover:bg-slate-50 text-slate-650 font-semibold text-xs transition-all active:scale-95"
        >
          취소
        </button>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          {isEditingExisting ? "수정 저장" : "배드민턴 전적 등록"}
        </button>
      </div>

    </form>
  );
}
