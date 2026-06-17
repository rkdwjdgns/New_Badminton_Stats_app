import React, { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../supabase";
import { 
  User, 
  LogIn, 
  LogOut, 
  Mail, 
  Lock, 
  ShieldAlert, 
  RefreshCw, 
  X, 
  Star, 
  KeyRound, 
  Trash2, 
  Trophy, 
  Users, 
  MapPin 
} from "lucide-react";
import { getIsolatedItem, setIsolatedItem, removeIsolatedItem } from "../utils";

interface AuthPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionChange: (session: any) => void;
  user: any;
}

export default function AuthPanel({ isOpen, onClose, onSessionChange, user }: AuthPanelProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Profile fields (used both during sign up and profile editing)
  const [myName, setMyName] = useState(getIsolatedItem("my_badminton_name", user?.id) || "");
  const [myTier, setMyTier] = useState(getIsolatedItem("my_badminton_tier", user?.id) || "미정");
  const [myAge, setMyAge] = useState(getIsolatedItem("my_badminton_age", user?.id) || "미정");
  const [myClub, setMyClub] = useState(getIsolatedItem("my_badminton_club", user?.id) || "");
  
  const [partnerName, setPartnerName] = useState(getIsolatedItem("partner_badminton_name", user?.id) || "");
  const [partnerTier, setPartnerTier] = useState(getIsolatedItem("partner_badminton_tier", user?.id) || "미정");
  const [partnerAge, setPartnerAge] = useState(getIsolatedItem("partner_badminton_age", user?.id) || "미정");
  const [partnerClub, setPartnerClub] = useState(getIsolatedItem("partner_badminton_club", user?.id) || "");

  // Change Password state
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Sync profile local states with user user_metadata when user logs in or profile changes
  useEffect(() => {
    if (user) {
      const meta = user.user_metadata || {};
      if (meta.name) {
        setMyName(meta.name);
        setIsolatedItem("my_badminton_name", meta.name, user.id);
      } else {
        setMyName(getIsolatedItem("my_badminton_name", user.id) || "");
      }
      if (meta.tier) {
        setMyTier(meta.tier);
        setIsolatedItem("my_badminton_tier", meta.tier, user.id);
      } else {
        setMyTier(getIsolatedItem("my_badminton_tier", user.id) || "미정");
      }
      if (meta.age) {
        setMyAge(meta.age);
        setIsolatedItem("my_badminton_age", meta.age, user.id);
      } else {
        setMyAge(getIsolatedItem("my_badminton_age", user.id) || "미정");
      }
      if (meta.club) {
        setMyClub(meta.club);
        setIsolatedItem("my_badminton_club", meta.club, user.id);
      } else {
        setMyClub(getIsolatedItem("my_badminton_club", user.id) || "");
      }
      
      if (meta.partner_name) {
        setPartnerName(meta.partner_name);
        setIsolatedItem("partner_badminton_name", meta.partner_name, user.id);
      } else {
        setPartnerName(getIsolatedItem("partner_badminton_name", user.id) || "");
      }
      if (meta.partner_tier) {
        setPartnerTier(meta.partner_tier);
        setIsolatedItem("partner_badminton_tier", meta.partner_tier, user.id);
      } else {
        setPartnerTier(getIsolatedItem("partner_badminton_tier", user.id) || "미정");
      }
      if (meta.partner_age) {
        setPartnerAge(meta.partner_age);
        setIsolatedItem("partner_badminton_age", meta.partner_age, user.id);
      } else {
        setPartnerAge(getIsolatedItem("partner_badminton_age", user.id) || "미정");
      }
      if (meta.partner_club) {
        setPartnerClub(meta.partner_club);
        setIsolatedItem("partner_badminton_club", meta.partner_club, user.id);
      } else {
        setPartnerClub(getIsolatedItem("partner_badminton_club", user.id) || "");
      }
    } else {
      // Guest mode or Logged Out
      setMyName(getIsolatedItem("my_badminton_name") || "");
      setMyTier(getIsolatedItem("my_badminton_tier") || "미정");
      setMyAge(getIsolatedItem("my_badminton_age") || "미정");
      setMyClub(getIsolatedItem("my_badminton_club") || "");
      setPartnerName(getIsolatedItem("partner_badminton_name") || "");
      setPartnerTier(getIsolatedItem("partner_badminton_tier") || "미정");
      setPartnerAge(getIsolatedItem("partner_badminton_age") || "미정");
      setPartnerClub(getIsolatedItem("partner_badminton_club") || "");
    }
  }, [user]);

  // Auth Submit: Handle both Login and SignUp
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setMessage({ 
        text: "Supabase URL 또는 Anon Key 설정이 비어 있습니다. .env 파일이나 /src/supabase.ts 파일에 설정을 완료한 후 사용해 주세요.", 
        type: "error" 
      });
      return;
    }
    if (!email.trim() || !password) {
      setMessage({ text: "이메일과 비밀번호를 입력해주세요.", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const metadata = {
          name: myName.trim(),
          tier: myTier,
          age: myAge,
          club: myClub.trim(),
          partner_name: partnerName.trim(),
          partner_tier: partnerTier,
          partner_age: partnerAge,
          partner_club: partnerClub.trim()
        };

        const { data, error } = await supabase!.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: metadata,
          }
        });
        
        if (error) throw error;
        
        // Save to local storage right away
        const userId = data.user?.id;
        setIsolatedItem("my_badminton_name", myName.trim(), userId);
        setIsolatedItem("my_badminton_tier", myTier, userId);
        setIsolatedItem("my_badminton_age", myAge, userId);
        setIsolatedItem("my_badminton_club", myClub.trim(), userId);
        setIsolatedItem("partner_badminton_name", partnerName.trim(), userId);
        setIsolatedItem("partner_badminton_tier", partnerTier, userId);
        setIsolatedItem("partner_badminton_age", partnerAge, userId);
        setIsolatedItem("partner_badminton_club", partnerClub.trim(), userId);

        if (data.user && data.session) {
          setMessage({ text: "회원가입 및 로그인이 완료되었습니다!", type: "success" });
          onSessionChange(data.session);
          setTimeout(() => onClose(), 1500);
        } else {
          // If confirmations are required
          setMessage({ text: "가입 단계에 진입했습니다! 이메일 인증 절차가 켜져 있는 프로젝트인 경우 인증 링크를 클릭해주시고, 그렇지 않다면 바로 로그인해주세요.", type: "success" });
        }
      } else {
        const { data, error } = await supabase!.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (error) throw error;
        
        setMessage({ text: "로그인 완료되었습니다!", type: "success" });
        onSessionChange(data.session);

        // Save metadata fields from user response to LS
        const meta = data.user?.user_metadata || {};
        const loginUserId = data.user?.id;
        if (meta.name) setIsolatedItem("my_badminton_name", meta.name, loginUserId);
        if (meta.tier) setIsolatedItem("my_badminton_tier", meta.tier, loginUserId);
        if (meta.age) setIsolatedItem("my_badminton_age", meta.age, loginUserId);
        if (meta.club) setIsolatedItem("my_badminton_club", meta.club, loginUserId);
        if (meta.partner_name) setIsolatedItem("partner_badminton_name", meta.partner_name, loginUserId);
        if (meta.partner_tier) setIsolatedItem("partner_badminton_tier", meta.partner_tier, loginUserId);
        if (meta.partner_age) setIsolatedItem("partner_badminton_age", meta.partner_age, loginUserId);
        if (meta.partner_club) setIsolatedItem("partner_badminton_club", meta.partner_club, loginUserId);

        setTimeout(() => onClose(), 1200);
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ text: err.message || "오류가 발생했습니다.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Profile Save Action for Logged In User
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const updatedMetadata = {
        name: myName.trim(),
        tier: myTier,
        age: myAge,
        club: myClub.trim(),
        partner_name: partnerName.trim(),
        partner_tier: partnerTier,
        partner_age: partnerAge,
        partner_club: partnerClub.trim()
      };

      // 1. Update in Supabase
      if (isSupabaseConfigured && user) {
        const { error } = await supabase!.auth.updateUser({
          data: updatedMetadata
        });
        if (error) throw error;
      }

      // 2. Save in LocalStorage
      setIsolatedItem("my_badminton_name", myName.trim(), user?.id);
      setIsolatedItem("my_badminton_tier", myTier, user?.id);
      setIsolatedItem("my_badminton_age", myAge, user?.id);
      setIsolatedItem("my_badminton_club", myClub.trim(), user?.id);
      
      setIsolatedItem("partner_badminton_name", partnerName.trim(), user?.id);
      setIsolatedItem("partner_badminton_tier", partnerTier, user?.id);
      setIsolatedItem("partner_badminton_age", partnerAge, user?.id);
      setIsolatedItem("partner_badminton_club", partnerClub.trim(), user?.id);

      setMessage({ text: "프로필 정보가 안정적으로 저장되었습니다!", type: "success" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: err.message || "설정 저장 도중 에러가 발생했습니다.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Change Password Action
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) return;
    if (newPassword.length < 6) {
      setPasswordMessage({ text: "비밀번호는 최소 6자리 이상이어야 합니다.", type: "error" });
      return;
    }

    setLoading(true);
    setPasswordMessage(null);

    try {
      const { error } = await supabase!.auth.updateUser({
        password: newPassword.trim()
      });
      if (error) throw error;
      
      setPasswordMessage({ text: "비밀번호가 성공적으로 변경되었습니다!", type: "success" });
      setNewPassword("");
      setTimeout(() => setPasswordMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setPasswordMessage({ text: err.message || "비밀번호 변경 중 오류가 발생했습니다.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Logout Action
  const handleLogout = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      await supabase!.auth.signOut();
      onSessionChange(null);
      setMessage({ text: "로그아웃 되었습니다.", type: "success" });
      setTimeout(() => {
        setMessage(null);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Delete User Account Action (Resets tables on Supabase, removes keys, and logs out)
  const handleDeleteAccount = async () => {
    const confirmWithdraw = window.confirm(
      "정말로 계정을 삭제(탈퇴)하시겠습니까?\n\n이 작업은 복원할 수 없으며, 모든 전적 기록이 소멸합니다!"
    );
    if (!confirmWithdraw) return;

    setLoading(true);
    try {
      if (user && isSupabaseConfigured) {
        // Clear remote match directory rows
        const { error: dbErr } = await supabase!
          .from("matches")
          .delete()
          .eq("user_id", user.id);
        if (dbErr) {
          console.warn("db match row suppression failed:", dbErr);
        }
      }

      // Cleanup local variables
      removeIsolatedItem("my_badminton_name", user?.id);
      removeIsolatedItem("my_badminton_tier", user?.id);
      removeIsolatedItem("my_badminton_age", user?.id);
      removeIsolatedItem("my_badminton_club", user?.id);
      
      removeIsolatedItem("partner_badminton_name", user?.id);
      removeIsolatedItem("partner_badminton_tier", user?.id);
      removeIsolatedItem("partner_badminton_age", user?.id);
      removeIsolatedItem("partner_badminton_club", user?.id);

      if (user) {
        localStorage.removeItem(`badminton_match_records_${user.id}`);
      }
      removeIsolatedItem("badminton_match_records");

      if (isSupabaseConfigured) {
        await supabase!.auth.signOut();
      }
      
      onSessionChange(null);
      alert("탈퇴 완료되었습니다. 저장소가 초기화되었습니다.");
      onClose();
    } catch (err: any) {
      alert("오류가 발생했습니다: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Cancel/Escape modal trigger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fadeIn" 
        onClick={onClose} 
      />

      {/* Modal Box */}
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-250 flex flex-col max-h-[90vh] overflow-hidden animate-slideUp z-10">
        
        {/* Header decoration bar */}
        <div className="h-1 w-full bg-emerald-600 shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <User className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-[13.5px] text-slate-850">
              {user ? "내 프로필 및 설정을 구성합니다" : "SmintonS 서비스 시작하기"}
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body with dynamic views */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
          
          {user ? (
            /* ==========================================
               LOGGED IN SCREEN: PROFILE CONFIG & PW RESET
               ========================================== */
            <div className="space-y-6">
              
              {/* Account email label info banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-450 font-bold block leading-none">로그인 계정</span>
                  <span className="text-xs font-bold text-slate-700 truncate block mt-1">{user.email}</span>
                </div>
                <div className="bg-emerald-50 text-emerald-700 text-[9px] font-extrabold px-2 py-0.5 rounded border border-emerald-150 flex items-center gap-1 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span>실시간 클라우드 동기화 중</span>
                </div>
              </div>

              {message && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  message.type === "success" 
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-100" 
                    : "bg-rose-50 text-rose-800 border border-rose-100"
                }`}>
                  {message.text}
                </div>
              )}

              {/* Editable Profile Information */}
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="border-b border-dashed border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <span className="text-xs font-extrabold text-slate-800">🏸 본인 및 기본 파트너 설정</span>
                  <span className="text-[9.5px] text-slate-400 font-medium">(등록 폼 자동 작성용)</span>
                </div>

                {/* Section: Me info inputs */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[10.5px] font-bold text-slate-650">나의 인적 사항</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-550 mb-1">이름</label>
                      <input
                        type="text"
                        value={myName}
                        onChange={(e) => setMyName(e.target.value)}
                        placeholder="본인 성함"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-350"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-550 mb-1">소속 클럽</label>
                      <input
                        type="text"
                        value={myClub}
                        onChange={(e) => setMyClub(e.target.value)}
                        placeholder="클럽명 또는 모임명"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-350"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-550 mb-1">나의 급수</label>
                      <select
                        value={myTier}
                        onChange={(e) => setMyTier(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none"
                      >
                        <option value="미정">미정</option>
                        <option value="S조">S조</option>
                        <option value="A조">A조</option>
                        <option value="B조">B조</option>
                        <option value="C조">C조</option>
                        <option value="D조">D조</option>
                        <option value="초심">초심</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-550 mb-1">연령층</label>
                      <select
                        value={myAge}
                        onChange={(e) => setMyAge(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none"
                      >
                        <option value="미정">미정</option>
                        <option value="20대">20대</option>
                        <option value="30대">30대</option>
                        <option value="40대">40대</option>
                        <option value="50대">50대</option>
                        <option value="60대 이상">60대 이상</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section: Partner info inputs */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[10.5px] font-bold text-slate-650">대표 파트너 인적 사항</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-550 mb-1">파트너 이름</label>
                      <input
                        type="text"
                        value={partnerName}
                        onChange={(e) => setPartnerName(e.target.value)}
                        placeholder="파트너 성함"
                        className="w-full bg-slate-50 border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-350"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-550 mb-1">파트너 클럽</label>
                      <input
                        type="text"
                        value={partnerClub}
                        onChange={(e) => setPartnerClub(e.target.value)}
                        placeholder="파트너 소속 클럽명"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-350"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-550 mb-1">파트너 급수</label>
                      <select
                        value={partnerTier}
                        onChange={(e) => setPartnerTier(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none"
                      >
                        <option value="미정">미정</option>
                        <option value="S조">S조</option>
                        <option value="A조">A조</option>
                        <option value="B조">B조</option>
                        <option value="C조">C조</option>
                        <option value="D조">D조</option>
                        <option value="초심">초심</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-550 mb-1">파트너 연령층</label>
                      <select
                        value={partnerAge}
                        onChange={(e) => setPartnerAge(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none"
                      >
                        <option value="미정">미정</option>
                        <option value="20대">20대</option>
                        <option value="30대">30대</option>
                        <option value="40대">40대</option>
                        <option value="50대">50대</option>
                        <option value="60대 이상">60대 이상</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>프로필 정보 업데이트</span>
                  </button>
                </div>
              </form>

              {/* Password update subsection */}
              <form onSubmit={handleUpdatePassword} className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-extrabold text-slate-700">🔐 계정 비밀번호 변경</span>
                </div>
                
                {passwordMessage && (
                  <div className={`p-2.5 rounded-lg text-[10.5px] font-medium ${
                    passwordMessage.type === "success" 
                      ? "bg-emerald-5px text-emerald-800 border border-emerald-100" 
                      : "bg-rose-50 text-rose-800 border border-rose-100"
                  }`}>
                    {passwordMessage.text}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="새로운 비밀번호 입력 (6자리 이상)"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none placeholder:text-slate-350"
                  />
                  <button
                    type="submit"
                    disabled={loading || !newPassword}
                    className="px-3.5 py-1.5 bg-slate-150 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    변경
                  </button>
                </div>
              </form>

              {/* Bottom danger action buttons */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-5 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className="px-3.5 py-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>계정 영구탈퇴 및 삭제</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loading}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 font-bold text-xs rounded-lg flex items-center gap-1.5 text-slate-650 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>로그아웃</span>
                </button>
              </div>

            </div>
          ) : (
            /* ==========================================
               LOGGED OUT SCREEN: SIMPLE SIGN IN & DETAILED SIGN UP
               ========================================== */
            <form onSubmit={handleAuth} className="space-y-4">
              
              {message && (
                <div className={`p-3 rounded-lg text-xs leading-normal font-semibold ${
                  message.type === "success" 
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-100" 
                    : "bg-rose-50 text-rose-800 border border-rose-100"
                }`}>
                  {message.text}
                </div>
              )}

              {/* Login Email, Password Inputs always visible */}
              <div className="space-y-2.5">
                <div className="border-b border-slate-100 pb-1 flex items-center gap-1">
                  <Star className="w-3 h-3 text-emerald-600" />
                  <span className="text-[11px] font-bold text-slate-550">이메일 계정 정보</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="이메일 주소"
                      disabled={loading}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8.5 pr-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:bg-white placeholder:text-slate-400"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="비밀번호"
                      disabled={loading}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8.5 pr-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:bg-white placeholder:text-slate-400"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* ONBOARDING FLOW: Additional profile questions if logging in for SignUp */}
              {isSignUp && (
                <div className="space-y-4 pt-2.5 border-t border-slate-100 animate-slideDown">
                  
                  {/* Category Title: My Profile */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[11px] font-extrabold text-slate-700">본인의 인적사항 (가입시 입력 원치 않으면 비워두셔도 됩니다)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pb-1">
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-400 mb-1">본인 이름 *</label>
                        <input
                          type="text"
                          value={myName}
                          onChange={(e) => setMyName(e.target.value)}
                          placeholder="예: 강정훈"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-400 mb-1">소속 클럽</label>
                        <input
                          type="text"
                          value={myClub}
                          onChange={(e) => setMyClub(e.target.value)}
                          placeholder="소속 배드민턴 클럽"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-400 mb-1">본인 급수</label>
                        <select
                          value={myTier}
                          onChange={(e) => setMyTier(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 px-2 py-1.2 rounded-lg text-xs"
                        >
                          <option value="미정">미정</option>
                          <option value="S조">S조</option>
                          <option value="A조">A조</option>
                          <option value="B조">B조</option>
                          <option value="C조">C조</option>
                          <option value="D조">D조</option>
                          <option value="초심">초심</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-400 mb-1">연령층</label>
                        <select
                          value={myAge}
                          onChange={(e) => setMyAge(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 px-2 py-1.2 rounded-lg text-xs"
                        >
                          <option value="미정">미정</option>
                          <option value="20대">20대</option>
                          <option value="30대 font-medium">30대</option>
                          <option value="40대">40대</option>
                          <option value="50대">50대</option>
                          <option value="60대 이상">60대 이상</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Category Title: Team partner */}
                  <div className="pt-1.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users className="w-3.5 h-3.5 text-slate-550" />
                      <span className="text-[11px] font-extrabold text-slate-700">대표 파트너 사항 (언제든 변경 가능)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pb-1">
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-400 mb-1">파트너 성함</label>
                        <input
                          type="text"
                          value={partnerName}
                          onChange={(e) => setPartnerName(e.target.value)}
                          placeholder="파트너 성함"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-400 mb-1">파트너 클럽</label>
                        <input
                          type="text"
                          value={partnerClub}
                          onChange={(e) => setPartnerClub(e.target.value)}
                          placeholder="파트너 소속 클럽"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-850 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-400 mb-1">파트너 급수</label>
                        <select
                          value={partnerTier}
                          onChange={(e) => setPartnerTier(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 px-2 py-1.2 rounded-lg text-xs"
                        >
                          <option value="미정">미정</option>
                          <option value="S조">S조</option>
                          <option value="A조">A조</option>
                          <option value="B조">B조</option>
                          <option value="C조">C조</option>
                          <option value="D조">D조</option>
                          <option value="초심">초심</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-400 mb-1">파트너 연령층</label>
                        <select
                          value={partnerAge}
                          onChange={(e) => setPartnerAge(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 px-2 py-1.2 rounded-lg text-xs"
                        >
                          <option value="미정">미정</option>
                          <option value="20대">20대</option>
                          <option value="30대">30대</option>
                          <option value="40대">40대</option>
                          <option value="50대">50대</option>
                          <option value="60대 이상">60대 이상</option>
                        </select>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Submit triggers and mode toggles */}
              <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setMessage(null);
                  }}
                  className="text-[10px] text-slate-500 hover:text-slate-800 font-bold transition-all underline cursor-pointer"
                >
                  {isSignUp ? "이미 계정이 있으신가요? 로그인하기" : "처음 사용하시나요? 3초 빠른 회원가입하기"}
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSignUp ? "프로필 작성 후 가입 완료" : "입력하고 로그인 완료"}</span>
                </button>
              </div>

            </form>
          )}

        </div>
      </div>
    </div>
  );
}
