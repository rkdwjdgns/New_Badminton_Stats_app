/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { MatchRecord } from "../types";
import { 
  Search, 
  Trash2, 
  Edit3, 
  ShieldAlert,
  Share2,
  X,
} from "lucide-react";
import { getIsolatedItem, getIsolatedKey, setIsolatedItem } from "../utils";

interface SmintonsPhotoSaverPlugin {
  savePng(options: { base64Data: string; fileName: string }): Promise<{ uri: string; fileName: string }>;
}

const SmintonsPhotoSaver = registerPlugin<SmintonsPhotoSaverPlugin>("SmintonsPhotoSaver");
const TOURNAMENT_IMAGES_KEY = "badminton_tournament_images";
const TOURNAMENT_IMAGE_DB_NAME = "smintons_tournament_assets";
const TOURNAMENT_IMAGE_STORE_NAME = "poster_images";

type TournamentImage = { url: string; offsetY: number };

const openTournamentImageDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(TOURNAMENT_IMAGE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TOURNAMENT_IMAGE_STORE_NAME)) {
        db.createObjectStore(TOURNAMENT_IMAGE_STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const getStoredTournamentImages = async (userId?: string) => {
  const db = await openTournamentImageDb();
  const keyPrefix = `${getIsolatedKey(TOURNAMENT_IMAGES_KEY, userId)}::`;

  return new Promise<Record<string, TournamentImage>>((resolve, reject) => {
    const transaction = db.transaction(TOURNAMENT_IMAGE_STORE_NAME, "readonly");
    const store = transaction.objectStore(TOURNAMENT_IMAGE_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const images: Record<string, TournamentImage> = {};
      (request.result || []).forEach((item: any) => {
        if (typeof item?.key === "string" && item.key.startsWith(keyPrefix)) {
          const tournamentName = item.key.slice(keyPrefix.length);
          images[tournamentName] = { url: item.url, offsetY: item.offsetY };
        }
      });
      resolve(images);
    };
    request.onerror = () => reject(request.error);
  });
};

const saveStoredTournamentImage = async (userId: string | undefined, tournamentName: string, image: TournamentImage) => {
  const db = await openTournamentImageDb();
  const key = `${getIsolatedKey(TOURNAMENT_IMAGES_KEY, userId)}::${tournamentName}`;

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(TOURNAMENT_IMAGE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(TOURNAMENT_IMAGE_STORE_NAME);
    const request = image.url
      ? store.put({ key, tournamentName, url: image.url, offsetY: image.offsetY })
      : store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const removeLegacyTournamentImages = (userId?: string) => {
  try {
    localStorage.removeItem(getIsolatedKey(TOURNAMENT_IMAGES_KEY, userId));
    localStorage.removeItem(getIsolatedKey(TOURNAMENT_IMAGES_KEY));
    localStorage.removeItem(TOURNAMENT_IMAGES_KEY);
  } catch (err) {
    console.error("Failed to remove legacy tournament poster cache:", err);
  }
};

interface MatchListProps {
  records: MatchRecord[];
  onDelete: (id: string) => void;
  onEditToggle: (record: MatchRecord) => void;
  user?: any;
}

export default function MatchList({ records, onDelete, onEditToggle, user }: MatchListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [resultFilter, setResultFilter] = useState<"ALL" | "WIN" | "LOSE">("ALL");
  const [filterType, setFilterType] = useState<"ALL" | "전국" | "지역" | "TOURNAMENT">("ALL");
  const [selectedTournament, setSelectedTournament] = useState<string>("ALL_TOURNAMENTS");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [stickerImageUrl, setStickerImageUrl] = useState<string | null>(null);
  const [stickerSaveMessage, setStickerSaveMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [tournamentRanks, setTournamentRanks] = useState<Record<string, string>>(() => {
    try {
      const data = getIsolatedItem("badminton_tournament_ranks", user?.id);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  });

  const loadLegacyTournamentImages = (userId?: string) => {
    try {
      const data = getIsolatedItem(TOURNAMENT_IMAGES_KEY, userId);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  };

  const [tournamentImages, setTournamentImages] = useState<Record<string, TournamentImage>>(() =>
    loadLegacyTournamentImages(user?.id)
  );

  // Re-sync ranks and images dynamically when the logged-in user changes
  useEffect(() => {
    try {
      const data = getIsolatedItem("badminton_tournament_ranks", user?.id);
      setTournamentRanks(data ? JSON.parse(data) : {});
    } catch {
      setTournamentRanks({});
    }

    let isMounted = true;
    const legacyImages = loadLegacyTournamentImages(user?.id);
    setTournamentImages(legacyImages);

    getStoredTournamentImages(user?.id)
      .then(async (storedImages) => {
        if (!isMounted) return;

        const mergedImages = { ...legacyImages, ...storedImages };
        setTournamentImages(mergedImages);

        if (Object.keys(legacyImages).length > 0) {
          await Promise.all(
            Object.entries(legacyImages).map(([tName, image]) =>
              saveStoredTournamentImage(user?.id, tName, image as TournamentImage)
            )
          );
          removeLegacyTournamentImages(user?.id);
        }
      })
      .catch((err) => {
        console.error("Failed to load tournament poster images:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const [showRankSelector, setShowRankSelector] = useState(false);

  const handleSaveRank = (tName: string, rank: string) => {
    const updated = { ...tournamentRanks, [tName]: rank };
    setTournamentRanks(updated);
    setIsolatedItem("badminton_tournament_ranks", JSON.stringify(updated), user?.id);
  };

  const handleSaveTournamentImage = async (tName: string, url: string, offsetY: number) => {
    const updated = { ...tournamentImages, [tName]: { url, offsetY } };
    setTournamentImages(updated);
    try {
      await saveStoredTournamentImage(user?.id, tName, { url, offsetY });
      removeLegacyTournamentImages(user?.id);
    } catch (err) {
      console.error("Failed to save tournament poster image:", err);
      alert("포스터 사진을 저장하지 못했습니다. 사진 용량을 줄여서 다시 올려주세요.");
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, tName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      handleSaveTournamentImage(tName, base64String, 50);
    };
    reader.readAsDataURL(file);
  };

  const getStickerFileName = (tournamentName: string) =>
    `${tournamentName.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_")}_인스타_인증스티커.png`;

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("이미지 데이터를 읽을 수 없습니다."));
          return;
        }
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = () => reject(reader.error || new Error("이미지 데이터를 읽을 수 없습니다."));
      reader.readAsDataURL(blob);
    });

  const triggerBrowserDownload = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveStickerImage = async (blob: Blob, imageUrl: string, fileName: string) => {
    setStickerSaveMessage(null);

    if (Capacitor.isNativePlatform()) {
      try {
        const base64Data = await blobToBase64(blob);
        await SmintonsPhotoSaver.savePng({ base64Data, fileName });
        setStickerSaveMessage({
          text: "갤러리에 저장했습니다. 사진 앱의 SmintonS 폴더를 확인해 주세요.",
          type: "success",
        });
        return;
      } catch (nativeError) {
        console.error("Native gallery save failed:", nativeError);
        setStickerSaveMessage({
          text: "갤러리 저장에 실패했습니다. 대회 인증 버튼을 다시 눌러 주세요.",
          type: "error",
        });
        return;
      }
    }

    try {
      triggerBrowserDownload(imageUrl, fileName);
      setStickerSaveMessage({
        text: "이미지 다운로드를 시작했습니다.",
        type: "success",
      });
    } catch (downloadError) {
      console.error("Browser download failed:", downloadError);
      setStickerSaveMessage({
        text: "자동 다운로드가 막혔습니다.",
        type: "error",
      });
    }
  };

  const handleDownloadInstagramSticker = (
    tournamentName: string,
    rank: string,
    recordsList: MatchRecord[]
  ) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear background for perfect transparency (as requested)
    ctx.clearRect(0, 0, 1080, 1920);

    // Styled purely in Black as requested (스티커 형태로 올리기 위해 검정색 위주 사용)
    const color = "#000000";
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    // Layout configuration
    const cardX = 120;
    const cardY = 260;
    const cardWidth = 840;
    const cardHeight = 1400;
    const radius = 40;

    const drawRoundedRect = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
      fill = false,
      stroke = true
    ) => {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r);
      c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h);
      c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r);
      c.quadraticCurveTo(x, y, x + r, y);
      c.closePath();
      if (fill) c.fill();
      if (stroke) c.stroke();
    };

    // Design: Double lines border for brutalist/premium layout
    // Outer Frame
    ctx.lineWidth = 6;
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, radius, false, true);

    // Inner Frame (16px offset)
    ctx.lineWidth = 2;
    drawRoundedRect(
      ctx,
      cardX + 16,
      cardY + 16,
      cardWidth - 32,
      cardHeight - 32,
      radius - 12,
      false,
      true
    );

    // Corner Deco Icons (Star sparkles for luxury feel)
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✦", cardX + 50, cardY + 50);
    ctx.fillText("✦", cardX + cardWidth - 50, cardY + 50);
    ctx.fillText("✦", cardX + 50, cardY + cardHeight - 50);
    ctx.fillText("✦", cardX + cardWidth - 50, cardY + cardHeight - 50);

    // Header Badge Label
    ctx.font = "900 24px sans-serif";
    ctx.fillText("✦ TOURNAMENT ARCHIVE ✦", 540, cardY + 95);

    // Splitter line with single diamond symbol
    ctx.beginPath();
    ctx.moveTo(cardX + 100, cardY + 150);
    ctx.lineTo(cardX + cardWidth - 100, cardY + 150);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "bold 20px sans-serif";
    ctx.fillText("◆", 540, cardY + 150);

    // Tournament Name Wrap Drawing
    ctx.font = "900 44px sans-serif";
    ctx.textAlign = "center";
    const textX = 540;
    const startY = cardY + 240;
    const maxWidth = 640;
    const lineHeight = 60;

    const words = tournamentName.split("");
    let line = "";
    let currentY = startY;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, textX, currentY);
        line = words[n];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, textX, currentY);

    // Rank Medal centerpiece with 3D colorful ribbon style (as requested!)
    const rankY = currentY + 130;
    
    // Distressed stamp ink texture helper that punches tiny transparent holes out of stamp
    const applyStampTexture = (c: CanvasRenderingContext2D, centerOffset: number) => {
      c.save();
      c.globalCompositeOperation = "destination-out";
      c.fillStyle = "rgba(0,0,0,1)";
      
      // Draw several random small air bubble gaps / dry ink spots
      const numSpots = 16;
      for (let i = 0; i < numSpots; i++) {
        // Pseudo-random coordinates centered around (0,0) with bounded range
        const rx = (Math.sin(i * 98.7) * 45) % centerOffset;
        const ry = (Math.cos(i * 37.4) * 45) % centerOffset;
        const radius = 0.5 + Math.abs(Math.sin(i * 12.3)) * 1.5;
        c.beginPath();
        c.arc(rx, ry, radius, 0, Math.PI * 2);
        c.fill();
      }

      // Draw subtle cracks to simulate a worn woodcarved or rubber stamp edge
      c.strokeStyle = "rgba(0,0,0,1)";
      const numLines = 3;
      for (let i = 0; i < numLines; i++) {
        const lx = (Math.sin(i * 64.2) * 50) % centerOffset;
        const ly = (Math.cos(i * 19.8) * 50) % centerOffset;
        const angle = i * 2.3;
        const length = 4 + Math.abs(Math.sin(i * 91.1)) * 10;
        c.beginPath();
        c.lineWidth = 0.5 + Math.abs(Math.sin(i * 5.4)) * 0.8;
        c.moveTo(lx, ly);
        c.lineTo(lx + Math.cos(angle) * length, ly + Math.sin(angle) * length);
        c.stroke();
      }
      c.restore();
    };

    const drawSerratedMedal = (
      c: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      rankText: string
    ) => {
      // Determine vibrant, luxury metallic colors based on rank
      let mainColor = "#FBBF24";     // Primary gold
      let lightColor = "#FEF08A";    // Glowing gold reflection
      let darkColor = "#B45309";     // Heavy gold shadow
      let ribbonColor = "#DC2626";   // Crimson red center ribbon
      let ribbonAccent = "#FBBF24";  // Gold ribbon edges
      let inscription = "참가"; 

      if (rankText.includes("1등") || rankText.includes("1위") || rankText.includes("우승")) {
        mainColor = "#FBBF24";     // Ultra Shiny Gold
        lightColor = "#FFFDF0";    // Crystal white reflection
        darkColor = "#92400E";     // Deep antique gold
        ribbonColor = "#E11D48";   // Rose red ribbon
        ribbonAccent = "#FBBF24";  // Gold trim
        inscription = "1위";
      } else if (rankText.includes("2등") || rankText.includes("2위") || rankText.includes("준우승")) {
        mainColor = "#CBD5E1";     // High-gloss Silver
        lightColor = "#F8FAFC";    // Pure white reflection
        darkColor = "#475569";     // Heavy gunmetal slate
        ribbonColor = "#2563EB";   // Royal blue ribbon
        ribbonAccent = "#E2E8F0";  // Shiny silver trim
        inscription = "2위";
      } else if (rankText.includes("3등") || rankText.includes("3위")) {
        mainColor = "#F97316";     // Polished Bronze / Copper
        lightColor = "#FFedd5";    // Sandy bronze reflection
        darkColor = "#9A3412";     // Rich deep terracota shadow
        ribbonColor = "#059669";   // Jade emerald green ribbon
        ribbonAccent = "#FDBA74";  // Coppery bronze trim
        inscription = "3위";
      } else if (rankText.includes("4등") || rankText.includes("4위")) {
        mainColor = "#A855F7";     // Royal Violet Purple
        lightColor = "#FAF5FF";    // Light lavender glow
        darkColor = "#581C87";     // Deep indigo shadow
        ribbonColor = "#EC4899";   // Pink magenta ribbon
        ribbonAccent = "#E9D5FF";  // Pale purple trim
        inscription = "4위";
      } else if (rankText.includes("예선") || rankText.includes("탈락") || rankText.includes("예탈")) {
        mainColor = "#EC4899";     // Rose/Coral Metal
        lightColor = "#FFF1F2";    // Soft pink reflection
        darkColor = "#9F1239";     // Dark crimson shadow
        ribbonColor = "#4B5563";   // Dark iron gray ribbon
        ribbonAccent = "#FDA4AF";  // Salmon pink trim
        inscription = "예탈";
      } else {
        // Defaults to "참가 완료"
        mainColor = "#14B8A6";     // Bright Teal
        lightColor = "#F0FDFA";    // Aqua white glow
        darkColor = "#115E59";     // Pine forest shadow
        ribbonColor = "#F59E0B";   // Amber ribbon
        ribbonAccent = "#99F6E4";  // Mint teal trim
        inscription = "참가";
      }

      c.save();
      c.translate(cx, cy);

      // 1. Draw Ornate 3-Dimensional Ribbon Tails Behind Medal
      const drawRibbonTail = (offsetX: number, angle: number, ribbonCol: string, accentCol: string) => {
        c.save();
        c.translate(offsetX, 10);
        c.rotate(angle);

        // Main Ribbon background shadow
        c.fillStyle = "rgba(0, 0, 0, 0.15)";
        c.beginPath();
        c.moveTo(-24, 0);
        c.lineTo(24, 0);
        c.lineTo(34, 115);
        c.lineTo(-4, 98);
        c.lineTo(-34, 115);
        c.closePath();
        c.fill();

        // Main Ribbon base
        c.fillStyle = ribbonCol;
        c.beginPath();
        c.moveTo(-20, 0);
        c.lineTo(20, 0);
        c.lineTo(30, 110);
        c.lineTo(0, 95);
        c.lineTo(-30, 110);
        c.closePath();
        c.fill();

        // Left & Right premium gold/trim stripes on ribbon
        c.fillStyle = accentCol;
        c.beginPath();
        c.moveTo(-20, 0);
        c.lineTo(-14, 0);
        c.lineTo(-24, 110);
        c.lineTo(-30, 110);
        c.closePath();
        c.fill();

        c.beginPath();
        c.moveTo(14, 0);
        c.lineTo(20, 0);
        c.lineTo(30, 110);
        c.lineTo(24, 110);
        c.closePath();
        c.fill();

        c.restore();
      };

      // Draw left & right overlapping ribbon tails
      drawRibbonTail(-26, -0.16, ribbonColor, ribbonAccent);
      drawRibbonTail(26, 0.16, ribbonColor, ribbonAccent);

      // 2. Double 24-point Ornate Rosette Star-burst (뾰족뾰족 메달 테두리 - Super Gorgeous & Rich Detail!)
      const points = 24;
      const rOuter = 82;
      const rInner = 69;

      // Draw background outer bronze shadow of the starburst
      c.fillStyle = darkColor;
      c.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? rOuter + 2 : rInner + 2;
        const angle = (i * Math.PI) / points;
        c.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      c.closePath();
      c.fill();

      // Create rich metal linear gradient across medal surface
      const metalGrad = c.createLinearGradient(-80, -80, 80, 80);
      metalGrad.addColorStop(0, mainColor);
      metalGrad.addColorStop(0.25, lightColor); // glistening metallic reflection
      metalGrad.addColorStop(0.5, mainColor);
      metalGrad.addColorStop(0.75, darkColor);
      metalGrad.addColorStop(1, mainColor);

      // Base Starburst
      c.fillStyle = metalGrad;
      c.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? rOuter : rInner;
        const angle = (i * Math.PI) / points;
        c.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      c.closePath();
      c.fill();

      // Inner Starburst bezel ring outline for sharp contrast
      c.strokeStyle = darkColor;
      c.lineWidth = 1.6;
      c.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? rOuter - 4 : rInner - 4;
        const angle = (i * Math.PI) / points;
        c.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      c.closePath();
      c.stroke();

      // 3. Central Rounded Gold Bezel Core Disc
      const discGrad = c.createRadialGradient(-16, -16, 8, 0, 0, 52);
      discGrad.addColorStop(0, lightColor);
      discGrad.addColorStop(0.4, mainColor);
      discGrad.addColorStop(1, darkColor);

      c.fillStyle = discGrad;
      c.beginPath();
      c.arc(0, 0, 52, 0, Math.PI * 2);
      c.fill();

      // Inner stroke for beautiful stamp-like bezel
      c.strokeStyle = "#FFFFFF";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, 46, 0, Math.PI * 2);
      c.stroke();

      c.strokeStyle = darkColor;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(0, 0, 42, 0, Math.PI * 2);
      c.stroke();

      // 4. Detailed Victory Laurel Leaf Wreath wrapped around the rating inscription inside (Extremely cool look!)
      c.strokeStyle = darkColor;
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(0, 4, 33, Math.PI * 0.22, Math.PI * 0.88); // Left laurel stem
      c.stroke();
      c.beginPath();
      c.arc(0, 4, 33, Math.PI * 0.78, Math.PI * 0.12, true); // Right laurel stem
      c.stroke();

      // Draw leaf pairs along the stems
      c.fillStyle = darkColor;
      for (let theta = Math.PI * 0.16; theta <= Math.PI * 0.84; theta += 0.14) {
        // Left leaves
        const lx = Math.cos(theta) * 33;
        const ly = 4 + Math.sin(theta) * 33;
        c.save();
        c.translate(lx, ly);
        c.rotate(theta + Math.PI / 3.8);
        c.beginPath();
        c.ellipse(0, 0, 6, 2.8, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      for (let theta = Math.PI * 0.84; theta >= Math.PI * 0.16; theta -= 0.14) {
        // Right leaves
        const rx = Math.cos(theta) * -33;
        const ry = 4 + Math.sin(theta) * 33;
        c.save();
        c.translate(rx, ry);
        c.rotate(-theta - Math.PI / 3.8);
        c.beginPath();
        c.ellipse(0, 0, 6, 2.8, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }

      // 5. Inscription text (Bold athletic serif design feel)
      c.fillStyle = "#0F172A"; // Rich deep navy charcoal
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = "900 32px 'Impact', 'Arial Black', sans-serif";
      
      // Draw subtle text shadow or double text offset for 3D embossed look
      c.fillStyle = "rgba(0,0,0,0.25)";
      c.fillText(inscription, 1, 2);
      c.fillStyle = "#0F172A";
      c.fillText(inscription, 0, 0);

      // Star above and below
      c.fillStyle = darkColor;
      c.font = "bold 9px sans-serif";
      c.fillText("★", 0, -20);
      c.fillText("★", 0, 20);

      c.restore();
    };

    drawSerratedMedal(ctx, 540, rankY, rank);

    // Sub separator before results section
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 140, rankY + 140);
    ctx.lineTo(cardX + cardWidth - 140, rankY + 140);
    ctx.stroke();

    // Match section layout
    const matchesTitleY = rankY + 195;
    ctx.fillStyle = "#000000";
    ctx.font = "900 24px sans-serif";
    ctx.fillText("MATCH LOGS", 540, matchesTitleY);

    let startMatchY = matchesTitleY + 80;

    if (recordsList.length === 0) {
      ctx.font = "italic 28px sans-serif";
      ctx.fillStyle = "#555555";
      ctx.fillText("등록된 경기 전적이 없습니다.", 540, startMatchY + 40);
    } else {
      recordsList.forEach((r, idx) => {
        if (idx >= 6) return; // limit to 6 matches so stickers stay neat & uncluttered

        const { our, opp } = parseScore(r.score);

        // Layout: Match label (Left), Scores (Center)
        ctx.fillStyle = "#000000";
        ctx.textAlign = "left";
        ctx.font = "900 28px sans-serif";
        ctx.fillText(`제 ${idx + 1}경기`, cardX + 110, startMatchY + 4);

        ctx.textAlign = "center";
        ctx.font = "900 32px sans-serif";
        ctx.fillText(`${our} : ${opp}`, 540, startMatchY + 4);

        // Stamp for Match Outcome (승 = Red Round Seal, 패 = Blue Square Seal) as requested!
        ctx.save();
        const stampX = cardX + cardWidth - 150;
        const stampY = startMatchY;
        ctx.translate(stampX, stampY);
        // Slightly rotate each stamp dynamically representing manual high-quality stamping
        const stampAngle = (((idx * 17) % 3) - 1) * 0.14; 
        ctx.rotate(stampAngle);

        if (r.result === "WIN") {
          const redColor = "#E11D48"; // Vivid Red Ink stamp
          ctx.strokeStyle = redColor;
          ctx.fillStyle = redColor;
          
          // Outer thick circle
          ctx.lineWidth = 3.6;
          ctx.beginPath();
          ctx.arc(0, 0, 26, 0, Math.PI * 2);
          ctx.stroke();

          // Inner thin circle
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(0, 0, 21, 0, Math.PI * 2);
          ctx.stroke();

          // Inner stars
          ctx.font = "bold 9px sans-serif";
          ctx.fillText("★", -13, -1);
          ctx.fillText("★", 13, -1);

          // Center '승' text with traditional wood block style serif typeface
          ctx.font = "900 25px 'Nanum Myeongjo', 'Batang', 'Times New Roman', serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("승", 0, 1);

          // Apply authentic ink weathering stamp texture!
          applyStampTexture(ctx, 42);
        } else {
          const blueColor = "#1D4ED8"; // Vivid Indigo Blue Ink stamp
          ctx.strokeStyle = blueColor;
          ctx.fillStyle = blueColor;

          // Double octagonal border/seal
          ctx.lineWidth = 3.6;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const x = Math.cos(angle) * 26;
            const y = Math.sin(angle) * 26;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();

          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const x = Math.cos(angle) * 21;
            const y = Math.sin(angle) * 21;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();

          // Inner dots
          ctx.font = "bold 9px sans-serif";
          ctx.fillText("●", -13, -1);
          ctx.fillText("●", 13, -1);

          // Center '패' text
          ctx.font = "900 25px 'Nanum Myeongjo', 'Batang', 'Times New Roman', serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("패", 0, 1);

          // Apply authentic ink weathering stamp texture!
          applyStampTexture(ctx, 42);
        }
        ctx.restore();

        startMatchY += 82; // spacing
      });

      if (recordsList.length > 6) {
        ctx.textAlign = "center";
        ctx.font = "bold 20px sans-serif";
        ctx.fillStyle = "#555555";
        ctx.fillText(`* 총 ${recordsList.length}경기 중 상위 6경기만 노출`, 540, startMatchY + 5);
      }
    }

    // Beautiful traditional "SmintonS 공식인증" stamp on the bottom.
    const drawCertificationStamp = (
      c: CanvasRenderingContext2D,
      cx: number,
      cy: number
    ) => {
      c.save();
      c.translate(cx, cy);
      c.rotate(-0.06); // manual hand-press aesthetic angle

      const stampColor = "#DC2626"; // Beautiful Vermilion Seal stamp Red
      c.strokeStyle = stampColor;
      c.fillStyle = stampColor;

      // 1. Draw outer heavy frame square
      c.lineWidth = 5.5;
      drawRoundedRect(c, -114, -50, 228, 100, 13, false, true);

      // 2. Draw inner thin boundary line
      c.lineWidth = 1.6;
      drawRoundedRect(c, -106, -42, 212, 84, 8, false, true);

      // Dividing stamp line
      c.beginPath();
      c.moveTo(-104, 4);
      c.lineTo(104, 4);
      c.stroke();

      // Top text: SmintonS Brand
      c.font = "900 23px 'Impact', 'Arial Black', sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("SmintonS", 0, -18);

      // Bottom text: 공식인증 in gorgeous traditional korean font
      c.font = "900 20px 'Nanum Myeongjo', 'Batang', 'Times New Roman', serif";
      c.fillText("공 식 인 증", 0, 26);

      // Left & right cosmetic stars
      c.font = "bold 13px sans-serif";
      c.fillText("★", -76, -18);
      c.fillText("★", 76, -18);

      // Apply realistic woodcarved weathering stamp texture!
      applyStampTexture(c, 110);

      c.restore();
    };

    // Draw Certification Stamp at the absolute bottom center (safely inside the card)
    drawCertificationStamp(ctx, 540, cardY + cardHeight - 165);

    // Elegant Footer Branding
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.font = "900 20px sans-serif";
    ctx.fillText("MATCH RECORD ✦ SMINTONS BADMINTON CLUB", 540, cardY + cardHeight - 85);

    // Convert canvas to lightweight Blob URL to avoid mega-Base64 lag and enable flawless mobile saving / long-press menus
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          alert("이미지 스티커 파일 생성에 실패했습니다.");
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const filename = getStickerFileName(tournamentName);

        // Clean up previous blob URL if any to prevent memory leaks
        if (stickerImageUrl && stickerImageUrl.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(stickerImageUrl);
          } catch (e) {
            console.error("Failed to revoke blob URL", e);
          }
        }

        setStickerImageUrl(url);
        setShowStickerModal(true);

        void saveStickerImage(blob, url, filename);
      }, "image/png");
    } catch (err) {
      console.error("Failed to generate image sticker blob:", err);
      alert("이미지 스티커 정보 생성 도중 에러가 발생했습니다.");
    }
  };

  const handleCloseStickerModal = () => {
    setShowStickerModal(false);
    if (stickerImageUrl && stickerImageUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(stickerImageUrl);
      } catch (e) {
        console.error("Failed revoking on close", e);
      }
    }
    setStickerImageUrl(null);
    setStickerSaveMessage(null);
  };

  const parseScore = (scoreStr: string) => {
    if (!scoreStr) return { our: 0, opp: 0 };
    const cleaned = scoreStr.replace("-", ":").replace(/\s/g, "");
    if (cleaned.includes(":")) {
      const parts = cleaned.split(":");
      const our = parseInt(parts[0], 10);
      const opp = parseInt(parts[1], 10);
      return {
        our: isNaN(our) ? 0 : our,
        opp: isNaN(opp) ? 0 : opp
      };
    }
    const val = parseInt(cleaned, 10);
    return { our: isNaN(val) ? 0 : val, opp: 0 };
  };

  const calculateMatchRating = (scoreStr: string, isWin: boolean): number => {
    const { our, opp } = parseScore(scoreStr);
    if (our === 0 && opp === 0) return 80;
    
    if (isWin) {
      if (opp === 0) return 100;
      const scoreDiff = our - opp;
      if (scoreDiff >= 15) return 100;
      const val = 90 + Math.min(10, Math.floor((scoreDiff / our) * 15));
      return Math.min(100, Math.max(90, val));
    } else {
      const scoreDiff = opp - our;
      if (scoreDiff === 1) return 99; // Lost by 1 point! "딱 한판 1점때문에 아쉽게 졌으면 99점"
      if (scoreDiff === 2) return 95;
      if (scoreDiff === 3) return 90;
      const ratio = our / opp;
      const val = 35 + Math.floor(ratio * 50);
      return Math.min(88, Math.max(30, val));
    }
  };

  const myName = getIsolatedItem("my_badminton_name", user?.id) || "나";

  // Filter records based on search, selected result, and selected tournament/type
  const filteredRecords = records.filter((r) => {
    // 1. Search filter: match opponent, club, partner, tournament
    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      !searchLower ||
      r.opponent.name.toLowerCase().includes(searchLower) ||
      (r.opponent.name2 && r.opponent.name2.toLowerCase().includes(searchLower)) ||
      r.opponent.club.toLowerCase().includes(searchLower) ||
      r.partner.toLowerCase().includes(searchLower) ||
      r.tournament_name.toLowerCase().includes(searchLower);

    // 2. Result filter
    const matchesResult = resultFilter === "ALL" || r.result === resultFilter;

    // 3. Tournament type and specific name filter
    let matchesTournament = true;
    if (filterType === "전국") {
      matchesTournament = r.tournament_type === "전국";
    } else if (filterType === "지역") {
      matchesTournament = r.tournament_type === "지역";
    } else if (filterType === "TOURNAMENT") {
      const currentTourneyName = r.tournament_name?.trim() || "정기 훈련";
      matchesTournament = 
        selectedTournament === "ALL_TOURNAMENTS" || 
        currentTourneyName === selectedTournament;
    }

    return matchesSearch && matchesResult && matchesTournament;
  });

  // Extract unique tournaments list with match counts
  const activeTournaments = Array.from(
    new Set(records.map((r) => r.tournament_name?.trim() || "정기 훈련"))
  ).filter(Boolean);

  return (
    <div className="space-y-3.5">
      
      {/* Search and Filters Strip - Hidden on specific tournament detail view */}
      {(filterType !== "TOURNAMENT" || selectedTournament === "ALL_TOURNAMENTS") && (
        <div className="bg-white border border-slate-200/90 p-4 rounded-xl shadow-xs space-y-3 font-sans">
          
          {/* Search Input */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="상대 이름, 소속 클럽, 파트너, 또는 대회명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-400 text-slate-800"
            />
          </div>

          {/* Minimal Filters Row (No vertical stacked text blocks) */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1 text-xs justify-between sm:items-center">
            {/* Result Filter */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg w-full sm:w-auto">
              {(["ALL", "WIN", "LOSE"] as const).map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setResultFilter(res)}
                  className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    resultFilter === res
                      ? res === "WIN"
                        ? "bg-blue-600 text-white shadow-xs"
                        : res === "LOSE"
                        ? "bg-rose-500 text-white shadow-xs"
                        : "bg-white text-slate-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {res === "ALL" ? "전체 결과" : res === "WIN" ? "승리" : "패배"}
                </button>
              ))}
            </div>

            {/* Tournament Group Filters */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg w-full sm:w-auto overflow-x-auto">
              {(["ALL", "전국", "지역", "TOURNAMENT"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setFilterType(type);
                    if (type !== "TOURNAMENT") {
                      setSelectedTournament("ALL_TOURNAMENTS");
                    }
                  }}
                  className={`flex-1 sm:flex-none px-3.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterType === type
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {type === "ALL" 
                    ? "전체" 
                    : type === "전국" 
                    ? "전국대회" 
                    : type === "지역" 
                    ? "지역대회" 
                    : "🏆 대회별"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Render based on filterType (TOURNAMENT has its own layout) */}
      {filterType === "TOURNAMENT" ? (
        selectedTournament === "ALL_TOURNAMENTS" ? (
          /* TOURNAMENT VIEW - LIST OF TOURNAMENT CARDS */
          (() => {
            const uniqueTournaments = Array.from(
              new Set(
                records
                  .map((r) => r.tournament_name?.trim())
                  .filter((name) => name && name.length > 0)
              )
            ).filter(Boolean) as string[];

            const tournamentCards = uniqueTournaments.map((tName) => {
              const tourneyRecords = records.filter(
                (r) => (r.tournament_name?.trim() || "") === tName
              );
              const totalCount = tourneyRecords.length;
              const winCount = tourneyRecords.filter((r) => r.result === "WIN").length;
              const lossCount = totalCount - winCount;
              const winRate = totalCount > 0 ? (winCount / totalCount) * 100 : 0;
              // Limit winrate display to max 100
              const displayWinRate = Math.min(100, winRate);

              const firstType = tourneyRecords[0]?.tournament_type || "지역";
              const rank = tournamentRanks[tName] || "미등록";

              return {
                name: tName,
                type: firstType,
                totalCount,
                winCount,
                lossCount,
                winRate: displayWinRate.toFixed(1),
                rank,
              };
            });

            return (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {tournamentCards.length > 0 ? (
                  tournamentCards.map((tc) => {
                    return (() => {
                      const imgInfo = tournamentImages[tc.name];
                      return (
                        <div
                          key={tc.name}
                          onClick={() => setSelectedTournament(tc.name)}
                          className="group relative bg-white border border-slate-200/90 rounded-xl p-4.5 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 text-slate-800 overflow-hidden"
                        >
                          {/* Top Poster Cover Section */}
                          {imgInfo && imgInfo.url ? (
                            <div className="relative h-28 overflow-hidden rounded-t-xl -mx-4.5 -mt-4.5 border-b border-slate-100">
                              <img
                                src={imgInfo.url}
                                alt={tc.name}
                                style={{ objectPosition: `center ${imgInfo.offsetY}%` }}
                                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                              <span className="absolute top-3 left-3 px-2 py-0.5 text-[9px] font-black tracking-tight rounded-md select-none bg-emerald-500/95 text-white backdrop-blur-xs">
                                {tc.type}대회
                              </span>
                              <span className="absolute bottom-3 left-3 text-white font-black text-sm tracking-tight drop-shadow-sm truncate pr-12 leading-none">
                                🏆 {tc.name}
                              </span>
                            </div>
                          ) : (
                            <div className="relative h-28 overflow-hidden rounded-t-xl -mx-4.5 -mt-4.5 border-b border-slate-105 bg-gradient-to-br from-slate-850 to-slate-950 flex items-center justify-center p-3">
                              <div className="absolute inset-0 opacity-40 mix-blend-overlay bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-400 via-teal-600 to-slate-950" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                              <span className="absolute top-3 left-3 px-2 py-0.5 text-[9px] font-black tracking-tight rounded-md select-none bg-slate-700 text-slate-200">
                                {tc.type}대회
                              </span>
                              <span className="absolute bottom-3 left-3 text-white font-black text-sm tracking-tight truncate pr-12 leading-none">
                                🏆 {tc.name}
                              </span>
                              <span className="absolute bottom-3 right-3 text-[9px] font-extrabold text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded">
                                포스터 미등록
                              </span>
                            </div>
                          )}

                          {/* Info area of card */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mt-0.5">
                              <span>총 {tc.totalCount}경기 치름</span>
                              <span className="text-slate-450 font-extrabold">{tc.winCount}승 {tc.lossCount}패</span>
                            </div>

                            <div className="flex items-center gap-1.5 py-0.5">
                              <span className="text-[11px] text-slate-450 font-black">최종 성적:</span>
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                                  tc.rank !== "미등록" && tc.rank !== "예선 탈락"
                                    ? "bg-amber-100 text-amber-850 border border-amber-200 shadow-4xs"
                                    : tc.rank === "예선 탈락"
                                    ? "bg-slate-100 text-slate-600"
                                    : "bg-slate-50 text-slate-405"
                                }`}
                              >
                                {tc.rank !== "미등록" ? (
                                  <>
                                    {tc.rank === "1등" && "🥇 "}
                                    {tc.rank === "2등" && "🥈 "}
                                    {tc.rank === "3등" && "🥉 "}
                                    {tc.rank === "4등" && "🏅 "}
                                    {tc.rank === "예선 탈락" && "🚩 "}
                                    {tc.rank}
                                  </>
                                ) : (
                                  "성적 미등록"
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Bottom stats - Only Win Rate */}
                          <div className="pt-2.5 border-t border-slate-100/80 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              대회 승률
                            </span>
                            <span className="text-sm font-black text-emerald-600 flex items-baseline gap-0.5">
                              <span className="text-base font-black tracking-tight">{tc.winRate}</span>
                              <span className="text-[10px] text-emerald-500 font-medium">%</span>
                            </span>
                          </div>

                          {/* Arrow indicator */}
                          <div className="absolute bottom-3 right-4.5 text-emerald-602 group-hover:translate-x-1 transition-transform opacity-0 group-hover:opacity-100 font-bold text-sm">
                            →
                          </div>
                        </div>
                      );
                    })();
                  })
                ) : (
                  <div className="col-span-full p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 font-sans">
                    <p className="text-sm font-semibold">대회명이 추가된 전적이 없습니다.</p>
                    <p className="text-xs text-slate-400 mt-1">대회명을 입력하고 매치를 등록하면 대회 카드가 여기에 자동 생성됩니다.</p>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          /* TOURNAMENT DETAIL VIEW FOR SPECIFIC NAME */
          (() => {
            const tourneyRecords = records.filter(
              (r) => (r.tournament_name?.trim() || "") === selectedTournament
            );

            const totalCount = tourneyRecords.length;
            const winCount = tourneyRecords.filter((r) => r.result === "WIN").length;
            const lossCount = totalCount - winCount;
            const winRate = totalCount > 0 ? parseFloat(((winCount / totalCount) * 100).toFixed(1)) : 0;

            let totalOurPoints = 0;
            let totalOppPoints = 0;
            let scoredCount = 0;
            tourneyRecords.forEach((r) => {
              const { our, opp } = parseScore(r.score);
              totalOurPoints += our;
              totalOppPoints += opp;
              if (our > 0 || opp > 0) scoredCount++;
            });
            const avgOur = scoredCount > 0 ? (totalOurPoints / scoredCount).toFixed(1) : "0.0";
            const avgOpp = scoredCount > 0 ? (totalOppPoints / scoredCount).toFixed(1) : "0.0";

            const currentRank = tournamentRanks[selectedTournament] || "미등록";

            const imgInfo = tournamentImages[selectedTournament];
            const selectedImgUrl = imgInfo?.url || "";
            const selectedOffsetY = imgInfo?.offsetY !== undefined ? imgInfo.offsetY : 50;

            return (
              <div className="space-y-4 animate-fadeIn font-sans">
                {/* Navigation Back-bar */}
                <div className="flex justify-between items-center bg-slate-50 border border-slate-200/60 p-2.5 px-3.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedTournament("ALL_TOURNAMENTS")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-650 hover:bg-slate-100 hover:text-slate-850 active:scale-95 transition-all cursor-pointer shadow-3xs"
                  >
                    ← 전체 대회 목록으로
                  </button>
                  <div className="text-[11px] text-slate-450 font-bold shrink-0">
                    전체 매치 기록: <span className="text-emerald-600 font-extrabold">{totalCount}개</span>
                  </div>
                </div>

                {/* Majestic Tournament Header Poster Banner */}
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-3xs bg-slate-950">
                  {selectedImgUrl ? (
                    <div className="relative h-28 sm:h-32 w-full overflow-hidden">
                      <img
                        src={selectedImgUrl}
                        alt={selectedTournament}
                        style={{ objectPosition: `center ${selectedOffsetY}%` }}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/35" />
                    </div>
                  ) : (
                    <div className="relative h-28 sm:h-32 bg-gradient-to-tr from-slate-900 via-slate-850 to-slate-950 flex items-center justify-center p-4 text-slate-400">
                      <div className="absolute inset-0 opacity-40 mix-blend-overlay bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500 via-teal-600 to-slate-950" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    </div>
                  )}

                  {/* Banner Content */}
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white flex justify-between items-end gap-2.5">
                    <div>
                      <span className="inline-block text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/10 text-emerald-300 select-none uppercase mb-1">
                        TOURNAMENT PREVIEW
                      </span>
                      <h2 className="text-base sm:text-lg font-black text-white tracking-tight leading-none drop-shadow-sm flex items-center gap-1.5">
                        🏆 {selectedTournament}
                      </h2>
                    </div>

                    {/* Image Adjustment and Upload Button */}
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={() => handleDownloadInstagramSticker(selectedTournament, currentRank, tourneyRecords)}
                        className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/10 text-white font-black text-[10.5px] px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 hover:relative hover:scale-102 active:scale-95 shadow-2xs"
                        title="인스타그램 스토리에 올릴 수 있는 세련된 9:16 투명 인증 스티커 다운로드"
                      >
                        📲 대회 인증
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowImageEditor(true)}
                        className="bg-black/60 hover:bg-black/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10 text-white font-extrabold text-[10.5px] transition-all cursor-pointer flex items-center gap-1 hover:scale-102 active:scale-95 shadow-3xs"
                      >
                        🖼️ 포스터 관리
                      </button>
                    </div>
                  </div>
                </div>

                {/* 50-50 Split Grid (최종 등수 & 대회 승률) -> Combined into a single cohesive row to save dramatic screen space */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-3xs flex flex-col md:flex-row items-center justify-between gap-3 text-slate-800">
                  {/* Left: 1등 / 최종 등수 Card */}
                  <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-1.5 px-3 flex items-center gap-2.5 shrink-0">
                      <span className="text-2xl select-none">
                        {currentRank === "1등" && "🥇"}
                        {currentRank === "2등" && "🥈"}
                        {currentRank === "3등" && "🥉"}
                        {currentRank === "4등" && "🏅"}
                        {currentRank === "예선 탈락" && "🚩"}
                        {currentRank === "미등록" && "🏆"}
                      </span>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block leading-none">대회 성적</span>
                        <span className="text-[13.5px] font-black text-slate-800 block mt-0.5 leading-none">
                          {currentRank === "미등록" ? "성적 미등록" : currentRank}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowRankSelector(!showRankSelector)}
                      className="text-[10px] font-extrabold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-emerald-100 transition-colors cursor-pointer shrink-0"
                    >
                      {showRankSelector ? "닫기 X" : "순위 변경"}
                    </button>

                    {/* INLINE RANK SELECTOR PANEL (Toggled on click) */}
                    {showRankSelector && (
                      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-50 border border-slate-150 rounded-lg animate-fadeIn">
                        {[
                          { val: "1등", icon: "🥇" },
                          { val: "2등", icon: "🥈" },
                          { val: "3등", icon: "🥉" },
                          { val: "4등", icon: "🏅" },
                          { val: "예선 탈락", icon: "🚩" },
                        ].map((item) => (
                          <button
                            key={item.val}
                            type="button"
                            onClick={() => {
                              handleSaveRank(selectedTournament, item.val);
                              setShowRankSelector(false);
                            }}
                            className={`px-2 py-0.5 rounded text-[10.5px] font-black border transition-all cursor-pointer flex items-center gap-0.5 active:scale-95 ${
                              currentRank === item.val
                                ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <span>{item.icon}</span>
                            <span>{item.val}</span>
                          </button>
                        ))}

                        {currentRank !== "미등록" && (
                          <button
                            type="button"
                            onClick={() => {
                              handleSaveRank(selectedTournament, "미등록");
                              setShowRankSelector(false);
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-500 hover:bg-rose-50 transition-all cursor-pointer"
                          >
                            해제
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: 대회 승률 / 전적 / 평균 득실 */}
                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-x-4 gap-y-2 w-full md:w-auto border-t md:border-t-0 pt-2.5 md:pt-0 border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-slate-400 tracking-wider">대회 승률:</span>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-sm font-black text-emerald-600">{winRate}</span>
                        <span className="text-[9px] text-emerald-500 font-bold">%</span>
                      </div>
                    </div>

                    <div className="w-[1px] h-3.5 bg-slate-200 hidden xs:block" />

                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      <span className="text-[10.5px] text-slate-600 font-extrabold">{winCount}승 {lossCount}패</span>
                    </div>

                    <div className="w-[1px] h-3.5 bg-slate-200 hidden xs:block" />

                    <div className="text-[10.5px] text-slate-500 font-bold">
                      평균 득실: <span className="font-extrabold text-slate-850">{avgOur}</span> : <span className="font-extrabold text-slate-850">{avgOpp}</span>
                    </div>

                    <span className="text-[9px] font-extrabold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded select-none font-sans">
                      {totalCount}경기 집계
                    </span>
                  </div>
                </div>

                {/* MODAL POPUP DIALOG for Tournament Poster Editing */}
                {showImageEditor && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-scaleIn text-slate-800 font-sans">
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          🖼️ 대회 이미지 설정 (포스터/인증샷)
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowImageEditor(false)}
                          className="text-slate-400 hover:text-slate-600 font-extrabold text-sm p-1 leading-none"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="mt-4 space-y-4">
                        {/* Preview */}
                        <div className="text-center">
                          <span className="text-[10px] text-slate-400 font-bold block mb-1.5">현재 이미지 미리보기</span>
                          {selectedImgUrl ? (
                            <div className="relative h-28 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                              <img
                                src={selectedImgUrl}
                                alt="Preview"
                                style={{ objectPosition: `center ${selectedOffsetY}%` }}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="h-28 w-full border border-dashed border-slate-250 bg-slate-50 flex flex-col items-center justify-center text-slate-400 rounded-xl">
                              <span className="text-2xl mb-1">📷</span>
                              <span className="text-[10px] font-bold">등록된 이미지가 없습니다.</span>
                            </div>
                          )}
                        </div>

                        {/* Upload buttons (Only simple File upload as requested for easy mobile access) */}
                        <div className="space-y-2">
                          <label className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[12px] text-center py-2.5 px-3 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-3xs active:scale-95">
                            <span>📁 파일 업로드</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handlePhotoUpload(e, selectedTournament)}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {/* Vertical offset slider */}
                        {selectedImgUrl && (
                          <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 space-y-1.5 text-xs">
                            <div className="flex justify-between text-[10px] text-slate-600 font-extrabold leading-none">
                              <span>노출 영역 세로 위치 조정</span>
                              <span className="text-emerald-600">{selectedOffsetY}%</span>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-[9px] text-slate-400 font-bold shrink-0">위쪽</span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={selectedOffsetY}
                                onChange={(e) =>
                                  handleSaveTournamentImage(
                                    selectedTournament,
                                    selectedImgUrl,
                                    parseInt(e.target.value, 10)
                                  )
                                }
                                className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              />
                              <span className="text-[9px] text-slate-400 font-bold shrink-0">아래쪽</span>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          {selectedImgUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("정말로 이미지를 삭제하고 기본 배경으로 되돌리시겠습니까?")) {
                                  handleSaveTournamentImage(selectedTournament, "", 50);
                                }
                              }}
                              className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold py-2 rounded-lg transition-colors border border-rose-150"
                            >
                              삭제
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowImageEditor(false)}
                            className="flex-2 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black py-2 rounded-lg transition-colors text-center"
                          >
                            설정 완료
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Match Log List */}
                <div className="space-y-2.5 pt-1">
                  <h3 className="text-[10.5px] font-black text-slate-400 uppercase tracking-wider leading-none">
                    📈 이 대회의 경기 진행 순서 ({totalCount}개 게임)
                  </h3>

                  {tourneyRecords.map((record, index) => {
                    const isWin = record.result === "WIN";
                    const isDeleting = deletingId === record.id;

                    const { our, opp } = parseScore(record.score);
                    const totalPt = our + opp;
                    const ourPct = totalPt > 0 ? Math.min(85, Math.max(15, (our / totalPt) * 100)) : 50;
                    const oppPct = 100 - ourPct;

                    const partner =
                      record.partner &&
                      record.partner !== "없음(단식)" &&
                      record.partner.trim() !== ""
                        ? record.partner
                        : null;
                    const op1 = record.opponent.name;
                    const op2 =
                      record.opponent.name2 && record.opponent.name2.trim() !== ""
                        ? record.opponent.name2
                        : null;

                    return (
                      <div
                        key={record.id}
                        className={`bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:border-slate-350 transition-all ${
                          isWin ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-rose-500"
                        }`}
                      >
                        {isDeleting ? (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-red-500 text-white animate-fadeIn min-h-[64px]">
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="w-5 h-5 text-white shrink-0" />
                              <div className="text-left">
                                <p className="text-xs font-black tracking-tight leading-none mb-1">매치 삭제</p>
                                <p className="text-[10px] text-red-100 font-bold leading-none">이 경기를 삭제하시겠습니까?</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  onDelete(record.id);
                                  setDeletingId(null);
                                }}
                                className="px-3 py-1 bg-white text-red-600 hover:bg-neutral-50 rounded font-black text-xs cursor-pointer shadow-xs"
                              >
                                예, 삭제
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(null)}
                                className="px-2.5 py-1 bg-red-600 text-white rounded font-bold text-xs border border-red-400/30 cursor-pointer"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3.5 px-4.5 space-y-3">
                            {/* Metadata */}
                            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold leading-none">
                              <span className="px-2 py-0.5 rounded-md bg-slate-105 text-slate-600 font-black">
                                제 {index + 1}경기
                              </span>
                              <span>{record.date.replace(/-/g, ".")}</span>
                            </div>

                            {/* Contestants */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className="text-xs font-extrabold text-slate-800">
                                  {myName}{partner && ` & ${partner}`}
                                </span>
                                <span className="text-[10px] font-black text-slate-400 italic">vs</span>
                                <span className="text-xs font-extrabold text-slate-800">
                                  {op1}{op2 && ` & ${op2}`}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                    isWin
                                      ? "bg-blue-100/90 text-blue-800"
                                      : "bg-rose-100/90 text-rose-800"
                                  }`}
                                >
                                  {isWin ? "WIN" : "LOSE"}
                                </span>

                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  <button
                                    type="button"
                                    onClick={() => onEditToggle(record)}
                                    className="p-1 rounded bg-slate-50 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 cursor-pointer text-slate-400 text-[10px] transition-transform active:scale-95"
                                    title="수정"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingId(record.id)}
                                    className="p-1 rounded bg-slate-50 hover:bg-rose-50 hover:text-red-500 border border-slate-200 cursor-pointer text-slate-400 text-[10px] transition-transform active:scale-95"
                                    title="삭제"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Colored vote-percentage bar */}
                            <div className="space-y-1.5 pt-1.5 border-t border-slate-50">
                              <div className="flex justify-between items-center text-[10px] font-black leading-none">
                                <span className="text-sky-600 flex items-center gap-1">
                                  🔵 우리팀 ({our}점)
                                </span>
                                <span className="text-rose-600 flex items-center gap-1">
                                  상대팀 ({opp}점) 🔴
                                </span>
                              </div>

                              <div className="relative h-[22px] w-full bg-slate-100 rounded-lg overflow-hidden flex border border-slate-200 shadow-3xs">
                                {/* Our score (Blue) */}
                                <div
                                  style={{ width: `${ourPct}%` }}
                                  className="bg-sky-500 h-full flex items-center justify-center text-[10.5px] font-black text-white px-2 relative transition-all duration-300 shadow-inner"
                                >
                                  <span>{our}</span>
                                </div>

                                {/* Opponent score (Red) */}
                                <div
                                  style={{ width: `${oppPct}%` }}
                                  className="bg-rose-500 h-full flex items-center justify-center text-[10.5px] font-black text-white px-2 relative transition-all duration-300 shadow-inner"
                                >
                                  <span>{opp}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()
        )
      ) : (
        /* STANDARD LIST VIEW AT ALL / REGIONAL / NATIONAL TABS */
        filteredRecords.length > 0 ? (
          <div className="space-y-2.5">
            {filteredRecords.map((record) => {
              const isWin = record.result === "WIN";
              const isDeleting = deletingId === record.id;
              
              // Partner parsing
              const hasPartner = record.partner && record.partner !== "없음(단식)" && record.partner.trim() !== "";
              const partnerText = hasPartner ? record.partner : null;
              
              // Opponent parsing
              const opponentName = record.opponent.name;
              const opponentName2 = record.opponent.name2 && record.opponent.name2.trim() !== "" ? record.opponent.name2 : null;
              
              let op1 = opponentName;
              let op2 = opponentName2;
              if (!op2 && opponentName) {
                if (opponentName.includes(",")) {
                  const parts = opponentName.split(",");
                  op1 = parts[0].trim();
                  if (parts[1]) op2 = parts[1].trim();
                } else if (opponentName.includes(" ")) {
                  const parts = opponentName.trim().split(/\s+/);
                  if (parts.length === 2 && hasPartner) {
                    op1 = parts[0];
                    op2 = parts[1];
                  }
                }
              }
              
              const opponentClub = record.opponent.club !== "미정" ? record.opponent.club : null;
              const opponentClub2 = record.opponent.club2 && record.opponent.club2 !== "미정" ? record.opponent.club2 : null;

              return (
                <div 
                  key={record.id} 
                  className={`relative rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-200 font-sans ${
                    isWin 
                      ? "bg-gradient-to-r from-blue-50/70 to-white hover:border-blue-300" 
                      : "bg-gradient-to-r from-rose-50/70 to-white hover:border-rose-300"
                  }`}
                >
                  {/* Inline Deletion Option */}
                  {isDeleting ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-red-500 text-white animate-fadeIn min-h-[68px] h-full">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 animate-pulse text-white shrink-0" />
                        <div className="text-left">
                          <p className="text-xs font-black tracking-tight leading-none mb-1">배드민턴 전적 기록 삭제</p>
                          <p className="text-[10px] text-red-100 font-bold leading-none">정말 이 경기 기록을 영구삭제 하시겠습니까? (되돌릴 수 없음)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(record.id);
                            setDeletingId(null);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-white text-red-600 hover:bg-red-55 font-extrabold text-xs transition-transform active:scale-95 cursor-pointer shadow-sm"
                        >
                          네, 삭제합니다
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 font-bold text-xs border border-red-400/30 transition-transform active:scale-95 cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Structured Esports Versus Layout */
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-2.5 px-3.5 gap-2 md:gap-4 select-none min-h-[52px]">
                      
                      {/* Column 1: Outcome Banner */}
                      <div className="flex items-center justify-between md:justify-start gap-2.5 shrink-0 md:w-20">
                        <div>
                          <span className={`text-[13px] font-black tracking-wide block leading-none ${isWin ? "text-blue-600" : "text-rose-500"}`}>
                            {isWin ? "WIN" : "LOSE"}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold block mt-1 leading-none">
                            {record.tournament_type} • {record.date.replace(/-/g, ".")}
                          </span>
                        </div>
                        
                        <div className="hidden md:block w-px h-8 bg-slate-200" />
                      </div>

                      {/* Column 2: Symmetric Rivals Row */}
                      <div className="flex-1 min-w-0 py-0 flex flex-col justify-center">
                        <div className="text-[9px] font-black text-slate-400 tracking-tight truncate mb-0.5 leading-none">
                          {record.tournament_name || "정기 훈련"}
                        </div>
                        
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2.5 gap-y-1 w-full text-xs">
                          {/* Row 1, Column 1: Me */}
                          <div className="flex flex-col text-right min-w-0">
                            <strong className="text-slate-900 font-extrabold text-[10.5px] truncate max-w-[80px] leading-tight">{myName}</strong>
                            <div className="text-[9px] text-slate-400 font-medium leading-none shrink-0 truncate max-w-[125px] mt-0.5">
                              {[
                                record.my_age && record.my_age !== "미정" ? record.my_age : null,
                                record.my_club && record.my_club !== "미정" ? record.my_club : "클럽없음",
                                record.my_tier && record.my_tier !== "미정" ? record.my_tier : null
                              ].filter(Boolean).join(" • ")}
                            </div>
                          </div>

                          {/* Column 2: VS */}
                          <div className={`px-1 py-0.5 text-[8px] font-black tracking-tight text-slate-450 bg-slate-100/95 border border-slate-200/60 rounded-sm italic select-none shrink-0 w-[24px] text-center leading-none self-center ${
                            partnerText || op2 ? "row-span-2 py-1" : "row-span-1"
                          }`}>
                            vs
                          </div>

                          {/* Row 1, Column 3: Opponent 1 */}
                          <div className="flex flex-col text-left min-w-0">
                            <strong className="text-slate-900 font-extrabold text-[10.5px] truncate max-w-[80px] leading-tight">{op1 || "상대방 1"}</strong>
                            <div className="text-[9px] text-slate-400 font-medium leading-none shrink-0 truncate max-w-[125px] mt-0.5">
                              {[
                                record.opponent.age && record.opponent.age !== "미정" ? record.opponent.age : null,
                                opponentClub ? opponentClub : "클럽없음",
                                record.opponent.tier1 && record.opponent.tier1 !== "미정" ? record.opponent.tier1 : null
                              ].filter(Boolean).join(" • ")}
                            </div>
                          </div>

                          {/* Row 2: Partner & Opponent 2 */}
                          {(partnerText || op2) && (
                            <>
                              <div className="flex flex-col text-right min-w-0">
                                <span className="text-slate-800 font-bold text-[10.5px] truncate max-w-[80px] leading-tight">{partnerText || "-"}</span>
                                {partnerText && (
                                  <div className="text-[9px] text-slate-400 font-medium leading-none shrink-0 truncate max-w-[125px] mt-0.5">
                                    {[
                                      record.partner_age && record.partner_age !== "미정" ? record.partner_age : null,
                                      record.partner_club && record.partner_club !== "미정" ? record.partner_club : "클럽없음",
                                      record.partner_tier && record.partner_tier !== "미정" ? record.partner_tier : null
                                    ].filter(Boolean).join(" • ")}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col text-left min-w-0">
                                <span className="text-slate-800 font-bold text-[10.5px] truncate max-w-[80px] leading-tight">{op2 || "-"}</span>
                                {op2 && (
                                  <div className="text-[9px] text-slate-405 font-medium leading-none shrink-0 truncate max-w-[125px] mt-0.5">
                                    {[
                                      record.opponent.age2 && record.opponent.age2 !== "미정" ? record.opponent.age2 : null,
                                      opponentClub2 ? opponentClub2 : "클럽없음",
                                      record.opponent.tier2 && record.opponent.tier2 !== "미정" ? record.opponent.tier2 : null
                                    ].filter(Boolean).join(" • ")}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Column 3: Score & Controls */}
                      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 border-t md:border-t-0 border-slate-150/50 pt-2 md:pt-0">
                        <div className="flex items-center gap-1.5 font-mono select-none">
                          <span className={`text-[8px] font-black px-1 py-0.5 rounded shrink-0 ${isWin ? "bg-blue-105 text-blue-700" : "bg-rose-100/60 text-rose-700"}`}>
                            SCORE
                          </span>
                          <span className="text-xs font-black tracking-tight text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-4xs hover:bg-slate-50 transition-colors">
                            {record.score}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditToggle(record)}
                            title="수정"
                            className="p-1.5 rounded-lg bg-white hover:bg-blue-50 text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-250 shadow-4xs cursor-pointer transition-all active:scale-95 shrink-0"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(record.id)}
                            title="삭제"
                            className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-400 hover:text-red-500 border border-slate-200 hover:border-rose-250 shadow-4xs cursor-pointer transition-all active:scale-95 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 font-sans">
            <p className="text-sm font-semibold">조건에 부합하는 전적 기록이 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1">검색어나 결과 필터를 조절해 보세요.</p>
          </div>
        )
      )}

      {/* MODAL POPUP DIALOG for Competition Verification Tournament Sticker (Mobile & Desktop Bulletproof) */}
      {showStickerModal && stickerImageUrl && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-5 shadow-2xl animate-scaleIn text-slate-800 font-sans flex flex-col gap-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex flex-col">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                  📲 대회 인증 투명 스티커
                </h3>
                <span className="text-[9px] text-slate-455 font-bold mt-0.5">인스타그램 스토리 업로드 전용 (9:16)</span>
              </div>
              <button
                type="button"
                onClick={handleCloseStickerModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sticker Preview (Interactive Transparent Board) */}
            <div className="flex flex-col items-center justify-center p-2 rounded-2xl border border-slate-200/80 bg-slate-50 shadow-inner relative overflow-hidden">
              <div 
                className="w-full h-64 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200 shadow-xs"
                style={{
                  backgroundImage: "conic-gradient(#eaeaea 0.25turn, #ffffff 0.25turn 0.5turn, #eaeaea 0.5turn 0.75turn, #ffffff 0.75turn)",
                  backgroundSize: "20px 20px"
                }}
              >
                <img
                  src={stickerImageUrl}
                  alt="인스타 스토리 인증 스티커"
                  className="max-h-full max-w-full object-contain hover:scale-105 transition-transform duration-250 cursor-pointer pointer-events-auto"
                  style={{
                    userSelect: "auto",
                    WebkitUserSelect: "auto",
                    WebkitTouchCallout: "default"
                  }}
                />
              </div>
            </div>

            {stickerSaveMessage && (
              <div
                className={`rounded-xl border p-3 text-[10.5px] font-extrabold leading-relaxed ${
                  stickerSaveMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-150"
                    : "bg-rose-50 text-rose-700 border-rose-150"
                }`}
              >
                {stickerSaveMessage.text}
              </div>
            )}

            <button
              type="button"
              onClick={handleCloseStickerModal}
              className="text-slate-450 hover:text-slate-600 text-[10.5px] font-bold text-center underline cursor-pointer hover:bg-slate-50 py-1 rounded"
            >
              닫기
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
