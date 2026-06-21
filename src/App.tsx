/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { MatchRecord } from "./types";
import { loadRecords, saveRecords, isDummyMatch, getIsolatedItem, setIsolatedItem, removeIsolatedItem } from "./utils";
import StatsSection from "./components/StatsSection";
import ManualEditForm from "./components/ManualEditForm";
import MatchList from "./components/MatchList";
import AuthPanel from "./components/AuthPanel";
import { supabase, isSupabaseConfigured, mapDbToMatchRecord, mapMatchRecordToDb } from "./supabase";
import { 
  PlusCircle, 
  History,
  TrendingUp,
  Database,
  CloudLightning,
  AlertTriangle,
  Clipboard
} from "lucide-react";

export default function App() {
  const [records, setRecords] = useState<MatchRecord[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MatchRecord | null>(null);
  const [newRecordData, setNewRecordData] = useState<Partial<MatchRecord> | null>(null);
  
  // Auth state
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showDdlGuide, setShowDdlGuide] = useState(false);

  // Profile settings state & reactive profile name for header
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentUserProfileName, setCurrentUserProfileName] = useState("");

  // Sync state back to LocalStorage in case of offline copies
  const updateRecords = (newRecords: MatchRecord[]) => {
    setRecords(newRecords);
    saveRecords(newRecords, user?.id);
  };

  const handleSessionChange = (newSession: any) => {
    setSession(newSession);
    const u = newSession?.user || null;
    setUser(u);
    if (u) {
      const meta = u.user_metadata || {};
      if (meta.name) {
        setIsolatedItem("my_badminton_name", meta.name, u.id);
        setCurrentUserProfileName(meta.name);
      } else {
        setCurrentUserProfileName(getIsolatedItem("my_badminton_name", u.id) || "");
      }
      if (meta.tier) setIsolatedItem("my_badminton_tier", meta.tier, u.id);
      if (meta.age) setIsolatedItem("my_badminton_age", meta.age, u.id);
      if (meta.club) setIsolatedItem("my_badminton_club", meta.club, u.id);
      if (meta.partner_name) setIsolatedItem("partner_badminton_name", meta.partner_name, u.id);
      if (meta.partner_tier) setIsolatedItem("partner_badminton_tier", meta.partner_tier, u.id);
      if (meta.partner_age) setIsolatedItem("partner_badminton_age", meta.partner_age, u.id);
      if (meta.partner_club) setIsolatedItem("partner_badminton_club", meta.partner_club, u.id);
    } else {
      setCurrentUserProfileName(getIsolatedItem("my_badminton_name") || "");
    }
  };

  // Restore saved login on app start and keep it in sync while the app is running.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        handleSessionChange(data.session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
        handleSessionChange(newSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Keep header name reactive and isolated
  useEffect(() => {
    setCurrentUserProfileName(getIsolatedItem("my_badminton_name", user?.id) || "");
  }, [user]);

  // Refresh reactive names whenever profile panel closes
  useEffect(() => {
    if (!isProfileOpen) {
      setCurrentUserProfileName(getIsolatedItem("my_badminton_name", user?.id) || "");
    }
  }, [isProfileOpen, user]);

  // Load records on start or when session/user state changes with lossless bidirectional syncing
  useEffect(() => {
    async function loadData() {
      setDbError(null);
      
      // Load most up-to-date local records first so we always show existing work immediately
      let localRecords = loadRecords(user ? user.id : undefined);
      if (user && localRecords.length === 0) {
        // Fallback to guest records if specific user profile has no local records yet (to prevent showing 0 records)
        localRecords = loadRecords();
      }

      if (user && isSupabaseConfigured) {
        try {
          const { data, error } = await supabase!
            .from("matches")
            .select("*")
            .order("date", { ascending: false })
            .order("created_at", { ascending: false });

          if (error) {
            console.error("Supabase load error detail:", error);
            if (
              error.code === "PGRST116" || 
              error.code === "42P01" || 
              error.message?.includes("relation") ||
              error.message?.includes("does not exist")
            ) {
              setDbError("Supabase 'matches' 테이블이 데이터베이스에 존재하지 않습니다. 아래 SQL 코드를 실행해주세요!");
            } else {
              setDbError(`클라우드 데이터 에러: ${error.message}`);
            }
            // Use local records as robust fallback
            setRecords(localRecords);
            return;
          }

          // Keep remote records list
          const rawDbMatches = data || [];
          const mappedRemote = rawDbMatches.map(mapDbToMatchRecord);

          // BIDIRECTIONAL MUTUAL MERGE: ID-based Map to prevent overwriting/loss
          const mergedMap = new Map<string, MatchRecord>();
          
          // 1. Populate with local records first
          localRecords.forEach(r => {
            if (r && r.id) {
              mergedMap.set(r.id, r);
            }
          });
          
          // 2. Overwrite or add with remote records from Supabase (ensuring matches match)
          mappedRemote.forEach(r => {
            if (r && r.id) {
              mergedMap.set(r.id, r);
            }
          });

          const mergedRecords = Array.from(mergedMap.values());
          
          // Order matches descending by date and creation
          mergedRecords.sort((a, b) => {
            const dateCompare = (b.date || "").localeCompare(a.date || "");
            if (dateCompare !== 0) return dateCompare;
            return (b.createdAt || "").localeCompare(a.createdAt || "");
          });

          // Instantly update local screen & storage with the complete merged history
          setRecords(mergedRecords);
          saveRecords(mergedRecords, user.id);

          // Find local-only matches that do not exist on the remote database to upload them automatically
          const remoteIds = new Set(rawDbMatches.map(m => m.id));
          const unsyncedLocal = localRecords.filter(r => 
            r && r.id && 
            !remoteIds.has(r.id) && 
            r.id !== "sample-1" && 
            r.id !== "sample-2"
          );

          if (unsyncedLocal.length > 0) {
            console.log("Auto-sync: Uploading unsynced local records to Supabase:", unsyncedLocal.length);
            const toInsert = unsyncedLocal.map(r => mapMatchRecordToDb(r, user.id));
            const { error: insertError } = await supabase!.from("matches").insert(toInsert);
            if (insertError) {
              console.error("Auto-sync upload failed:", insertError);
            }
          }
        } catch (err: any) {
          console.error("Supabase fetch exception, falling back to local:", err);
          setDbError("클라우드 데이터를 동기화하는 도중 오류가 발생했습니다. (오프라인 상태로 로컬 전적 사용 가능)");
          setRecords(localRecords);
          saveRecords(localRecords, user.id);
        }
      } else {
        // Logged out / Guest Mode: Simply load robust local records
        setRecords(localRecords);
      }
    }

    loadData();
  }, [user]);

  // Open empty form for adding a new match directly
  const handleAddNewMatch = () => {
    const today = new Date().toISOString().split("T")[0];
    setNewRecordData({
      date: today,
      tournament_name: "", 
      tournament_type: "지역",
      my_tier: getIsolatedItem("my_badminton_tier", user?.id) || "미정",
      my_club: getIsolatedItem("my_badminton_club", user?.id) || "", 
      partner: getIsolatedItem("partner_badminton_name", user?.id) || "",
      partner_tier: getIsolatedItem("partner_badminton_tier", user?.id) || "미정",
      partner_club: getIsolatedItem("partner_badminton_club", user?.id) || "",
      opponent: {
        name: "",
        name2: "",
        age: "미정",
        club: "",
        club2: "",
        tier1: "미정",
        tier2: "미정"
      },
      score: "25:23",
      result: "WIN"
    });
    setEditingRecord(null);
    setIsFormOpen(true);
  };

  // Save complete record from manual form (Dual local/cloud save)
  const handleSaveRecord = async (record: MatchRecord) => {
    let updated: MatchRecord[];
    
    if (user && isSupabaseConfigured) {
      try {
        setDbError(null);
        if (editingRecord) {
          // Edit existing in Supabase
          const { error } = await supabase!
            .from("matches")
            .update(mapMatchRecordToDb(record, user.id))
            .eq("id", editingRecord.id);
          
          if (error) throw error;
          
          updated = records.map((r) => (r.id === editingRecord.id ? record : r));
        } else {
          // Insert new in Supabase
          const toInsert = mapMatchRecordToDb(record, user.id);
          const { data, error } = await supabase!
            .from("matches")
            .insert(toInsert)
            .select();
            
          if (error) throw error;
          
          const insertedRecord = data && data[0] ? mapDbToMatchRecord(data[0]) : record;
          updated = [insertedRecord, ...records];
        }
        setRecords(updated);
        saveRecords(updated, user.id);
      } catch (err: any) {
        console.error("Supabase save error details:", err);
        setDbError("클라우드 저장에 실패했습니다. (로컬에만 안전하게 저장됨) " + (err.message || ""));
        
        // fallback local
        if (editingRecord) {
          updated = records.map((r) => (r.id === editingRecord.id ? record : r));
        } else {
          updated = [record, ...records];
        }
        updateRecords(updated);
      }
    } else {
      // Local mode
      if (editingRecord) {
        updated = records.map((r) => (r.id === editingRecord.id ? record : r));
      } else {
        updated = [record, ...records];
      }
      updateRecords(updated);
    }
    
    setNewRecordData(null);
    setEditingRecord(null);
    setIsFormOpen(false);
  };

  // Edit Existing Match Toggle
  const handleEditToggle = (record: MatchRecord) => {
    setEditingRecord(record);
    setNewRecordData(record);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Delete Record
  const handleDeleteRecord = async (id: string) => {
    if (user && isSupabaseConfigured) {
      try {
        setDbError(null);
        const { error } = await supabase!
          .from("matches")
          .delete()
          .eq("id", id);
          
        if (error) throw error;
        
        const updated = records.filter((r) => r.id !== id);
        setRecords(updated);
        saveRecords(updated, user.id);
      } catch (err: any) {
        console.error("Supabase delete error details:", err);
        setDbError("클라우드 삭제에 실패했습니다. (로컬 파일에서만 우선 삭제됨) " + (err.message || ""));
        
        const updated = records.filter((r) => r.id !== id);
        updateRecords(updated);
      }
    } else {
      const updated = records.filter((r) => r.id !== id);
      updateRecords(updated);
    }

    if (editingRecord?.id === id) {
      setNewRecordData(null);
      setEditingRecord(null);
      setIsFormOpen(false);
    }
  };

  // State for DDL copy feedback
  const [copied, setCopied] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans flex flex-col justify-between">
      
      {/* Upper Navigation / Decorative Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 py-3.5 px-4 md:px-6 flex items-center justify-between shadow-xs">
        <div>
          <h1 className="font-extrabold text-base text-slate-850 tracking-tight leading-none">
            SmintonS
          </h1>
          <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider mt-1 block">
            For Badminton Lovers
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {user ? (
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl transition-all cursor-pointer text-[11px] font-extrabold shadow-3xs active:scale-95"
              title="내 프로필 및 계정 설정"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="max-w-[120px] truncate">{currentUserProfileName || user.email}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-850 border border-emerald-150 rounded-xl transition-all cursor-pointer text-[11px] font-extrabold shadow-3xs active:scale-95"
            >
              <span>시작하기 (로그인)</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl w-full mx-auto px-4 py-5 space-y-5 flex-1">

        {/* Database setup instructions or Error warnings */}
        {dbError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs font-medium text-rose-800 space-y-2.5 shadow-2xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold mb-0.5 text-[11.5px]">수파베이스 연동 필요 안내</strong>
                <span>{dbError}</span>
              </div>
            </div>
            
            {dbError.includes("matches") && (
              <div className="pt-2.5 border-t border-rose-150 space-y-2">
                <p className="text-[10.5px] leading-relaxed text-rose-700">
                  수파베이스 대시보드의 <strong className="text-rose-900">SQL Editor</strong>에 아래 쿼리를 그대로 붙여넣고 <strong className="text-rose-900">Run</strong> 단추를 눌러 실행하세요. 그 후 새로고침하시면 클라우드 백업이 즉시 실행됩니다!
                </p>
                <div className="relative">
                  <pre className="bg-slate-900 text-[9.5px] text-slate-300 font-mono p-3 rounded-lg overflow-x-auto max-h-[160px] whitespace-pre select-all border border-slate-800 leading-normal">
{`create table matches (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  date text not null,
  tournament_name text,
  tournament_type text not null,
  my_tier text,
  my_club text,
  my_age text,
  partner text,
  partner_tier text,
  partner_club text,
  partner_age text,
  opponent_name text not null,
  opponent_name2 text,
  opponent_age text,
  opponent_age2 text,
  opponent_club text,
  opponent_club2 text,
  opponent_tier1 text,
  opponent_tier2 text,
  score text not null,
  result text not null,
  raw_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table matches enable row level security;

create policy "Users can modify their own matches"
  on matches for all
  using (auth.uid() = user_id);`}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`create table matches (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  date text not null,
  tournament_name text,
  tournament_type text not null,
  my_tier text,
  my_club text,
  my_age text,
  partner text,
  partner_tier text,
  partner_club text,
  partner_age text,
  opponent_name text not null,
  opponent_name2 text,
  opponent_age text,
  opponent_age2 text,
  opponent_club text,
  opponent_club2 text,
  opponent_tier1 text,
  opponent_tier2 text,
  score text not null,
  result text not null,
  raw_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table matches enable row level security;

create policy "Users can modify their own matches"
  on matches for all
  using (auth.uid() = user_id);`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute right-2 top-2 px-2.5 py-1 bg-slate-805 hover:bg-slate-750 text-slate-300 font-extrabold text-[9px] rounded border border-slate-700 flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>{copied ? "복사완료!" : "SQL 복사"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Statistics Widgets */}
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              경기 통계
            </h2>
            <span className="text-[10px] font-bold text-slate-400 uppercase">{records.length} MATCHES</span>
          </div>
          <StatsSection records={records} />
        </section>

        {/* Quick Add Match Action Button (Highly Recommended for Mobile Focus) */}
        {!isFormOpen && (
          <button
            onClick={handleAddNewMatch}
            className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm tracking-wide rounded-xl shadow-xs hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>새 배드민턴 전적 등록</span>
          </button>
        )}

        {/* Manual Edit and Store Form - Displays conditionally */}
        {isFormOpen && (
          <div className="animate-slideUp">
            <ManualEditForm
              key={editingRecord ? editingRecord.id : "new-match-form"}
              initialData={newRecordData || {}}
              onSave={handleSaveRecord}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingRecord(null);
                setNewRecordData(null);
              }}
              isEditingExisting={!!editingRecord}
              existingTournaments={Array.from(new Set(records.map(r => r.tournament_name?.trim()))).filter(Boolean) as string[]}
              user={user}
            />
          </div>
        )}

        {/* Match List Section */}
        <section className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <History className="w-4.5 h-4.5 text-slate-500" />
                경기 전적 리스트
              </h3>
              <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-150 px-2.5 py-0.5 rounded-full">
                {records.length} Total
              </span>
            </div>

            {/* Match List Component */}
            <MatchList
              records={records}
              onDelete={handleDeleteRecord}
              onEditToggle={handleEditToggle}
              user={user}
            />

          </div>
        </section>

      </main>

      {/* Elegant Professional minimalist footer */}
      <footer className="h-11 bg-slate-900 flex items-center px-4 text-[10px] text-slate-400 justify-between w-full mt-8">
        <div>
          <span>© 2026 SmintonS</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-slate-350 font-medium tracking-tight">For Badminton Lovers</span>
        </div>
      </footer>

      {/* Auth & Profile Settings Modal Component */}
      <AuthPanel 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        onSessionChange={handleSessionChange} 
        user={user} 
      />
    </div>
  );
}
