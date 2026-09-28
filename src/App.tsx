import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Sparkles, Upload, UserPlus } from 'lucide-react';
import { HEROINES, WEAPONS, PRESET_HERO_IDS, createBlankHero } from './data/heroines';
import { Ultrawoman, AlienWeapon, BodyPartId, Stats, LogEntry, CustomSettings, AudioSettings, EnvironmentTheme, AiConfig, CustomSkill, CustomSkillCategory, CustomWeaponType, HeroProgress, ENV_DAILY_EFFECTS, DayConfig, DEFAULT_DAY_CONFIG, CustomEnvTheme, EnvPhysicalParams, getDefaultEnvParams, ScenarioConfig, ScenarioStartupConfig, DEFAULT_SCENARIO_PRESETS, RelationshipState, RelationshipSlot, Faction, getActiveMilestones, AiAttachment, NEUTRAL_SCENARIO } from './types';
import { DEFAULT_FACTIONS } from './data/factions';
import { DEFAULT_RELATIONSHIP_SLOTS, NEUTRAL_RELATIONSHIP_SLOT } from './data/relationships';
import { evaluateBestRelationshipSlot, getAllRelationshipSlots, getGlobalRelationshipSlots, saveGlobalRelationshipSlots } from './utils/relationshipUtils';
import { RelationshipModal } from './components/RelationshipModal';
import { Header } from './components/Header';
import { UltraViewer } from './components/UltraViewer';
import { AttackControls } from './components/AttackControls';
import { StatsPanel } from './components/StatsPanel';
import { DamageRadar } from './components/DamageRadar';
import { UnifiedInterrogationConsole, ConsoleEntry } from './components/UnifiedInterrogationConsole';
import { CustomSkillModal } from './components/CustomSkillModal';
import { CustomizerModal } from './components/CustomizerModal';
import { ReportModal } from './components/ReportModal';
import { AiConfigModal, DEFAULT_AI_CONFIG } from './components/AiConfigModal';
import { DayConfigModal } from './components/DayConfigModal';
import { ResetConfirmModal } from './components/ResetConfirmModal';
import { EnvironmentPanelModal } from './components/EnvironmentPanelModal';
import { ScenarioModal } from './components/ScenarioModal';
import { StateExportImportModal, FullExportData } from './components/StateExportImportModal';
import {
  SaveLoadManagerModal,
  SaveSlotData,
  getGameSaveSlots,
  loadSaveSlotsAsync,
  saveLocalSaveSlots,
  updateDedicatedAutoSaveSlot,
  updateDedicatedQuickSaveSlot,
} from './components/SaveLoadManagerModal';
import { UnifiedSaveManagerModal, StorageModalTab } from './components/UnifiedSaveManagerModal';
import { RealTimeModeModal } from './components/RealTimeModeModal';
import { HeroSelectorModal } from './components/HeroSelectorModal';
import { MultiHeroTeamBar } from './components/MultiHeroTeamBar';
import { clearModelFromIDB } from './lib/modelStorage';
import { savePortraitToIDB, getAllPortraitsFromIDB, clearPortraitFromIDB } from './lib/portraitStorage';
import { saveSlotsToIDB } from './lib/slotStorage';
import { 
  queueServerSave, 
  flushServerStorageSync,
  downloadFullLocalBackup, 
  downloadDialogueProgressBackup, 
  initAutoBackupEngine, 
  subscribeBackupEvents, 
  restoreFullLocalBackup,
  fetchServerStorage,
  collectCurrentLocalData,
  isInsideIframe,
  getAutoBackupConfig,
  markServerStorageHydrated,
  isServerStorageHydrated,
  collectLocalPortraitPayload,
} from './services/storageSync';
import { safeLocalStorageSet, sanitizeProgressMapForStorage } from './utils/storageUtils';
import { ultraAudio } from './utils/audio';
import { getMediaType } from './utils/mediaUtils';
import { getStatsPayload, getWeaponActionTitle, getWeaponContinuousActionTitle, sanitizeHeroForAi } from './utils/stats';
import {
  RealTimeSyncState,
  DEFAULT_REAL_TIME_STATE,
  getRealTimeContext,
  calculateRealTimeDay,
} from './utils/realTimeUtils';

// Synchronous media and video stream preloader & memory cache helper
function getSynchronousMediaCache(): Record<string, string> {
  const cache: Record<string, string> = {};
  try {
    const sessionData = sessionStorage.getItem('ultra_video_stream_cache_v1');
    if (sessionData) {
      Object.assign(cache, JSON.parse(sessionData));
    }
  } catch (e) {}
  try {
    const localData = localStorage.getItem('ultra_video_stream_cache_v1');
    if (localData) {
      Object.assign(cache, JSON.parse(localData));
    }
  } catch (e) {}

  // Harvest individual character media tracks from localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ultra_video_track_')) {
          const heroId = k.replace('ultra_video_track_', '');
          const val = localStorage.getItem(k);
          if (heroId && val && !cache[heroId]) {
            cache[heroId] = val;
          }
        }
      }
    }
  } catch (e) {}

  // Harvest individual character media tracks from sessionStorage
  try {
    if (typeof sessionStorage !== 'undefined') {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('ultra_video_track_')) {
          const heroId = k.replace('ultra_video_track_', '');
          const val = sessionStorage.getItem(k);
          if (heroId && val && !cache[heroId]) {
            cache[heroId] = val;
          }
        }
      }
    }
  } catch (e) {}

  return cache;
}

// ---------------------------------------------------------------------------------------
// Media mirror helpers (localStorage quota protection)
// Base64 portraits / video tracks can be hundreds of KB each. Mirroring them into
// localStorage/sessionStorage used to exhaust the ~5MB quota, after which even small keys
// (AI presets, progress map, heroines) silently failed to save. Big media now lives in
// IndexedDB + the server portrait store; web storage keeps only small entries.
// ---------------------------------------------------------------------------------------
const MEDIA_MIRROR_LIMIT_BYTES = 200 * 1024;
const STREAM_CACHE_MIRROR_LIMIT_BYTES = 1024 * 1024;

function mirrorMediaToWebStorage(key: string, value: string): void {
  if (typeof value !== 'string' || value.length === 0) return;
  if (value.length > MEDIA_MIRROR_LIMIT_BYTES) return; // too big for the shared 5MB quota
  try { localStorage.setItem(key, value); } catch (e) {}
  try { sessionStorage.setItem(key, value); } catch (e) {}
}

function mirrorStreamCacheToWebStorage(cache: Record<string, string>): void {
  let json = '';
  try { json = JSON.stringify(cache); } catch (e) { return; }
  if (json.length > STREAM_CACHE_MIRROR_LIMIT_BYTES) return;
  try { sessionStorage.setItem('ultra_video_stream_cache_v1', json); } catch (e) {}
  try { localStorage.setItem('ultra_video_stream_cache_v1', json); } catch (e) {}
}

// Background media preloader for video tracks and portraits.
// Deduplicated: previously every heroines change created a fresh <video>/<Image> for
// the same URL, leaking decoders and re-downloading multi-MB base64 portraits.
const preloadedMediaUrls = new Set<string>();
function preloadMediaStream(url: string) {
  if (!url || typeof url !== 'string') return;
  if (preloadedMediaUrls.has(url)) return;
  preloadedMediaUrls.add(url);
  if (preloadedMediaUrls.size > 200) preloadedMediaUrls.clear(); // keep the set bounded
  try {
    const mediaType = getMediaType(url);
    if (mediaType === 'video') {
      const v = document.createElement('video');
      v.src = url;
      v.preload = 'auto';
      v.muted = true;
      v.playsInline = true;
      v.load();
    } else {
      const img = new Image();
      img.src = url;
    }
  } catch (e) {
    // Non-blocking preloader
  }
}

// Client-side fetch helper: retry network requests up to 5 times on error before falling back
async function fetchWith5Retries(url: string, options: RequestInit, maxRetries = 5): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        return res;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err: any) {
      lastError = err;
      console.warn(`[Client Fetch Attempt ${attempt}/${maxRetries} failed]:`, err?.message || err);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
  }
  throw lastError || new Error(`Fetch to ${url} failed after ${maxRetries} attempts.`);
}

// Lightweight hierarchical chat history serializer to ensure context memory across long sessions
// ---------------------------------------------------------------------------------------
// 会话前情摘要（大幅降低输入 token）
// 旧对话不再全量塞进请求，而是压缩成一段摘要，请求只携带「摘要 + 最近 N 条原文」。
// 摘要由 /api/summarize-session 后台生成，随对话推进增量合并。
// ---------------------------------------------------------------------------------------
const SESSION_SUMMARY_KEY = 'ultra_session_summary_v1';
const CHAT_RECENT_ENTRIES = 10;      // 每次请求携带的最近原文条数
const CHAT_SUMMARY_TRIGGER = 10;     // 攒够多少条新对话后触发一次摘要
const CHAT_SUMMARY_KEEP_RECENT = 4;  // 最近这几条永远保留原文，不参与摘要

interface SessionSummaryRecord {
  summary: string;
  coveredCount: number;
  /** 摘要实际覆盖到的最后一条对话 id（锚点）。刷新/裁剪后靠它定位，避免索引错位导致记忆重叠或断层。 */
  coveredId?: string;
  updatedAt: number;
}

/**
 * 计算"摘要已覆盖到"的历史下标（不含）。返回 -1 表示摘要与当前历史脱节
 * （锚点条目已被裁剪/清空/切换到别的会话），此时不能再用它声称覆盖了前 N 条。
 */
function resolveSummaryCoverage(entries: any[], record?: SessionSummaryRecord | null): number {
  if (!record || !record.summary || !record.summary.trim()) return -1;
  const list = Array.isArray(entries) ? entries : [];
  if (record.coveredId) {
    const idx = list.findIndex((e) => e && e.id === record.coveredId);
    return idx >= 0 ? idx + 1 : -1;
  }
  const n = Number(record.coveredCount);
  if (!isFinite(n) || n <= 0) return -1;
  return Math.max(0, Math.min(n, list.length));
}

function getSessionSummaryStore(): Record<string, SessionSummaryRecord> {
  try {
    const raw = localStorage.getItem(SESSION_SUMMARY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeSessionSummaryStore(store: Record<string, SessionSummaryRecord>): void {
  try {
    safeLocalStorageSet(SESSION_SUMMARY_KEY, store);
    queueServerSave({ [SESSION_SUMMARY_KEY]: store });
  } catch (e) {
    console.warn('[Session Summary] persist failed:', e);
  }
}

/**
 * 取一段对话最后一条的时间戳（毫秒），用于在"同样长"的候选历史之间判断哪份更新。
 * 历史条目的 id 形如 `user_1699999999999` / `atk_1699999999999_ab12`，因此从 id 里抽取
 * 时间戳是可靠的；没有可用信息时返回 0。
 */
function lastEntryStamp(list: any[]): number {
  const last = Array.isArray(list) && list.length > 0 ? list[list.length - 1] : null;
  if (!last) return 0;
  if (typeof last.timestamp === 'number' && isFinite(last.timestamp)) return last.timestamp;
  if (typeof last.createdAt === 'number' && isFinite(last.createdAt)) return last.createdAt;
  const m = typeof last.id === 'string' ? last.id.match(/(\d{12,})/) : null;
  if (m) {
    const n = Number(m[1]);
    if (isFinite(n)) return n;
  }
  return 0;
}

/** a 的 id 是否覆盖 b 的全部 id（即 a 是 b 记忆的超集，通常意味着 a = b + 后续对话） */
function timelineCovers(a: any[], b: any[]): boolean {
  if (!Array.isArray(b) || b.length === 0) return true;
  const ids = new Set((Array.isArray(a) ? a : []).map((e) => e && e.id).filter(Boolean));
  if (ids.size === 0) return false;
  return b.every((e) => (e && e.id ? ids.has(e.id) : true));
}

interface ConsoleTimelineCandidate {
  source: string;
  entries: any[] | undefined | null;
}

/**
 * ★ 会话历史（记忆）唯一化。
 *
 * 同一份对话历史会同时出现在三个地方：
 *   1) progressMap[heroId].consoleEntries          （服务端权威进度）
 *   2) ultra_chat_entries_v2_<heroId>              （角色独立缓存，localStorage + 服务端）
 *   3) ultra_current_chat_entries_v2               （当前活动会话缓存）
 * 老版本、被中断的写入、或"快速关闭"只刷新了其中一份时，三者长度会不一致——有的停在很早的
 * 快照上，甚至变成空数组。刷新时若盲选其中一份（旧逻辑固定选第 2 份，哪怕它是空/更旧），
 * 就会出现"记忆倒退 / 只剩几条 / 与上一段剧情对不上"，随后还会把短历史回写覆盖所有人。
 *
 * 这里统一挑选唯一的权威版本：
 *   规则 1：某一份在 id 上是其它所有份的超集 → 它就是全部记忆（长 = 短 + 后续对话），选它；
 *   规则 2：否则是真正的分叉 → 选"最后一条更新"的那份（用户当前正在继续的时间线），
 *           同样新时再取更长的。
 * 由调用方把结果回写到所有副本，使三处重新一致。
 */
function pickMostCompleteTimeline(candidates: ConsoleTimelineCandidate[]): {
  entries: any[];
  chosenSource: string;
  diverged: boolean;
  detail: string;
} {
  const list = (Array.isArray(candidates) ? candidates : []).filter((c) => c && Array.isArray(c.entries));
  const nonEmpty = list.filter((c) => (c.entries as any[]).length > 0);

  if (nonEmpty.length === 0) {
    return { entries: [], chosenSource: list[0]?.source || 'none', diverged: false, detail: '全部为空' };
  }

  // 规则 1：若某一份在 id 上覆盖了其它所有份（= 它包含全部已有记忆），直接选它。
  // 这能正确处理"长历史 = 短历史 + 后续对话"的正常情况，也避免误选被截断的短副本。
  let best: ConsoleTimelineCandidate | null = null;
  for (const c of nonEmpty) {
    const ce = c.entries as any[];
    if (nonEmpty.every((o) => o === c || timelineCovers(ce, o.entries as any[]))) {
      best = c;
      break;
    }
  }

  // 规则 2：真正的分叉（互相都不包含，例如某角色停在旧剧情上继续写）——选"最后一条更新"的那份，
  // 因为它才是用户当前正在继续的时间线；同样新时再取更长的。
  if (!best) {
    best = nonEmpty[0];
    for (const c of nonEmpty) {
      const ce = c.entries as any[];
      const be = best.entries as any[];
      const cs = lastEntryStamp(ce);
      const bs = lastEntryStamp(be);
      if (cs > bs || (cs === bs && ce.length > be.length)) {
        best = c;
      }
    }
  }

  const bestEntries = best.entries as any[];
  const diverged = nonEmpty.some((c) => {
    const ce = c.entries as any[];
    if (ce === bestEntries) return false;
    if (ce.length !== bestEntries.length) return true;
    return lastEntryStamp(ce) !== lastEntryStamp(bestEntries);
  });

  return {
    entries: bestEntries,
    chosenSource: best.source,
    diverged,
    detail: list.map((c) => `${c.source}:${(c.entries as any[]).length}`).join(' / '),
  };
}

/**
 * ★ 清理"未完成的 AI 占位条目"。
 *
 * 攻击/对话在等 AI 回复前会先插入一条占位记录（text 形如 `⏳ [AI思考分析受创反应中...]`、
 * `⏳ [正在根据现实时间…生成角色实时心声…]` 等），随后按 id 回填正文。如果用户在中途刷新/
 * 断线/退出，回填永远不会发生，这条占位就会永久留在历史里，并被当成"一句真实对白"塞进模型的
 * 长期记忆 → 记忆混乱（用户数据里就能看到这种残留）。
 * 这里以"⏳ ["开头作为待生成占位的特征，刷新时统一改写为中性说明：保留伤害/事件记录，
 * 但不再污染对话记忆。
 */
const PENDING_AI_PLACEHOLDER_RE = /^⏳\s*\[/;

function clearStalePendingEntries(entries: any[]): { entries: any[]; changed: boolean } {
  if (!Array.isArray(entries) || entries.length === 0) return { entries, changed: false };
  let changed = false;
  const cleaned = entries.map((e) => {
    if (!e || typeof e !== 'object') return e;
    const textHit = typeof e.text === 'string' && PENDING_AI_PLACEHOLDER_RE.test(e.text.trim());
    const analysisHit = typeof e.psychologicalAnalysis === 'string' && PENDING_AI_PLACEHOLDER_RE.test(e.psychologicalAnalysis.trim());
    if (!textHit && !analysisHit) return e;
    changed = true;
    return {
      ...e,
      text: textHit ? '（该条 AI 反应在刷新或断线时中断，未生成正文）' : e.text,
      psychologicalAnalysis: analysisHit ? '（AI 受创评估中断）' : e.psychologicalAnalysis,
    };
  });
  return changed ? { entries: cleaned, changed } : { entries, changed: false };
}

/**
 * ★ 长效记忆（前情摘要）跨角色 / 跨刷新复用。
 *
 * 剧情时间线（consoleEntries）按设计是"全员共享"的，但摘要曾经只按 heroId 保存，于是换角色
 * 或刷新后，如果本角色没有摘要、或摘要锚点已过时，这一轮模型就完全拿不到长期记忆
 * → 表现为"失忆 / 前后矛盾"。
 *
 * 这里在所有已保存的摘要中，挑选「锚点能在当前历史里定位、且覆盖条数最多」的那一份。
 * 由于要求锚点必须真实存在于当前历史中，所以只会在共享的同一段时间线上命中，
 * 不会把另一条分叉剧情的内容错误地塞进来。平局时优先本角色自己的摘要。
 */
/**
 * 把一条进度记录裁剪成"小体积补丁"：去掉体积最大的 consoleEntries / logs。
 * 整表 progressMap 有 6MB（UTF-8 13MB），全套同步在关窗/频繁保存时根本发不出去；
 * 对话内容单独走 chatTailPatch / per-hero 键同步即可。
 */
/** UTF-8 字节数（sendBeacon/keepalive 的限制按字节算，中文 1 字 ≈ 3 字节） */
function utf8SizeOf(text: string): number {
  try {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  } catch {}
  return String(text || '').length * 3;
}

/**
 * 关窗 payload 自适应：从最新往旧加入对话，直到"整个 payload"逼近 64KB 上限为止。
 * 只校验尾部不够——progressPatch/updates 也占体积，必须按整体字节数算。
 */
function fitClosePayloadWithTail(
  basePayload: Record<string, any>,
  heroKey: string,
  entries: any[],
  maxBytes = 56000,
  maxCount = 8
): Record<string, any> {
  const build = (tail: any[]) => {
    const payload: Record<string, any> = JSON.parse(JSON.stringify(basePayload));
    if (heroKey && tail.length > 0) {
      payload.chatTailPatch = { ...(payload.chatTailPatch || {}), [heroKey]: tail };
    }
    return payload;
  };
  const list = Array.isArray(entries) ? entries : [];
  const byteSize = (p: Record<string, any>) => utf8SizeOf(JSON.stringify(p));
  if (list.length === 0 || !heroKey) return build([]);
  let n = Math.min(maxCount, list.length);
  let payload = build(list.slice(-n));
  while (n > 1 && byteSize(payload) > maxBytes) {
    n--;
    payload = build(list.slice(-n));
  }
  // A single huge entry can still blow past ~64KB (sendBeacon silently drops it).
  // Progressively drop the optional/less-critical sections so the progress patch,
  // which is the part that actually prevents data loss, always gets through.
  if (byteSize(payload) > maxBytes && (payload as any).portraits) {
    delete (payload as any).portraits;
  }
  if (byteSize(payload) > maxBytes && (payload as any).updates) {
    delete (payload as any).updates;
  }
  if (byteSize(payload) > maxBytes && (payload as any).chatTailPatch) {
    delete (payload as any).chatTailPatch;
  }
  if (byteSize(payload) > maxBytes) {
    console.warn('[AutoSave on Close] 关窗增量仍超过 64KB，仅保留进度补丁（其余将在下次启动时同步）。');
  }
  return payload;
}

function slimProgressForPatch(progress: any, includeLogs = false): any {
  if (!progress || typeof progress !== 'object') return progress;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(progress)) {
    if (k === 'consoleEntries') continue;              // 对话体积最大，单独走 per-hero/current 键
    if (k === 'logs' && !includeLogs) continue;        // 关窗时不带 logs（否则塞不进 64KB）
    out[k] = v;
  }
  return out;
}

function getBestSummaryRecord(
  entries: any[],
  heroId?: string
): { coveredTo: number; record: SessionSummaryRecord } | null {
  const store = getSessionSummaryStore();
  const ordered: Array<SessionSummaryRecord | undefined> = [];
  if (heroId) ordered.push(store[heroId]);
  for (const [key, rec] of Object.entries(store)) {
    if (heroId && key === heroId) continue;
    ordered.push(rec as SessionSummaryRecord);
  }

  let best: { coveredTo: number; record: SessionSummaryRecord } | null = null;
  for (const rec of ordered) {
    const coveredTo = resolveSummaryCoverage(entries, rec);
    if (coveredTo < 0) continue;
    if (!best || coveredTo > best.coveredTo) {
      best = { coveredTo, record: rec as SessionSummaryRecord };
    }
  }
  return best;
}

function isAiProviderConfigured(): boolean {
  try {
    const raw = localStorage.getItem('ultra_ai_config_v1');
    if (!raw) return false;
    const cfg = JSON.parse(raw);
    return !!(cfg && cfg.enabled && cfg.apiKey);
  } catch (e) {
    return false;
  }
}

function getTokenSaveMode(): 'off' | 'standard' | 'extreme' {
  try {
    const raw = localStorage.getItem('ultra_ai_config_v1');
    const m = raw ? JSON.parse(raw)?.tokenSaveMode : 'standard';
    return m === 'off' || m === 'extreme' ? m : 'standard';
  } catch (e) {
    return 'standard';
  }
}

function getEnrichedChatHistory(entries: any[], heroId?: string): any[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const sanitized = entries.map((entry, index) => ({
    id: entry.id,
    sender: entry.sender,
    senderName: entry.senderName || entry.heroName || entry.speakerName,
    text: (entry.text || entry.content || '').trim().slice(0, 200),
    damage: typeof entry.damage === 'number' ? entry.damage : (typeof entry.damageDealt === 'number' ? entry.damageDealt : undefined),
    type: entry.type,
    reactionType: entry.reactionType,
    timestamp: entry.timestamp || entry.time,
    // 在"完整历史"里的真实序号：前情摘要窗口化后，服务端仍能据此标出真实轮次，
    // 不会把最近 10 条误标成"轮次1..10"（那是刷新后记忆错乱的主要来源之一）。
    seq: index + 1,
  }));

  const mode = getTokenSaveMode();
  const windowSize = mode === 'off' ? 45 : mode === 'extreme' ? 6 : CHAT_RECENT_ENTRIES;
  // 摘要按"全员共享的时间线"复用：本角色没有摘要 / 锚点失效时，自动退回到其它角色保存的
  // 摘要中最贴合当前历史的那一份，避免换角色或刷新后模型直接失忆。
  const bestSummary = getBestSummaryRecord(sanitized, heroId);

  if (bestSummary) {
    const record = bestSummary.record;
    const coveredTo = bestSummary.coveredTo;
    if (record.summary && record.summary.trim()) {
      // 只发送"摘要覆盖点之后"的原文，天然不会与摘要重叠；窗口只截取其中最近的 N 条。
      // 显示用 coveredTo（在当前历史里重新定位到的实际覆盖条数），而不是历史遗留的
      // coveredCount，避免"摘要声称覆盖 N 条、实际按别的下标裁剪"造成记忆断层。
      const tail = sanitized.slice(coveredTo);
      const recent = tail.slice(-windowSize);
      const skipped = tail.length - recent.length;
      return [
        {
          id: 'session_summary',
          sender: 'system',
          senderName: '前情摘要',
          type: 'summary',
          text:
            '【前情摘要（已覆盖此前 ' + coveredTo + ' 条对话）】' +
            record.summary.trim() +
            (skipped > 0
              ? '（其后还有 ' + skipped + ' 条较早对话未逐条列出，仅保留最近 ' + recent.length + ' 条原文）'
              : ''),
        },
        ...recent,
      ];
    }
  } else if (heroId) {
    const ownRecord = getSessionSummaryStore()[heroId];
    if (ownRecord && ownRecord.summary && ownRecord.summary.trim()) {
      // 摘要与当前历史脱节（刷新后历史被裁剪 / 切换等）：本轮不带摘要，等后台按现有历史自动重建，
      // 避免"摘要说了一套、原文又是另一套"造成记忆混乱。
      console.warn('[Session Summary] 摘要锚点已失效，本轮暂不使用摘要，等待重建');
    }
  }

  // 还没有可用摘要：如果已配置服务商，摘要很快会生成，只带最近 N 条即可；
  // 如果压根没配置服务商（无法生成摘要），退回旧逻辑，避免上下文丢失。
  if (heroId && isAiProviderConfigured()) {
    return sanitized.slice(-windowSize);
  }

  if (sanitized.length <= 60) return sanitized;
  const genesis = sanitized.slice(0, 3);
  const middle = sanitized.slice(3, -45).filter((e) => {
    const txt = e.text || '';
    return e.type === 'scenario_start' ||
      e.type === 'day_transition' ||
      txt.includes('契约') || txt.includes('誓约') || txt.includes('爱') ||
      txt.includes('臣服') || txt.includes('顺从') || txt.includes('第') ||
      (e.damage && Math.abs(e.damage) >= 20);
  }).slice(-8);
  const recent = sanitized.slice(-45);
  return [...genesis, ...middle, ...recent];
}



// Union two preset collections by id: incoming wins for the same id, but nothing is dropped.
function mergePresetById<T extends { id?: string }>(base?: T[], incoming?: T[]): T[] {
  const map = new Map<string, T>();
  (Array.isArray(base) ? base : []).forEach((p) => {
    if (p && p.id) map.set(p.id, p);
  });
  (Array.isArray(incoming) ? incoming : []).forEach((p) => {
    if (p && p.id) map.set(p.id, p);
  });
  return Array.from(map.values());
}

/**
 * Build the AI config used when restoring a save slot / backup / imported state.
 * Every preset collection is UNIONED with what the user already has, so restoring an older
 * snapshot (several save slots carry an aiConfig with ZERO presets) can never wipe the user's
 * AI presets — that was a real data-loss path.
 */
function mergeAiConfigPreservingPresets(current: AiConfig | undefined | null, incoming: Partial<AiConfig> | undefined | null): AiConfig {
  const base: AiConfig = current || DEFAULT_AI_CONFIG;
  const merged: AiConfig = { ...DEFAULT_AI_CONFIG, ...base, ...(incoming || {}) };
  merged.customSystemPresets = mergePresetById(base.customSystemPresets, incoming?.customSystemPresets);
  merged.apiProfiles = mergePresetById(base.apiProfiles, incoming?.apiProfiles);
  merged.customJailbreakPresets = mergePresetById(base.customJailbreakPresets, incoming?.customJailbreakPresets);
  merged.customWorldViewSlots = mergePresetById(base.customWorldViewSlots, incoming?.customWorldViewSlots);
  merged.customProviders = mergePresetById(base.customProviders, incoming?.customProviders);
  return merged;
}

/**
 * Runtime fallback used only when the user has not created any skill/weapon yet.
 * It is NOT preset content shipped in src/data — it exists so the attack UI keeps
 * working on a completely blank install, and disappears as soon as a real one exists.
 */
const FALLBACK_WEAPON: AlienWeapon = {
  id: '__fallback_contact__',
  name: '基础接触',
  type: 'touch',
  category: 'touch',
  iconName: 'Zap',
  damage: 5,
  energyDrain: 3,
  moraleDamage: 3,
  shameIncrease: 2,
  obedienceGain: 2,
  description: '尚未创建任何调教方式时使用的通用基础动作。请在「自定义」中创建属于你的技能与武器。',
  sfxType: 'touch',
};

export default function App() {
  // Synchronous Media & Video Stream Preload Cache
  const [videoStreamCache, setVideoStreamCache] = useState<Record<string, string>>(() => {
    return getSynchronousMediaCache();
  });

  // Persistent Heroines List State (Presets removed: only user custom heroes are kept)
  const [heroines, setHeroines] = useState<Ultrawoman[]>(() => {
    const syncCache = getSynchronousMediaCache();
    try {
      const saved = localStorage.getItem('trainer_heroines_v5') || localStorage.getItem('ultra_heroines_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Automatically filter out preset heroes from historical cache.
          // IMPORTANT: if every entry happens to be a legacy preset id we must still keep the
          // list — returning [] here used to fire the "empty heroines" effect below, which
          // erased the roster from localStorage AND from the authoritative server disk.
          const userOnly = parsed.filter((h: any) => h && !PRESET_HERO_IDS.includes(h.id));
          const restored = userOnly.length > 0 ? userOnly : parsed.filter((h: any) => h && h.id);
          if (restored.length > 0) {
            return restored.map((h: Ultrawoman) => {
              if (!h.customPortrait && syncCache[h.id]) {
                return { ...h, customPortrait: syncCache[h.id] };
              }
              return h;
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse heroines from localStorage:', e);
    }
    // Clean default: empty array for 100% pure distribution package (zero characters initially)
    return [];
  });

  // Persistent Custom Skills State
  const [customSkills, setCustomSkills] = useState<CustomSkill[]>(() => {
    try {
      const saved = localStorage.getItem('ultra_custom_skills_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse custom skills from localStorage:', e);
    }
    return [];
  });

  // Persistent Custom Skill Categories State
  const [customCategories, setCustomCategories] = useState<CustomSkillCategory[]>(() => {
    try {
      const saved = localStorage.getItem('ultra_custom_skill_categories_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse custom skill categories:', e);
    }
    return [];
  });

  // Persistent Custom Weapon Types State
  const [customWeaponTypes, setCustomWeaponTypes] = useState<CustomWeaponType[]>(() => {
    try {
      const saved = localStorage.getItem('ultra_custom_weapon_types_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse custom weapon types:', e);
    }
    return [];
  });

  // Persistent Favorite Weapons State
  const [favoriteWeaponIds, setFavoriteWeaponIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ultra_favorite_weapons_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse favorite weapons:', e);
    }
    return [];
  });

  // Persistent Deleted Weapons State
  const [deletedWeaponIds, setDeletedWeaponIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ultra_deleted_weapons_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse deleted weapons:', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('ultra_custom_skills_v1', JSON.stringify(customSkills));
      queueServerSave({ ultra_custom_skills_v1: customSkills });
    } catch (e) {
      console.error('Failed to save custom skills:', e);
    }
  }, [customSkills]);

  useEffect(() => {
    try {
      localStorage.setItem('ultra_custom_skill_categories_v1', JSON.stringify(customCategories));
      queueServerSave({ ultra_custom_skill_categories_v1: customCategories });
    } catch (e) {
      console.error('Failed to save custom skill categories:', e);
    }
  }, [customCategories]);

  useEffect(() => {
    try {
      localStorage.setItem('ultra_custom_weapon_types_v1', JSON.stringify(customWeaponTypes));
      queueServerSave({ ultra_custom_weapon_types_v1: customWeaponTypes });
    } catch (e) {
      console.error('Failed to save custom weapon types:', e);
    }
  }, [customWeaponTypes]);

  useEffect(() => {
    try {
      localStorage.setItem('ultra_favorite_weapons_v1', JSON.stringify(favoriteWeaponIds));
      queueServerSave({ ultra_favorite_weapons_v1: favoriteWeaponIds });
    } catch (e) {
      console.error('Failed to save favorite weapons:', e);
    }
  }, [favoriteWeaponIds]);

  useEffect(() => {
    try {
      localStorage.setItem('ultra_deleted_weapons_v1', JSON.stringify(deletedWeaponIds));
      queueServerSave({ ultra_deleted_weapons_v1: deletedWeaponIds });
    } catch (e) {
      console.error('Failed to save deleted weapons:', e);
    }
  }, [deletedWeaponIds]);

  // Persistent Factions State
  const [factions, setFactions] = useState<Faction[]>(() => {
    try {
      const saved = localStorage.getItem('ultra_factions_v1');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse factions from localStorage:', e);
    }
    return DEFAULT_FACTIONS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('ultra_factions_v1', JSON.stringify(factions));
      queueServerSave({ ultra_factions_v1: factions });
    } catch (e) {
      console.error('Failed to save factions:', e);
    }
  }, [factions]);

  const handleAddCustomCategory = (cat: CustomSkillCategory) => {
    setCustomCategories((prev) => {
      const exists = prev.some((c) => c.id === cat.id);
      if (exists) return prev.map((c) => (c.id === cat.id ? cat : c));
      return [...prev, cat];
    });
  };

  const handleUpdateCustomCategory = (cat: CustomSkillCategory) => {
    setCustomCategories((prev) => prev.map((c) => (c.id === cat.id ? cat : c)));
  };

  const handleDeleteCustomCategory = (catId: string) => {
    setCustomCategories((prev) => prev.filter((c) => c.id !== catId));
  };

  const handleAddCustomWeaponType = (wpt: CustomWeaponType) => {
    setCustomWeaponTypes((prev) => {
      const exists = prev.some((w) => w.id === wpt.id);
      if (exists) return prev.map((w) => (w.id === wpt.id ? wpt : w));
      return [...prev, wpt];
    });
  };

  const handleDeleteCustomWeaponType = (wptId: string) => {
    setCustomWeaponTypes((prev) => prev.filter((w) => w.id !== wptId));
  };

  const handleToggleFavoriteWeapon = useCallback((weaponId: string) => {
    setFavoriteWeaponIds((prev) =>
      prev.includes(weaponId) ? prev.filter((id) => id !== weaponId) : [...prev, weaponId]
    );
  }, []);

  const allWeapons: AlienWeapon[] = useMemo(() => {
    const weaponMap = new Map<string, AlienWeapon>();
    WEAPONS.forEach((w) => {
      if (!deletedWeaponIds.includes(w.id)) {
        weaponMap.set(w.id, {
          ...w,
          isFavorite: favoriteWeaponIds.includes(w.id),
          isCustom: false,
        });
      }
    });
    customSkills.forEach((sk) => {
      if (!deletedWeaponIds.includes(sk.id)) {
        weaponMap.set(sk.id, {
          id: sk.id,
          name: sk.name,
          type: sk.type,
          category: sk.category,
          iconName: sk.iconName || 'Zap',
          damage: sk.damage,
          energyDrain: sk.energyDrain,
          moraleDamage: sk.moraleDamage,
          shameIncrease: sk.shameIncrease,
          obedienceGain: sk.obedienceGain,
          lustChange: sk.lustChange,
          partDamageChange: sk.partDamageChange,
          partExposureChange: sk.partExposureChange,
          hpHeal: sk.hpHeal ?? (sk.damage < 0 ? Math.abs(sk.damage) : undefined),
          shieldPenetration: sk.shieldPenetration ?? 20,
          description: sk.description,
          sfxType: sk.sfxType || (sk.type === 'touch' ? 'touch' : sk.type === 'heal' ? 'heal' : sk.type === 'drain' ? 'siphon' : 'laser'),
          isCustom: true,
          isFavorite: favoriteWeaponIds.includes(sk.id),
        } as AlienWeapon);
      }
    });
    if (weaponMap.size === 0) {
      weaponMap.set(FALLBACK_WEAPON.id, FALLBACK_WEAPON);
    }
    return Array.from(weaponMap.values());
  }, [customSkills, deletedWeaponIds, favoriteWeaponIds]);

  const handleDeleteWeapon = useCallback((weaponId: string) => {
    setCustomSkills((prev) => prev.filter((s) => s.id !== weaponId));
    setDeletedWeaponIds((prev) => Array.from(new Set([...prev, weaponId])));
    setSelectedWeapon((prev) => {
      if (prev.id === weaponId) {
        const remaining = allWeapons.filter((w) => w.id !== weaponId);
        return remaining.length > 0 ? remaining[0] : FALLBACK_WEAPON;
      }
      return prev;
    });
  }, [allWeapons]);

  // Persistent AI Config State
  const [aiConfig, setAiConfig] = useState<AiConfig>(() => {
    try {
      const saved = localStorage.getItem('ultra_ai_config_v1');
      if (saved) {
        // Merge over defaults so configs written by older versions never lose newly
        // added preset fields (customSystemPresets / apiProfiles / worldview slots...).
        return { ...DEFAULT_AI_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to parse AI Config:', e);
    }
    return DEFAULT_AI_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem('ultra_ai_config_v1', JSON.stringify(aiConfig));
      queueServerSave({ ultra_ai_config_v1: aiConfig });
    } catch (e) {
      console.error('Failed to save AI Config:', e);
    }
  }, [aiConfig]);

  // Persistent Day Config State
  const [dayConfig, setDayConfig] = useState<DayConfig>(() => {
    try {
      const saved = localStorage.getItem('ultra_day_config_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse DayConfig:', e);
    }
    return DEFAULT_DAY_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem('ultra_day_config_v1', JSON.stringify(dayConfig));
      queueServerSave({ ultra_day_config_v1: dayConfig });
    } catch (e) {
      console.error('Failed to save DayConfig:', e);
    }
  }, [dayConfig]);

  const [isDayConfigOpen, setIsDayConfigOpen] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [isEnvPanelOpen, setIsEnvPanelOpen] = useState<boolean>(false);
  const [isHeroSelectorOpen, setIsHeroSelectorOpen] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<{ message: string; visible: boolean } | null>(null);

  const isPortraitHydratedRef = useRef<boolean>(false);
  // Tracks whether the roster has ever been non-empty in this session. A cold start (no local
  // cache yet) must never propagate an empty roster to the authoritative server disk.
  const hasEverHadHeroinesRef = useRef<boolean>(false);
  // Bumped once IndexedDB portrait rehydration settles, so the heroines persist effect runs
  // at least once after hydration instead of being skipped by its early return.
  const [portraitsHydratedTick, setPortraitsHydratedTick] = useState<number>(0);
  const currentDialogueRef = useRef<any>(null);
  const exportDataRef = useRef<any>(null);

  // Local IndexedDB boot rehydration for portraits & AutoBackup engine initialization
  useEffect(() => {
    let isMounted = true;
    getAllPortraitsFromIDB()
      .then((portraitsMap) => {
        if (!isMounted) return;
        if (portraitsMap && Object.keys(portraitsMap).length > 0) {
          // Preload video and media streams into background buffer
          Object.values(portraitsMap).forEach((mediaUrl) => {
            preloadMediaStream(mediaUrl);
          });

          // Synchronize stream cache
          setVideoStreamCache((prev) => {
            const merged = { ...prev, ...portraitsMap };
            try {
              mirrorStreamCacheToWebStorage(merged);
            } catch (e) {}
            return merged;
          });

          setHeroines((prevHeroines) => {
            return prevHeroines.map((h) => {
              if (portraitsMap[h.id]) {
                return { ...h, customPortrait: portraitsMap[h.id] };
              }
              return h;
            });
          });
          // Immediately hydrate selectedHero customPortrait if available in IDB
          setSelectedHero((prevSelected) => {
            if (prevSelected && portraitsMap[prevSelected.id]) {
              return { ...prevSelected, customPortrait: portraitsMap[prevSelected.id] };
            }
            return prevSelected;
          });

          // Also populate individual tracks for fast synchronous rehydration
          Object.entries(portraitsMap).forEach(([hId, trackSrc]) => {
            try {
              mirrorMediaToWebStorage(`ultra_video_track_${hId}`, trackSrc);
            } catch (e) {}
          });

          // Sync back to server in case server storage was clean or missing portraits
          queueServerSave({}, portraitsMap);
        }
        isPortraitHydratedRef.current = true;
        setPortraitsHydratedTick(1);
      })
      .catch((err) => {
        console.warn('Failed to load local IndexedDB portraits:', err);
        isPortraitHydratedRef.current = true;
        setPortraitsHydratedTick(1);
      });

    // Start background AutoBackup periodic polling & backup event listener
    // 默认自动保存当前对话进度，不全量打包世界观
    const stopAutoBackup = initAutoBackupEngine(
      () => currentDialogueRef.current,
      () => exportDataRef.current
    );
    const unsubscribeBackupEvents = subscribeBackupEvents((event) => {
      if (event.isSilent) {
        // Also update dedicated unified Auto-Save slot
        try {
          const curData = exportDataRef.current;
          if (curData) {
            const autoSnap: SaveSlotData = {
              id: 'slot_auto_save',
              slotNumber: 0,
              slotType: 'auto',
              isAutoSave: true,
              name: `⚡ 自动保存 - ${curData.heroines?.find((h: any) => h.id === curData.selectedHeroId)?.name || '战况'} (第${curData.currentDayCount || 1}天)`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              heroId: curData.selectedHeroId,
              heroName: curData.heroines?.find((h: any) => h.id === curData.selectedHeroId)?.name || '角色',
              dayCount: curData.currentDayCount || 1,
              stats: curData.currentStats,
              activeTeamIds: curData.activeTeamIds || [],
              targetedHeroIds: curData.targetedHeroIds,
              progressMap: curData.progressMap || {},
              partDamage: curData.currentPartDamage || { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
              partExposure: curData.currentPartExposure || { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
              consoleEntries: curData.currentConsoleEntries || [],
              logs: curData.currentLogs || [],
              scenarioConfig: curData.scenarioConfig,
              envTheme: curData.envTheme,
              relationshipState: curData.relationshipState,
              customSettings: curData.customSettings,
              dayConfig: curData.dayConfig,
              aiConfig: curData.aiConfig,
            };
            updateDedicatedAutoSaveSlot(autoSnap);
          }
        } catch (autoErr) {
          console.warn('[AutoBackup] Error syncing dedicated auto-save slot:', autoErr);
        }

        // Silent toast for automatic background backup
        const scopeDesc = event.scope === 'dialogue' ? '当前对话进度' : '全量数据';
        setSaveToast({
          message: event.message || `📁 [自动保存] 已备份${scopeDesc} (${event.sizeKb || 0} KB)`,
          visible: true,
        });
        setTimeout(() => setSaveToast(null), 4000);
      }
    });

    return () => {
      isMounted = false;
      stopAutoBackup();
      unsubscribeBackupEvents();
    };
  }, []);

  // Sync heroines and customPortraits to IndexedDB & localStorage (Debounced to prevent typing lag)
  useEffect(() => {
    if (!isPortraitHydratedRef.current) return;

    const timeoutId = setTimeout(() => {
      // 1. Save heavy media customPortraits to IndexedDB & collect for server
      // Portraits are collected from EVERY local source (per-hero keys / stream cache / memory),
      // so a single missing local copy can still be repaired from the authoritative server store.
      const portraitsMap = collectLocalPortraitPayload(heroines);
      heroines.forEach((h) => {
        if (h.customPortrait) {
          savePortraitToIDB(h.id, h.customPortrait).catch(() => {});
          preloadMediaStream(h.customPortrait);
        }
      });
      // Keep every known portrait durable in IndexedDB (no 5MB quota limit).
      Object.entries(portraitsMap).forEach(([heroId, media]) => {
        if (heroId && media) savePortraitToIDB(heroId, media).catch(() => {});
      });

      // Update videoStreamCache & sync to storage
      if (Object.keys(portraitsMap).length > 0) {
        setVideoStreamCache((prev) => {
          const merged = { ...prev, ...portraitsMap };
          try {
            mirrorStreamCacheToWebStorage(merged);
          } catch (e) {}
          return merged;
        });
      }

      // 2. Save metadata to localStorage and server
      try {
        if (heroines.length === 0) {
          localStorage.removeItem('trainer_heroines_v5');
          localStorage.removeItem('ultra_heroines_v4');
          localStorage.removeItem('ultra_last_selected_hero_id_v1');
          // Only propagate an EMPTY roster to the authoritative server when the user really
          // emptied the roster in this session. Otherwise a cold start (no local cache yet,
          // server still holding characters) would wipe the roster on disk.
          if (hasEverHadHeroinesRef.current) {
            queueServerSave({
              trainer_heroines_v5: [],
              ultra_heroines_v4: [],
              ultra_last_selected_hero_id_v1: '',
            });
          }
          return;
        }
        hasEverHadHeroinesRef.current = true;

        const sanitizedHeroines = heroines.map((h) => {
          if (h.customPortrait && h.customPortrait.startsWith('data:') && h.customPortrait.length > 2000) {
            return { ...h, customPortrait: undefined };
          }
          return h;
        });
        localStorage.setItem('trainer_heroines_v5', JSON.stringify(sanitizedHeroines));
        localStorage.setItem('ultra_heroines_v4', JSON.stringify(sanitizedHeroines));

        queueServerSave({
          trainer_heroines_v5: heroines,
          ultra_heroines_v4: heroines,
        }, Object.keys(portraitsMap).length > 0 ? portraitsMap : undefined);
        // Mirror small portraits into the per-hero web-storage keys (big media stays in IDB + server).
        Object.entries(portraitsMap).forEach(([heroId, media]) => {
          mirrorMediaToWebStorage(`ultra_video_track_${heroId}`, media);
        });
      } catch (e) {
        console.warn('Heroines save error:', e);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [heroines, portraitsHydratedTick]);

  const [selectedHero, setSelectedHero] = useState<Ultrawoman | null>(() => {
    const syncCache = getSynchronousMediaCache();
    try {
      const savedHeroId = localStorage.getItem('ultra_last_selected_hero_id_v1');
      if (savedHeroId) {
        const found = heroines.find((h: Ultrawoman) => h.id === savedHeroId);
        if (found) {
          const enrichedPortrait = found.customPortrait || syncCache[found.id];
          return enrichedPortrait ? { ...found, customPortrait: enrichedPortrait } : found;
        }
      }
    } catch (e) {
      console.warn('Failed to restore last selected hero ID:', e);
    }
    if (heroines && heroines.length > 0) {
      const defaultHero = heroines[0];
      const enrichedPortrait = defaultHero.customPortrait || syncCache[defaultHero.id];
      return enrichedPortrait ? { ...defaultHero, customPortrait: enrichedPortrait } : defaultHero;
    }
    return null;
  });

  // Safe hero fallback: guaranteed non-null Ultrawoman object preventing any runtime crashes in pure/empty state
  const safeHero: Ultrawoman = useMemo(() => {
    return selectedHero || (heroines.length > 0 ? heroines[0] : createBlankHero('pure_blank', '纯净空白角色'));
  }, [selectedHero, heroines]);

  // Ensure selectedHero remains synchronized with any customPortrait/details updates in heroines
  useEffect(() => {
    if (heroines.length === 0) {
      if (selectedHero) setSelectedHero(null);
      return;
    }
    if (!selectedHero) {
      setSelectedHero(heroines[0]);
      return;
    }
    const heroInList = heroines.find((h) => h.id === selectedHero.id);
    if (heroInList) {
      if (heroInList.customPortrait !== selectedHero.customPortrait) {
        setSelectedHero((prev) => (prev ? { ...prev, customPortrait: heroInList.customPortrait } : heroInList));
      }
    } else {
      setSelectedHero(heroines[0]);
    }
  }, [heroines, selectedHero?.id, selectedHero?.customPortrait]);

  useEffect(() => {
    if (selectedHero?.id) {
      try {
        localStorage.setItem('ultra_last_selected_hero_id_v1', selectedHero.id);
        queueServerSave({ ultra_last_selected_hero_id_v1: selectedHero.id });
      } catch (e) {
        console.warn('Failed to save last selected hero ID:', e);
      }
    }
  }, [selectedHero?.id]);

  // Multi-Character Active Team State (localStorage key: ultra_active_team_ids_v1)
  const [activeTeamIds, setActiveTeamIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ultra_active_team_ids_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // ★ 只有角色名册已经加载完成时才按名册过滤，否则先原样保留。
          // 启动瞬间 heroines 可能仍是空数组（新浏览器/清缓存），此时过滤会把在场成员全部丢掉，
          // 随后还会被旧的服务端值覆盖 → 表现为"关闭再打开后在场的人变不完整"。
          if (heroines.length === 0) return parsed.filter((id: string) => typeof id === 'string' && id);
          const valid = parsed.filter((id: string) => heroines.some((h) => h.id === id));
          if (valid.length > 0) return valid;
        }
      }
    } catch (e) {
      console.warn('Failed to restore active team IDs:', e);
    }
    return selectedHero?.id ? [selectedHero.id] : [];
  });

  const [targetScope, setTargetScope] = useState<'primary' | 'all' | 'custom'>(() => {
    try {
      const saved = localStorage.getItem('ultra_target_scope_v1');
      if (saved === 'primary' || saved === 'all' || saved === 'custom') return saved;
    } catch {}
    return 'all';
  });

  const [targetedHeroIds, setTargetedHeroIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ultra_targeted_hero_ids_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return selectedHero?.id ? [selectedHero.id] : [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('ultra_active_team_ids_v1', JSON.stringify(activeTeamIds));
      queueServerSave({ ultra_active_team_ids_v1: activeTeamIds });
    } catch (e) {
      console.warn('Failed to save active team IDs:', e);
    }
  }, [activeTeamIds]);

  useEffect(() => {
    try {
      localStorage.setItem('ultra_target_scope_v1', targetScope);
      localStorage.setItem('ultra_targeted_hero_ids_v1', JSON.stringify(targetedHeroIds));
      queueServerSave({
        ultra_target_scope_v1: targetScope,
        ultra_targeted_hero_ids_v1: targetedHeroIds,
      });
    } catch {}
  }, [targetScope, targetedHeroIds]);

  // Ensure selectedHero is always included in activeTeamIds
  useEffect(() => {
    if (selectedHero?.id && !activeTeamIds.includes(selectedHero.id)) {
      setActiveTeamIds((prev) => [selectedHero.id, ...prev]);
    }
  }, [selectedHero?.id]);

  // 角色名册就绪/变化后，剔除确实已不存在的 id（名册为空时绝不裁剪，避免启动阶段误删在场成员）
  useEffect(() => {
    if (heroines.length === 0) return;
    setActiveTeamIds((prev) => {
      const valid = prev.filter((id) => heroines.some((h) => h.id === id));
      if (valid.length === prev.length) return prev;
      const next = valid.length > 0 ? valid : (selectedHero?.id ? [selectedHero.id] : []);
      console.warn(`[Team] 名册变化：剔除 ${prev.length - valid.length} 个已不存在的在场成员。`);
      return next;
    });
  }, [heroines, selectedHero?.id]);

  // Sync targetedHeroIds when targetScope, selectedHero, or activeTeamIds changes.
  // Guard against the startup race where activeTeamIds has not hydrated yet: writing an
  // empty team over the server-provided target list used to silently drop every target.
  useEffect(() => {
    if (targetScope === 'primary') {
      const id = selectedHero?.id;
      if (!id) return;
      setTargetedHeroIds((prev) => (prev.length === 1 && prev[0] === id ? prev : [id]));
    } else if (targetScope === 'all') {
      if (activeTeamIds.length === 0) return;
      setTargetedHeroIds((prev) => {
        if (prev.length === activeTeamIds.length && prev.every((id, i) => id === activeTeamIds[i])) return prev;
        return activeTeamIds;
      });
    } else if (targetScope === 'custom') {
      if (activeTeamIds.length === 0) return;
      setTargetedHeroIds((prev) => {
        const valid = prev.filter((id) => activeTeamIds.includes(id));
        if (valid.length > 0) return valid.length === prev.length ? prev : valid;
        return selectedHero?.id ? [selectedHero.id] : prev;
      });
    }
  }, [targetScope, selectedHero?.id, activeTeamIds]);

  const handleToggleTargetHero = useCallback((heroId: string) => {
    setTargetedHeroIds((prev) => {
      let next: string[];
      if (prev.includes(heroId)) {
        next = prev.filter((id) => id !== heroId);
        if (next.length === 0) next = [heroId]; // Keep at least 1 hero
      } else {
        next = [...prev, heroId];
      }

      if (selectedHero?.id && next.length === 1 && next[0] === selectedHero.id) {
        setTargetScope('primary');
      } else if (next.length === activeTeamIds.length && activeTeamIds.every((id) => next.includes(id))) {
        setTargetScope('all');
      } else {
        setTargetScope('custom');
      }
      return next;
    });
  }, [selectedHero?.id, activeTeamIds]);

  const handleSetTargetScope = useCallback((scope: 'primary' | 'all' | 'custom') => {
    setTargetScope(scope);
    if (scope === 'primary' && selectedHero?.id) {
      setTargetedHeroIds([selectedHero.id]);
    } else if (scope === 'all') {
      setTargetedHeroIds(activeTeamIds);
    }
  }, [selectedHero?.id, activeTeamIds]);

  // Persistent Progress Map per Heroine (localStorage key: ultra_progress_map_v2)
  const [progressMap, setProgressMap] = useState<Record<string, HeroProgress>>(() => {
    try {
      const saved = localStorage.getItem('ultra_progress_map_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse progress map:', e);
    }
    return {};
  });

  useEffect(() => {
    try {
      safeLocalStorageSet('ultra_progress_map_v2', progressMap);
      if (hasServerHydratedRef.current || Object.keys(progressMap).length > 0) {
        queueServerSave({ ultra_progress_map_v2: progressMap });
      }
    } catch (e) {
      console.error('Failed to save progress map:', e);
    }
  }, [progressMap]);

  // Initial hero setup & restore
  const initialHero = selectedHero || (heroines.length > 0 ? heroines[0] : null);
  const initialSavedProgress = initialHero?.id ? progressMap[initialHero.id] : undefined;

  // ★ 记住"上次选中的调教方式(武器/自定义技能)"的 id。
  // 自定义技能（调教方式）是从服务端异步水合的：启动瞬间武器列表里可能还没有它，
  // 旧逻辑会直接回退到 allWeapons[0] 并把默认项写回 localStorage，
  // 于是用户的选择被永久覆盖 → "每次关闭再打开后调教方式不会自动跳回上次的选项"。
  // 这里把暂时找不到的 id 挂起，等武器列表补齐后再自动回选。
  const pendingWeaponIdRef = useRef<string | null>(null);

  const [selectedWeapon, setSelectedWeapon] = useState<AlienWeapon>(() => {
    try {
      const savedId = localStorage.getItem('ultra_selected_weapon_id_v1');
      if (savedId) {
        const found = allWeapons.find((w) => w.id === savedId);
        if (found) return found;
        // 暂时找不到（自定义技能尚未水合）→ 挂起，先不改写已保存的 id
        pendingWeaponIdRef.current = savedId;
      }
    } catch {}
    return allWeapons[0];
  });

  // 武器/技能列表变化（含服务端补全自定义技能）后，自动回选上次的调教方式
  useEffect(() => {
    const pendingId = pendingWeaponIdRef.current;
    if (!pendingId) return;
    const found = allWeapons.find((w) => w.id === pendingId);
    if (found) {
      pendingWeaponIdRef.current = null;
      setSelectedWeapon((prev) => (prev && prev.id === found.id ? prev : found));
      console.info('[Weapon] 已自动回选上次的调教方式：', found.name);
      return;
    }
    // 该武器确实已被删除，或服务端水合已完成仍找不到 → 放弃挂起，恢复正常偏好保存
    if (deletedWeaponIds.includes(pendingId) || isServerStorageHydrated()) {
      pendingWeaponIdRef.current = null;
    }
  }, [allWeapons, deletedWeaponIds]);

  const [selectedPart, setSelectedPart] = useState<BodyPartId>(() => {
    try {
      const savedPart = localStorage.getItem('ultra_selected_part_v1');
      if (savedPart && safeHero?.bodyParts && safeHero.bodyParts[savedPart as BodyPartId]) {
        return savedPart as BodyPartId;
      }
    } catch {}
    return safeHero?.weakPart || ((safeHero?.bodyParts ? Object.keys(safeHero.bodyParts)[0] : 'timer') as BodyPartId) || 'timer';
  });

  // Dynamic States initialized from initialSavedProgress
  const [dayCount, setDayCount] = useState<number>(initialSavedProgress?.dayCount || 1);
  const [intensity, setIntensity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ultra_selected_intensity_v1');
      if (saved) {
        const num = parseFloat(saved);
        if (!isNaN(num) && num > 0) return num;
      }
    } catch {}
    return 1.0;
  });

  useEffect(() => {
    try {
      // 挂起期间不要写：否则会把"默认第一项"盖掉用户真正保存的选择
      if (selectedWeapon?.id && !pendingWeaponIdRef.current) {
        localStorage.setItem('ultra_selected_weapon_id_v1', selectedWeapon.id);
        queueServerSave({ ultra_selected_weapon_id_v1: selectedWeapon.id });
      }
    } catch {}
  }, [selectedWeapon?.id]);

  useEffect(() => {
    try {
      if (selectedPart) {
        localStorage.setItem('ultra_selected_part_v1', selectedPart);
      }
    } catch {}
  }, [selectedPart]);

  useEffect(() => {
    try {
      localStorage.setItem('ultra_selected_intensity_v1', String(intensity));
    } catch {}
  }, [intensity]);
  const [stats, setStats] = useState<Stats>(() => {
    const base = initialHero?.defaultStats || safeHero.defaultStats;
    const saved = initialSavedProgress?.stats;
    return {
      hp: saved?.hp ?? base.hp,
      energy: saved?.energy ?? base.energy,
      morale: saved?.morale ?? base.morale,
      obedience: saved?.obedience ?? base.obedience,
      shame: saved?.shame ?? base.shame,
      lust: saved?.lust ?? base.lust ?? 10,
      maxHp: saved?.maxHp || base.maxHp || 100,
      maxEnergy: saved?.maxEnergy || base.maxEnergy || 100,
      maxMorale: saved?.maxMorale || base.maxMorale || 100,
      maxObedience: saved?.maxObedience || base.maxObedience || 100,
      maxShame: saved?.maxShame || base.maxShame || 100,
      maxLust: saved?.maxLust || base.maxLust || 100,
    };
  });
  const [partDamage, setPartDamage] = useState<Record<BodyPartId, number>>(
    initialSavedProgress?.partDamage || {
      head: 0,
      timer: 0,
      chest: 0,
      leftArm: 0,
      rightArm: 0,
      torso: 0,
      legs: 0,
    }
  );
  const [partExposure, setPartExposure] = useState<Record<BodyPartId, number>>(
    initialSavedProgress?.partExposure || {
      head: 0,
      timer: 0,
      chest: 0,
      leftArm: 0,
      rightArm: 0,
      torso: 0,
      legs: 0,
    }
  );

  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>(() => {
    if (!initialHero) {
      return [];
    }
    // ★ 三份本地历史里取"最新的一份"。
    //   旧逻辑无条件优先 progressMap，而 progressMap(6MB) 很容易因 localStorage 配额写入失败而变旧，
    //   结果刷新后反而显示很早之前的内容，把刚写进去的角色独立缓存忽略了。
    try {
      const parseArr = (raw: string | null): any[] | undefined => {
        if (!raw) return undefined;
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
        } catch { return undefined; }
      };
      const bestLocal = pickMostCompleteTimeline([
        { source: 'localProgressMap', entries: initialSavedProgress?.consoleEntries },
        { source: 'localHeroKey', entries: parseArr(localStorage.getItem('ultra_chat_entries_v2_' + initialHero.id)) },
        { source: 'localCurrentKey', entries: parseArr(localStorage.getItem('ultra_current_chat_entries_v2')) },
      ]);
      if (bestLocal.entries.length > 0) {
        if (bestLocal.diverged) {
          console.warn('[Memory] 启动时本地三份历史不一致（' + bestLocal.detail + '），已选用最新/最完整的「' + bestLocal.chosenSource + '」。');
        }
        return bestLocal.entries;
      }
    } catch {}

    return [
      {
        id: `init_${Date.now()}`,
        type: 'chat_hero',
        sender: 'heroine',
        heroId: initialHero.id,
        heroName: initialHero.name,
        speakerName: initialHero.name,
        text: initialHero.voiceLines?.greeting?.[0] || `${initialHero.name}沉吟不语，用戒备的目光死死盯着审讯官...`,
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        reactionType: 'defiant',
        psychologicalAnalysis: `战术对讲建立：目标【${initialHero.name}】(${initialHero.personality || '坚毅正义'})。弱点部位：${initialHero.bodyParts[initialHero.weakPart]?.name || initialHero.weakPart}。能量护盾状态：${initialHero.defaultStats.energy}%。`,
      },
    ];
  });
  const [logs, setLogs] = useState<LogEntry[]>(initialSavedProgress?.logs || []);
  const [isConsoleLoading, setIsConsoleLoading] = useState<boolean>(false);
  const [isAutoAttacking, setIsAutoAttacking] = useState<boolean>(false);
  const [isContinuousFiring, setIsContinuousFiring] = useState<boolean>(false);
  const [hitTimestamp, setHitTimestamp] = useState<number>(0);
  const [lastHitPart, setLastHitPart] = useState<BodyPartId | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [isRecharging, setIsRecharging] = useState<boolean>(false);
  const [envTheme, setEnvTheme] = useState<EnvironmentTheme | string>(initialSavedProgress?.envTheme || 'glass');
  const [extraDailyEnvDamage, setExtraDailyEnvDamage] = useState<number>(0);

  const handleSelectEnvTheme = (theme: EnvironmentTheme | string) => {
    setEnvTheme(theme);
  };

  // Custom Environments & Physical Parameters Overrides
  const [customEnvs, setCustomEnvs] = useState<CustomEnvTheme[]>(() => {
    try {
      const saved = localStorage.getItem('ultra_custom_envs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [envParamOverrides, setEnvParamOverrides] = useState<Record<string, EnvPhysicalParams>>(() => {
    try {
      const saved = localStorage.getItem('ultra_env_param_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const handleSaveCustomEnvs = (newList: CustomEnvTheme[]) => {
    setCustomEnvs(newList);
    try {
      localStorage.setItem('ultra_custom_envs', JSON.stringify(newList));
      queueServerSave({ ultra_custom_envs: newList });
    } catch (e) {
      console.warn('Failed to save custom envs:', e);
    }
  };

  const handleSaveEnvParamOverride = (themeKey: string, params: EnvPhysicalParams) => {
    setEnvParamOverrides((prev) => {
      const updated = { ...prev, [themeKey]: params };
      try {
        localStorage.setItem('ultra_env_param_overrides', JSON.stringify(updated));
        queueServerSave({ ultra_env_param_overrides: updated });
      } catch (e) {
        console.warn('Failed to save env param overrides:', e);
      }
      return updated;
    });
  };
  const [dailyLightEffects, setDailyLightEffects] = useState<{
    hpDelta: number;
    energyDelta: number;
    moraleDelta: number;
    shameDelta: number;
    obedienceDelta: number;
    descriptions: string[];
  }>({
    hpDelta: 0,
    energyDelta: 0,
    moraleDelta: 0,
    shameDelta: 0,
    obedienceDelta: 0,
    descriptions: [],
  });

  // Continuous Attack Hold Refs
  const continuousStartTimeRef = useRef<number>(0);
  const continuousStatsAccRef = useRef<{
    hits: number;
    damage: number;
    energyDrained: number;
    moraleLost: number;
    shameGained: number;
    obedienceGained: number;
    lustChanged: number;
  }>({ hits: 0, damage: 0, energyDrained: 0, moraleLost: 0, shameGained: 0, obedienceGained: 0, lustChanged: 0 });

  // Energy Shock / Coma state (loss of consciousness when energy = 0%)
  const [isEnergyShock, setIsEnergyShock] = useState<boolean>(initialSavedProgress?.isEnergyShock || false);
  const isEnergyShockRef = useRef<boolean>(initialSavedProgress?.isEnergyShock || false);

  useEffect(() => {
    isEnergyShockRef.current = isEnergyShock;
  }, [isEnergyShock]);

  // Low HP Random Event Banner State
  const [activeRandomEvent, setActiveRandomEvent] = useState<{
    id: string;
    name: string;
    type: 'resistance' | 'whisper' | 'surge' | 'faultline';
    tag: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    if (activeRandomEvent) {
      const timer = setTimeout(() => {
        setActiveRandomEvent(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeRandomEvent]);

  // Modal & Audio UI States
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isAiConfigOpen, setIsAiConfigOpen] = useState<boolean>(false);
  const [isCustomSkillModalOpen, setIsCustomSkillModalOpen] = useState<boolean>(false);
  const [customSkillModalTab, setCustomSkillModalTab] = useState<'arsenal' | 'forge' | 'category' | 'types' | 'backup'>('arsenal');
  const [customSkillModalEditingId, setCustomSkillModalEditingId] = useState<string | null>(null);

  const handleOpenCustomSkillModalTab = useCallback(
    (tab: 'arsenal' | 'forge' | 'category' | 'types' | 'backup' = 'arsenal', skillId?: string) => {
      setCustomSkillModalTab(tab);
      setCustomSkillModalEditingId(skillId || null);
      setIsCustomSkillModalOpen(true);
    },
    []
  );

  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState<boolean>(false);
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState<boolean>(false);
  const [isStateExportImportOpen, setIsStateExportImportOpen] = useState<boolean>(false);
  const [isSaveLoadModalOpen, setIsSaveLoadModalOpen] = useState<boolean>(false);
  const [isUnifiedSaveModalOpen, setIsUnifiedSaveModalOpen] = useState<boolean>(false);
  const [unifiedSaveModalTab, setUnifiedSaveModalTab] = useState<StorageModalTab>('slots');
  const [isRealTimeModalOpen, setIsRealTimeModalOpen] = useState<boolean>(false);
  const [isQuickSaving, setIsQuickSaving] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try { return ultraAudio.getSettings().isMuted === true; } catch (e) { return false; }
  });
  const [masterVolume, setMasterVolume] = useState<number>(() => {
    try {
      const v = ultraAudio.getSettings().masterVolume;
      return typeof v === 'number' ? v : 0.8;
    } catch (e) { return 0.8; }
  });

  // Real-Time Sync Mode State (Persistent in localStorage: ultra_real_time_state_v1)
  const [realTimeState, setRealTimeState] = useState<RealTimeSyncState>(() => {
    try {
      const saved = localStorage.getItem('ultra_real_time_state_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            isEnabled: !!parsed.isEnabled,
            firstCreatedTimestamp: parsed.firstCreatedTimestamp || Date.now(),
            lastVisitedTimestamp: Date.now(),
            initialRealDateStr: parsed.initialRealDateStr || new Date().toISOString().split('T')[0],
          };
        }
      }
    } catch (e) {
      console.warn('Failed to restore realTimeState:', e);
    }
    if (initialSavedProgress?.realTimeSyncState) {
      return {
        ...initialSavedProgress.realTimeSyncState,
        lastVisitedTimestamp: Date.now(),
      };
    }
    return DEFAULT_REAL_TIME_STATE;
  });

  // Keep realTimeState continuously persisted
  useEffect(() => {
    try {
      safeLocalStorageSet('ultra_real_time_state_v1', realTimeState);
      queueServerSave({ ultra_real_time_state_v1: realTimeState });
    } catch (e) {
      console.warn('Failed to save realTimeState:', e);
    }
  }, [realTimeState]);

  // Synchronize dayCount with real-world time elapsed if Real-Time Sync is enabled
  useEffect(() => {
    if (realTimeState.isEnabled && realTimeState.firstCreatedTimestamp) {
      const calculatedDay = calculateRealTimeDay(realTimeState.firstCreatedTimestamp);
      if (calculatedDay !== dayCount) {
        setDayCount(calculatedDay);
      }
    }
  }, [realTimeState.isEnabled, realTimeState.firstCreatedTimestamp, dayCount]);

  // Scenario Presets State (Restores per-hero scenario or global scenario with fallback)
  const [scenarioConfig, setScenarioConfig] = useState<ScenarioConfig>(() => {
    try {
      const saved = localStorage.getItem('ultra_selected_scenario_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) return parsed;
      }
    } catch {}
    if (initialSavedProgress?.scenarioConfig) {
      return initialSavedProgress.scenarioConfig;
    }
    return NEUTRAL_SCENARIO;
  });

  const [customScenarios, setCustomScenarios] = useState<ScenarioConfig[]>(() => {
    try {
      const saved = localStorage.getItem('ultra_custom_scenarios_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [deletedScenarioIds, setDeletedScenarioIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ultra_deleted_scenarios_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Keep scenarioConfig continuously persisted
  useEffect(() => {
    if (scenarioConfig) {
      try {
        safeLocalStorageSet('ultra_selected_scenario_v1', scenarioConfig);
        queueServerSave({ ultra_selected_scenario_v1: scenarioConfig });
      } catch (e) {
        console.warn('Failed to save selected scenario:', e);
      }
    }
  }, [scenarioConfig]);

  // Keep customScenarios continuously persisted
  useEffect(() => {
    try {
      safeLocalStorageSet('ultra_custom_scenarios_v1', customScenarios);
      queueServerSave({ ultra_custom_scenarios_v1: customScenarios });
    } catch (e) {
      console.warn('Failed to save custom scenarios:', e);
    }
  }, [customScenarios]);

  // Keep deletedScenarioIds continuously persisted
  useEffect(() => {
    try {
      safeLocalStorageSet('ultra_deleted_scenarios_v1', deletedScenarioIds);
      queueServerSave({ ultra_deleted_scenarios_v1: deletedScenarioIds });
    } catch (e) {
      console.warn('Failed to save deleted scenario ids:', e);
    }
  }, [deletedScenarioIds]);

  // Keep customEnvs and envParamOverrides continuously persisted
  useEffect(() => {
    try {
      safeLocalStorageSet('ultra_custom_envs', customEnvs);
      queueServerSave({ ultra_custom_envs: customEnvs });
    } catch (e) {
      console.warn('Failed to save custom envs:', e);
    }
  }, [customEnvs]);

  useEffect(() => {
    try {
      safeLocalStorageSet('ultra_env_param_overrides', envParamOverrides);
      queueServerSave({ ultra_env_param_overrides: envParamOverrides });
    } catch (e) {
      console.warn('Failed to save env param overrides:', e);
    }
  }, [envParamOverrides]);

  const availableScenarios = [...DEFAULT_SCENARIO_PRESETS, ...customScenarios].filter(
    (s) => !deletedScenarioIds.includes(s.id)
  );

  // Relationship State (Restores per-hero relationship if saved, while preserving and merging all global and custom relationship slots)
  const [relationshipState, setRelationshipState] = useState<RelationshipState>(() => {
    let baseState: Partial<RelationshipState> = {};
    if (initialSavedProgress?.relationshipState) {
      baseState = initialSavedProgress.relationshipState;
    } else {
      try {
        const saved = selectedHero?.id ? localStorage.getItem('ultra_relationship_state_v1_' + selectedHero.id) : null;
        if (saved) {
          baseState = JSON.parse(saved);
        }
      } catch {}
    }
    const mergedSlots = getAllRelationshipSlots(baseState as RelationshipState);
    return {
      activeSlotId: baseState.activeSlotId || mergedSlots[0]?.id || NEUTRAL_RELATIONSHIP_SLOT.id,
      isLocked: !!baseState.isLocked,
      manualOverrideSlotId: baseState.manualOverrideSlotId,
      lockedAtDay: baseState.lockedAtDay,
      historyLogs: baseState.historyLogs || [],
      customSlots: baseState.customSlots,
      slots: mergedSlots,
    };
  });

  const allRelationshipSlots = useMemo(() => {
    return getAllRelationshipSlots(relationshipState);
  }, [relationshipState]);

  const activeRelationship = useMemo(() => {
    return allRelationshipSlots.find((s) => s.id === relationshipState.activeSlotId) || allRelationshipSlots[0] || NEUTRAL_RELATIONSHIP_SLOT;
  }, [allRelationshipSlots, relationshipState.activeSlotId]);

  const getHeroActiveRelationship = useCallback((heroId: string): RelationshipSlot => {
    if (heroId === selectedHero?.id && activeRelationship) {
      return activeRelationship;
    }
    const heroProgress = progressMap[heroId];
    if (heroProgress?.relationshipState) {
      const slots = getAllRelationshipSlots(heroProgress.relationshipState);
      const found = slots.find((s) => s.id === heroProgress.relationshipState.activeSlotId);
      if (found) return found;
    }
    if (heroProgress?.activeRelationship) {
      return heroProgress.activeRelationship;
    }
    try {
      const saved = localStorage.getItem('ultra_relationship_state_v1_' + heroId);
      if (saved) {
        const parsed = JSON.parse(saved);
        const slots = getAllRelationshipSlots(parsed);
        const found = slots.find((s) => s.id === parsed.activeSlotId);
        if (found) return found;
      }
    } catch {}
    return NEUTRAL_RELATIONSHIP_SLOT;
  }, [progressMap, selectedHero?.id, activeRelationship]);

  const getHeroActiveRelationshipTitle = useCallback((heroId: string): string => {
    const rel = getHeroActiveRelationship(heroId);
    return rel ? rel.title : '战友关系';
  }, [getHeroActiveRelationship]);

  // 在场角色名单：供"智能建议"在多人同台时分清谁是谁（主焦点角色排第一位）
  const presentCharacterRoster = useMemo(() => {
    const orderedIds = [selectedHero?.id, ...activeTeamIds].filter(Boolean) as string[];
    const seen = new Set<string>();
    const out: Array<{ id: string; name: string; relationshipTitle?: string; personality?: string }> = [];
    for (const id of orderedIds) {
      if (!id || seen.has(id)) continue;
      const h = heroines.find((x) => x.id === id);
      if (!h) continue;
      seen.add(id);
      const rel = getHeroActiveRelationship(id);
      out.push({
        id,
        name: h.name,
        relationshipTitle: rel?.title,
        personality: h.personalityCustomName || h.personality,
      });
    }
    return out;
  }, [selectedHero?.id, activeTeamIds, heroines, getHeroActiveRelationship]);

  // Helper: compute initial stats based on current scenario config preset
  const getInitialHeroStatsFromScenario = useCallback((memberHero: Ultrawoman, scenario: ScenarioConfig): Stats => {
    const mDef = memberHero.defaultStats;
    const mMaxHp = mDef.maxHp ?? 100;
    const mMaxEnergy = mDef.maxEnergy ?? 100;
    const mMaxMorale = mDef.maxMorale ?? 100;
    const mMaxObedience = mDef.maxObedience ?? 100;
    const mMaxShame = mDef.maxShame ?? 100;
    const mMaxLust = mDef.maxLust ?? 100;

    const sp = scenario.initialStatsPct;
    if (!sp) {
      return {
        hp: mDef.hp !== undefined ? Math.min(mDef.hp, mMaxHp) : mMaxHp,
        energy: mDef.energy !== undefined ? Math.min(mDef.energy, mMaxEnergy) : mMaxEnergy,
        morale: mDef.morale !== undefined ? Math.min(mDef.morale, mMaxMorale) : mMaxMorale,
        obedience: mDef.obedience !== undefined ? Math.min(mDef.obedience, mMaxObedience) : 0,
        shame: mDef.shame !== undefined ? Math.min(mDef.shame, mMaxShame) : 0,
        lust: mDef.lust !== undefined ? Math.min(mDef.lust, mMaxLust) : 10,
        maxHp: mMaxHp,
        maxEnergy: mMaxEnergy,
        maxMorale: mMaxMorale,
        maxObedience: mMaxObedience,
        maxShame: mMaxShame,
        maxLust: mMaxLust,
      };
    }

    return {
      hp: sp.hpPct !== undefined ? Math.min(Math.max(0, Math.round((sp.hpPct / 100) * mMaxHp)), mMaxHp) : (mDef.hp !== undefined ? Math.min(mDef.hp, mMaxHp) : mMaxHp),
      energy: sp.energyPct !== undefined ? Math.min(Math.max(0, Math.round((sp.energyPct / 100) * mMaxEnergy)), mMaxEnergy) : (mDef.energy !== undefined ? Math.min(mDef.energy, mMaxEnergy) : mMaxEnergy),
      morale: sp.moralePct !== undefined ? Math.min(Math.max(0, Math.round((sp.moralePct / 100) * mMaxMorale)), mMaxMorale) : (mDef.morale !== undefined ? Math.min(mDef.morale, mMaxMorale) : mMaxMorale),
      obedience: sp.trustPct !== undefined ? Math.min(Math.max(0, Math.round((sp.trustPct / 100) * mMaxObedience)), mMaxObedience) : (mDef.obedience !== undefined ? Math.min(mDef.obedience, mMaxObedience) : 0),
      shame: sp.shamePct !== undefined ? Math.min(Math.max(0, Math.round((sp.shamePct / 100) * mMaxShame)), mMaxShame) : (mDef.shame !== undefined ? Math.min(mDef.shame, mMaxShame) : 0),
      lust: sp.lustPct !== undefined ? Math.min(Math.max(0, Math.round((sp.lustPct / 100) * mMaxLust)), mMaxLust) : (mDef.lust !== undefined ? Math.min(mDef.lust, mMaxLust) : 10),
      maxHp: mMaxHp,
      maxEnergy: mMaxEnergy,
      maxMorale: mMaxMorale,
      maxObedience: mMaxObedience,
      maxShame: mMaxShame,
      maxLust: mMaxLust,
    };
  }, []);

  const getInitialRelationshipStateFromScenario = useCallback((scenario: ScenarioConfig): RelationshipState => {
    const allSlots = getAllRelationshipSlots();
    const targetSlotId = scenario.boundRelationshipSlotId || allSlots[0]?.id || NEUTRAL_RELATIONSHIP_SLOT.id;
    const slot = allSlots.find((s) => s.id === targetSlotId) || allSlots[0] || NEUTRAL_RELATIONSHIP_SLOT;
    return {
      activeSlotId: targetSlotId,
      isLocked: false,
      historyLogs: [
        {
          id: `log_reset_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          dayCount: 1,
          fromTitle: '重置归位',
          toTitle: slot.title,
          triggerType: 'manual_trigger',
          reason: `按剧情开局预设【${scenario.name}】自动联动还原关联羁绊`,
        },
      ],
      slots: allSlots,
    };
  }, []);

  // Persist relationshipState to localStorage and server
  useEffect(() => {
    if (!selectedHero?.id) return;
    try {
      const key = 'ultra_relationship_state_v1_' + selectedHero.id;
      safeLocalStorageSet(key, relationshipState);
      if (relationshipState.slots && relationshipState.slots.length > 0) {
        safeLocalStorageSet('ultra_global_relationship_slots_v1', relationshipState.slots);
      }
      queueServerSave({ [key]: relationshipState, ultra_global_relationship_slots_v1: relationshipState.slots });
    } catch (e) {
      console.error('Failed to save relationship state:', e);
    }
  }, [relationshipState, selectedHero?.id]);

  // Trigger manual or button evaluation
  const handleTriggerRelationshipEval = useCallback(() => {
    const evalResult = evaluateBestRelationshipSlot(
      stats,
      selectedHero,
      scenarioConfig,
      allRelationshipSlots,
      relationshipState.activeSlotId,
      false, // allow re-eval on button click even if locked
      dayCount,
      relationshipState
    );

    const now = new Date().toLocaleTimeString();
    setRelationshipState((prev) => ({
      ...prev,
      activeSlotId: evalResult.selectedSlot.id,
      historyLogs: [
        {
          id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          timestamp: now,
          dayCount,
          fromTitle: activeRelationship.title,
          toTitle: evalResult.selectedSlot.title,
          triggerType: 'manual_trigger',
          reason: evalResult.matchReason,
        },
        ...(prev.historyLogs || []),
      ],
    }));
  }, [stats, selectedHero, scenarioConfig, allRelationshipSlots, relationshipState, dayCount, activeRelationship.title]);

  // Auto-evaluate relationship on stats / dayCount change if not locked
  useEffect(() => {
    if (relationshipState.isLocked) return;

    const evalResult = evaluateBestRelationshipSlot(
      stats,
      selectedHero,
      scenarioConfig,
      allRelationshipSlots,
      relationshipState.activeSlotId,
      relationshipState.isLocked,
      dayCount,
      relationshipState
    );

    if (evalResult.isChanged) {
      const now = new Date().toLocaleTimeString();
      setRelationshipState((prev) => ({
        ...prev,
        activeSlotId: evalResult.selectedSlot.id,
        historyLogs: [
          {
            id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            timestamp: now,
            dayCount,
            fromTitle: activeRelationship.title,
            toTitle: evalResult.selectedSlot.title,
            triggerType: 'auto_eval',
            reason: evalResult.matchReason,
          },
          ...(prev.historyLogs || []),
        ],
      }));
    }
  }, [stats, dayCount, scenarioConfig, relationshipState.isLocked, selectedHero, relationshipState.customSlots]);

  const handleSwitchRelationship = useCallback(
    (slot: RelationshipSlot) => {
      setRelationshipState((prev) => {
        if (prev.activeSlotId === slot.id && prev.isLocked) return prev;
        const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        return {
          ...prev,
          activeSlotId: slot.id,
          manualOverrideSlotId: slot.id,
          isLocked: true, // 手动选择确立后自动锁定，防止随小数值波动被自动覆盖
          historyLogs: [
            {
              id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              timestamp: now,
              dayCount,
              fromTitle: activeRelationship.title,
              toTitle: slot.title,
              triggerType: 'manual_trigger',
              reason: `属性满足后在页面手动点击“成为【${slot.title}】”切换并锁定确立`,
            },
            ...(prev.historyLogs || []),
          ],
        };
      });

      setConsoleEntries((prev) => [
        ...prev,
        {
          id: 'rel_switch_' + Date.now(),
          type: 'system',
          time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          text: `✨【关系确立与切换】属性与契合度达成！【${safeHero.name}】与指挥官的关系已成功确立为：【${slot.title}】（${slot.description}）`,
          sender: 'system',
        },
      ]);

      ultraAudio.playChimeSFX();
    },
    [dayCount, activeRelationship?.title, safeHero.name]
  );

  // Authoritative Local Server Disk Storage Hydration on App Mount (Never rely on transient browser cache)
  // hasServerHydratedRef must be true only AFTER the server snapshot has been applied — it is used
  // as the "safe to write to the server disk" signal. Setting it at the start of the fetch used to
  // let boot-time defaults overwrite newer presets/saves on disk.
  const hasServerHydratedRef = useRef(false);
  const hasServerHydrationStartedRef = useRef(false);
  useEffect(() => {
    if (hasServerHydrationStartedRef.current) return;
    hasServerHydrationStartedRef.current = true;
    let isMounted = true;
    // Safety net: never keep the server-write gate closed forever if the request never settles.
    const hydrationSafetyTimer = setTimeout(() => {
      if (!hasServerHydratedRef.current) {
        hasServerHydratedRef.current = true;
        markServerStorageHydrated();
      }
    }, 8000);
    // Asynchronously load save slots from server disk, IndexedDB, and cache immediately
    loadSaveSlotsAsync().then((slots) => {
      if (slots && slots.length > 0) {
        console.log(`[App] Initialized ${slots.length} save slots from persistent storage.`);
      }
    }).catch((e) => console.warn('[App] Error loading initial save slots:', e));

    fetchServerStorage().then(async (serverData) => {
      if (!isMounted || !serverData) return;
      const { storage, portraits } = serverData;

      // 0. Universal portrait hydration from serverPortraitsCache / portraits.json
      if (portraits && typeof portraits === 'object' && Object.keys(portraits).length > 0) {
        setVideoStreamCache((prev) => {
          const next = { ...prev };
          Object.entries(portraits).forEach(([hId, pUrl]) => {
            if (pUrl && typeof pUrl === 'string') {
              next[hId] = pUrl;
              savePortraitToIDB(hId, pUrl).catch(() => {});
              try {
                mirrorMediaToWebStorage(`ultra_video_track_${hId}`, pUrl);
              } catch (e) {}
            }
          });
          return next;
        });

        setHeroines((prevHeroines) => {
          return prevHeroines.map((h) => {
            const p = portraits[h.id];
            if (p && !h.customPortrait) {
              return { ...h, customPortrait: p };
            }
            return h;
          });
        });

        setSelectedHero((prevSelected) => {
          if (prevSelected && portraits[prevSelected.id] && !prevSelected.customPortrait) {
            return { ...prevSelected, customPortrait: portraits[prevSelected.id] };
          }
          return prevSelected;
        });
      }

      if (!storage || Object.keys(storage).length === 0) {
        console.log('[App] Pure initial state detected: Server storage is clean.');
        return;
      }

      console.log(`[App] Authoritative server storage loaded from local disk: ${Object.keys(storage).length} keys, ${Object.keys(portraits || {}).length} portraits.`);

      // 1. Rehydrate Heroines and Custom Portraits
      const savedHeroines = storage['trainer_heroines_v5'] || storage['ultra_heroines_v4'];
      if (Array.isArray(savedHeroines) && savedHeroines.length > 0) {
        const syncCache = getSynchronousMediaCache();
        const enrichedHeroines = savedHeroines.filter((h: any) => h && h.id).map((h: Ultrawoman) => {
          const p = portraits?.[h.id] || h.customPortrait || syncCache[h.id] || videoStreamCache[h.id];
          if (p) {
            savePortraitToIDB(h.id, p).catch(() => {});
            try {
              mirrorMediaToWebStorage(`ultra_video_track_${h.id}`, p);
            } catch (e) {}
          }
          return p ? { ...h, customPortrait: p } : h;
        });

        setHeroines((prevHeroines) => {
          return enrichedHeroines.map((h: Ultrawoman) => {
            const existing = prevHeroines.find((ph) => ph.id === h.id);
            const p = h.customPortrait || existing?.customPortrait || syncCache[h.id];
            return p ? { ...h, customPortrait: p } : h;
          });
        });

        const lastHeroId = storage['ultra_last_selected_hero_id_v1'];
        setSelectedHero((prevSelected) => {
          const targetId = lastHeroId || prevSelected?.id || enrichedHeroines[0]?.id;
          const found = enrichedHeroines.find((h: Ultrawoman) => h.id === targetId);
          if (found) {
            const p = found.customPortrait || prevSelected?.customPortrait || syncCache[found.id];
            return p ? { ...found, customPortrait: p } : found;
          }
          return prevSelected;
        });
      }

      // 2. Rehydrate Skills, Weapons, Factions, Scenarios, AI & Day Configs
      if (Array.isArray(storage['ultra_custom_skills_v1'])) {
        setCustomSkills(storage['ultra_custom_skills_v1']);
      }
      // ★ 会话偏好（调教方式 / 部位 / 强度）也随服务端回灌：
      // 旧版只从 localStorage 读取，换浏览器或清缓存后就丢了；更糟的是启动时的默认值会把
      // 已保存的 id 覆盖掉（"调教方式不会自动跳回上次选项"）。这里以服务端为准补齐。
      if (typeof storage['ultra_selected_weapon_id_v1'] === 'string' && storage['ultra_selected_weapon_id_v1']) {
        const serverWeaponId = storage['ultra_selected_weapon_id_v1'];
        let localWeaponId: string | null = null;
        try {
          localWeaponId = localStorage.getItem('ultra_selected_weapon_id_v1');
        } catch {}
        if (serverWeaponId !== localWeaponId) {
          // 挂起 + 写回本地：等自定义技能列表就绪后由回选 effect 自动跳到这一项
          pendingWeaponIdRef.current = serverWeaponId;
          try {
            localStorage.setItem('ultra_selected_weapon_id_v1', serverWeaponId);
          } catch {}
        }
      }
      if (typeof storage['ultra_selected_part_v1'] === 'string' && storage['ultra_selected_part_v1']) {
        safeLocalStorageSet('ultra_selected_part_v1', storage['ultra_selected_part_v1']);
      }
      if (typeof storage['ultra_selected_intensity_v1'] === 'number' && storage['ultra_selected_intensity_v1'] > 0) {
        setIntensity(storage['ultra_selected_intensity_v1']);
      }
      if (Array.isArray(storage['ultra_custom_skill_categories_v1'])) {
        setCustomCategories(storage['ultra_custom_skill_categories_v1']);
      }
      if (Array.isArray(storage['ultra_custom_weapon_types_v1'])) {
        setCustomWeaponTypes(storage['ultra_custom_weapon_types_v1']);
      }
      // NOTE: the persisted key is ultra_deleted_weapons_v1 (the old name is kept as a fallback).
      const deletedWeapons = Array.isArray(storage['ultra_deleted_weapons_v1'])
        ? storage['ultra_deleted_weapons_v1']
        : storage['ultra_deleted_weapon_ids_v1'];
      if (Array.isArray(deletedWeapons)) {
        setDeletedWeaponIds(deletedWeapons);
      }
      if (Array.isArray(storage['ultra_favorite_weapons_v1'])) {
        setFavoriteWeaponIds(storage['ultra_favorite_weapons_v1']);
      }
      if (Array.isArray(storage['ultra_factions_v1'])) {
        setFactions(storage['ultra_factions_v1']);
      }
      if (storage['ultra_ai_config_v1']) {
        // Merge over defaults so a config written by an older version never loses preset fields.
        const serverAiConfig: AiConfig = { ...DEFAULT_AI_CONFIG, ...storage['ultra_ai_config_v1'] };
        setAiConfig(serverAiConfig);
        try {
          safeLocalStorageSet('ultra_ai_config_v1', serverAiConfig);
          if (Array.isArray(serverAiConfig.apiProfiles) && serverAiConfig.apiProfiles.length > 0) {
            safeLocalStorageSet('ultra_ai_config_presets_v1', serverAiConfig.apiProfiles);
          }
        } catch {}
      }
      if (storage['ultra_day_config_v1']) {
        setDayConfig(storage['ultra_day_config_v1']);
      }
      if (storage['ultra_selected_scenario_v1']) {
        setScenarioConfig(storage['ultra_selected_scenario_v1']);
      }
      if (Array.isArray(storage['ultra_custom_scenarios_v1'])) {
        setCustomScenarios(storage['ultra_custom_scenarios_v1']);
      }
      if (Array.isArray(storage['ultra_deleted_scenarios_v1'])) {
        setDeletedScenarioIds(storage['ultra_deleted_scenarios_v1']);
      }
      if (Array.isArray(storage['ultra_active_team_ids_v1'])) {
        // ★ 在场小队"不丢人"合并：
        // 本地 localStorage 在每次改动时都会同步写入（= 本浏览器最新意图），而服务端是防抖 300ms /
        // 关窗时才落盘，可能是旧值。旧逻辑无条件用服务端覆盖 → 一刷新就少人（"在场的人变不完整"）。
        // 规则：服务端是超集 → 用服务端；否则一律以本地为准并回写服务端修复。
        const serverTeam = (storage['ultra_active_team_ids_v1'] as any[]).filter((id) => typeof id === 'string' && id);
        const localTeam = (Array.isArray(activeTeamIds) ? activeTeamIds : []).filter((id) => typeof id === 'string' && id);
        const serverCoversLocal = localTeam.every((id) => serverTeam.includes(id));
        if (serverTeam.length > 0) {
          if (localTeam.length === 0 || serverCoversLocal) {
            if (serverTeam.length !== localTeam.length) setActiveTeamIds(serverTeam);
          } else {
            console.warn(
              `[Team] 服务端在场小队(${serverTeam.length})比本地(${localTeam.length})更旧/更少，已保留本地成员并回写修复。`
            );
            const repairTeam = localTeam;
            setTimeout(() => {
              safeLocalStorageSet('ultra_active_team_ids_v1', repairTeam);
              queueServerSave({ ultra_active_team_ids_v1: repairTeam });
            }, 0);
          }
        } else if (localTeam.length === 0) {
          setActiveTeamIds(serverTeam);
        } else {
          // 服务端为空但本地有成员：绝不能清空，回写服务端。
          const repairTeam = localTeam;
          setTimeout(() => {
            queueServerSave({ ultra_active_team_ids_v1: repairTeam });
          }, 0);
        }
      }
      if (storage['ultra_custom_settings_v1']) {
        setCustomSettings(storage['ultra_custom_settings_v1']);
      }
      // Previously missing keys: without these the local defaults were re-pushed over the
      // authoritative values on the first change after a cold start.
      if (storage['ultra_target_scope_v1'] === 'primary' || storage['ultra_target_scope_v1'] === 'all' || storage['ultra_target_scope_v1'] === 'custom') {
        setTargetScope(storage['ultra_target_scope_v1']);
      }
      if (Array.isArray(storage['ultra_targeted_hero_ids_v1'])) {
        setTargetedHeroIds(storage['ultra_targeted_hero_ids_v1']);
      }
      if (storage['ultra_real_time_state_v1']) {
        setRealTimeState({
          ...storage['ultra_real_time_state_v1'],
          lastVisitedTimestamp: Date.now(),
        });
        safeLocalStorageSet('ultra_real_time_state_v1', storage['ultra_real_time_state_v1']);
      }
      if (Array.isArray(storage['ultra_custom_envs'])) {
        setCustomEnvs(storage['ultra_custom_envs']);
      }
      if (storage['ultra_env_param_overrides']) {
        setEnvParamOverrides(storage['ultra_env_param_overrides']);
      }
      if (Array.isArray(storage['ultra_global_relationship_slots_v1'])) {
        saveGlobalRelationshipSlots(storage['ultra_global_relationship_slots_v1']);
      }
      // ★ 回灌"每个角色当前生效的羁绊关系"（ultra_relationship_state_v1_<heroId>）。
      // 旧版只回灌了全局关系卡库和当前角色的进度，其它在场角色读不到自己的关系状态，
      // 于是界面只能退回默认关系卡（例如把"陌生人/后宫团"当成真实关系），
      // 点开某个角色时又会用默认项新建一份 → 表现为"人物关系保存后不实时/不正确，重启才对"。
      try {
        const relPrefix = 'ultra_relationship_state_v1_';
        let restoredRelCount = 0;
        for (const [key, value] of Object.entries(storage)) {
          if (!key.startsWith(relPrefix) || !value || typeof value !== 'object') continue;
          const heroId = key.slice(relPrefix.length);
          if (!heroId) continue;
          // 本地已有的（可能是本次会话刚保存的）优先，服务端仅在本地缺失时补齐
          let hasLocal = false;
          try {
            hasLocal = !!localStorage.getItem(key);
          } catch {}
          if (!hasLocal) {
            safeLocalStorageSet(key, value);
            restoredRelCount++;
          }
        }
        if (restoredRelCount > 0) {
          console.log(`[Relationship] 已从服务端回灌 ${restoredRelCount} 个角色的羁绊关系状态。`);
        }
      } catch (e) {
        console.warn('[Relationship] 回灌角色羁绊状态失败:', e);
      }
      // Auto-backup preferences live in a standalone localStorage key consumed by the engine.
      if (storage['ultra_auto_backup_config_v1'] && typeof storage['ultra_auto_backup_config_v1'] === 'object') {
        safeLocalStorageSet('ultra_auto_backup_config_v1', storage['ultra_auto_backup_config_v1']);
      }
      // 会话前情摘要也随服务端存储回灌，换浏览器/清缓存后上下文不丢。
      // ★ 但不能无条件覆盖本地：如果本地摘要更新（例如刚生成完就刷新，服务端那次写入被
      //   "水合完成前禁止写盘"的保护丢弃了），无条件覆盖会让长效记忆回退一版。这里按
      //   updatedAt / coveredCount 取更新的那一份合并。
      if (storage['ultra_session_summary_v1'] && typeof storage['ultra_session_summary_v1'] === 'object') {
        const remoteSummaryStore: Record<string, any> = { ...storage['ultra_session_summary_v1'] };
        let summaryMerged = false;
        try {
          const localSummaryStore = getSessionSummaryStore();
          for (const [heroKey, localRec] of Object.entries(localSummaryStore)) {
            const lr: any = localRec;
            if (!lr || !lr.summary) continue;
            const rr: any = remoteSummaryStore[heroKey];
            const localIsNewer =
              !rr || !rr.summary ||
              (Number(lr.updatedAt) || 0) > (Number(rr.updatedAt) || 0) ||
              ((Number(lr.updatedAt) || 0) === (Number(rr.updatedAt) || 0) &&
                (Number(lr.coveredCount) || 0) > (Number(rr.coveredCount) || 0));
            if (localIsNewer) {
              remoteSummaryStore[heroKey] = lr;
              summaryMerged = true;
            }
          }
        } catch (e) {
          // 解析失败就退回"以服务端为准"
        }
        safeLocalStorageSet('ultra_session_summary_v1', remoteSummaryStore);
        if (summaryMerged) {
          // 合并结果比服务端新：等水合门闩放开后补写回服务端，避免下次刷新又回退。
          setTimeout(() => {
            try {
              queueServerSave({ [SESSION_SUMMARY_KEY]: getSessionSummaryStore() });
            } catch (e) {}
          }, 0);
        }
      }

      // 2.5 Rehydrate Save Slots
      if (Array.isArray(storage['ultra_game_save_slots_v1']) && storage['ultra_game_save_slots_v1'].length > 0) {
        saveLocalSaveSlots(storage['ultra_game_save_slots_v1']);
      }

      // 3. Rehydrate Progress Map and Active Hero Stats & Dialogue
      if (storage['ultra_progress_map_v2'] && typeof storage['ultra_progress_map_v2'] === 'object') {
        const pMap = storage['ultra_progress_map_v2'];
        setProgressMap(pMap);
        safeLocalStorageSet('ultra_progress_map_v2', pMap);

        const targetId = storage['ultra_last_selected_hero_id_v1'] || selectedHero?.id;
        const targetProgress = pMap[targetId];
        if (targetProgress) {
          if (targetProgress.stats) setStats(targetProgress.stats);
          if (targetProgress.dayCount) setDayCount(targetProgress.dayCount);
          if (targetProgress.partDamage) setPartDamage(targetProgress.partDamage);
          if (targetProgress.partExposure) setPartExposure(targetProgress.partExposure);
          if (targetProgress.envTheme) setEnvTheme(targetProgress.envTheme);
          if (targetProgress.scenarioConfig) setScenarioConfig(targetProgress.scenarioConfig);
          if (Array.isArray(targetProgress.logs)) {
            setLogs(targetProgress.logs);
          }
        }
      }

      // 3.5 ★ 会话历史（记忆）唯一化 —— 修复"刷新后记忆混乱"：
      //   同一份对话历史会同时存在于 progressMap / ultra_chat_entries_v2_<heroId> /
      //   ultra_current_chat_entries_v2 三处。老版本残留、被中断的写入、或快速关闭只刷新了
      //   其中一份时，三者长度会不一致（有的停在很早的快照上，甚至变成空数组）。
      //   旧逻辑无条件采纳"角色独立缓存"，一旦它更短/为空，刷新后就会出现"记忆倒退 / 只剩几条"，
      //   并且随后会把短历史回写、覆盖所有人的共享时间线。这里改为挑选最完整且最新的那一份，
      //   并在检测到分歧时回写三处，使它们重新一致。
      const targetId = storage['ultra_last_selected_hero_id_v1'] || selectedHero?.id;
      const serverProgressMap =
        storage['ultra_progress_map_v2'] && typeof storage['ultra_progress_map_v2'] === 'object'
          ? storage['ultra_progress_map_v2']
          : {};
      // 本地缓存也算候选：服务端可能还没收到最后一次同步（关窗通道曾被 64KB 限制卡死），
      // 而本浏览器的 per-hero/current 键往往是最新的。
      const readLocalArr = (key: string): any[] | undefined => {
        if (!key) return undefined;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return undefined;
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
        } catch { return undefined; }
      };
      const timeline = pickMostCompleteTimeline([
        { source: 'progressMap', entries: targetId ? serverProgressMap[targetId]?.consoleEntries : undefined },
        { source: 'heroKey', entries: targetId ? storage['ultra_chat_entries_v2_' + targetId] : undefined },
        { source: 'sharedKey', entries: storage['ultra_current_chat_entries_v2'] },
        { source: 'localHeroKey', entries: targetId ? readLocalArr('ultra_chat_entries_v2_' + targetId) : undefined },
        { source: 'localCurrentKey', entries: readLocalArr('ultra_current_chat_entries_v2') },
        { source: 'localMemory', entries: consoleEntries },
      ]);

      if (timeline.entries.length > 0) {
        // 顺带清掉"未完成的 AI 占位条目"（刷新/断线导致回填没发生），否则它们会作为
        // 一句真实对白进入模型长期记忆。
        const pendingClean = clearStalePendingEntries(timeline.entries);
        const finalEntries = pendingClean.entries;
        setConsoleEntries(finalEntries);
        // 立即回写本地缓存：即使随后服务端不可达，刷新也不会再退回短历史。
        if (targetId) safeLocalStorageSet('ultra_chat_entries_v2_' + targetId, finalEntries);
        safeLocalStorageSet('ultra_current_chat_entries_v2', finalEntries);

        if ((timeline.diverged || pendingClean.changed) && targetId) {
          if (timeline.diverged) {
            console.warn(
              `[Memory] 检测到多份对话历史长度不一致（${timeline.detail}），已选用最完整的一份「${timeline.chosenSource}」(${finalEntries.length} 条) 并回写同步。`
            );
          }
          if (pendingClean.changed) {
            console.warn('[Memory] 已清理未完成的 AI 占位条目（刷新/断线残留），避免污染对白记忆。');
          }
          // 修复服务端：必须等写入门闩放开（finally 里的 markServerStorageHydrated）之后再发，
          // 否则会被"水合完成前禁止写盘"的保护丢弃。
          const repairEntries = finalEntries;
          const repairHeroId = targetId;
          setTimeout(() => {
            setProgressMap((prev) => {
              const updated = { ...prev };
              // 只在已有该角色进度时补齐记忆字段，避免凭空造出缺少数值的残缺进度（未播放过的角色
              // 会由自动存档 effect 用完整快照补齐）。
              if (updated[repairHeroId]) {
                updated[repairHeroId] = { ...updated[repairHeroId], consoleEntries: repairEntries };
              }
              safeLocalStorageSet('ultra_progress_map_v2', updated);
              queueServerSave({
                ultra_progress_map_v2: updated,
                ['ultra_chat_entries_v2_' + repairHeroId]: repairEntries,
                ultra_current_chat_entries_v2: repairEntries,
              });
              return updated;
            });
          }, 0);
        }
      }
    }).catch((err) => {
      console.warn('[App] Error in fetchServerStorage initialization:', err);
    }).finally(() => {
      clearTimeout(hydrationSafetyTimer);
      // Hydration settled (success or failure): release the server-disk write gate. From this
      // point on local changes may legitimately be persisted to the authoritative store.
      hasServerHydratedRef.current = true;
      markServerStorageHydrated();
    });
  }, []);

  // 会话前情摘要：攒够若干条新对话后，后台压缩成摘要（不阻塞正常对话）。
  const isSummarizingRef = useRef(false);
  useEffect(() => {
    if (!aiConfig.enabled || !aiConfig.apiKey) return;
    const heroId = selectedHero?.id;
    if (!heroId) return;
    const bestExisting = getBestSummaryRecord(consoleEntries, heroId);
    const covered = bestExisting ? bestExisting.coveredTo : 0;
    const summaryTrigger = getTokenSaveMode() === 'extreme' ? 8 : CHAT_SUMMARY_TRIGGER;
    if (consoleEntries.length - covered < summaryTrigger) return;
    const timer = setTimeout(async () => {
      if (isSummarizingRef.current) return;
      isSummarizingRef.current = true;
      try {
        // ★ 用同一份快照计算"要总结什么"和"覆盖到哪一条"：
        //   摘要是异步生成的，期间用户可能又发了几条；若用 await 之后的长度记覆盖条数，
        //   会让摘要声称覆盖了它其实没看到的对话（记忆断层）。
        const snapshot = Array.isArray(consoleEntries) ? consoleEntries.slice() : [];
        // 同样按"共享时间线"寻找已有摘要：本角色没有摘要 / 锚点失效时，用其它角色保存的、
        // 能在当前历史中定位的那一份继续增量合并，而不是从头重建（既省 token，也不会断层）。
        const bestAtRun = getBestSummaryRecord(snapshot, heroId);
        const anchorValid = !!bestAtRun;
        const from = bestAtRun ? bestAtRun.coveredTo : 0;
        const previousSummaryText = bestAtRun ? (bestAtRun.record.summary || '') : '';
        const pending = snapshot.slice(from).slice(0, -CHAT_SUMMARY_KEEP_RECENT);
        if (pending.length < 4) return;
        const anchorEntry = pending[pending.length - 1];
        const res = await fetch('/api/summarize-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hero: sanitizeHeroForAi(safeHero),
            aiConfig,
            previousSummary: previousSummaryText,
            messages: pending.map((e) => ({ sender: e.sender, senderName: (e as any).senderName || (e as any).heroName, text: e.text })),
          }),
        });
        const data = await res.json();
        if (data && data.summary) {
          const next = getSessionSummaryStore();
          const newRecord: SessionSummaryRecord = {
            summary: String(data.summary),
            // 锚点 = 本次真正纳入摘要的最后一条对话，刷新后靠 id 重新定位
            coveredId: anchorEntry && anchorEntry.id ? String(anchorEntry.id) : undefined,
            coveredCount: from + pending.length,
            updatedAt: Date.now(),
          };
          next[heroId] = newRecord;
          // 把同一份摘要镜像给"时间线相同、但覆盖得更少"的其它角色记录，
          // 让全员长效记忆保持一致，避免换角色后各自重算（更慢，还容易前后矛盾）。
          for (const [otherId, otherRec] of Object.entries(next)) {
            if (otherId === heroId || !otherRec || !otherRec.summary) continue;
            const otherCoveredTo = resolveSummaryCoverage(snapshot, otherRec);
            if (otherCoveredTo >= 0 && otherCoveredTo <= newRecord.coveredCount) {
              next[otherId] = { ...newRecord };
            }
          }
          writeSessionSummaryStore(next);
        }
      } catch (e) {
        console.warn('[Session Summary] failed:', e);
      } finally {
        isSummarizingRef.current = false;
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [consoleEntries, selectedHero?.id, aiConfig.enabled, aiConfig.apiKey]);
  const handleApplyScenario = (
    scenario: ScenarioConfig,
    applyGreeting: boolean = true,
    startupConfig?: ScenarioStartupConfig
  ) => {
    const finalStartup = startupConfig || scenario.startupConfig;

    // Check if Real-Time Sync was explicitly configured for this scenario
    let effectiveRealTimeState = realTimeState;
    if (finalStartup?.isRealTimeSync !== undefined) {
      const willBeEnabled = !!finalStartup.isRealTimeSync;
      effectiveRealTimeState = {
        isEnabled: willBeEnabled,
        firstCreatedTimestamp: realTimeState.firstCreatedTimestamp || Date.now(),
        lastVisitedTimestamp: Date.now(),
        initialRealDateStr: realTimeState.initialRealDateStr || new Date().toISOString().split('T')[0],
      };
      setRealTimeState(effectiveRealTimeState);
      if (willBeEnabled && !realTimeState.isEnabled) {
        setDayCount(1);
      }
    }

    // 1. Multi-Hero Selection & Squad Setup
    let currentSquadIds = activeTeamIds;
    let targetPrimaryHero = selectedHero;

    if (finalStartup?.activeHeroIds && finalStartup.activeHeroIds.length > 0) {
      currentSquadIds = finalStartup.activeHeroIds;
      setActiveTeamIds(currentSquadIds);
      try {
        localStorage.setItem('ultra_active_team_ids_v1', JSON.stringify(currentSquadIds));
        queueServerSave({ ultra_active_team_ids_v1: currentSquadIds });
      } catch {}

      const leadId = finalStartup.primaryHeroId || currentSquadIds[0];
      const leadHero = heroines.find((h) => h.id === leadId);
      if (leadHero) {
        targetPrimaryHero = leadHero;
        setSelectedHero(leadHero);
      }
    }

    setScenarioConfig(scenario);
    try {
      localStorage.setItem('ultra_selected_scenario_v1', JSON.stringify(scenario));
      queueServerSave({ ultra_selected_scenario_v1: scenario });
    } catch {}

    if (scenario.defaultEnvTheme) {
      setEnvTheme(scenario.defaultEnvTheme);
    }

    // 2. Multi-Hero & Single-Hero Individual Initial Stats Application
    setProgressMap((prev) => {
      const updated = { ...prev };

      heroines.forEach((hero) => {
        const heroId = hero.id;
        const heroStatsPct = finalStartup?.heroStatsMap?.[heroId] || scenario.initialStatsPct;

        if (heroStatsPct || currentSquadIds.includes(heroId)) {
          const defaultStats: Stats = {
            hp: hero.defaultStats?.hp ?? 100,
            maxHp: hero.defaultStats?.maxHp ?? 100,
            energy: hero.defaultStats?.energy ?? 100,
            maxEnergy: hero.defaultStats?.maxEnergy ?? 100,
            morale: hero.defaultStats?.morale ?? 100,
            maxMorale: hero.defaultStats?.maxMorale ?? 100,
            obedience: hero.defaultStats?.obedience ?? 50,
            maxObedience: hero.defaultStats?.maxObedience ?? 100,
            shame: hero.defaultStats?.shame ?? 0,
            maxShame: hero.defaultStats?.maxShame ?? 100,
            lust: hero.defaultStats?.lust ?? 0,
            maxLust: hero.defaultStats?.maxLust ?? 100,
          };

          const existing: HeroProgress = updated[heroId] || {
            heroId: heroId,
            dayCount: dayCount,
            stats: defaultStats,
            partDamage: {},
            partExposure: {},
            consoleEntries: [],
            logs: [],
            envTheme: scenario.defaultEnvTheme || envTheme || 'glass',
            isEnergyShock: false,
            scenarioConfig: scenario,
            lastUpdated: Date.now(),
          };

          const baseStats: Stats = existing.stats || defaultStats;
          const maxHp = baseStats.maxHp ?? hero.defaultStats?.maxHp ?? 100;
          const maxEnergy = baseStats.maxEnergy ?? hero.defaultStats?.maxEnergy ?? 100;
          const maxMorale = baseStats.maxMorale ?? hero.defaultStats?.maxMorale ?? 100;
          const maxObedience = baseStats.maxObedience ?? hero.defaultStats?.maxObedience ?? 100;
          const maxShame = baseStats.maxShame ?? hero.defaultStats?.maxShame ?? 100;
          const maxLust = baseStats.maxLust ?? hero.defaultStats?.maxLust ?? 100;

          if (heroStatsPct) {
            existing.stats = {
              ...baseStats,
              hp: heroStatsPct.hpPct !== undefined ? Math.round((heroStatsPct.hpPct / 100) * maxHp) : (baseStats.hp ?? maxHp),
              energy: heroStatsPct.energyPct !== undefined ? Math.round((heroStatsPct.energyPct / 100) * maxEnergy) : (baseStats.energy ?? maxEnergy),
              morale: heroStatsPct.moralePct !== undefined ? Math.round((heroStatsPct.moralePct / 100) * maxMorale) : (baseStats.morale ?? maxMorale),
              obedience: heroStatsPct.trustPct !== undefined ? Math.round((heroStatsPct.trustPct / 100) * maxObedience) : (baseStats.obedience ?? 50),
              shame: heroStatsPct.shamePct !== undefined ? Math.round((heroStatsPct.shamePct / 100) * maxShame) : (baseStats.shame ?? 0),
              lust: heroStatsPct.lustPct !== undefined ? Math.round((heroStatsPct.lustPct / 100) * maxLust) : (baseStats.lust ?? 0),
            };
          }

          existing.scenarioConfig = scenario;
          if (scenario.defaultEnvTheme) existing.envTheme = scenario.defaultEnvTheme;

          updated[heroId] = existing;

          if (heroId === targetPrimaryHero.id && existing.stats) {
            setStats(existing.stats);
          }
        }
      });

      return updated;
    });

    // 3. Bound relationship sync
    if (scenario.boundRelationshipSlotId) {
      const allRelSlots = getAllRelationshipSlots(relationshipState);
      const boundSlot = allRelSlots.find((s) => s.id === scenario.boundRelationshipSlotId);
      if (boundSlot) {
        setRelationshipState((prev) => ({
          ...prev,
          activeSlotId: boundSlot.id,
          historyLogs: [
            {
              id: `log_${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
              dayCount: dayCount,
              fromTitle: prev.activeSlotId || '初始默认',
              toTitle: boundSlot.title,
              triggerType: 'manual_trigger',
              reason: `开局选定【${scenario.name}】自动联动激活关联羁绊`,
            },
            ...(prev.historyLogs || []),
          ],
        }));
      }
    }

    if (applyGreeting && scenario.initialGreeting) {
      const nowStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      const statsSummary = scenario.initialStatsPct
        ? ` (已自动同步开局挂钩属性: HP ${scenario.initialStatsPct.hpPct ?? 100}% | 能量 ${scenario.initialStatsPct.energyPct ?? 100}% | 信任 ${scenario.initialStatsPct.trustPct ?? 50}% | 意志 ${scenario.initialStatsPct.moralePct ?? 100}%)`
        : '';

      const activeHeroes = heroines.filter((h) => activeTeamIds.includes(h.id));
      let initialGreetingText = scenario.initialGreeting;

      if (activeTeamIds.length > 1 && activeHeroes.length > 1) {
        // Construct joint response from all active squad members
        const lines: string[] = [];
        activeHeroes.forEach((h) => {
          const isPrimary = h.id === selectedHero.id;
          const hRel = getHeroActiveRelationship(h.id);
          const relTag = hRel?.title ? `[${hRel.title}]` : '';

          const hasName = initialGreetingText.includes(`【${h.name}】`) ||
                          initialGreetingText.includes(`${h.name}：`) ||
                          initialGreetingText.includes(`${h.name}:`);

          if (!hasName) {
            if (isPrimary) {
              const cleanInit = scenario.initialGreeting.replace(/^【.*?】[：:]?/, '').replace(/^[“"”]/, '').replace(/[“"”]$/, '').trim();
              lines.push(`【${h.name}】${relTag}：“${cleanInit}”`);
            } else {
              lines.push(`【${h.name}】${relTag}：“（在【${scenario.name}】开局场景中，与【${selectedHero.name}】小队全员同台出阵，看向【${scenario.interrogatorIdentity || '对方'}】）我们小队全员已就位，并肩面对到底！”`);
            }
          }
        });

        if (lines.length > 0) {
          if (activeHeroes.some((h) => initialGreetingText.includes(`【${h.name}】`))) {
            initialGreetingText = initialGreetingText + '\n' + lines.join('\n');
          } else {
            initialGreetingText = lines.join('\n');
          }
        }
      } else {
        // Single-person mode: format dialogue strictly with selectedHero
        const hRel = getHeroActiveRelationship(selectedHero.id);
        const relTag = hRel?.title ? `[${hRel.title}]` : '';
        const cleanInit = scenario.initialGreeting
          .replace(/^【.*?】[：:]?/, '')
          .replace(/^[“"”]/, '')
          .replace(/[“"”]$/, '')
          .trim();
        initialGreetingText = `【${selectedHero.name}】${relTag}：“${cleanInit}”`;
      }

      const entryId = `sc_start_${Date.now()}`;
      const scenarioStartEntry: ConsoleEntry = {
        id: entryId,
        type: 'chat_hero',
        sender: 'heroine',
        heroId: selectedHero.id,
        heroName: activeTeamIds.length > 1 ? '👥 在场小队全员' : selectedHero.name,
        speakerName: activeTeamIds.length > 1 ? '👥 在场小队全员' : selectedHero.name,
        text: initialGreetingText,
        time: nowStr,
        reactionType: 'defiant',
        psychologicalAnalysis: activeTeamIds.length > 1
          ? `已载入【${scenario.name}】剧情与互动关系模式${statsSummary}。在场小队全员（${activeHeroes.map((h) => h.name).join('、')}）已同步激活并参与群体开局应答。`
          : `已载入【${scenario.name}】剧情与互动关系模式${statsSummary}。与【${selectedHero.name}】开启单人对话交互。`,
      };

      setConsoleEntries((prev) => [...prev, scenarioStartEntry]);

      // Request live AI opening dialogue for BOTH single-hero and multi-hero modes!
      if (aiConfig.enabled && aiConfig.apiKey) {
        fetchWith5Retries('/api/chat-interrogate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hero: sanitizeHeroForAi(selectedHero),
            stats: getStatsPayload(stats, selectedHero),
            activeTeam: heroines
              .filter((h) => activeTeamIds.includes(h.id))
              .map((h) => ({
                hero: sanitizeHeroForAi(h),
                stats: h.id === selectedHero.id ? getStatsPayload(stats, selectedHero) : (progressMap[h.id]?.stats || h.defaultStats),
                isPrimary: h.id === selectedHero.id,
                activeRelationship: getHeroActiveRelationship(h.id),
              })),
            targetScope: activeTeamIds.length > 1 ? 'all' : 'primary',
            partDamage,
            partExposure,
            customSettings,
            environmentTheme: envTheme,
            messages: [],
            userMessage: activeTeamIds.length > 1
              ? `【开局剧情建立与小队全员出阵】我们在【${scenario.name}】场景中正式展开（对方身份：【${scenario.interrogatorIdentity || '交互对方'}】）。请在场小队全员（${activeHeroes.map((h) => `【${h.name}】`).join('、')}）依次以各自定义性格、语气与羁绊关系，发表开局第一句现场合答与态度姿态！`
              : `【开局剧情建立】我们在【${scenario.name}】场景中正式展开（对方身份：【${scenario.interrogatorIdentity || '交互对方'}】）。请【${selectedHero.name}】以你的定义性格、语气与羁绊关系，发表开局第一句现场回答与姿态！`,
            aiConfig,
            dayCount,
            dayConfig,
            scenarioConfig: scenario,
            activeRelationship,
            realTimeSyncState: effectiveRealTimeState,
            realTimeContext: effectiveRealTimeState.isEnabled ? getRealTimeContext(effectiveRealTimeState) : undefined,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.text) {
              setConsoleEntries((prev) =>
                prev.map((e) =>
                  e.id === entryId
                    ? {
                        ...e,
                        text: data.text,
                        psychologicalAnalysis: data.psychologicalAnalysis || e.psychologicalAnalysis,
                        reactionType: data.reactionType || e.reactionType,
                        thinkingProcess: data.thinkingProcess || (e as any).thinkingProcess,
                        webSearchUsed: Boolean(data.webSearchUsed || (data.webSources && data.webSources.length > 0)),
                        searchEngine: data.webSearchEngine || data.searchEngine,
                        searchQuery: data.webSearchQuery || data.searchQuery,
                        searchSources: data.webSources || data.searchSources,
                      }
                    : e
                )
              );
              if (!isMuted && selectedHero) {
                ultraAudio.speakVoiceLine(data.text, selectedHero.voicePitch);
              }
            }
          })
          .catch((err) => console.warn('Async multi-team opening AI generation error:', err));
      } else if (!isMuted && selectedHero) {
        ultraAudio.speakVoiceLine(initialGreetingText, selectedHero.voicePitch);
      }
    }
  };

  const handleSaveCustomScenario = (scenario: ScenarioConfig) => {
    setCustomScenarios((prev) => {
      const updated = [...prev.filter((s) => s.id !== scenario.id), scenario];
      try {
        localStorage.setItem('ultra_custom_scenarios_v1', JSON.stringify(updated));
        queueServerSave({ ultra_custom_scenarios_v1: updated });
      } catch {}
      return updated;
    });
  };

  const handleSaveCustomRelationshipSlot = (slot: RelationshipSlot) => {
    setRelationshipState((prev) => {
      const customSlots = prev.customSlots || [];
      const updatedCustomSlots = customSlots.some((s) => s.id === slot.id)
        ? customSlots.map((s) => (s.id === slot.id ? slot : s))
        : [slot, ...customSlots];

      const allCurrentSlots = getAllRelationshipSlots(prev);
      const updatedSlots = allCurrentSlots.some((s) => s.id === slot.id)
        ? allCurrentSlots.map((s) => (s.id === slot.id ? slot : s))
        : [slot, ...allCurrentSlots];

      saveGlobalRelationshipSlots(updatedSlots);

      const newState = {
        ...prev,
        slots: updatedSlots,
        customSlots: updatedCustomSlots,
      };
      try {
        const key = 'ultra_relationship_state_v1_' + selectedHero.id;
        safeLocalStorageSet(key, newState);
        safeLocalStorageSet('ultra_global_relationship_slots_v1', updatedSlots);
        queueServerSave({ [key]: newState, ultra_global_relationship_slots_v1: updatedSlots });
      } catch {}
      return newState;
    });
  };

  const handleDeleteCustomScenario = (id: string) => {
    setCustomScenarios((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem('ultra_custom_scenarios_v1', JSON.stringify(updated));
        queueServerSave({ ultra_custom_scenarios_v1: updated });
      } catch {}
      return updated;
    });

    setDeletedScenarioIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      try {
        localStorage.setItem('ultra_deleted_scenarios_v1', JSON.stringify(updated));
        queueServerSave({ ultra_deleted_scenarios_v1: updated });
      } catch {}
      return updated;
    });

    const remaining = [...DEFAULT_SCENARIO_PRESETS, ...customScenarios].filter(
      (s) => s.id !== id && !deletedScenarioIds.includes(s.id)
    );
    if (scenarioConfig.id === id) {
      setScenarioConfig(remaining.length > 0 ? remaining[0] : NEUTRAL_SCENARIO);
    }
  };

  const [customSettings, setCustomSettings] = useState<CustomSettings>(() => {
    const defaultSettings: CustomSettings = {
      difficulty: 'normal',
      weaknessMultiplier: 1.2,
      sensitiveMultiplier: 1.3,
      physicsShakeForce: 1.0,
      timerBeepSpeed: 1.0,
      autoRegen: false,
      regenRate: 1.0,
      dialogueFontSize: (() => {
        try {
          const s = localStorage.getItem('ultrawoman_dialogue_font_size');
          return s ? parseInt(s, 10) : 14;
        } catch {
          return 14;
        }
      })(),
      consoleHeight: (() => {
        try {
          const s = localStorage.getItem('ultrawoman_console_height');
          return s ? parseInt(s, 10) : 650;
        } catch {
          return 650;
        }
      })(),
      consoleWidthMode: (() => {
        try {
          const s = localStorage.getItem('ultrawoman_console_width_mode');
          return (s as any) || 'normal';
        } catch {
          return 'normal';
        }
      })(),
    };
    try {
      const saved = localStorage.getItem('ultra_custom_settings_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultSettings,
          ...parsed,
          dialogueFontSize: parsed.dialogueFontSize || defaultSettings.dialogueFontSize,
          consoleHeight: parsed.consoleHeight || defaultSettings.consoleHeight,
          consoleWidthMode: parsed.consoleWidthMode || defaultSettings.consoleWidthMode,
        };
      }
    } catch (e) {
      console.error('Failed to parse custom settings:', e);
    }
    return defaultSettings;
  });

  useEffect(() => {
    try {
      localStorage.setItem('ultra_custom_settings_v1', JSON.stringify(customSettings));
      if (customSettings.dialogueFontSize) {
        localStorage.setItem('ultrawoman_dialogue_font_size', String(customSettings.dialogueFontSize));
      }
      if (customSettings.consoleHeight) {
        localStorage.setItem('ultrawoman_console_height', String(customSettings.consoleHeight));
      }
      if (customSettings.consoleWidthMode) {
        localStorage.setItem('ultrawoman_console_width_mode', customSettings.consoleWidthMode);
      }
      queueServerSave({ ultra_custom_settings_v1: customSettings });
    } catch (e) {
      console.error('Failed to save custom settings:', e);
    }
  }, [customSettings]);

  // Helper to load saved custom 3D lighting settings
  const getSavedCustomLights = () => {
    try {
      const saved = localStorage.getItem('ultra_custom_lights_v1');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  // Continuous hold fire interval ref
  const continuousIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const activeHeroIdRef = useRef<string>(selectedHero?.id || '');
  const isSwitchingHeroRef = useRef<boolean>(false);
  const currentHeroProgressRef = useRef<HeroProgress | null>(null);

  useEffect(() => {
    activeHeroIdRef.current = selectedHero?.id || '';
  }, [selectedHero?.id]);

  // Keep latest in-memory progress snapshot in ref for synchronous pagehide/beforeunload flush
  useEffect(() => {
    if (!selectedHero?.id) return;
    currentHeroProgressRef.current = {
      heroId: selectedHero.id,
      dayCount,
      stats,
      partDamage,
      partExposure,
      consoleEntries,
      logs,
      envTheme,
      isEnergyShock,
      scenarioConfig,
      relationshipState,
      activeRelationship,
      lastUpdated: Date.now(),
    };
  }, [selectedHero?.id, dayCount, stats, partDamage, partExposure, consoleEntries, logs, envTheme, isEnergyShock, scenarioConfig, relationshipState, activeRelationship]);

  // Synchronous immediate persistence of console entries per hero & current active console
  useEffect(() => {
    if (!selectedHero?.id || isSwitchingHeroRef.current) return;
    if (consoleEntries && Array.isArray(consoleEntries) && consoleEntries.length > 0) {
      safeLocalStorageSet('ultra_chat_entries_v2_' + selectedHero.id, consoleEntries);
      safeLocalStorageSet('ultra_current_chat_entries_v2', consoleEntries);
    }
  }, [selectedHero?.id, consoleEntries]);

  // Flush in-memory state on page unload/refresh to guarantee 0ms lag and prevent any rollback
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (typeof window !== 'undefined' && (window as any).__isWipingAllStorage) {
        return;
      }
      // storageSync.ts registers its own unload flusher and sets this flag; without the
      // guard every tab-hide fired two full POSTs (and two synchronous 90MB disk writes).
      if (typeof window !== 'undefined' && (window as any).__hasServerFlushListener) {
        return;
      }
      const snap = currentHeroProgressRef.current;
      try {
        // 注意：这里不再同步写整表 progressMap（6MB）——它会拖慢关窗并极易触发 localStorage 配额失败，
        // 该进度已通过 progressPatch 增量同步到服务端。
        if (snap && snap.consoleEntries && snap.consoleEntries.length > 0) {
          safeLocalStorageSet('ultra_chat_entries_v2_' + snap.heroId, snap.consoleEntries);
          safeLocalStorageSet('ultra_current_chat_entries_v2', snap.consoleEntries);
        }

        // ★ 小体积关窗落盘：只发最后 8 条对话（按 id 幂等合并）+ 该角色的进度补丁。
        //   旧版把 progressMap(6MB)/全部历史/名册塞进 sendBeacon —— 超过 ~64KB 上限会被浏览器
        //   静默丢弃，导致"关闭前的内容根本没存上"，重开只能看到更早的同步结果。
        const heroChatKey = (snap && snap.heroId) ? 'ultra_chat_entries_v2_' + snap.heroId : '';
        const progressPatch: Record<string, any> = {};
        if (snap && snap.heroId) {
          progressPatch[snap.heroId] = slimProgressForPatch(snap);
        }
        const closeUpdates: Record<string, any> = { last_closed_at: Date.now() };
        if (snap && snap.heroId) closeUpdates['ultra_last_selected_hero_id_v1'] = snap.heroId;
        if (heroines && heroines.length > 0) {
          const rawHeroines = JSON.stringify(heroines);
          if (rawHeroines.length < 20000) {
            closeUpdates['trainer_heroines_v5'] = heroines;
            closeUpdates['ultra_heroines_v4'] = heroines;
          }
        }

        // 整个 payload 自适应到 64KB 以内（尾部对话按需缩减）
        const payload = JSON.stringify(fitClosePayloadWithTail(
          { isCloseFlush: true, updates: closeUpdates, progressPatch, closedAt: Date.now() },
          heroChatKey,
          (snap && Array.isArray(snap.consoleEntries)) ? snap.consoleEntries : []
        ));

        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon('/api/storage/flush-sync', blob);
        }
        try {
          fetch('/api/storage/flush-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        } catch {}
      } catch (e) {
        console.warn('Failed to flush progress on beforeunload:', e);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handleBeforeUnload();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [heroines]);

  // Auto-Save Current Hero Progress into progressMap whenever states update
  useEffect(() => {
    if (!selectedHero || !selectedHero.id) return;
    if (isSwitchingHeroRef.current || activeHeroIdRef.current !== selectedHero.id) return;

    const currentProgress: HeroProgress = {
      heroId: selectedHero.id,
      dayCount,
      stats,
      partDamage,
      partExposure,
      consoleEntries,
      logs,
      envTheme,
      isEnergyShock,
      scenarioConfig,
      relationshipState,
      activeRelationship,
      lastUpdated: Date.now(),
    };
    setProgressMap((prev) => {
      const updated = {
        ...prev,
        [selectedHero.id]: currentProgress,
      };
      // 将公共剧情时间线（consoleEntries、logs、scenarioConfig、dayCount、envTheme）同步给全员，保证切角色时剧情永不丢失
      heroines.forEach((h) => {
        if (h.id !== selectedHero.id && updated[h.id]) {
          updated[h.id] = {
            ...updated[h.id],
            consoleEntries,
            logs,
            scenarioConfig,
            dayCount,
            envTheme,
          };
        }
      });
      // 同步且立即写入 localStorage，杜绝页面刷新或切换角色时的任何进度回档
      safeLocalStorageSet('ultra_progress_map_v2', updated);
      if (consoleEntries && consoleEntries.length > 0) {
        safeLocalStorageSet('ultra_chat_entries_v2_' + selectedHero.id, consoleEntries);
        safeLocalStorageSet('ultra_current_chat_entries_v2', consoleEntries);
      }
      // ★ 只发小体积增量：对话走 per-hero/current 键，进度走 progressPatch。
      //   旧版每次同步都发整表 progressMap（UTF-8 13MB），一旦网络/关窗来不及就整批丢失。
      queueServerSave(
        {
          ['ultra_chat_entries_v2_' + selectedHero.id]: consoleEntries,
          ultra_current_chat_entries_v2: consoleEntries,
          ultra_last_selected_hero_id_v1: selectedHero.id,
        },
        undefined,
        { progressPatch: { [selectedHero.id]: slimProgressForPatch(currentProgress, true) } }
      );
      return updated;
    });
  }, [selectedHero?.id, dayCount, stats, partDamage, partExposure, consoleEntries, logs, envTheme, isEnergyShock, scenarioConfig, relationshipState, activeRelationship, activeTeamIds, heroines]);

  // Switch Heroine handler: seamlessly preserve shared session narrative & dialogues, load individual hero stats cleanly
  const handleSelectHero = useCallback(
    (
      newHero: Ultrawoman,
      options?: {
        newTeamIds?: string[];
        forceSingle?: boolean;
      }
    ) => {
      const isSameHero = selectedHero ? newHero.id === selectedHero.id : false;
      const targetTeamIds = options?.newTeamIds || activeTeamIds;

      if (options?.newTeamIds) {
        setActiveTeamIds(options.newTeamIds);
      }
      if (options?.forceSingle) {
        setTargetScope('primary');
        setTargetedHeroIds([newHero.id]);
      }

      if (isSameHero) {
        // 如果是同一个角色（例如点击"仅此人在场"），只需收缩在场小队与目标锁定范围，保留所有局内数值、天数、创伤与战报记录，绝不重置进度！
        return;
      }

      isSwitchingHeroRef.current = true;
      activeHeroIdRef.current = newHero.id;

      const nowStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });

      // 1. 完整保存当前离场/切换前角色的独立生理数值与个人状态
      const previousProgress: HeroProgress | null = selectedHero ? {
        heroId: selectedHero.id,
        dayCount,
        stats: { ...stats },
        partDamage: { ...partDamage },
        partExposure: { ...partExposure },
        consoleEntries: [...consoleEntries],
        logs: [...logs],
        envTheme,
        isEnergyShock,
        scenarioConfig,
        relationshipState,
        activeRelationship,
        lastUpdated: Date.now(),
      } : null;

      // 2. 剧情连贯性保障：公共剧情流与对话长卷 (consoleEntries) 必须无缝延续，绝不重置或被空白覆盖！
      let nextConsoleEntries = [...consoleEntries];
      if (nextConsoleEntries.length > 0) {
        // 在已有对话中追加一条清晰的焦点切换事件提示，保持上下文严密连贯
        const switchNotice: ConsoleEntry = {
          id: `switch_${Date.now()}`,
          type: 'system',
          sender: 'system',
          heroId: newHero.id,
          heroName: newHero.name,
          speakerName: '战术系统',
          text: `【主控焦点切换】当前对话与剧情互动焦点已切换至：【${newHero.name}】(${newHero.title || '角色'})。`,
          time: nowStr,
          reactionType: 'defiant',
          psychologicalAnalysis: `战术焦点转移至【${newHero.name}】。当前剧情场景【${scenarioConfig.name}】（第 ${dayCount} 天）保持无缝延续。`,
        };
        nextConsoleEntries = [...nextConsoleEntries, switchNotice];
      } else {
        // 初始开局无记录时的默认问候
        const greetingQuote = newHero.voiceLines?.greeting?.[0] || `${newHero.name}沉吟不语，用戒备的目光死死盯着对方...`;
        nextConsoleEntries = [
          {
            id: `init_${Date.now()}`,
            type: 'chat_hero',
            sender: 'heroine',
            heroId: newHero.id,
            heroName: newHero.name,
            speakerName: newHero.name,
            text: greetingQuote,
            time: nowStr,
            reactionType: 'defiant',
            psychologicalAnalysis: `战术对讲建立：目标【${newHero.name}】(${newHero.personality || '坚毅正义'})。弱点部位：${newHero.bodyParts[newHero.weakPart]?.name || newHero.weakPart}。`,
          },
        ];
      }

      setConsoleEntries(nextConsoleEntries);

      // 3. 构建并同步 progressMap，确保共享剧情时间线（consoleEntries/logs/scenarioConfig/dayCount/envTheme）全员一致
      const updatedMap: Record<string, HeroProgress> = {
        ...progressMap,
      };
      if (selectedHero && previousProgress) {
        updatedMap[selectedHero.id] = {
          ...previousProgress,
          consoleEntries: nextConsoleEntries,
        };
      }

      heroines.forEach((h) => {
        if (updatedMap[h.id]) {
          updatedMap[h.id] = {
            ...updatedMap[h.id],
            scenarioConfig,
            dayCount,
            envTheme,
            consoleEntries: nextConsoleEntries,
            logs,
          };
        }
      });

      setProgressMap(updatedMap);
      try {
        safeLocalStorageSet('ultra_progress_map_v2', updatedMap);
        safeLocalStorageSet('ultra_current_chat_entries_v2', nextConsoleEntries);
        safeLocalStorageSet('ultra_chat_entries_v2_' + newHero.id, nextConsoleEntries);
        safeLocalStorageSet('ultra_last_selected_hero_id_v1', newHero.id);
      } catch (e) {
        console.error('Failed to persist progress map on hero switch:', e);
      }

      // 4. 载入目标角色的独立生理数值与专属羁绊
      setSelectedHero(newHero);
      if (!selectedPart || !newHero.bodyParts[selectedPart]) {
        setSelectedPart(newHero.weakPart || Object.keys(newHero.bodyParts)[0] || 'timer');
      }

      const saved = updatedMap[newHero.id];
      if (saved && saved.stats) {
        const base = newHero.defaultStats;
        const loadedStats: Stats = {
          hp: saved.stats.hp ?? base.hp,
          energy: saved.stats.energy ?? base.energy,
          morale: saved.stats.morale ?? base.morale,
          obedience: saved.stats.obedience ?? base.obedience,
          shame: saved.stats.shame ?? base.shame,
          lust: saved.stats.lust ?? base.lust ?? 10,
          maxHp: saved.stats.maxHp || base.maxHp || 100,
          maxEnergy: saved.stats.maxEnergy || base.maxEnergy || 100,
          maxMorale: saved.stats.maxMorale || base.maxMorale || 100,
          maxObedience: saved.stats.maxObedience || base.maxObedience || 100,
          maxShame: saved.stats.maxShame || base.maxShame || 100,
          maxLust: saved.stats.maxLust || base.maxLust || 100,
        };
        setStats(loadedStats);
        setPartDamage(saved.partDamage || { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 });
        setPartExposure(saved.partExposure || { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 });
        setIsEnergyShock(saved.isEnergyShock || false);
        isEnergyShockRef.current = saved.isEnergyShock || false;

        let baseRelState: Partial<RelationshipState> = {};
        if (saved?.relationshipState) {
          baseRelState = saved.relationshipState;
        } else {
          try {
            const s = localStorage.getItem('ultra_relationship_state_v1_' + newHero.id);
            if (s) {
              baseRelState = JSON.parse(s);
            }
          } catch {}
        }
        const mergedSlots = getAllRelationshipSlots(baseRelState as RelationshipState);
        const newHeroRelState: RelationshipState = {
          activeSlotId: baseRelState.activeSlotId || mergedSlots[0]?.id || NEUTRAL_RELATIONSHIP_SLOT.id,
          isLocked: !!baseRelState.isLocked,
          manualOverrideSlotId: baseRelState.manualOverrideSlotId,
          lockedAtDay: baseRelState.lockedAtDay,
          historyLogs: baseRelState.historyLogs || [],
          customSlots: baseRelState.customSlots,
          slots: mergedSlots,
        };
        setRelationshipState(newHeroRelState);
      } else {
        // 无存档的全新角色：纯净初始化生理数值
        setStats({ ...newHero.defaultStats });
        setPartDamage({ head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 });
        setPartExposure({ head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 });
        setIsEnergyShock(false);
        isEnergyShockRef.current = false;

        let baseRelState: Partial<RelationshipState> = {};
        try {
          const s = localStorage.getItem('ultra_relationship_state_v1_' + newHero.id);
          if (s) {
            baseRelState = JSON.parse(s);
          }
        } catch {}
        const mergedSlots = getAllRelationshipSlots(baseRelState as RelationshipState);
        const newHeroRelState: RelationshipState = {
          activeSlotId: baseRelState.activeSlotId || mergedSlots[0]?.id || NEUTRAL_RELATIONSHIP_SLOT.id,
          isLocked: !!baseRelState.isLocked,
          manualOverrideSlotId: baseRelState.manualOverrideSlotId,
          lockedAtDay: baseRelState.lockedAtDay,
          historyLogs: baseRelState.historyLogs || [],
          customSlots: baseRelState.customSlots,
          slots: mergedSlots,
        };
        setRelationshipState(newHeroRelState);
      }

      setTimeout(() => {
        isSwitchingHeroRef.current = false;
      }, 50);
    },
    [
      selectedHero,
      activeTeamIds,
      dayCount,
      stats,
      partDamage,
      partExposure,
      consoleEntries,
      logs,
      envTheme,
      isEnergyShock,
      scenarioConfig,
      relationshipState,
      activeRelationship,
      progressMap,
      selectedPart,
      heroines,
    ]
  );

  // Multi-hero & Team Bar Handlers (Safely synchronized with handleSelectHero)
  const handleToggleTeamMember = useCallback(
    (heroId: string) => {
      if (activeTeamIds.includes(heroId)) {
        if (activeTeamIds.length <= 1) return;
        const nextTeam = activeTeamIds.filter((id) => id !== heroId);
        if (heroId === selectedHero?.id && nextTeam.length > 0) {
          const newSelected = heroines.find((h) => h.id === nextTeam[0]);
          if (newSelected) {
            handleSelectHero(newSelected, { newTeamIds: nextTeam });
            return;
          }
        }
        setActiveTeamIds(nextTeam);
      } else {
        setActiveTeamIds([...activeTeamIds, heroId]);
      }
    },
    [activeTeamIds, selectedHero?.id, heroines, handleSelectHero]
  );

  const handleSelectAllTeam = useCallback(() => {
    setActiveTeamIds(heroines.map((h) => h.id));
  }, [heroines]);

  const handleResetTeamSingle = useCallback(() => {
    if (selectedHero?.id) {
      setActiveTeamIds([selectedHero.id]);
      setTargetScope('primary');
      setTargetedHeroIds([selectedHero.id]);
    } else {
      setActiveTeamIds([]);
      setTargetedHeroIds([]);
    }
  }, [selectedHero?.id]);

  const handleSetSingleHeroMode = useCallback(
    (hero: Ultrawoman) => {
      handleSelectHero(hero, { newTeamIds: [hero.id], forceSingle: true });
    },
    [handleSelectHero]
  );

  // Universal Day Navigation & Switching Handler (Forward, Backward, Jump, Simulate Env or Seamless Switch)
  const handleChangeDay = (
    value: number,
    options?: { isDelta?: boolean; simulateEnv?: boolean }
  ) => {
    if (!selectedHero) return;
    // If Real-Time Sync Mode is enabled, manual time skipping is disabled
    if (realTimeState.isEnabled) {
      ultraAudio.playUiClick();
      setSaveToast({
        message: '⏳ 现实时间同步模式已开启：天数与现实真实世界对齐，不可手动跳跃。',
        visible: true,
      });
      setTimeout(() => setSaveToast(null), 3000);
      return;
    }

    const isDelta = options?.isDelta !== false; // default true if not specified
    const simulateEnv = options?.simulateEnv ?? true;

    const currentDay = dayCount;
    let targetDay = isDelta ? currentDay + value : value;
    if (targetDay < 1) targetDay = 1;
    if (targetDay > 9999) targetDay = 9999;

    const delta = targetDay - currentDay;
    if (delta === 0) return; // No change

    setDayCount(targetDay);

    const isForward = delta > 0;
    const daysMagnitude = Math.abs(delta);

    const isCustom = !['glass', 'metal', 'acid', 'lava', 'cryo', 'plasma', 'void', 'hypno', 'pure'].includes(envTheme);
    const customMatch = customEnvs.find((c) => c.id === envTheme);
    const envEffect = isCustom && customMatch
      ? {
          name: customMatch.name,
          theme: customMatch.id,
          hpChange: customMatch.hpChange,
          energyChange: customMatch.energyChange,
          moraleChange: customMatch.moraleChange,
          shameChange: customMatch.shameChange,
          obedienceChange: customMatch.obedienceChange,
          lustChange: customMatch.lustChange,
          description: customMatch.description,
          badgeColor: customMatch.badgeColor,
        }
      : ENV_DAILY_EFFECTS[envTheme as EnvironmentTheme] || ENV_DAILY_EFFECTS.glass;

    const activeParams = envParamOverrides[envTheme] || (isCustom && customMatch ? customMatch.params : getDefaultEnvParams(envTheme));

    const maxHp = stats.maxHp || safeHero.defaultStats?.maxHp || 100;
    const maxEnergy = stats.maxEnergy || safeHero.defaultStats?.maxEnergy || 100;
    const maxMorale = stats.maxMorale || safeHero.defaultStats?.maxMorale || 100;
    const maxShame = stats.maxShame || safeHero.defaultStats?.maxShame || 100;
    const maxObedience = stats.maxObedience || safeHero.defaultStats?.maxObedience || 100;
    const maxLust = stats.maxLust || safeHero.defaultStats?.maxLust || 100;

    let newHp = stats.hp;
    let newEnergy = stats.energy;
    let newMorale = stats.morale;
    let newShame = stats.shame;
    let newObedience = stats.obedience;
    let newLust = stats.lust ?? 10;

    let netHpChange = 0;
    let netEnergyChange = 0;
    let netMoraleChange = 0;
    let netShameChange = 0;
    let netObedienceChange = 0;
    let netLustChange = 0;

    if (simulateEnv && isForward) {
      // Temperature bonus
      let tempHpDrain = 0;
      if (activeParams.temperature > 100) tempHpDrain = -Math.min(15, (activeParams.temperature - 100) * 0.02);
      else if (activeParams.temperature < 0) tempHpDrain = -Math.min(10, Math.abs(activeParams.temperature) * 0.03);

      // pH bonus
      let phHpDrain = 0;
      if (activeParams.phLevel < 4.0) phHpDrain = -Math.min(12, (4.0 - activeParams.phLevel) * 2.5);
      else if (activeParams.phLevel > 10.0) phHpDrain = -Math.min(10, (activeParams.phLevel - 10.0) * 2.0);

      // Voltage / Plasma
      const voltageHpDrain = -Math.min(15, (activeParams.voltageKv / 1000) * 12);
      const voltageEnergyDrain = -Math.min(20, (activeParams.voltageKv / 1000) * 15);

      // Anti-photon
      const photonEnergyDrain = -Math.min(15, (activeParams.antiPhotonRate / 100) * 12);

      // Hypnosis Hz
      const hypnoMoraleDrain = -Math.min(15, (activeParams.hypnosisHz / 500) * 12);
      const hypnoObedienceGain = Math.min(15, (activeParams.hypnosisHz / 500) * 10);
      const hypnoLustGain = Math.min(12, (activeParams.hypnosisHz / 500) * 8);

      const dayScalingMult = 1 + Math.max(0, targetDay - 1) * (dayConfig.scalingFactor || 0.02);

      // Active Milestones deltas
      const activeMilestones = getActiveMilestones(dayConfig, targetDay);
      let milestoneHpDelta = 0;
      let milestoneEnergyDelta = 0;
      let milestoneMoraleDelta = 0;
      let milestoneObedienceDelta = 0;
      let milestoneShameDelta = 0;
      let milestoneLustDelta = 0;
      let milestoneDamageMultiplier = 1.0;

      for (const m of activeMilestones) {
        if (m.hpDeltaDaily) milestoneHpDelta += m.hpDeltaDaily;
        if (m.energyDeltaDaily) milestoneEnergyDelta += m.energyDeltaDaily;
        if (m.moraleDeltaDaily) milestoneMoraleDelta += m.moraleDeltaDaily;
        if (m.obedienceDeltaDaily) milestoneObedienceDelta += m.obedienceDeltaDaily;
        if (m.shameDeltaDaily) milestoneShameDelta += m.shameDeltaDaily;
        if (m.lustDeltaDaily) milestoneLustDelta += m.lustDeltaDaily;
        if (m.damageMultiplier && m.damageMultiplier !== 1) {
          milestoneDamageMultiplier *= m.damageMultiplier;
        }
      }

      const dailyHp = ((envEffect.hpChange + tempHpDrain + phHpDrain + voltageHpDrain + (activeParams.extraHpDrain || 0) - extraDailyEnvDamage + dailyLightEffects.hpDelta) * dayScalingMult + milestoneHpDelta) * milestoneDamageMultiplier;
      const dailyEnergy = (envEffect.energyChange + voltageEnergyDrain + photonEnergyDrain + (activeParams.extraEnergyDrain || 0) + dailyLightEffects.energyDelta) * dayScalingMult + milestoneEnergyDelta;
      const dailyMorale = (envEffect.moraleChange + hypnoMoraleDrain + (activeParams.extraMoraleDrain || 0) + dailyLightEffects.moraleDelta) + (dayConfig.dailyMoraleDrain || 0) + milestoneMoraleDelta;
      const dailyShame = (envEffect.shameChange + (activeParams.extraShameGain || 0) + dailyLightEffects.shameDelta) + (dayConfig.dailyShameGain || 0) + milestoneShameDelta;
      const dailyObedience = (envEffect.obedienceChange + hypnoObedienceGain + (activeParams.extraObedienceGain || 0) + dailyLightEffects.obedienceDelta) + (dayConfig.dailyObedienceGain || 0) + milestoneObedienceDelta;
      const dailyLust = envEffect.lustChange + hypnoLustGain + (activeParams.extraLustGain || 0) + (dayConfig.dailyLustGain || 0) + milestoneLustDelta;

      netHpChange = dailyHp * daysMagnitude;
      netEnergyChange = dailyEnergy * daysMagnitude;
      netMoraleChange = dailyMorale * daysMagnitude;
      netShameChange = dailyShame * daysMagnitude;
      netObedienceChange = dailyObedience * daysMagnitude;
      netLustChange = dailyLust * daysMagnitude;

      newHp = Math.min(maxHp, Math.max(0, Math.round((stats.hp + netHpChange) * 10) / 10));
      newEnergy = Math.min(maxEnergy, Math.max(0, Math.round((stats.energy + netEnergyChange) * 10) / 10));
      newMorale = Math.min(maxMorale, Math.max(0, Math.round((stats.morale + netMoraleChange) * 10) / 10));
      newShame = Math.min(maxShame, Math.max(0, Math.round((stats.shame + netShameChange) * 10) / 10));
      newObedience = Math.min(maxObedience, Math.max(0, Math.round((stats.obedience + netObedienceChange) * 10) / 10));
      newLust = Math.min(maxLust, Math.max(0, Math.round(((stats.lust ?? 10) + netLustChange) * 10) / 10));

      if (newEnergy <= 0) {
        newEnergy = 0;
        setIsEnergyShock(true);
        isEnergyShockRef.current = true;
      }

      setStats({
        hp: newHp,
        energy: newEnergy,
        morale: newMorale,
        shame: newShame,
        obedience: newObedience,
        lust: newLust,
        maxHp,
        maxEnergy,
        maxMorale,
        maxObedience,
        maxShame,
        maxLust,
      });

      if (activeTeamIds.length > 1) {
        setProgressMap((prev) => {
          const updated = { ...prev };
          activeTeamIds.forEach((mId) => {
            if (mId !== selectedHero.id) {
              const mHero = heroines.find((h) => h.id === mId);
              const mSaved = updated[mId];
              const mStats = mSaved?.stats || mHero?.defaultStats || { ...stats };
              const mMaxHp = mStats.maxHp || mHero?.defaultStats?.maxHp || 100;
              const mMaxEnergy = mStats.maxEnergy || mHero?.defaultStats?.maxEnergy || 100;
              const mMaxMorale = mStats.maxMorale || mHero?.defaultStats?.maxMorale || 100;
              const mMaxShame = mStats.maxShame || mHero?.defaultStats?.maxShame || 100;
              const mMaxObedience = mStats.maxObedience || mHero?.defaultStats?.maxObedience || 100;
              const mMaxLust = mStats.maxLust || mHero?.defaultStats?.maxLust || 100;

              const mNewHp = Math.min(mMaxHp, Math.max(0, Math.round((mStats.hp + netHpChange) * 10) / 10));
              const mNewEnergy = Math.min(mMaxEnergy, Math.max(0, Math.round((mStats.energy + netEnergyChange) * 10) / 10));
              const mNewMorale = Math.min(mMaxMorale, Math.max(0, Math.round((mStats.morale + netMoraleChange) * 10) / 10));
              const mNewShame = Math.min(mMaxShame, Math.max(0, Math.round((mStats.shame + netShameChange) * 10) / 10));
              const mNewObedience = Math.min(mMaxObedience, Math.max(0, Math.round((mStats.obedience + netObedienceChange) * 10) / 10));
              const mNewLust = Math.min(mMaxLust, Math.max(0, Math.round(((mStats.lust ?? 10) + netLustChange) * 10) / 10));

              updated[mId] = {
                ...(mSaved || {
                  heroId: mId,
                  dayCount: targetDay,
                  envTheme,
                  isEnergyShock: false,
                  partDamage: { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
                  partExposure: { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
                  consoleEntries: [],
                  logs: [],
                }),
                dayCount: targetDay,
                stats: {
                  ...mStats,
                  hp: mNewHp,
                  energy: mNewEnergy,
                  morale: mNewMorale,
                  shame: mNewShame,
                  obedience: mNewObedience,
                  lust: mNewLust,
                },
                lastUpdated: Date.now(),
              };
            }
          });
          return updated;
        });
      }
    }

    const nowStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const isPositiveEffect = netHpChange >= 0 && netEnergyChange >= 0;

    let transitionTitle = '';
    let logText = '';
    if (!isForward) {
      transitionTitle = `⏪ 时间回退: 第 ${currentDay} 天 ➔ 第 ${targetDay} 天 (-${daysMagnitude}天)`;
      logText = `【时间倒退/线索重置】剧情时间回退至第 ${targetDay} 天。角色的阶段状态与关系匹配规则已自动同步。`;
    } else if (!simulateEnv) {
      transitionTitle = `⏩ 无损跃迁: 第 ${currentDay} 天 ➔ 第 ${targetDay} 天 (+${daysMagnitude}天)`;
      logText = `【剧情时间无损跳转】直接设定剧情时间至第 ${targetDay} 天（不进行环境扣损）。已同步更新天数阶段与剧情指导。`;
    } else {
      transitionTitle = `📅 进到第 ${targetDay} 天 (${daysMagnitude > 1 ? `跨越 ${daysMagnitude} 天` : '+1天'}) - 环境结算`;
      logText = `【第 ${currentDay} ➔ ${targetDay} 天】收容在【${envEffect.name}】中。${daysMagnitude > 1 ? `累计 ${daysMagnitude} 天环境结算：` : ''}` +
        `生命值 ${netHpChange >= 0 ? '+' : ''}${netHpChange.toFixed(1)}% (${newHp}%), 能量 ${netEnergyChange >= 0 ? '+' : ''}${netEnergyChange.toFixed(1)}% (${newEnergy}%).`;
      if (dailyLightEffects.descriptions.length > 0) {
        logText += ` 💡[光源每日附加影响]: ${dailyLightEffects.descriptions.join('; ')}`;
      }
    }

    const dayConsoleEntry: ConsoleEntry = {
      id: `day_${targetDay}_${Date.now()}`,
      type: 'attack_log',
      time: nowStr,
      heroId: safeHero.id,
      heroName: safeHero.name,
      speakerName: safeHero.name,
      weaponName: transitionTitle,
      targetPartName: '全身整体/时间线',
      damageDealt: -netHpChange,
      energyDrained: -netEnergyChange,
      moraleLost: -netMoraleChange,
      shameGained: netShameChange,
      obedienceGained: netObedienceChange,
      lustChanged: netLustChange,
      text: logText,
      reactionType: !isForward || !simulateEnv ? 'healing' : isPositiveEffect ? 'healing' : newHp <= 0 ? 'corpse' : 'pained',
      psychologicalAnalysis: `【第 ${targetDay} 天时间节点】当前处于第 ${targetDay} 天 (从第 ${currentDay} 天${isForward ? '推进' : '回退'} ${daysMagnitude} 天)，处于【${envEffect.name}】环境下。`,
    };

    setConsoleEntries((prev) => [...prev, dayConsoleEntry]);
    ultraAudio.playUiClick();

    // Call the dedicated /api/day-transition API
    if (aiConfig.enabled && aiConfig.apiKey) {
      setIsLoadingAi(true);
      fetchWith5Retries('/api/day-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hero: sanitizeHeroForAi(selectedHero),
          dayCount: targetDay,
          oldDay: currentDay,
          newDay: targetDay,
          daysDelta: delta,
          isRewind: !isForward,
          simulateEnv,
          stats: {
            ...getStatsPayload({
              hp: newHp,
              energy: newEnergy,
              morale: newMorale,
              shame: newShame,
              obedience: newObedience,
              lust: newLust,
              maxHp,
              maxEnergy,
              maxMorale,
              maxObedience,
              maxShame,
              maxLust,
            }, selectedHero),
            hpDamage: -netHpChange,
            energyDamage: -netEnergyChange,
            moraleDamage: -netMoraleChange,
            obedienceGained: netObedienceChange,
            shameGained: netShameChange,
            lustChanged: netLustChange,
            isPositiveEffect,
          },
          envTheme,
          envEffect,
          envPhysicalParams: activeParams,
          customSettings,
          partDamage,
          partExposure,
          customLights: getSavedCustomLights(),
          aiConfig,
          dayConfig,
          scenarioConfig,
          activeRelationship,
          activeTeam: heroines
            .filter((h) => activeTeamIds.includes(h.id))
            .map((h) => ({
              hero: sanitizeHeroForAi(h),
              stats: h.id === selectedHero?.id ? getStatsPayload(stats, safeHero) : (progressMap[h.id]?.stats || h.defaultStats),
              isPrimary: h.id === selectedHero?.id,
              activeRelationship: getHeroActiveRelationship(h.id),
            })),
          targetScope,
          messages: getEnrichedChatHistory(consoleEntries, selectedHero?.id),
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data && data.dialogue) {
              let dayDialogue = data.dialogue;
              let reactionType = data.reactionType || (newHp <= 0 ? 'corpse' : 'pained');
              if (newHp <= 0) {
                reactionType = 'corpse';
                if (!dayDialogue.startsWith('（') || dayDialogue.includes('“') || dayDialogue.includes('"')) {
                  const cleanTxt = dayDialogue.replace(/[“"”]/g, '').trim();
                  dayDialogue = `（【${safeHero.name}】在第 ${targetDay} 天处于生命沉寂状态：${cleanTxt}……无法做出回应）`;
                }
              }

              setConsoleEntries((prev) => [
                ...prev,
                {
                  id: `day_dialogue_${Date.now()}`,
                  type: 'chat_hero',
                  sender: 'heroine',
                  heroId: safeHero.id,
                  heroName: safeHero.name,
                  speakerName: safeHero.name,
                  text: dayDialogue,
                  time: nowStr,
                  reactionType,
                  psychologicalAnalysis: data.psychologicalAnalysis || `第 ${targetDay} 天晨起/剧情心境评估`,
                  thinkingProcess: data.thinkingProcess,
                },
              ]);
              if (!isMuted && newHp > 0 && reactionType !== 'corpse') {
                ultraAudio.speakVoiceLine(dayDialogue, safeHero.voicePitch);
              }
            }
          }
        })
        .catch((e) => console.error('Day advancement AI API error:', e))
        .finally(() => setIsLoadingAi(false));
    }
  };

  // Backwards-compatible single-day advancement
  const handlePassDay = () => {
    handleChangeDay(1, { isDelta: true, simulateEnv: true });
  };

  // Reset Current Heroine's (or All Active Team Members') Progress back to Day 1 based on current Scenario Config
  const handleResetCurrentHeroProgress = () => {
    setIsRecharging(true);
    setIsAutoAttacking(false);
    setIsContinuousFiring(false);
    setHitTimestamp(0);
    setLastHitPart(null);
    setExtraDailyEnvDamage(0);
    setActiveRandomEvent(null);
    ultraAudio.playRechargeSFX();
    ultraAudio.stopColorTimerBeep();

    setDayCount(1);
    setIsEnergyShock(false);
    isEnergyShockRef.current = false;

    if (realTimeState.isEnabled) {
      setRealTimeState((prev) => ({
        ...prev,
        firstCreatedTimestamp: Date.now(),
        lastVisitedTimestamp: Date.now(),
        initialRealDateStr: new Date().toISOString().split('T')[0],
      }));
    }

    // 如果剧情预设定义了默认环境，同步还原环境主题
    if (scenarioConfig.defaultEnvTheme) {
      setEnvTheme(scenarioConfig.defaultEnvTheme);
    }

    const currentHero = heroines.find((h) => h.id === selectedHero.id) || selectedHero;
    const resetSelectedStats = getInitialHeroStatsFromScenario(currentHero, scenarioConfig);
    const resetRelState = getInitialRelationshipStateFromScenario(scenarioConfig);

    setStats(resetSelectedStats);
    setRelationshipState(resetRelState);

    setPartDamage({
      head: 0,
      timer: 0,
      chest: 0,
      leftArm: 0,
      rightArm: 0,
      torso: 0,
      legs: 0,
    });
    setPartExposure({
      head: 0,
      timer: 0,
      chest: 0,
      leftArm: 0,
      rightArm: 0,
      torso: 0,
      legs: 0,
    });

    const activeHeroes = heroines.filter((h) => activeTeamIds.includes(h.id));
    const isMultiTeam = activeTeamIds.length > 1 && activeHeroes.length > 1;

    const boundSlot = DEFAULT_RELATIONSHIP_SLOTS.find((s) => s.id === resetRelState.activeSlotId) || NEUTRAL_RELATIONSHIP_SLOT;

    let greetingQuote = scenarioConfig.initialGreeting || currentHero.voiceLines?.greeting?.[0] || `${currentHero.name}沉吟不语，用戒备的目光死死盯着【${scenarioConfig.interrogatorIdentity || '对方'}】...`;
    let resetNotice = `一键彻底重置：目标【${currentHero.name}】已按开局剧情【${scenarioConfig.name}】预设重置复位（绑定羁绊：【${boundSlot.title}】），天数回到第 1 天。`;

    if (isMultiTeam) {
      const namesStr = activeHeroes.map((h) => h.name).join('、');
      resetNotice = `一键彻底重置：战术小队全员（${namesStr}）已按开局剧情【${scenarioConfig.name}】预设同步重置复位（绑定羁绊：【${boundSlot.title}】），天数回到第 1 天。`;

      const teamGreetingLines = activeHeroes.map((h) => {
        const isPrimary = h.id === currentHero.id;
        const relTag = boundSlot.title ? `[${boundSlot.title}]` : '';
        if (scenarioConfig.initialGreeting && isPrimary) {
          const cleanInit = scenarioConfig.initialGreeting.replace(/^【.*?】[：:]?/, '').replace(/^[“"”]/, '').replace(/[“"”]$/, '').trim();
          return `【${h.name}】${relTag}：“${cleanInit}”`;
        }
        const hQuote = h.voiceLines?.greeting?.[0] || '我们绝不屈服！';
        return `【${h.name}】${relTag}：“${hQuote}”`;
      });
      greetingQuote = teamGreetingLines.join('\n');
    } else {
      const relTag = boundSlot.title ? `[${boundSlot.title}]` : '';
      const cleanInit = greetingQuote.replace(/^【.*?】[：:]?/, '').replace(/^[“"”]/, '').replace(/[“"”]$/, '').trim();
      greetingQuote = `【${currentHero.name}】${relTag}：“${cleanInit}”`;
    }

    const initEntry: ConsoleEntry = {
      id: `init_${Date.now()}`,
      type: 'chat_hero',
      sender: 'heroine',
      heroId: currentHero.id,
      heroName: isMultiTeam ? '👥 在场小队全员' : currentHero.name,
      speakerName: isMultiTeam ? '👥 在场小队全员' : currentHero.name,
      text: greetingQuote,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      reactionType: 'defiant',
      psychologicalAnalysis: resetNotice,
    };

    setConsoleEntries([initEntry]);
    setLogs([]);

    // 重置角色库中的所有角色档案与羁绊状态
    heroines.forEach((h) => {
      try {
        localStorage.setItem('ultra_relationship_state_v1_' + h.id, JSON.stringify(resetRelState));
      } catch (e) {
        console.error('Failed to clear relationship state in localStorage for ' + h.id, e);
      }
    });

    const newProgressMap: Record<string, HeroProgress> = {};
    heroines.forEach((memberHero) => {
      const id = memberHero.id;
      const mStats = getInitialHeroStatsFromScenario(memberHero, scenarioConfig);
      const mRelState = getInitialRelationshipStateFromScenario(scenarioConfig);

      newProgressMap[id] = {
        heroId: id,
        dayCount: 1,
        stats: mStats,
        partDamage: { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
        partExposure: { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
        consoleEntries: [initEntry],
        logs: [],
        envTheme: scenarioConfig.defaultEnvTheme || envTheme,
        isEnergyShock: false,
        scenarioConfig,
        relationshipState: mRelState,
        activeRelationship: boundSlot,
        lastUpdated: Date.now(),
      };
    });

    setProgressMap(newProgressMap);
    try {
      localStorage.setItem('ultra_progress_map_v2', JSON.stringify(newProgressMap));
    } catch (e) {
      console.error('Failed to save reset progress map to localStorage:', e);
    }
  };

  // Slow Natural Energy Recovery Loop (if HP > 0)
  // Awakens from energy shock ONLY after energy recovers ABOVE 10%
  useEffect(() => {
    if (!selectedHero) return;
    const currentHero = selectedHero;
    const timer = setInterval(() => {
      setStats((prev) => {
        const maxEnergy = prev.maxEnergy || currentHero.defaultStats?.maxEnergy || 100;
        // 🚨 能量归零 (energy <= 0) 或 生命归零 (hp <= 0) 或 能量已满 时，停止自然回复
        if (prev.hp <= 0 || prev.energy <= 0 || prev.energy >= maxEnergy) return prev;

        const rate = currentHero.energyRegenRate ?? customSettings.regenRate ?? 0.5;
        const nextEnergy = Math.min(maxEnergy, Math.round((prev.energy + rate) * 10) / 10);

        // Check if recovering from energy shock state (> 10%)
        if (isEnergyShockRef.current) {
          if (nextEnergy > 10) {
            setIsEnergyShock(false);
            isEnergyShockRef.current = false;

            const nowStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
            const awakenEntry: ConsoleEntry = {
              id: `awaken_${Date.now()}`,
              type: 'attack_log',
              time: nowStr,
              heroId: currentHero.id,
              heroName: currentHero.name,
              speakerName: currentHero.name,
              weaponName: '慢速自然魔能复苏',
              targetPartName: '魔能值',
              damageDealt: 0,
              energyDrained: -rate,
              moraleLost: 0,
              shameGained: 0,
              obedienceGained: 0,
              lustChanged: 0,
              text: `（魔能值充能重新突破 10%……！${currentHero.name}从无意识能量休克状态中缓缓复苏，剧烈喘息着重聚神智……）`,
              reactionType: 'wavering',
              psychologicalAnalysis: '【脱离休克】魔能值能量回升突破 10%，神经网络系统重组，苏醒恢复意识！',
            };
            setConsoleEntries((prevEntries) => [...prevEntries, awakenEntry]);
            ultraAudio.playChimeSFX();
          }
        }

        if (nextEnergy <= 30 && nextEnergy > 0) {
          ultraAudio.startColorTimerBeep(nextEnergy, currentHero.voicePitch);
        } else if (nextEnergy === 0 || nextEnergy > 30) {
          ultraAudio.stopColorTimerBeep();
        }

        return { ...prev, energy: nextEnergy };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedHero?.id, selectedHero?.name, selectedHero?.energyRegenRate, customSettings.regenRate, selectedHero?.voicePitch]);

  // Handle Send Dialogue in Unified Console with multimodal attachments
  const handleSendChatMessage = async (userText: string, attachments?: AiAttachment[]) => {
    if (!selectedHero) return;
    if (!userText.trim() && (!attachments || attachments.length === 0)) return;

    const userEntry: ConsoleEntry = {
      id: `user_${Date.now()}`,
      type: 'chat_user',
      sender: 'interrogator',
      speakerName: scenarioConfig.interrogatorIdentity || '审讯官',
      text: userText,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    };

    const nextEntries = [...consoleEntries, userEntry];
    setConsoleEntries(nextEntries);
    safeLocalStorageSet('ultra_chat_entries_v2_' + safeHero.id, nextEntries);
    safeLocalStorageSet('ultra_current_chat_entries_v2', nextEntries);
    setIsConsoleLoading(true);

    try {
      const res = await fetchWith5Retries('/api/chat-interrogate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hero: sanitizeHeroForAi(safeHero),
          stats: getStatsPayload(stats, safeHero),
          activeTeam: heroines
            .filter((h) => activeTeamIds.includes(h.id))
            .map((h) => ({
              hero: sanitizeHeroForAi(h),
              stats: h.id === selectedHero?.id ? getStatsPayload(stats, safeHero) : (progressMap[h.id]?.stats || h.defaultStats),
              isPrimary: h.id === selectedHero?.id,
              activeRelationship: getHeroActiveRelationship(h.id),
            })),
          targetScope,
          partDamage,
          partExposure,
          customSettings,
          environmentTheme: envTheme,
          customLights: getSavedCustomLights(),
          messages: getEnrichedChatHistory(nextEntries, selectedHero?.id),
          userMessage: userText,
          attachments: attachments || [],
          weapon: selectedWeapon ? {
            ...selectedWeapon,
            actionTitle: getWeaponActionTitle(selectedWeapon),
          } : undefined,
          targetPart: safeHero.bodyParts[selectedPart]?.name || selectedPart,
          aiConfig,
          dayCount,
          dayConfig,
          scenarioConfig,
          activeRelationship,
          realTimeSyncState: realTimeState,
          realTimeContext: realTimeState.isEnabled ? getRealTimeContext(realTimeState) : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        let replyText = data.text || `（【${safeHero.name}】生命值归零处于死亡状态……无法做出任何言语回应）`;
        let reactionType = data.reactionType || (stats.hp <= 0 ? 'corpse' : 'defiant');
        if (stats.hp <= 0) {
          reactionType = 'corpse';
          if (!replyText.startsWith('（') && !replyText.startsWith('(')) {
            const cleanTxt = replyText.replace(/[“"”]/g, '').trim();
            replyText = `（${cleanTxt}）`;
          }
        }

        const heroEntry: ConsoleEntry = {
          id: `hero_${Date.now()}`,
          type: 'chat_hero',
          sender: 'heroine',
          heroId: safeHero.id,
          heroName: activeTeamIds.length > 1 ? '👥 在场小队全员' : safeHero.name,
          speakerName: activeTeamIds.length > 1 ? '👥 在场小队全员' : safeHero.name,
          text: replyText,
          time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          reactionType,
          psychologicalAnalysis: data.psychologicalAnalysis,
          thinkingProcess: data.thinkingProcess,
          webSearchUsed: Boolean(data.webSearchUsed || (data.webSources && data.webSources.length > 0)),
          searchEngine: data.webSearchEngine || data.searchEngine,
          searchQuery: data.webSearchQuery || data.searchQuery,
          searchSources: data.webSources || data.searchSources,
        };
        setConsoleEntries((prev) => {
          const updated = [...prev, heroEntry];
          safeLocalStorageSet('ultra_chat_entries_v2_' + safeHero.id, updated);
          safeLocalStorageSet('ultra_current_chat_entries_v2', updated);
          return updated;
        });
        if (stats.hp > 0 && reactionType !== 'corpse' && !isMuted) {
          ultraAudio.speakVoiceLine(replyText, safeHero.voicePitch);
        }
      } else {
        throw new Error('API request failed');
      }
    } catch (e: any) {
      console.error('Chat error:', e);
      const isDead = stats.hp <= 0;
      const errHeroEntry: ConsoleEntry = {
        id: `hero_err_${Date.now()}`,
        type: 'chat_hero',
        sender: 'heroine',
        heroId: safeHero.id,
        heroName: activeTeamIds.length > 1 ? '👥 在场小队全员' : safeHero.name,
        speakerName: activeTeamIds.length > 1 ? '👥 在场小队全员' : safeHero.name,
        text: isDead
          ? `（【${safeHero.name}】生命值归零判定死亡……体征沉寂，眼眸无光，尊贵冰凉的遗体对你的言语无法做出任何言语回应）`
          : (activeTeamIds.length > 1
              ? heroines
                  .filter((h) => activeTeamIds.includes(h.id))
                  .map((h) =>
                    h.id === selectedHero?.id
                      ? `【${h.name}】：“（面向【${scenarioConfig.interrogatorIdentity || '交互对方'}】）我们绝不会向逆境服输的！不管你耍什么手段！”`
                      : `【${h.name}】：“（与【${safeHero.name}】并肩而立）没错！同伴们都在这里，正义的力量绝不会散去！”`
                  )
                  .join('\n')
              : `【${safeHero.name}】：“（咬紧牙关）可恶……无论你怎么挑衅，我都不会听信你的谎言！”`),
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        reactionType: isDead ? 'corpse' : 'defiant',
        psychologicalAnalysis: isDead
          ? '生命值归零死亡沉寂状态'
          : (activeTeamIds.length > 1
              ? heroines
                  .filter((h) => activeTeamIds.includes(h.id))
                  .map((h) => {
                    const hRel = getHeroActiveRelationship(h.id);
                    const relStr = hRel?.title ? `[契约: ${hRel.title}] ` : '';
                    return `【${h.name}】心理：${relStr}面对【${scenarioConfig.interrogatorIdentity || '交互对方'}】的言语，坚守防线，与小队同伴并肩应对。`;
                  })
                  .join('\n')
              : '通信降级模式：触发角色坚毅防线防护'),
      };
      setConsoleEntries((prev) => {
        const updated = [...prev, errHeroEntry];
        safeLocalStorageSet('ultra_chat_entries_v2_' + safeHero.id, updated);
        safeLocalStorageSet('ultra_current_chat_entries_v2', updated);
        return updated;
      });
    } finally {
      setIsConsoleLoading(false);
    }
  };

  const lastQuoteRef = useRef<string>('');

  const pickNonRepeatingQuote = (pool?: string[], fallback: string = ''): string => {
    if (!pool || pool.length === 0) return fallback;
    if (pool.length === 1) {
      lastQuoteRef.current = pool[0];
      return pool[0];
    }
    const filtered = pool.filter((q) => q !== lastQuoteRef.current);
    const chosen = filtered.length > 0
      ? filtered[Math.floor(Math.random() * filtered.length)]
      : pool[Math.floor(Math.random() * pool.length)];
    lastQuoteRef.current = chosen;
    return chosen;
  };

  // Add Custom Hero Slot
  const handleAddHeroine = () => {
    const newId = `custom_hero_${Date.now()}`;
    const newHero: Ultrawoman = {
      id: newId,
      name: `自定义角色 ${heroines.length + 1}`,
      title: '原创战术角色 / 自定义位',
      height: '168cm',
      weight: '52kg',
      homePlanet: '原创次元 / 自定义背景',
      description: '用户建立的自定义角色槽位，支持配置任何动漫角色、科幻英雄、魔法少女、战甲战士或原创角色 (OC)，包含独立属性与立绘机制。',
      weakness: '核心弱点与敏感部位',
      weakPart: 'timer',
      voicePitch: 1.0,
      colorTheme: {
        primary: '#3b82f6',
        secondary: '#e2e8f0',
        glow: '#06b6d4',
        bgGradient: 'from-blue-950/40 via-cyan-950/30 to-slate-950',
      },
      defaultStats: {
        hp: 100,
        energy: 100,
        morale: 100,
        obedience: 0,
        shame: 0,
        lust: 10,
      },
      bodyParts: {
        head: { id: 'head', name: '头部战术头盔', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.0, description: '战术防护面罩。' },
        timer: { id: 'timer', name: '魔能值 (弱点中枢)', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.5, description: '核心能量枢纽。' },
        chest: { id: 'chest', name: '胸甲装甲', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.1, description: '前胸护铠。' },
        leftArm: { id: 'leftArm', name: '左臂', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.0, description: '左手臂防御。' },
        rightArm: { id: 'rightArm', name: '右臂', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.0, description: '右手臂攻击端。' },
        torso: { id: 'torso', name: '腰腹部', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.2, description: '发力躯干。' },
        legs: { id: 'legs', name: '腿部关节', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.1, description: '战术飞踢枢纽。' },
      },
      voiceLines: {
        greeting: ['不管你用什么手段，我都绝不屈服！'],
        hitSmall: ['哼……这种程度的冲击！', '咬紧牙关！'],
        hitHeavy: ['咕呜啊……！能量流失得太快了！'],
        hitWeakPoint: ['核心弱点……被击中了！'],
        timerLow: ['魔能值警报响起了……我还能支撑！'],
        defiant: ['正义的光芒……永不熄灭！'],
        wavering: ['视线……开始模糊了……'],
        broken: ['任由……处置了……'],
        corpseReaction: ['（遗体停止了呼吸，处于休克死寂之中……）'],
        healingReaction: ['复苏光线……伤口正在愈合……！'],
      },
    };

    const updated = [...heroines, newHero];
    setHeroines(updated);
    handleSelectHero(newHero);
  };

  // Update Heroine Configuration (Preserves customPortrait safely unless explicitly set to empty string or null)
  const handleUpdateHeroine = (updatedHero: Ultrawoman) => {
    const existingHero = heroines.find((h) => h.id === updatedHero.id);
    const resolvedPortrait = updatedHero.customPortrait !== undefined
      ? updatedHero.customPortrait
      : (existingHero?.customPortrait || videoStreamCache[updatedHero.id]);

    const finalHero: Ultrawoman = {
      ...updatedHero,
      customPortrait: resolvedPortrait,
    };

    if (resolvedPortrait) {
      preloadMediaStream(resolvedPortrait);
      savePortraitToIDB(finalHero.id, resolvedPortrait).catch(() => {});
      setVideoStreamCache((prev) => {
        const next = { ...prev, [finalHero.id]: resolvedPortrait };
        try {
          mirrorStreamCacheToWebStorage(next);
        } catch (e) {}
        return next;
      });
    } else if (updatedHero.customPortrait === '' || updatedHero.customPortrait === null) {
      // Explicit deletion requested
      clearPortraitFromIDB(finalHero.id).catch(() => {});
      setVideoStreamCache((prev) => {
        const next = { ...prev };
        delete next[finalHero.id];
        try {
          mirrorStreamCacheToWebStorage(next);
        } catch (e) {}
        return next;
      });
    }

    setHeroines((prev) => {
      const oldHero = prev.find((h) => h.id === finalHero.id);
      const nameChanged = oldHero && oldHero.name !== finalHero.name;

      return prev.map((h) => {
        if (h.id === finalHero.id) {
          return finalHero;
        }
        if (nameChanged && h.heroRelationships) {
          const updatedRels = h.heroRelationships.map((r) =>
            r.targetHeroId === finalHero.id ? { ...r, targetHeroName: finalHero.name } : r
          );
          return { ...h, heroRelationships: updatedRels };
        }
        return h;
      });
    });

    if (selectedHero.id === finalHero.id) {
      setSelectedHero(finalHero);
    }
  };

  // Import Standalone Character Card
  const handleImportCharacterCard = (importedHero: Ultrawoman) => {
    if (importedHero.customPortrait) {
      preloadMediaStream(importedHero.customPortrait);
      savePortraitToIDB(importedHero.id, importedHero.customPortrait).catch(() => {});
      setVideoStreamCache((prev) => {
        const next = { ...prev, [importedHero.id]: importedHero.customPortrait! };
        try {
          mirrorStreamCacheToWebStorage(next);
        } catch (e) {}
        return next;
      });
    }

    setHeroines((prev) => {
      const existingIndex = prev.findIndex((h) => h.id === importedHero.id);
      if (existingIndex >= 0) {
        return prev.map((h, idx) => (idx === existingIndex ? importedHero : h));
      }
      return [...prev, importedHero];
    });
    handleSelectHero(importedHero);
    ultraAudio.playApiReplyChime();
  };

  // Import Batch Characters / Character Deck
  const handleImportBatchHeroes = (
    importedHeroes: Ultrawoman[],
    importedFactions?: Faction[],
    importedRelationships?: RelationshipSlot[]
  ) => {
    if (!importedHeroes || importedHeroes.length === 0) return;

    // Cache any custom portraits and save to IDB
    importedHeroes.forEach((hero) => {
      if (hero.customPortrait) {
        preloadMediaStream(hero.customPortrait);
        savePortraitToIDB(hero.id, hero.customPortrait).catch(() => {});
        setVideoStreamCache((prev) => {
          const next = { ...prev, [hero.id]: hero.customPortrait! };
          try {
            mirrorStreamCacheToWebStorage(next);
          } catch (e) {}
          return next;
        });
      }
    });

    // Merge custom factions
    if (importedFactions && importedFactions.length > 0) {
      setFactions((prev) => {
        const existingIds = new Set(prev.map((f) => f.id));
        const newFactions = importedFactions.filter((f) => !existingIds.has(f.id));
        return newFactions.length > 0 ? [...prev, ...newFactions] : prev;
      });
    }

    // Merge relationship slots
    if (importedRelationships && importedRelationships.length > 0) {
      setRelationshipState((prev) => {
        const existingSlots = prev.slots || [];
        const existingSlotIds = new Set(existingSlots.map((s) => s.id));
        const newSlots = importedRelationships.filter((s) => !existingSlotIds.has(s.id));
        if (newSlots.length === 0) return prev;
        const mergedSlots = [...existingSlots, ...newSlots];
        saveGlobalRelationshipSlots(mergedSlots);
        return { ...prev, slots: mergedSlots };
      });
    }

    // Merge heroes
    setHeroines((prev) => {
      const prevMap = new Map(prev.map((h) => [h.id, h]));
      importedHeroes.forEach((h) => {
        prevMap.set(h.id, h);
      });
      return Array.from(prevMap.values());
    });

    handleSelectHero(importedHeroes[0]);
    ultraAudio.playApiReplyChime();
    setSaveToast({ message: `📦 成功批量导入 ${importedHeroes.length} 位全息干员及关联数据！`, visible: true });
    setTimeout(() => setSaveToast(null), 4000);
  };

  // Auto-sync selectedPart if invalid
  useEffect(() => {
    if (selectedHero && selectedHero.bodyParts) {
      if (!selectedHero.bodyParts[selectedPart]) {
        const remainingKeys = Object.keys(selectedHero.bodyParts);
        if (remainingKeys.length > 0) {
          setSelectedPart(remainingKeys[0]);
        }
      }
    }
  }, [selectedHero, selectedPart]);

  // Delete Heroine Slot
  const handleDeleteHeroine = async (heroId: string) => {
    if (heroines.length <= 1) return;

    try {
      await clearModelFromIDB(heroId);
      await clearPortraitFromIDB(heroId);
    } catch (err) {
      console.warn('Failed to clear IDB model/portrait on hero deletion:', err);
    }

    setHeroines((prev) => {
      const filtered = prev.filter((h) => h.id !== heroId);
      // Clean up any relationship references to the deleted hero
      return filtered.map((h) => {
        if (h.heroRelationships) {
          return {
            ...h,
            heroRelationships: h.heroRelationships.filter((r) => r.targetHeroId !== heroId),
          };
        }
        return h;
      });
    });

    if (selectedHero?.id === heroId) {
      const remaining = heroines.filter((h) => h.id !== heroId);
      if (remaining.length === 0) {
        setHeroines([]);
        setSelectedHero(null);
        return;
      }
      handleSelectHero(remaining[0]);
    }
  };

  // Reset / Clear Heroines List to Fresh Custom Slate (Pure initial state)
  const handleRestoreDefaultHeroines = () => {
    setHeroines([]);
    setSelectedHero(null);
  };

  // Reset Stats & Full Energy Recharge (RESTORES HP & Energy to max capacity)
  const handleResetStats = () => {
    if (!selectedHero) return; // Header stays mounted even when the roster is empty
    setIsEnergyShock(false);
    isEnergyShockRef.current = false;
    setIsRecharging(true);
    ultraAudio.playRechargeSFX();
    ultraAudio.stopColorTimerBeep();

    const maxHp = stats.maxHp || selectedHero.defaultStats?.maxHp || 100;
    const maxEnergy = stats.maxEnergy || selectedHero.defaultStats?.maxEnergy || 100;

    setStats((prev) => ({
      ...prev,
      hp: maxHp,
      energy: maxEnergy,
    }));

    setPartDamage({
      head: 0,
      timer: 0,
      chest: 0,
      leftArm: 0,
      rightArm: 0,
      torso: 0,
      legs: 0,
    });

    // 多人小队模式下，满血满能量注能直接对全员生效
    if (activeTeamIds.length > 1) {
      activeTeamIds.forEach((memberId) => {
        if (memberId !== selectedHero.id) {
          const memberHero = heroines.find((h) => h.id === memberId);
          if (memberHero) {
            const curStats = progressMap[memberId]?.stats || memberHero.defaultStats;
            const mMaxHp = curStats.maxHp || memberHero.defaultStats.maxHp || 100;
            const mMaxEnergy = curStats.maxEnergy || memberHero.defaultStats.maxEnergy || 100;
            setProgressMap((prev) => ({
              ...prev,
              [memberId]: {
                ...(prev[memberId] || {
                  heroId: memberId,
                  dayCount,
                  envTheme,
                  isEnergyShock: false,
                  consoleEntries: [],
                  logs: [],
                  lastUpdated: Date.now(),
                }),
                stats: {
                  ...curStats,
                  hp: mMaxHp,
                  energy: mMaxEnergy,
                },
                partDamage: { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
                partExposure: { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
                isEnergyShock: false,
                lastUpdated: Date.now(),
              },
            }));
          }
        }
      });
    }

    const restoredStats = {
      ...stats,
      hp: maxHp,
      energy: maxEnergy,
    };

    const presetRechargeText = `✨【满血注能充能】审讯官全面注入高纯度能量！【${selectedHero.name}】生命值(${maxHp} HP)与能量值(${maxEnergy})恢复全满！意志与信任值等心理状态保持不变。`;
    const presetRechargeAnalysis = `【满血充能注能】体能 (HP: ${maxHp}) 与核心光能 (Energy: ${maxEnergy}) 复原至 100% 充能上限。【${selectedHero.name}】的心理状态 (意志/耻辱/信任/欲望) 维持原样。`;

    const nowStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const rechargeEntryId = `recharge_${Date.now()}`;
    const rechargeConsoleEntry: ConsoleEntry = {
      id: rechargeEntryId,
      type: 'attack_log',
      time: nowStr,
      heroId: selectedHero.id,
      heroName: selectedHero.name,
      speakerName: selectedHero.name,
      weaponName: '✨ M78高纯能量满血注能射线',
      targetPartName: '魔能值 (全躯干)',
      damageDealt: -100,
      energyDrained: -100,
      moraleLost: 0,
      shameGained: 0,
      obedienceGained: 0,
      lustChanged: 0,
      shieldAbsorbRate: 1,
      text: `⏳ [AI思考分析注能反应中...]`,
      reactionType: 'healing',
      psychologicalAnalysis: `⏳ [核心光能复原度与心智评估中...]`,
    };

    setConsoleEntries((prev) => [...prev, rechargeConsoleEntry]);
    setIsLoadingAi(true);

    const applyRechargeFallback = () => {
      setConsoleEntries((prev) =>
        prev.map((entry) =>
          entry.id === rechargeEntryId
            ? {
                ...entry,
                text: presetRechargeText,
                reactionType: 'healing',
                psychologicalAnalysis: presetRechargeAnalysis,
              }
            : entry
        )
      );
      if (!isMuted) {
        ultraAudio.speakVoiceLine(presetRechargeText, selectedHero.voicePitch);
      }
    };

    fetchWith5Retries('/api/interrogate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hero: sanitizeHeroForAi(selectedHero),
        weapon: {
          id: 'full_recharge',
          name: '✨ 高纯灵能满血注能射线',
          type: 'heal',
          category: 'heal',
          description: `执刑官将【${selectedHero.name}】的生命值、能量与创伤完全注能复原至100%满血状态。`,
          damage: -100,
          energyDrain: -100,
          moraleDamage: -100,
          shameIncrease: 0,
          obedienceGain: 0,
        },
        targetPart: '能量核心 (全躯干)',
        stats: getStatsPayload(restoredStats, selectedHero),
        customSettings,
        environmentTheme: envTheme,
        partDamage: { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
        partExposure: { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
        customLights: getSavedCustomLights(),
        aiConfig,
        dayCount,
        scenarioConfig,
        activeRelationship,
        activeTeam: heroines
          .filter((h) => activeTeamIds.includes(h.id))
          .map((h) => ({
            hero: sanitizeHeroForAi(h),
            stats: h.id === selectedHero.id ? getStatsPayload(restoredStats, selectedHero) : (progressMap[h.id]?.stats || h.defaultStats),
            isPrimary: h.id === selectedHero.id,
            activeRelationship: getHeroActiveRelationship(h.id),
          })),
        targetScope,
        messages: getEnrichedChatHistory(consoleEntries, selectedHero?.id),
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          applyRechargeFallback();
          return;
        }
        const data = await res.json();
        if (data && (data.dialogue || data.psychologicalAnalysis)) {
          const apiQuote = data.dialogue || presetRechargeText;
          const apiReaction = data.reactionType || 'healing';
          const apiAnalysis = data.psychologicalAnalysis || presetRechargeAnalysis;

          setConsoleEntries((prev) =>
            prev.map((entry) =>
              entry.id === rechargeEntryId
                ? {
                    ...entry,
                    text: apiQuote,
                    reactionType: apiReaction,
                    psychologicalAnalysis: apiAnalysis,
                    thinkingProcess: data.thinkingProcess,
                    webSearchUsed: Boolean(data.webSearchUsed || (data.webSources && data.webSources.length > 0)),
                    searchEngine: data.webSearchEngine || data.searchEngine,
                    searchQuery: data.webSearchQuery || data.searchQuery,
                    searchSources: data.webSources || data.searchSources,
                  }
                : entry
            )
          );

          if (data.dialogue && !isMuted) {
            ultraAudio.speakVoiceLine(data.dialogue, selectedHero.voicePitch);
          }
        } else {
          applyRechargeFallback();
        }
        ultraAudio.playApiReplyChime();
      })
      .catch((err) => {
        console.error('API interrogation error for full recharge:', err);
        applyRechargeFallback();
      })
      .finally(() => {
        setIsLoadingAi(false);
      });

    setTimeout(() => {
      setIsRecharging(false);
    }, 2500);
  };

  // 音效设置同步到音频引擎（引擎内部会写入 localStorage，刷新后保持）
  useEffect(() => {
    ultraAudio.setSettings(masterVolume, 0.7, isMuted);
  }, [masterVolume, isMuted]);

  // Sound Mute Toggle
  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  // Execute Attack Logic with Energy Shield Mitigation
  const handleExecuteAttack = async (
    weapon: AlienWeapon,
    targetPart: BodyPartId,
    attackIntensity: number = intensity,
    customQuestion?: string
  ) => {
    if (!selectedHero) return;
    // Disable single attack if API is currently analyzing
    if (isLoadingAi) return;

    setIsLoadingAi(true);

    // 0. State Flags & Weapon Checks
    const wasHpZero = stats.hp <= 0;
    const isHealingWeapon = weapon.category === 'heal' || weapon.type === 'heal' || weapon.type === 'nanite' || weapon.type === 'bliss' || (weapon.hpHeal && weapon.hpHeal > 0);

    // 1. Calculate Weakness & Sensitive Multipliers
    const isWeakPoint = selectedHero.weakPart === targetPart;
    const isSensitivePoint = selectedHero.sensitivePart === targetPart;
    const partConfig = selectedHero.bodyParts[targetPart];
    const partMultiplier = partConfig?.weaknessMultiplier || 1.0;
    const globalWeakMult = customSettings.weaknessMultiplier || 1.0;
    const globalSensMult = customSettings.sensitiveMultiplier || 1.3;

    // Check active Environmental Weakness linkage
    const activeEnvWeaknesses = (selectedHero.envWeaknesses || []).filter((ew) => ew.enabled);
    const matchedEw = activeEnvWeaknesses.find((ew) => {
      const matchEnv = ew.envTheme === 'any' || ew.envTheme === envTheme;
      const matchPart = !ew.targetPartId || ew.targetPartId === 'any' || ew.targetPartId === targetPart;
      const matchCat = !ew.weaponCategory || ew.weaponCategory === 'any' || ew.weaponCategory === weapon.category;
      const matchType = !ew.weaponType || ew.weaponType === 'any' || ew.weaponType === weapon.type;
      return matchEnv && matchPart && matchCat && matchType;
    });

    const envWeaknessMult = matchedEw ? (matchedEw.damageMultiplier || 1.5) : 1.0;
    const weaknessMult = isWeakPoint ? (partMultiplier * globalWeakMult) : partMultiplier;
    const dayScalingMult = 1 + Math.max(0, dayCount - 1) * (dayConfig.scalingFactor || 0.02);
    const totalMult = attackIntensity * weaknessMult * envWeaknessMult * dayScalingMult;
    const sensitiveShameMult = isSensitivePoint ? globalSensMult : 1.0;
    const BALANCED_SCALE = 0.6; // Global balance coefficient

    // ENERGY SHIELD & ENERGY DRAIN MITIGATION LOGIC:
    // 1. Energy value (0-100%) acts as an Energy Shield (能量护盾).
    // 2. High energy -> high damage mitigation (up to 75% at 100% energy).
    // 3. Low energy (<= 10%): SHIELD SHATTERS! (0% mitigation, full raw damage directly passes through!).
    // 4. Energy drain: Only explicit energy drain/siphon weapons can drain energy to 0. Non-drain weapons stop at 1.0%.
    const maxEnergyForShield = stats.maxEnergy || selectedHero.defaultStats.maxEnergy || 100;
    const currentEnergyShield = Math.max(0, Math.min(100, (stats.energy / maxEnergyForShield) * 100)); // Percentage 0 to 100
    const isShieldShattered = currentEnergyShield <= 10;
    const isEnergyDrainWeapon = weapon.category === 'drain' || weapon.type === 'drain' || weapon.sfxType === 'siphon' || weapon.id.includes('drain') || weapon.id.includes('siphon');

    const shieldPenetration = (weapon as any).shieldPenetration ? ((weapon as any).shieldPenetration / 100) : 0;
    const rawShieldAbsorb = isShieldShattered ? 0 : (currentEnergyShield / 100) * 0.75; // 0% if shield broken (<=10%)
    const effectiveShieldAbsorb = isShieldShattered ? 0 : Math.max(0, rawShieldAbsorb * (1 - shieldPenetration));
    const shieldMitigationFactor = isHealingWeapon ? 1.0 : (1 - effectiveShieldAbsorb); // 1.0 if shield shattered (full damage)

    let damageDealt = 0;
    let hpHealed = 0;
    let energyDrained = 0;
    let moraleLost = 0;
    let shameGained = 0;
    let obedienceGained = 0;
    let lustChanged = 0;

    let isRevival = false;
    let isCorpseHit = false;

    // Body part current exposure factor: exposed skin/damaged armor amplifies shame
    const currentPartExp = partExposure[targetPart] || 0;
    const exposureShameMult = 1 + (Math.max(0, Math.min(100, currentPartExp)) / 100) * 0.5;

    if (isHealingWeapon) {
      // HEALING LIGHT / CARE LOGIC
      hpHealed = Math.round((weapon.hpHeal || Math.abs(weapon.damage) || 25) * attackIntensity * 10) / 10;
      energyDrained = weapon.energyDrain;
      moraleLost = weapon.moraleDamage;
      // Allow negative shameIncrease to soothe and wash away shame, or positive shame if healing has an embarrassing component
      shameGained = Math.round((weapon.shameIncrease || 0) * attackIntensity * 10) / 10;
      obedienceGained = Math.round((weapon.obedienceGain || 0) * attackIntensity * 10) / 10;
      lustChanged = Math.round((weapon.lustChange ?? 5) * attackIntensity * 10) / 10;

      if (wasHpZero) isRevival = true;
    } else if (wasHpZero) {
      // CORPSE WHIPPING / 鞭尸
      isCorpseHit = true;
      damageDealt = weapon.damage > 0 ? Math.max(0.1, Math.round(weapon.damage * totalMult * BALANCED_SCALE * 10) / 10) : 0;
      energyDrained = 0;
      moraleLost = 0;
      shameGained = Math.round((weapon.shameIncrease || 0) * attackIntensity * (isSensitivePoint ? sensitiveShameMult : 1.0) * 10) / 10;
      obedienceGained = 0;
      lustChanged = 0;
    } else {
      // NORMAL ATTACK LOGIC WITH ENERGY SHIELD ABSORPTION
      const rawDmg = weapon.damage > 0 ? Math.max(0.1, Math.round(weapon.damage * totalMult * BALANCED_SCALE * 10) / 10) : 0;
      damageDealt = Math.round(rawDmg * shieldMitigationFactor * 10) / 10;

      // Allow negative energyDrain (energy recharge) as well as positive energy drain
      const rawEnergyDrain = Math.round((weapon.energyDrain || 0) * totalMult * BALANCED_SCALE * 10) / 10;
      energyDrained = (weapon.energyDrain || 0) > 0 ? Math.round(rawEnergyDrain * shieldMitigationFactor * 10) / 10 : rawEnergyDrain;

      // Allow negative moraleDamage (morale boost) as well as positive morale damage
      const rawMorale = Math.round((weapon.moraleDamage || 0) * totalMult * (isSensitivePoint ? 1.2 : 1.0) * BALANCED_SCALE * 10) / 10;
      moraleLost = (weapon.moraleDamage || 0) > 0 ? Math.round(rawMorale * shieldMitigationFactor * 10) / 10 : rawMorale;

      // SHAME LOGIC: Shame is psychological/emotional and NOT blocked by kinetic energy shields
      // It scales with attack intensity, sensitive point bonuses, and current body part exposure
      if ((weapon.shameIncrease || 0) > 0) {
        const rawShame = weapon.shameIncrease * attackIntensity * sensitiveShameMult * exposureShameMult;
        shameGained = Math.round(rawShame * 10) / 10;
      } else if ((weapon.shameIncrease || 0) < 0) {
        // Negative shame: calming/comforting actions directly reduce shame
        shameGained = Math.round((weapon.shameIncrease || 0) * attackIntensity * 10) / 10;
      } else {
        // Weapon has 0 base shame: targeting sensitive area still triggers minor embarrassment
        shameGained = isSensitivePoint ? Math.round(3 * attackIntensity * sensitiveShameMult * 10) / 10 : 0;
      }

      // Allow negative obedienceGain (rebellion/obedience reduction) as well as positive obedience
      const rawObedience = Math.round((weapon.obedienceGain || 0) * attackIntensity * (isSensitivePoint ? 1.2 : 1.0) * 10) / 10;
      obedienceGained = rawObedience;

      // LUST CHANGE LOGIC
      const configuredLust = weapon.lustChange !== undefined ? weapon.lustChange : (weapon.shameIncrease !== undefined ? Math.round(weapon.shameIncrease * 0.5) : 5);
      if (configuredLust > 0) {
        const rawLust = Math.round(configuredLust * attackIntensity * (isSensitivePoint ? 1.3 : 1.0) * exposureShameMult * 10) / 10;
        lustChanged = rawLust;
      } else if (configuredLust < 0) {
        lustChanged = Math.round(configuredLust * attackIntensity * 10) / 10;
      } else {
        lustChanged = 0;
      }
    }

    // Next Stats Calculation
    const maxHp = stats.maxHp || safeHero.defaultStats?.maxHp || 100;
    const maxEnergy = stats.maxEnergy || safeHero.defaultStats?.maxEnergy || 100;
    const maxMorale = stats.maxMorale || safeHero.defaultStats?.maxMorale || 100;
    const maxObedience = stats.maxObedience || safeHero.defaultStats?.maxObedience || 100;
    const maxShame = stats.maxShame || safeHero.defaultStats?.maxShame || 100;
    const maxLust = stats.maxLust || safeHero.defaultStats?.maxLust || 100;

    let nextHp = wasHpZero && !isHealingWeapon ? 0 : Math.min(maxHp, Math.max(0, Math.round((stats.hp - damageDealt + hpHealed) * 10) / 10));
    let rawNextEnergy = Math.min(maxEnergy, Math.max(0, Math.round((stats.energy - energyDrained) * 10) / 10));
    let nextEnergy = rawNextEnergy;

    // Rule: Energy = 0% triggers Energy Shock state (失去意识)
    if (nextEnergy <= 0) {
      nextEnergy = 0;
      setIsEnergyShock(true);
      isEnergyShockRef.current = true;
    }

    let nextMorale = Math.min(maxMorale, Math.max(0, Math.round((stats.morale - moraleLost) * 10) / 10));
    let nextObedience = Math.min(maxObedience, Math.max(0, Math.round((stats.obedience + obedienceGained) * 10) / 10));
    let nextShame = Math.min(maxShame, Math.max(0, Math.round((stats.shame + shameGained) * 10) / 10));
    let nextLust = Math.min(maxLust, Math.max(0, Math.round(((stats.lust ?? 10) + lustChanged) * 10) / 10));

    // =========================================================
    // 🎲 临界低血量随机事件发生器 (HP < 30% 战场随机分支)
    // =========================================================
    let specialEvent: {
      name: string;
      type: 'resistance' | 'whisper' | 'surge' | 'faultline';
      tag: string;
      description: string;
    } | undefined = undefined;

    if (nextHp < (maxHp * 0.3) && nextHp > 0 && !isCorpseHit && !isRevival && !isHealingWeapon && !isEnergyShockRef.current) {
      if (Math.random() < 0.55) {
        const roll = Math.random();
        if (roll < 0.35) {
          // 分支1: “临界反抗” (Critical Resistance)
          specialEvent = {
            name: '临界反抗 (Critical Resistance)',
            type: 'resistance',
            tag: '⚡ 临界爆发',
            description: '在濒死威胁下强行激发光之意志！士气飙升 +15，并全额抵抗顺从感侵蚀！',
          };
          nextMorale = Math.min(maxMorale, Math.round((nextMorale + 15) * 10) / 10);
          nextObedience = Math.max(0, Math.round((nextObedience - 10) * 10) / 10);
          obedienceGained = 0;
        } else if (roll < 0.70) {
          // 分支2: “绝望低语” (Desperate Whispers)
          specialEvent = {
            name: '绝望低语 (Desperate Whispers)',
            type: 'whisper',
            tag: '🖤 精神崩溃',
            description: '剧痛撕裂理智防线！士气暴跌 -20，耻辱与顺从度疯狂飙升！',
          };
          nextMorale = Math.max(0, Math.round((nextMorale - 20) * 10) / 10);
          nextShame = Math.min(maxShame, Math.round((nextShame + 15) * 10) / 10);
          nextObedience = Math.min(maxObedience, Math.round((nextObedience + 15) * 10) / 10);
          moraleLost += 20;
          shameGained += 15;
          obedienceGained += 15;
        } else if (roll < 0.85) {
          // 分支3: “光能逆涌” (Light Energy Surge)
          specialEvent = {
            name: '光能逆涌 (Light Energy Surge)',
            type: 'surge',
            tag: '✨ 魔能值过载',
            description: '魔能值在红线濒死状态下强行逆涌！能量护盾紧急回充 +20%！',
          };
          nextEnergy = Math.min(maxEnergy, Math.round((nextEnergy + 20) * 10) / 10);
        } else {
          // 分支4: “心智断层” (Mental Faultline)
          specialEvent = {
            name: '心智断层 (Mental Faultline)',
            type: 'faultline',
            tag: '🌌 认知解离',
            description: '濒死冲击引发感官倒错！欲望感知跳升 +20，陷入恍惚盲从状态！',
          };
          nextLust = Math.min(maxLust, Math.round((nextLust + 20) * 10) / 10);
          lustChanged += 20;
        }

        setActiveRandomEvent({
          id: `evt_${Date.now()}`,
          ...specialEvent,
        });
      }
    }

    if (nextHp <= 0) {
      nextHp = 0;
      nextObedience = 0;
      nextMorale = 0;
    }

    const newStats: Stats = {
      hp: nextHp,
      energy: nextEnergy,
      morale: nextMorale,
      obedience: nextObedience,
      shame: nextShame,
      lust: nextLust,
      maxHp,
      maxEnergy,
      maxMorale,
      maxObedience,
      maxShame,
      maxLust,
    };
    const isSelectedHeroTargeted = selectedHero?.id ? targetedHeroIds.includes(selectedHero.id) : false;

    // Update Body Part Damage & Exposure via Skills
    const currentPartDmg = partDamage[targetPart] || 0;

    // Determine part damage change
    let deltaPartDmg = 0;
    if (weapon.partDamageChange !== undefined && weapon.partDamageChange !== 0) {
      deltaPartDmg = weapon.partDamageChange * attackIntensity;
    } else if (isHealingWeapon) {
      const repairAmount = hpHealed > 0 ? hpHealed : Math.abs(weapon.damage || weapon.hpHeal || 25) * attackIntensity;
      deltaPartDmg = -repairAmount;
    } else {
      deltaPartDmg = damageDealt;
    }

    // Determine part exposure change
    let deltaPartExp = 0;
    if (weapon.partExposureChange !== undefined && weapon.partExposureChange !== 0) {
      deltaPartExp = weapon.partExposureChange * attackIntensity;
    } else if (isHealingWeapon) {
      const repairAmount = hpHealed > 0 ? hpHealed : Math.abs(weapon.damage || weapon.hpHeal || 25) * attackIntensity;
      deltaPartExp = -repairAmount;
    } else {
      // Physical attacks tear armor proportional to damage dealt (not psychological shame)
      deltaPartExp = damageDealt > 0 ? Math.round(damageDealt * 0.6 * 10) / 10 : 0;
    }

    const nextPartDmg = Math.min(100, Math.max(0, Math.round((currentPartDmg + deltaPartDmg) * 10) / 10));
    const nextPartExp = Math.min(100, Math.max(0, Math.round((currentPartExp + deltaPartExp) * 10) / 10));

    if (isSelectedHeroTargeted) {
      setStats(newStats);

      setPartDamage((prev) => {
        const updated = { ...prev, [targetPart]: nextPartDmg };
        if (deltaPartDmg < 0 && Math.abs(deltaPartDmg) >= 15) {
          (Object.keys(updated) as BodyPartId[]).forEach((pKey) => {
            if (pKey !== targetPart) {
              updated[pKey] = Math.max(0, Math.round(((updated[pKey] || 0) + deltaPartDmg * 0.5) * 10) / 10);
            }
          });
        }
        return updated;
      });

      setPartExposure((prev) => {
        const updated = { ...prev, [targetPart]: nextPartExp };
        if (deltaPartExp < 0 && Math.abs(deltaPartExp) >= 15) {
          (Object.keys(updated) as BodyPartId[]).forEach((pKey) => {
            if (pKey !== targetPart) {
              updated[pKey] = Math.max(0, Math.round(((updated[pKey] || 0) + deltaPartExp * 0.5) * 10) / 10);
            }
          });
        }
        return updated;
      });
    }

    // 在多人模式下，对选定的目标小队成员同步施加受击效应
    if (activeTeamIds.length > 1) {
      activeTeamIds.forEach((memberId) => {
        if (memberId !== selectedHero?.id && targetedHeroIds.includes(memberId)) {
          const memberHero = heroines.find((h) => h.id === memberId);
          if (memberHero) {
            const memberProgress = progressMap[memberId];
            const curStats = memberProgress?.stats || memberHero.defaultStats;
            const curPartDmg = memberProgress?.partDamage || { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 };
            const curPartExp = memberProgress?.partExposure || { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 };

            // Determine part damage & exposure changes for team member
            let mDeltaPartDmg = 0;
            if (weapon.partDamageChange !== undefined && weapon.partDamageChange !== 0) {
              mDeltaPartDmg = weapon.partDamageChange * attackIntensity;
            } else if (isHealingWeapon) {
              const repairAmount = hpHealed > 0 ? hpHealed : Math.abs(weapon.damage || weapon.hpHeal || 25) * attackIntensity;
              mDeltaPartDmg = -repairAmount;
            } else {
              mDeltaPartDmg = damageDealt;
            }

            let mDeltaPartExp = 0;
            if (weapon.partExposureChange !== undefined && weapon.partExposureChange !== 0) {
              mDeltaPartExp = weapon.partExposureChange * attackIntensity;
            } else if (isHealingWeapon) {
              const repairAmount = hpHealed > 0 ? hpHealed : Math.abs(weapon.damage || weapon.hpHeal || 25) * attackIntensity;
              mDeltaPartExp = -repairAmount;
            } else {
              mDeltaPartExp = damageDealt > 0 ? Math.round(damageDealt * 0.6 * 10) / 10 : 0;
            }

            const mNextHp = curStats.hp <= 0 && !isHealingWeapon
              ? 0
              : Math.min(curStats.maxHp, Math.max(0, Math.round((curStats.hp - damageDealt + (isHealingWeapon ? hpHealed : 0)) * 10) / 10));
            const mNextEnergy = Math.min(curStats.maxEnergy, Math.max(0, Math.round((curStats.energy - energyDrained) * 10) / 10));
            const mNextMorale = Math.min(curStats.maxMorale, Math.max(0, Math.round((curStats.morale - moraleLost) * 10) / 10));
            const mNextObedience = Math.min(curStats.maxObedience, Math.max(0, Math.round((curStats.obedience + obedienceGained) * 10) / 10));
            const mNextShame = Math.min(curStats.maxShame, Math.max(0, Math.round((curStats.shame + shameGained) * 10) / 10));
            const mNextLust = Math.min(curStats.maxLust, Math.max(0, Math.round((curStats.lust + lustChanged) * 10) / 10));

            const mNextPartDmg = Math.min(100, Math.max(0, Math.round(((curPartDmg[targetPart] || 0) + mDeltaPartDmg) * 10) / 10));
            const mNextPartExp = Math.min(100, Math.max(0, Math.round(((curPartExp[targetPart] || 0) + mDeltaPartExp) * 10) / 10));

            setProgressMap((prev) => ({
              ...prev,
              [memberId]: {
                ...(prev[memberId] || {
                  heroId: memberId,
                  dayCount,
                  envTheme,
                  isEnergyShock: false,
                  consoleEntries: [],
                  logs: [],
                  lastUpdated: Date.now(),
                }),
                stats: {
                  ...curStats,
                  hp: mNextHp,
                  energy: mNextEnergy,
                  morale: mNextMorale,
                  obedience: mNextObedience,
                  shame: mNextShame,
                  lust: mNextLust,
                },
                partDamage: { ...curPartDmg, [targetPart]: mNextPartDmg },
                partExposure: { ...curPartExp, [targetPart]: mNextPartExp },
                lastUpdated: Date.now(),
              },
            }));
          }
        }
      });
    }

    // SFX
    if (weapon.sfxType === 'heal') ultraAudio.playChimeSFX();
    else if (weapon.sfxType === 'laser') ultraAudio.playLaserSFX();
    else if (weapon.sfxType === 'zap') ultraAudio.playElectricZapSFX();
    else if (weapon.sfxType === 'siphon') ultraAudio.playSiphonSFX();
    else if (weapon.sfxType === 'chains') ultraAudio.playChainsSFX();
    else if (weapon.sfxType === 'wave') ultraAudio.playPsyWaveSFX();
    else ultraAudio.playImpactSFX();

    const nextObediencePct = (nextObedience / maxObedience) * 100;
    const nextMoralePct = (nextMorale / maxMorale) * 100;
    const nextEnergyPct = (nextEnergy / maxEnergy) * 100;
    const nextHpPct = (nextHp / maxHp) * 100;

    if (nextEnergyPct <= 30 && nextEnergyPct > 0) {
      ultraAudio.startColorTimerBeep(nextEnergyPct, selectedHero.voicePitch);
    } else if (nextEnergyPct === 0 || nextEnergyPct > 30) {
      ultraAudio.stopColorTimerBeep();
    }

    setLastHitPart(targetPart);
    setHitTimestamp(Date.now());

    // Dialogue Selection with ABSOLUTE DEATH PRIORITY OVERRIDE
    let quote = '';
    let reaction: 'defiant' | 'pained' | 'wavering' | 'broken' | 'begging' | 'corpse' | 'healing' = 'pained';
    let aiAnalysis = '';

    const vl = selectedHero.voiceLines;

    // 1. ABSOLUTE HIGHEST PRIORITY: Death / Corpse Hit / Life zero (unless reviving with healing weapon)
    if ((isCorpseHit || nextHp <= 0) && !isRevival) {
      reaction = 'corpse';
      const defaultCorpseQuotes = [
        `（【${selectedHero.name}】生命值归零判定死亡，体征彻底熄灭，冰凉死寂的遗体在重击下无力震颤，已无法做出任何言语回应……）`,
        `（【${selectedHero.name}】魔能值彻底沉寂黑化，无意识的战躯承受着鞭尸重击，处于死亡沉寂状态……）`,
        `（生机已彻底断绝，毫无防备的尸身随着鞭尸打击沉闷摇晃，无法发出一丝声响……）`,
      ];
      quote = pickNonRepeatingQuote(vl.corpseReaction?.length ? vl.corpseReaction : defaultCorpseQuotes);
      aiAnalysis = `【最高优先级·生命归零死亡判定】目标生命值(HP)已归零判定死亡，完全丧失生命体征与语言意识。攻击转换为对死寂遗体的【鞭尸创伤】，仅引发纯粹的物理死寂反应。`;
    } else if (isRevival && vl.healingReaction?.length) {
      quote = pickNonRepeatingQuote(vl.healingReaction);
      reaction = 'healing';
      aiAnalysis = `【复苏救治】注入生命能量光束，使其脱离死亡状态，微弱生命体征开始复苏！`;
    } else if (isEnergyShockRef.current && nextEnergyPct <= 10) {
      reaction = 'corpse';
      quote = pickNonRepeatingQuote(vl.corpseReaction, `（${selectedHero.name}魔能值彻底沉寂熄灭，陷入无意识能量休克状态，无法做出回应……）`);
      aiAnalysis = `【无意识休克】魔能值归零 (0%)，目标失去意识陷入休克昏迷！能量低于 10% 护盾全面碎裂，全额承受打击。等待慢速充能恢复至 10% 以上方可苏醒。`;
    } else if (specialEvent) {
      if (specialEvent.type === 'resistance') {
        reaction = 'defiant';
        quote = pickNonRepeatingQuote(vl.defiant, `（临界反抗）‘哪怕这具躯体受创至此……光之战士的警备意志也绝对不会屈服！喝啊啊——！’`);
        aiAnalysis = `【随机事件：临界反抗】在生命值低于 30% 濒死红线时爆发出强烈反抗意志！士气飙升 +15，成功全额抵抗顺从感侵蚀！`;
      } else if (specialEvent.type === 'whisper') {
        reaction = 'begging';
        quote = pickNonRepeatingQuote(vl.beggingDesperate, `（绝望低语）‘为什么……难道真的没有任何救赎了吗……这具光之战躯……已经被彻底污浊侵蚀了……呜呜……’`);
        aiAnalysis = `【随机事件：绝望低语】绝境下精神理智防线坍塌！受暗黑低语侵蚀，士气暴跌 -20，服从与耻辱感大幅飙升！`;
      } else if (specialEvent.type === 'surge') {
        reaction = 'pained';
        quote = `（光能逆涌）‘魔能值……正在极速过载逆涌！身躯被灼热的高能强光烫伤……但护盾强行接通了！’`;
        aiAnalysis = `【随机事件：光能逆涌】魔能值红线紧急逆涌！能量护盾暴涨 +20%，紧急回充防御势能。`;
      } else if (specialEvent.type === 'faultline') {
        reaction = 'wavering';
        quote = `（心智断层）‘眼前全是眩目的光斑……审讯官大人的声音……为什么听起来越来越清晰……’`;
        aiAnalysis = `【随机事件：心智断层】濒死剧痛引发感官倒错与认知解离！欲望激增 +20，陷入恍惚盲从状态。`;
      }
    } else if (matchedEw && matchedEw.lines && matchedEw.lines.length > 0) {
      quote = pickNonRepeatingQuote(matchedEw.lines);
      reaction = 'pained';
    } else if (nextObediencePct >= 70 && nextMoralePct <= 30 && vl.beggingSubmissive?.length) {
      quote = pickNonRepeatingQuote(vl.beggingSubmissive);
      reaction = 'begging';
    } else if (nextMoralePct <= 15 && vl.beggingDesperate?.length) {
      quote = pickNonRepeatingQuote(vl.beggingDesperate);
      reaction = 'begging';
    } else if (nextMoralePct <= 30 && vl.beggingResistant?.length) {
      quote = pickNonRepeatingQuote(vl.beggingResistant);
      reaction = 'begging';
    } else if (isSensitivePoint && vl.hitSensitivePoint?.length) {
      quote = pickNonRepeatingQuote(vl.hitSensitivePoint);
      reaction = 'wavering';
    } else if (isWeakPoint && vl.hitWeakPoint?.length) {
      quote = pickNonRepeatingQuote(vl.hitWeakPoint);
      reaction = 'pained';
    } else if (damageDealt > 15 && vl.hitHeavy?.length) {
      quote = pickNonRepeatingQuote(vl.hitHeavy);
      reaction = 'pained';
    } else if (nextMoralePct <= 30 && vl.wavering?.length) {
      quote = pickNonRepeatingQuote(vl.wavering);
      reaction = 'wavering';
    } else if (nextEnergyPct <= 30 && vl.timerLow?.length) {
      quote = pickNonRepeatingQuote(vl.timerLow);
      reaction = 'pained';
    } else {
      const pool = vl.hitSmall?.length ? vl.hitSmall : vl.defiant;
      quote = pickNonRepeatingQuote(pool);
      reaction = 'defiant';
    }

    let presetQuote = `【${selectedHero.name}】：“${quote}”`;
    if (activeTeamIds.length > 1) {
      const teamHeroes = heroines.filter((h) => activeTeamIds.includes(h.id));
      presetQuote = teamHeroes
        .map((h) => {
          if (h.id === selectedHero.id) {
            return `【${h.name}】：“${quote}”`;
          }
          const isTargeted = targetedHeroIds.length === 0 || targetedHeroIds.includes(h.id);
          return isTargeted
            ? `【${h.name}】：“（遭受极大冲击波及，咬紧牙关坚持）呃啊……受击能量侵蚀到了这边……”`
            : `【${h.name}】：“（在旁焦急目睹【${selectedHero.name}】受创，大声呼唤）住手！快停下对【${selectedHero.name}】的摧残！”`;
        })
        .join('\n');
    }

    const presetReaction = reaction;
    const hRel = getHeroActiveRelationship(selectedHero.id);
    const relTitle = hRel?.title ? `[契约: ${hRel.title}] ` : '';
    let presetAnalysis = aiAnalysis || `【${selectedHero.name}】心理：${relTitle}受创部位（${selectedHero.bodyParts[targetPart]?.name || targetPart}）受到直击，能量护盾抵挡了 ${(effectiveShieldAbsorb * 100).toFixed(0)}% 伤害，心理与防线承受压动。`;
    if (activeTeamIds.length > 1) {
      const teamHeroes = heroines.filter((h) => activeTeamIds.includes(h.id));
      presetAnalysis = teamHeroes
        .map((h) => {
          const hRel = getHeroActiveRelationship(h.id);
          const relTitle = hRel?.title ? `[契约: ${hRel.title}] ` : '';
          if (h.id === selectedHero.id) {
            return `【${h.name}】心理：${relTitle}受创部位（${selectedHero.bodyParts[targetPart]?.name || targetPart}）受到直击，心理与防线承受强烈压动。`;
          }
          const isTargeted = targetedHeroIds.length === 0 || targetedHeroIds.includes(h.id);
          return isTargeted
            ? `【${h.name}】心理：${relTitle}身处相同区域同受冲击波及，意志发生剧烈震荡。`
            : `【${h.name}】心理：${relTitle}目睹同伴【${selectedHero.name}】受创，关切与不安急剧上升。`;
        })
        .join('\n');
    }

    // Add entry to Unified Interrogation Console with pending AI state
    const nowStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const attackConsoleEntry: ConsoleEntry = {
      id: `atk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'attack_log',
      time: nowStr,
      heroId: selectedHero.id,
      heroName: activeTeamIds.length > 1 ? '👥 在场小队全员' : selectedHero.name,
      speakerName: activeTeamIds.length > 1 ? '👥 在场小队全员' : selectedHero.name,
      weaponName: weapon.name,
      targetPartName: selectedHero.bodyParts[targetPart]?.name || targetPart,
      damageDealt,
      energyDrained,
      moraleLost,
      shameGained,
      obedienceGained,
      lustChanged,
      shieldAbsorbRate: effectiveShieldAbsorb,
      text: `⏳ [AI思考分析受创反应中...]`,
      reactionType: presetReaction,
      psychologicalAnalysis: `⏳ [心智监测与受创效果评估中...]`,
      envWeaknessName: matchedEw?.name,
      isCorpseHit,
      isRevival,
      specialEvent,
      customQuestion,
    };

    setConsoleEntries((prev) => [...prev, attackConsoleEntry]);

    // Also keep in logs list for Report Modal
    const newLog: LogEntry = {
      id: attackConsoleEntry.id,
      time: nowStr,
      heroId: selectedHero.id,
      heroName: activeTeamIds.length > 1 ? '👥 在场小队全员' : selectedHero.name,
      speakerName: activeTeamIds.length > 1 ? '👥 在场小队全员' : selectedHero.name,
      weaponName: weapon.name,
      targetPartName: selectedHero.bodyParts[targetPart]?.name || targetPart,
      damageDealt,
      energyDrained,
      moraleLost,
      shameGained,
      obedienceGained,
      lustChanged,
      characterQuote: `⏳ [AI思考分析受创反应中...]`,
      reactionType: presetReaction,
      isCorpseHit,
      isRevival,
      envWeaknessHit: matchedEw ? { name: matchedEw.name, multiplier: matchedEw.damageMultiplier } : undefined,
      aiAnalysis: `⏳ [心智监测与受创效果评估中...]`,
      specialEvent,
    };
    setLogs((prev) => [...prev, newLog]);

    const entryId = attackConsoleEntry.id;

    const applyAttackFallback = () => {
      setConsoleEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                text: presetQuote,
                reactionType: presetReaction,
                psychologicalAnalysis: presetAnalysis,
              }
            : entry
        )
      );

      setLogs((prev) =>
        prev.map((log) =>
          log.id === entryId
            ? {
                ...log,
                characterQuote: presetQuote,
                reactionType: presetReaction,
                aiAnalysis: presetAnalysis,
              }
            : log
        )
      );

      if (presetQuote && !isMuted && presetReaction !== 'corpse' && !isCorpseHit && nextHp > 0) {
        ultraAudio.speakVoiceLine(presetQuote, selectedHero.voicePitch);
      }
    };

    // Asynchronous API call: execute API reaction based on Ultrawoman's custom personality & settings
    fetchWith5Retries('/api/interrogate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hero: sanitizeHeroForAi(selectedHero),
        weapon: {
          ...weapon,
          description: weapon.description || '',
          category: weapon.category || 'attack',
          type: weapon.type || 'beam',
          actionTitle: getWeaponActionTitle(weapon),
          actionMode: 'single_strike',
        },
        targetPart: selectedHero.bodyParts[targetPart]?.name || targetPart,
        stats: getStatsPayload({
          ...newStats,
          damageDealt,
          energyDrained,
          moraleLost,
          shameGained,
          obedienceGained,
          lustChanged,
          partDamage: nextPartDmg,
        }, selectedHero),
        customSettings,
        environmentTheme: envTheme,
        partDamage: nextPartDmg,
        partExposure,
        customLights: getSavedCustomLights(),
        aiConfig,
        dayCount,
        dayConfig,
        customQuestion,
        scenarioConfig,
        activeRelationship,
        realTimeSyncState: realTimeState,
        realTimeContext: realTimeState.isEnabled ? getRealTimeContext(realTimeState) : undefined,
        activeTeam: heroines
          .filter((h) => activeTeamIds.includes(h.id))
          .map((h) => ({
            hero: sanitizeHeroForAi(h),
            stats: h.id === selectedHero.id ? getStatsPayload(stats, selectedHero) : (progressMap[h.id]?.stats || h.defaultStats),
            isPrimary: h.id === selectedHero.id,
            isTargeted: targetedHeroIds.includes(h.id),
            activeRelationship: getHeroActiveRelationship(h.id),
          })),
        targetScope,
        targetedHeroIds,
        messages: getEnrichedChatHistory(consoleEntries, selectedHero?.id),
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          applyAttackFallback();
          return;
        }
        const data = await res.json();
        if (data && (data.dialogue || data.psychologicalAnalysis)) {
          let apiQuote = data.dialogue || presetQuote;
          let apiReaction = data.reactionType || presetReaction;
          let apiAnalysis = data.psychologicalAnalysis || presetAnalysis;

          if ((isCorpseHit || nextHp <= 0) && !isRevival) {
            apiReaction = 'corpse';
            if (apiQuote && !apiQuote.startsWith('（') && !apiQuote.startsWith('(')) {
              const cleanTxt = apiQuote.replace(/[“"”]/g, '').trim();
              apiQuote = `（${cleanTxt}）`;
            }
          }

          setConsoleEntries((prev) =>
            prev.map((entry) =>
              entry.id === entryId
                ? {
                    ...entry,
                    text: apiQuote,
                    reactionType: apiReaction,
                    psychologicalAnalysis: apiAnalysis,
                    thinkingProcess: data.thinkingProcess,
                    webSearchUsed: Boolean(data.webSearchUsed || (data.webSources && data.webSources.length > 0)),
                    searchEngine: data.webSearchEngine || data.searchEngine,
                    searchQuery: data.webSearchQuery || data.searchQuery,
                    searchSources: data.webSources || data.searchSources,
                  }
                : entry
            )
          );

          setLogs((prev) =>
            prev.map((log) =>
              log.id === entryId
                ? {
                    ...log,
                    characterQuote: apiQuote,
                    reactionType: apiReaction,
                    aiAnalysis: apiAnalysis,
                  }
                : log
            )
          );

          if (apiQuote && !isMuted && apiReaction !== 'corpse' && !isCorpseHit && nextHp > 0) {
            ultraAudio.speakVoiceLine(apiQuote, selectedHero.voicePitch);
          }
        } else {
          applyAttackFallback();
        }
        ultraAudio.playApiReplyChime();
      })
      .catch((err) => {
        console.error('API interrogation error for weapon attack:', err);
        applyAttackFallback();
      })
      .finally(() => {
        setIsLoadingAi(false);
      });
  };

  // Continuous Light Source Stat Effect Handler
  const handleApplyLightEffect = useCallback((effect: {
    hpDelta?: number;
    energyDelta?: number;
    moraleDelta?: number;
    shameDelta?: number;
    obedienceDelta?: number;
  }) => {
    setStats((prev) => {
      const maxH = prev.maxHp || safeHero.defaultStats?.maxHp || 100;
      const maxE = prev.maxEnergy || safeHero.defaultStats?.maxEnergy || 100;
      const maxM = prev.maxMorale || safeHero.defaultStats?.maxMorale || 100;
      const maxO = prev.maxObedience || safeHero.defaultStats?.maxObedience || 100;
      const maxS = prev.maxShame || safeHero.defaultStats?.maxShame || 100;

      const nextHp = Math.min(maxH, Math.max(0, Math.round((prev.hp + (effect.hpDelta || 0)) * 10) / 10));
      const nextEnergy = Math.min(maxE, Math.max(0, Math.round((prev.energy + (effect.energyDelta || 0)) * 10) / 10));
      const nextMorale = Math.min(maxM, Math.max(0, Math.round((prev.morale + (effect.moraleDelta || 0)) * 10) / 10));
      const nextObedience = Math.min(maxO, Math.max(0, Math.round((prev.obedience + (effect.obedienceDelta || 0)) * 10) / 10));
      const nextShame = Math.min(maxS, Math.max(0, Math.round((prev.shame + (effect.shameDelta || 0)) * 10) / 10));

      if (nextEnergy <= 30 && nextEnergy > 0) {
        ultraAudio.startColorTimerBeep(nextEnergy, safeHero.voicePitch);
      } else if (nextEnergy === 0 || nextEnergy > 30) {
        ultraAudio.stopColorTimerBeep();
      }

      return {
        ...prev,
        hp: nextHp,
        energy: nextEnergy,
        morale: nextMorale,
        obedience: nextObedience,
        shame: nextShame,
      };
    });
  }, [safeHero.voicePitch, safeHero.defaultStats]);

  // Execute Local Hit Tick for Continuous Press-and-Hold Attack (No API call on each tick)
  const executeLocalContinuousHitTick = useCallback(() => {
    if (!selectedHero) return;
    const weapon = selectedWeapon;
    const targetPart = selectedPart;
    const isWeakPoint = selectedHero.weakPart === targetPart;
    const isSensitivePoint = selectedHero.sensitivePart === targetPart;
    const partConfig = selectedHero.bodyParts[targetPart];
    const partMultiplier = partConfig?.weaknessMultiplier || 1.0;
    const globalWeakMult = customSettings.weaknessMultiplier || 1.0;
    const globalSensMult = customSettings.sensitiveMultiplier || 1.3;

    const weaknessMult = isWeakPoint ? (partMultiplier * globalWeakMult) : partMultiplier;
    const totalMult = intensity * weaknessMult;
    const sensitiveShameMult = isSensitivePoint ? globalSensMult : 1.0;
    const BALANCED_SCALE = 0.6;

    const isHealing = weapon.category === 'heal' || weapon.category === 'pure_love' || weapon.type === 'heal' || weapon.type === 'nanite' || weapon.type === 'bliss' || ((weapon as any).hpHeal && (weapon as any).hpHeal > 0) || weapon.damage < 0;

    const hpHealed = isHealing ? Math.round(((weapon.hpHeal || Math.abs(weapon.damage) || 20) * totalMult * BALANCED_SCALE) * 10) / 10 : 0;
    const damageDealt = isHealing ? 0 : Math.round((weapon.damage * totalMult * BALANCED_SCALE) * 10) / 10;
    const energyDrained = Math.round(((weapon.energyDrain || 0) * totalMult * BALANCED_SCALE) * 10) / 10;
    const moraleLost = Math.round(((weapon.moraleDamage || 0) * totalMult * BALANCED_SCALE) * 10) / 10;
    const curExp = partExposure[targetPart] || 0;
    const contExpMult = 1 + (Math.max(0, Math.min(100, curExp)) / 100) * 0.5;

    let shameGained = 0;
    if ((weapon.shameIncrease || 0) > 0) {
      shameGained = Math.round((weapon.shameIncrease * intensity * sensitiveShameMult * contExpMult * 0.25) * 10) / 10;
    } else if ((weapon.shameIncrease || 0) < 0) {
      shameGained = Math.round((weapon.shameIncrease * intensity * 0.25) * 10) / 10;
    } else if (isSensitivePoint) {
      shameGained = Math.round((1.5 * intensity * sensitiveShameMult) * 10) / 10;
    }

    const obedienceGained = Math.round(((weapon.obedienceGain || 0) * intensity * (isSensitivePoint ? 1.2 : 1.0) * 0.25) * 10) / 10;
    const configuredLustVal = (weapon as any).lustChange !== undefined ? (weapon as any).lustChange : 5;
    const lustChanged = Math.round((configuredLustVal * intensity * (isSensitivePoint ? 1.2 : 1.0) * 0.25) * 10) / 10;

    // Accumulate
    continuousStatsAccRef.current.hits += 1;
    continuousStatsAccRef.current.damage += (damageDealt - hpHealed);
    continuousStatsAccRef.current.energyDrained += energyDrained;
    continuousStatsAccRef.current.moraleLost += moraleLost;
    continuousStatsAccRef.current.shameGained += shameGained;
    continuousStatsAccRef.current.obedienceGained += obedienceGained;
    continuousStatsAccRef.current.lustChanged += lustChanged;

    setStats((prev) => {
      const maxH = prev.maxHp || selectedHero.defaultStats.maxHp || 100;
      const maxE = prev.maxEnergy || selectedHero.defaultStats.maxEnergy || 100;
      const maxM = prev.maxMorale || selectedHero.defaultStats.maxMorale || 100;
      const maxS = prev.maxShame || selectedHero.defaultStats.maxShame || 100;
      const maxO = prev.maxObedience || selectedHero.defaultStats.maxObedience || 100;
      const maxL = prev.maxLust || selectedHero.defaultStats.maxLust || 100;

      return {
        ...prev,
        hp: Math.min(maxH, Math.max(0, Math.round((prev.hp - damageDealt + hpHealed) * 10) / 10)),
        energy: Math.min(maxE, Math.max(0, Math.round((prev.energy - energyDrained) * 10) / 10)),
        morale: Math.min(maxM, Math.max(0, Math.round((prev.morale - moraleLost) * 10) / 10)),
        shame: Math.min(maxS, Math.max(0, Math.round((prev.shame + shameGained) * 10) / 10)),
        obedience: Math.min(maxO, Math.max(0, Math.round((prev.obedience + obedienceGained) * 10) / 10)),
        lust: Math.min(maxL, Math.max(0, Math.round(((prev.lust ?? 10) + lustChanged) * 10) / 10)),
      };
    });

    let contPartDmgDelta = 0;
    if (weapon.partDamageChange !== undefined && weapon.partDamageChange !== 0) {
      contPartDmgDelta = weapon.partDamageChange * totalMult * 0.2;
    } else if (isHealing) {
      contPartDmgDelta = -Math.abs(weapon.damage < 0 ? weapon.damage : ((weapon as any).hpHeal || 15)) * totalMult * 0.2;
    } else {
      contPartDmgDelta = damageDealt * 0.5;
    }

    let contPartExpDelta = 0;
    if (weapon.partExposureChange !== undefined && weapon.partExposureChange !== 0) {
      contPartExpDelta = weapon.partExposureChange * totalMult * 0.2;
    } else if (isHealing) {
      contPartExpDelta = -Math.abs(weapon.damage < 0 ? weapon.damage : ((weapon as any).hpHeal || 15)) * totalMult * 0.2;
    } else {
      contPartExpDelta = shameGained * 0.5;
    }

    setPartDamage((prev) => ({
      ...prev,
      [targetPart]: Math.min(100, Math.max(0, Math.round(((prev[targetPart] || 0) + contPartDmgDelta) * 10) / 10)),
    }));
    setPartExposure((prev) => ({
      ...prev,
      [targetPart]: Math.min(100, Math.max(0, Math.round(((prev[targetPart] || 0) + contPartExpDelta) * 10) / 10)),
    }));

    setHitTimestamp(Date.now());
    setLastHitPart(targetPart);

    // Play weapon sound
    if (weapon.category === 'attack') ultraAudio.playLaserSFX();
    else if (weapon.category === 'drain') ultraAudio.playSiphonSFX();
    else if (weapon.category === 'hypnosis') ultraAudio.playPsyWaveSFX();
    else if (weapon.category === 'touch') ultraAudio.playChainsSFX();
    else ultraAudio.playImpactSFX();
  }, [selectedWeapon, selectedPart, selectedHero, intensity, customSettings]);

  // Hold Mouse Continuous Attack Interval Setup
  const handleStartContinuousFiring = useCallback(() => {
    setIsContinuousFiring(true);
    continuousStartTimeRef.current = Date.now();
    continuousStatsAccRef.current = { hits: 0, damage: 0, energyDrained: 0, moraleLost: 0, shameGained: 0, obedienceGained: 0, lustChanged: 0 };

    executeLocalContinuousHitTick();

    if (continuousIntervalRef.current) clearInterval(continuousIntervalRef.current);
    continuousIntervalRef.current = setInterval(() => {
      executeLocalContinuousHitTick();
    }, 180);
  }, [executeLocalContinuousHitTick]);

  const handleStopContinuousFiring = useCallback(() => {
    setIsContinuousFiring(false);
    if (continuousIntervalRef.current) {
      clearInterval(continuousIntervalRef.current);
      continuousIntervalRef.current = null;
    }

    const durationSec = Math.max(0.2, (Date.now() - continuousStartTimeRef.current) / 1000);
    const acc = { ...continuousStatsAccRef.current };
    // Immediately clear accumulator so duplicate mouseup/touchend events cannot trigger multiple API calls
    continuousStatsAccRef.current = { hits: 0, damage: 0, energyDrained: 0, moraleLost: 0, shameGained: 0, obedienceGained: 0, lustChanged: 0 };

    if (!selectedHero || acc.hits === 0) return;

    const nowStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const holdEntryId = `hold_${Date.now()}`;
    const targetPartName = selectedHero.bodyParts[selectedPart]?.name || selectedPart;
    const actionTitle = getWeaponContinuousActionTitle(selectedWeapon);

    const singleRel = getHeroActiveRelationship(selectedHero.id);
    const singleRelTag = singleRel?.title ? `[${singleRel.title}]` : '';
    let presetHoldText = `【${selectedHero.name}】${singleRelTag}：“（遭受 ${actionTitle} ${durationSec.toFixed(1)} 秒，全身剧痛发抖）嗯啊啊……这股持续的【${selectedWeapon.name}】力量……”`;
    if (activeTeamIds.length > 1) {
      const teamHeroes = heroines.filter((h) => activeTeamIds.includes(h.id));
      presetHoldText = teamHeroes
        .map((h) => {
          const hRel = getHeroActiveRelationship(h.id);
          const relTag = hRel ? `[${hRel.title}]` : '';
          if (h.id === selectedHero.id) {
            return `【${h.name}】${relTag}：“（遭受 ${actionTitle} ${durationSec.toFixed(1)} 秒，全身剧痛发抖）嗯啊啊……这股持续的【${selectedWeapon.name}】力量……”`;
          }
          const isTargeted = targetedHeroIds.length === 0 || targetedHeroIds.includes(h.id);
          return isTargeted
            ? `【${h.name}】${relTag}：“（同受高频连击波及，咬紧牙关颤抖）可恶……身体被强行束缚在连击范围内……”`
            : `【${h.name}】${relTag}：“（在旁痛苦亲眼目睹 ${durationSec.toFixed(1)} 秒连击，神色慌张）不！快停下对【${selectedHero.name}】的审讯折磨！”`;
        })
        .join('\n');
    }

    let presetHoldAnalysis = `【${selectedHero.name}】心理：${singleRelTag ? `[契约: ${singleRel?.title}] ` : ''}部位【${targetPartName}】承受 ${actionTitle} ${durationSec.toFixed(1)} 秒共 ${acc.hits} 次连击，体能创伤 -${Math.round(acc.damage)} HP，心理防线承受极大沉重波及。`;
    if (activeTeamIds.length > 1) {
      const teamHeroes = heroines.filter((h) => activeTeamIds.includes(h.id));
      presetHoldAnalysis = teamHeroes
        .map((h) => {
          const hRel = getHeroActiveRelationship(h.id);
          const relTitle = hRel?.title ? `[契约: ${hRel.title}] ` : '';
          if (h.id === selectedHero.id) {
            return `【${h.name}】心理：${relTitle}部位【${targetPartName}】承受长达 ${durationSec.toFixed(1)} 秒高频作用，心理防线濒临动摇极限。`;
          }
          const isTargeted = targetedHeroIds.length === 0 || targetedHeroIds.includes(h.id);
          return isTargeted
            ? `【${h.name}】心理：${relTitle}遭受连带波及作用，身体与心理陷入剧烈震荡。`
            : `【${h.name}】心理：${relTitle}目睹同伴高频受创，情绪紧绷到了极限。`;
        })
        .join('\n');
    }

    const holdConsoleEntry: ConsoleEntry = {
      id: holdEntryId,
      type: 'attack_log',
      time: nowStr,
      heroId: selectedHero.id,
      heroName: activeTeamIds.length > 1 ? '👥 在场小队全员' : selectedHero.name,
      speakerName: activeTeamIds.length > 1 ? '👥 在场小队全员' : selectedHero.name,
      weaponName: `🔥【${selectedWeapon.name}】${actionTitle} (${durationSec.toFixed(1)} 秒)`,
      targetPartName,
      damageDealt: Math.round(acc.damage * 10) / 10,
      energyDrained: Math.round(acc.energyDrained * 10) / 10,
      moraleLost: Math.round(acc.moraleLost * 10) / 10,
      shameGained: Math.round(acc.shameGained * 10) / 10,
      obedienceGained: Math.round(acc.obedienceGained * 10) / 10,
      lustChanged: Math.round(acc.lustChanged * 10) / 10,
      shieldAbsorbRate: 0,
      text: `⏳ [AI正在针对【${selectedWeapon.name}】的${actionTitle}分析受击表现与心理变动...]`,
      reactionType: 'pained',
      psychologicalAnalysis: `⏳ [结合【${selectedWeapon.name}】的固有技能描述与类别特效评估摧残效果中...]`,
    };

    setConsoleEntries((prev) => [...prev, holdConsoleEntry]);
    setIsLoadingAi(true);

    const applyHoldFallback = () => {
      setConsoleEntries((prev) =>
        prev.map((entry) =>
          entry.id === holdEntryId
            ? {
                ...entry,
                text: presetHoldText,
                reactionType: 'pained',
                psychologicalAnalysis: presetHoldAnalysis,
              }
            : entry
        )
      );
      if (!isMuted) {
        ultraAudio.speakVoiceLine(presetHoldText, selectedHero.voicePitch);
      }
    };

    fetchWith5Retries('/api/interrogate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hero: sanitizeHeroForAi(selectedHero),
        weapon: {
          ...selectedWeapon,
          name: `${selectedWeapon.name} (${actionTitle}长达 ${durationSec.toFixed(1)} 秒)`,
          description: `【${selectedWeapon.name}】工具固有功能描述: "${selectedWeapon.description}" | 持续动作说明: 审讯官按住【${selectedWeapon.name}】对【${selectedHero.name}】的【${targetPartName}】进行了长达 ${durationSec.toFixed(1)} 秒的${actionTitle} (共计 ${acc.hits} 次连击，触发生理与心理全套反应)。`,
          actionMode: 'continuous_hold',
          holdDurationSec: durationSec,
          hitsCount: acc.hits,
          actionTitle,
        },
        targetPart: targetPartName,
        stats: getStatsPayload({
          ...stats,
          damageDealt: Math.round(acc.damage * 10) / 10,
          energyDrained: Math.round(acc.energyDrained * 10) / 10,
          moraleLost: Math.round(acc.moraleLost * 10) / 10,
          shameGained: Math.round(acc.shameGained * 10) / 10,
          obedienceGained: Math.round(acc.obedienceGained * 10) / 10,
          lustChanged: Math.round(acc.lustChanged * 10) / 10,
          holdDurationSec: durationSec,
          totalHits: acc.hits,
        }, selectedHero),
        customSettings,
        environmentTheme: envTheme,
        partDamage,
        partExposure,
        customLights: getSavedCustomLights(),
        aiConfig,
        dayCount,
        scenarioConfig,
        activeRelationship,
        activeTeam: heroines
          .filter((h) => activeTeamIds.includes(h.id))
          .map((h) => ({
            hero: sanitizeHeroForAi(h),
            stats: h.id === selectedHero.id ? getStatsPayload(stats, selectedHero) : (progressMap[h.id]?.stats || h.defaultStats),
            isPrimary: h.id === selectedHero.id,
            isTargeted: targetedHeroIds.includes(h.id),
            activeRelationship: getHeroActiveRelationship(h.id),
          })),
        targetScope,
        targetedHeroIds,
        messages: getEnrichedChatHistory(consoleEntries, selectedHero?.id),
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          applyHoldFallback();
          return;
        }
        const data = await res.json();
        if (data && (data.dialogue || data.psychologicalAnalysis)) {
          let apiQuote = data.dialogue || presetHoldText;
          let apiReaction = data.reactionType || 'pained';
          const apiAnalysis = data.psychologicalAnalysis || presetHoldAnalysis;

          if (stats.hp <= 0) {
            apiReaction = 'corpse';
            if (apiQuote && !apiQuote.startsWith('（') && !apiQuote.startsWith('(')) {
              const cleanTxt = apiQuote.replace(/[“"”]/g, '').trim();
              apiQuote = `（${cleanTxt}）`;
            }
          }

          setConsoleEntries((prev) =>
            prev.map((entry) =>
              entry.id === holdEntryId
                ? {
                    ...entry,
                    text: apiQuote,
                    reactionType: apiReaction,
                    psychologicalAnalysis: apiAnalysis,
                    thinkingProcess: data.thinkingProcess,
                    webSearchUsed: Boolean(data.webSearchUsed || (data.webSources && data.webSources.length > 0)),
                    searchEngine: data.webSearchEngine || data.searchEngine,
                    searchQuery: data.webSearchQuery || data.searchQuery,
                    searchSources: data.webSources || data.searchSources,
                  }
                : entry
            )
          );

          if (apiQuote && !isMuted && apiReaction !== 'corpse' && stats.hp > 0) {
            ultraAudio.speakVoiceLine(apiQuote, selectedHero.voicePitch);
          }
        } else {
          applyHoldFallback();
        }
        ultraAudio.playApiReplyChime();
      })
      .catch((err) => {
        console.error('API interrogation error for continuous hold attack:', err);
        applyHoldFallback();
      })
      .finally(() => {
        setIsLoadingAi(false);
      });
  }, [selectedWeapon, selectedPart, selectedHero, stats, aiConfig, isMuted]);

  // Auto Attack Timer
  // Keep a ref to the latest handler: the interval outlives a single render, so
  // calling handleExecuteAttack directly captured a stale stats/partDamage/isLoadingAi
  // snapshot (damage rollbacks + stacked concurrent AI requests). The ref is refreshed
  // every render and the interval only closes over selectedWeapon/selectedPart/intensity.
  const handleExecuteAttackRef = useRef(handleExecuteAttack);
  useEffect(() => {
    handleExecuteAttackRef.current = handleExecuteAttack;
  });
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isAutoAttacking) {
      timer = setInterval(() => {
        handleExecuteAttackRef.current(selectedWeapon, selectedPart, intensity);
      }, 1500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isAutoAttacking, selectedWeapon, selectedPart, intensity]);

  useEffect(() => {
    if (stats.hp <= 0 && isContinuousFiring) {
      handleStopContinuousFiring();
    }
  }, [stats.hp, isContinuousFiring, handleStopContinuousFiring]);

  // Construct full export data memoized
  const exportData: FullExportData = useMemo(() => ({
    version: '1.0',
    exportTime: new Date().toISOString(),
    dataType: 'full_backup',
    selectedHeroId: selectedHero?.id || '',
    activeTeamIds,
    targetedHeroIds,
    heroines,
    factions,
    progressMap,
    currentStats: stats,
    currentDayCount: dayCount,
    currentPartDamage: partDamage,
    currentPartExposure: partExposure,
    currentConsoleEntries: consoleEntries,
    currentLogs: logs,
    scenarioConfig,
    envTheme,
    envParamsOverride: envParamOverrides,
    customEnvs,
    customSettings,
    dayConfig,
    relationshipState,
    allRelationshipSlots: getAllRelationshipSlots(relationshipState),
    customScenarios,
    customSkills,
    customCategories,
    customWeaponTypes,
    aiConfig,
    realTimeState,
  }), [
    selectedHero?.id, activeTeamIds, targetedHeroIds, heroines, factions, progressMap, stats, dayCount, partDamage, partExposure,
    consoleEntries, logs, scenarioConfig, envTheme, envParamOverrides, customEnvs, customSettings,
    dayConfig, relationshipState, customScenarios, customSkills, customCategories, customWeaponTypes, aiConfig, realTimeState
  ]);

  // Keep currentDialogueRef and exportDataRef continuously updated for auto backup engine
  useEffect(() => {
    currentDialogueRef.current = {
      selectedHeroId: selectedHero?.id || '',
      selectedHero: selectedHero ? {
        id: selectedHero.id,
        name: selectedHero.name,
        title: selectedHero.title,
        race: selectedHero.race,
        personality: selectedHero.personality,
        weakPart: selectedHero.weakPart,
      } : undefined,
      currentStats: stats,
      currentDayCount: dayCount,
      currentPartDamage: partDamage,
      currentPartExposure: partExposure,
      currentConsoleEntries: consoleEntries,
      currentLogs: logs,
      scenarioConfig,
      envTheme,
      relationshipState,
      dayConfig,
    };
    exportDataRef.current = exportData;
  }, [
    selectedHero?.id, selectedHero?.name, selectedHero?.title, selectedHero?.race, selectedHero?.personality, selectedHero?.weakPart,
    stats, dayCount, partDamage, partExposure, consoleEntries, logs, scenarioConfig, envTheme, relationshipState, dayConfig, exportData
  ]);

  // Handle importing state from JSON
  const handleImportState = useCallback(async (importedData: FullExportData) => {
    if (!importedData) return;

    // 1. Rehydrate portraits and heroines
    const customPortraitsMap = (importedData as any).customPortraits || {};
    if (customPortraitsMap && typeof customPortraitsMap === 'object') {
      for (const [hId, pData] of Object.entries(customPortraitsMap)) {
        if (typeof pData === 'string' && pData.length > 0) {
          savePortraitToIDB(hId, pData).catch(() => {});
        }
      }
    }

    if (importedData.heroines && Array.isArray(importedData.heroines) && importedData.heroines.length > 0) {
      const hydrated = importedData.heroines.map((h) => {
        const p = customPortraitsMap[h.id] || h.customPortrait;
        return p ? { ...h, customPortrait: p } : h;
      });
      setHeroines(hydrated);
    }
    if (importedData.factions && Array.isArray(importedData.factions)) {
      setFactions(importedData.factions);
    }
    if (importedData.activeTeamIds && Array.isArray(importedData.activeTeamIds)) {
      setActiveTeamIds(importedData.activeTeamIds);
    }
    if (importedData.targetedHeroIds && Array.isArray(importedData.targetedHeroIds)) {
      setTargetedHeroIds(importedData.targetedHeroIds);
    }

    let targetHeroId = importedData.selectedHeroId;
    if (importedData.selectedHeroId) {
      const list = importedData.heroines || heroines;
      const found = list.find((h) => h.id === importedData.selectedHeroId);
      if (found) {
        setSelectedHero(found);
        targetHeroId = found.id;
      }
    }

    const pMap = importedData.progressMap;
    if (pMap && typeof pMap === 'object') {
      setProgressMap(pMap);
    }

    const heroProg: HeroProgress | undefined = (pMap && targetHeroId) ? pMap[targetHeroId] : undefined;

    if (importedData.currentStats || heroProg?.stats) {
      setStats(importedData.currentStats || heroProg!.stats);
    }
    if (typeof importedData.currentDayCount === 'number' || typeof heroProg?.dayCount === 'number') {
      setDayCount(typeof importedData.currentDayCount === 'number' ? importedData.currentDayCount : heroProg!.dayCount);
    }
    if (importedData.currentPartDamage || heroProg?.partDamage) {
      setPartDamage(importedData.currentPartDamage || heroProg!.partDamage);
    }
    if (importedData.currentPartExposure || heroProg?.partExposure) {
      setPartExposure(importedData.currentPartExposure || heroProg!.partExposure);
    }
    if (importedData.currentConsoleEntries && Array.isArray(importedData.currentConsoleEntries) && importedData.currentConsoleEntries.length > 0) {
      setConsoleEntries(importedData.currentConsoleEntries);
    } else if (heroProg?.consoleEntries && Array.isArray(heroProg.consoleEntries) && heroProg.consoleEntries.length > 0) {
      setConsoleEntries(heroProg.consoleEntries);
    }
    if (importedData.currentLogs || heroProg?.logs) {
      setLogs(importedData.currentLogs || heroProg!.logs);
    }
    if (importedData.scenarioConfig || heroProg?.scenarioConfig) {
      setScenarioConfig(importedData.scenarioConfig || heroProg?.scenarioConfig);
    }
    if (importedData.customScenarios) {
      setCustomScenarios(importedData.customScenarios);
    }
    if (importedData.envTheme || heroProg?.envTheme) {
      setEnvTheme(importedData.envTheme || heroProg!.envTheme);
    }
    if (importedData.envParamsOverride) {
      setEnvParamOverrides(importedData.envParamsOverride);
    }
    if (importedData.customEnvs) {
      setCustomEnvs(importedData.customEnvs);
    }
    if (importedData.customSettings) {
      setCustomSettings(importedData.customSettings);
    }
    if (importedData.dayConfig) {
      setDayConfig(importedData.dayConfig);
    }
    if (importedData.relationshipState) {
      const importedSlots = getAllRelationshipSlots(importedData.relationshipState);
      saveGlobalRelationshipSlots(importedSlots);
      setRelationshipState({
        ...importedData.relationshipState,
        slots: importedSlots,
      });
    }
    if (importedData.customSkills) {
      setCustomSkills(importedData.customSkills);
    }
    if ((importedData as any).customCategories) {
      setCustomCategories((importedData as any).customCategories);
    }
    if ((importedData as any).customWeaponTypes) {
      setCustomWeaponTypes((importedData as any).customWeaponTypes);
    }
    if (importedData.aiConfig) {
      setAiConfig((prev) => mergeAiConfigPreservingPresets(prev, importedData.aiConfig));
    }

    // Restore save slots if present in payload
    const rawSlots = (importedData as any).saveSlots || (importedData as any).localStorageData?.ultra_game_save_slots_v1;
    if (Array.isArray(rawSlots) && rawSlots.length > 0) {
      saveSlotsToIDB(rawSlots).catch(() => {});
      safeLocalStorageSet('ultra_game_save_slots_v1', rawSlots);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ultra_save_slots_updated', { detail: rawSlots }));
      }
    }
  }, [heroines]);

  // Handle Loading a specific Save Slot Data safely without crashing
  const handleLoadSaveSlot = useCallback((slot: SaveSlotData) => {
    if (!slot) return;

    try {
      // 1. Recover or select heroine
      let heroToSelect = heroines.find((h) => h.id === slot.heroId);
      if (!heroToSelect && slot.heroName) {
        heroToSelect = heroines.find((h) => h.name === slot.heroName);
      }
      if (!heroToSelect && slot.heroId) {
        // Recover hero if it was a custom hero missing from current list
        const defaultBaseStats: Stats = slot.stats
          ? {
              hp: slot.stats.hp ?? 100,
              energy: slot.stats.energy ?? 100,
              morale: slot.stats.morale ?? 100,
              obedience: slot.stats.obedience ?? 100,
              shame: slot.stats.shame ?? 0,
              lust: slot.stats.lust ?? 0,
              maxHp: slot.stats.maxHp ?? 100,
              maxEnergy: slot.stats.maxEnergy ?? 100,
              maxMorale: slot.stats.maxMorale ?? 100,
              maxObedience: slot.stats.maxObedience ?? 100,
              maxShame: slot.stats.maxShame ?? 100,
              maxLust: slot.stats.maxLust ?? 100,
            }
          : {
              hp: 100,
              energy: 100,
              morale: 100,
              obedience: 100,
              shame: 0,
              lust: 0,
              maxHp: 100,
              maxEnergy: 100,
              maxMorale: 100,
              maxObedience: 100,
              maxShame: 100,
              maxLust: 100,
            };

        const baseHero = createBlankHero(slot.heroId, slot.heroName || '已恢复主角');
        const recoveredHero: Ultrawoman = {
          ...baseHero,
          defaultStats: defaultBaseStats,
          colorTheme: {
            ...baseHero.colorTheme,
            primary: slot.heroColor || baseHero.colorTheme.primary,
          },
        };
        heroToSelect = recoveredHero;
        setHeroines((prev) => [...prev.filter((h) => h.id !== recoveredHero.id), recoveredHero]);
      }
      if (heroToSelect) {
        setSelectedHero(heroToSelect);
      }

      // 2. Active team IDs
      if (slot.activeTeamIds && Array.isArray(slot.activeTeamIds) && slot.activeTeamIds.length > 0) {
        setActiveTeamIds(slot.activeTeamIds);
      } else if (heroToSelect) {
        setActiveTeamIds([heroToSelect.id]);
      }

      if (slot.targetedHeroIds && Array.isArray(slot.targetedHeroIds)) {
        setTargetedHeroIds(slot.targetedHeroIds);
      }

      // 3. Robust Stats sanitization (prevent NaN or undefined crashes)
      if (slot.stats && typeof slot.stats === 'object') {
        const safeStats: Stats = {
          hp: typeof slot.stats.hp === 'number' && !isNaN(slot.stats.hp) ? slot.stats.hp : 100,
          maxHp: typeof slot.stats.maxHp === 'number' && !isNaN(slot.stats.maxHp) ? slot.stats.maxHp : 100,
          energy: typeof slot.stats.energy === 'number' && !isNaN(slot.stats.energy) ? slot.stats.energy : 100,
          maxEnergy: typeof slot.stats.maxEnergy === 'number' && !isNaN(slot.stats.maxEnergy) ? slot.stats.maxEnergy : 100,
          morale: typeof slot.stats.morale === 'number' && !isNaN(slot.stats.morale) ? slot.stats.morale : 100,
          maxMorale: typeof slot.stats.maxMorale === 'number' && !isNaN(slot.stats.maxMorale) ? slot.stats.maxMorale : 100,
          obedience: typeof slot.stats.obedience === 'number' && !isNaN(slot.stats.obedience) ? slot.stats.obedience : 0,
          maxObedience: typeof slot.stats.maxObedience === 'number' && !isNaN(slot.stats.maxObedience) ? slot.stats.maxObedience : 100,
          shame: typeof slot.stats.shame === 'number' && !isNaN(slot.stats.shame) ? slot.stats.shame : 0,
          maxShame: typeof slot.stats.maxShame === 'number' && !isNaN(slot.stats.maxShame) ? slot.stats.maxShame : 100,
          lust: typeof slot.stats.lust === 'number' && !isNaN(slot.stats.lust) ? slot.stats.lust : 0,
          maxLust: typeof slot.stats.maxLust === 'number' && !isNaN(slot.stats.maxLust) ? slot.stats.maxLust : 100,
        };
        setStats(safeStats);
      }

      if (typeof slot.dayCount === 'number' && !isNaN(slot.dayCount)) {
        setDayCount(Math.max(1, slot.dayCount));
      }

      // 4. Part damage & exposure defaults
      const defaultParts = { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 };
      if (slot.partDamage && typeof slot.partDamage === 'object') {
        setPartDamage({ ...defaultParts, ...slot.partDamage });
      }
      if (slot.partExposure && typeof slot.partExposure === 'object') {
        setPartExposure({ ...defaultParts, ...slot.partExposure });
      }

      // 5. Console entries & logs
      if (slot.consoleEntries && Array.isArray(slot.consoleEntries)) {
        const sanitizedEntries = slot.consoleEntries.filter(Boolean).map((e, idx) => ({
          ...e,
          id: e.id || `entry_${Date.now()}_${idx}`,
          time: e.time || new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          text: typeof e.text === 'string' ? e.text : '',
        }));
        setConsoleEntries(sanitizedEntries);
        if (heroToSelect) {
          safeLocalStorageSet('ultra_chat_entries_v2_' + heroToSelect.id, sanitizedEntries);
        }
        safeLocalStorageSet('ultra_current_chat_entries_v2', sanitizedEntries);
      }

      if (slot.logs && Array.isArray(slot.logs)) {
        setLogs(slot.logs.filter(Boolean));
      }

      // 6. Scenario config
      if (slot.scenarioConfig && typeof slot.scenarioConfig === 'object') {
        setScenarioConfig(slot.scenarioConfig);
        safeLocalStorageSet('ultra_selected_scenario_v1', slot.scenarioConfig);
      }

      // 7. Environment
      if (slot.envTheme) {
        setEnvTheme(slot.envTheme);
      }
      if (slot.envParamsOverride) {
        setEnvParamOverrides(slot.envParamsOverride);
      }

      // 8. Relationship State
      if (slot.relationshipState && typeof slot.relationshipState === 'object') {
        const slots = getAllRelationshipSlots(slot.relationshipState);
        saveGlobalRelationshipSlots(slots);
        setRelationshipState({
          ...slot.relationshipState,
          slots,
        });
      }

      // 9. Progress Map
      if (slot.progressMap && typeof slot.progressMap === 'object') {
        setProgressMap(slot.progressMap);
        safeLocalStorageSet('ultra_progress_map_v2', slot.progressMap);
      }

      // 10. Additional Configs
      if (slot.customSettings) setCustomSettings(slot.customSettings);
      if (slot.dayConfig) setDayConfig(slot.dayConfig);
      if (slot.aiConfig) setAiConfig((prev) => mergeAiConfigPreservingPresets(prev, slot.aiConfig));
      if (slot.realTimeSyncState) {
        setRealTimeState({
          ...slot.realTimeSyncState,
          lastVisitedTimestamp: Date.now(),
        });
      } else if (slot.isRealTimeSync !== undefined) {
        setRealTimeState((prev) => ({
          ...prev,
          isEnabled: !!slot.isRealTimeSync,
          lastVisitedTimestamp: Date.now(),
        }));
      } else {
        // Standard save slot: explicitly disable real-time sync
        setRealTimeState((prev) => ({
          ...prev,
          isEnabled: false,
        }));
      }

      setSaveToast({
        message: `📂 成功读取存档【${slot.name || '战术记录'}】！`,
        visible: true,
      });
      setTimeout(() => setSaveToast(null), 3000);
    } catch (e: any) {
      console.error('Failed to load save slot safely:', e);
      setSaveToast({
        message: `⚠️ 读取存档遇到非致命警告: ${e?.message || '已自动完成容错修复'}`,
        visible: true,
      });
      setTimeout(() => setSaveToast(null), 4000);
    }
  }, [heroines]);

  // Handle One-Click Local Persistence & Backup Download
  const handleQuickSaveToLocal = useCallback(async () => {
    if (isQuickSaving || !selectedHero) return;
    setIsQuickSaving(true);
    ultraAudio.playUiClick();
    try {
      // 1. Build the fresh snapshot for currently selected heroine and active team members
      const currentHeroSnap: HeroProgress = {
        heroId: selectedHero.id,
        dayCount,
        stats: { ...stats },
        partDamage: { ...partDamage },
        partExposure: { ...partExposure },
        consoleEntries: [...consoleEntries],
        logs: [...logs],
        envTheme,
        isEnergyShock: !!isEnergyShock,
        scenarioConfig: scenarioConfig ? { ...scenarioConfig } : undefined,
        relationshipState: relationshipState ? { ...relationshipState } : undefined,
        activeRelationship: activeRelationship ? { ...activeRelationship } : undefined,
        lastUpdated: Date.now(),
      };

      const updatedProgressMap: Record<string, HeroProgress> = {
        ...progressMap,
        [selectedHero.id]: currentHeroSnap,
      };

      // Also ensure active teammates have progress entries
      activeTeamIds.forEach((tId) => {
        if (!updatedProgressMap[tId]) {
          const tHero = heroines.find((h) => h.id === tId);
          if (tHero) {
            updatedProgressMap[tId] = {
              heroId: tId,
              dayCount: 1,
              stats: {
                hp: tHero.defaultStats?.hp ?? 100,
                energy: tHero.defaultStats?.energy ?? 100,
                morale: tHero.defaultStats?.morale ?? 100,
                obedience: tHero.defaultStats?.obedience ?? 0,
                shame: tHero.defaultStats?.shame ?? 0,
                lust: tHero.defaultStats?.lust ?? 0,
              },
              partDamage: { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
              partExposure: { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
              consoleEntries: [],
              logs: [],
              envTheme: 'deep_space',
              isEnergyShock: false,
              lastUpdated: Date.now(),
            };
          }
        }
      });

      // Update state
      setProgressMap(updatedProgressMap);

      // 2. Flush core state to localStorage safely
      const sanitizedHeroines = heroines.map((h) => {
        if (h.customPortrait && (h.customPortrait.startsWith('data:') || h.customPortrait.length > 500)) {
          return { ...h, customPortrait: undefined };
        }
        return h;
      });
      safeLocalStorageSet('trainer_heroines_v5', sanitizedHeroines);
      safeLocalStorageSet('ultra_heroines_v4', sanitizedHeroines);
      safeLocalStorageSet('ultra_last_selected_hero_id_v1', selectedHero.id);
      safeLocalStorageSet('ultra_active_team_ids_v1', activeTeamIds);
      safeLocalStorageSet('ultra_targeted_hero_ids_v1', targetedHeroIds);
      safeLocalStorageSet('ultra_progress_map_v2', updatedProgressMap);
      safeLocalStorageSet('ultra_current_chat_entries_v2', consoleEntries);
      safeLocalStorageSet('ultra_chat_entries_v2_' + selectedHero.id, consoleEntries);
      safeLocalStorageSet('ultra_custom_skills_v1', customSkills);
      safeLocalStorageSet('ultra_custom_skill_categories_v1', customCategories);
      safeLocalStorageSet('ultra_custom_weapon_types_v1', customWeaponTypes);
      safeLocalStorageSet('ultra_factions_v1', factions);
      safeLocalStorageSet('ultra_ai_config_v1', aiConfig);
      safeLocalStorageSet('ultra_day_config_v1', dayConfig);
      safeLocalStorageSet('ultra_custom_envs', customEnvs);
      safeLocalStorageSet('ultra_env_param_overrides', envParamOverrides);
      safeLocalStorageSet('ultra_custom_scenarios_v1', customScenarios);
      safeLocalStorageSet('ultra_selected_scenario_v1', scenarioConfig);
      safeLocalStorageSet('ultra_relationship_state_v1_' + selectedHero.id, relationshipState);
      const allSlots = getAllRelationshipSlots(relationshipState);
      safeLocalStorageSet('ultra_global_relationship_slots_v1', allSlots);
      safeLocalStorageSet('ultra_custom_settings_v1', customSettings);
      safeLocalStorageSet('ultra_real_time_state_v1', realTimeState);

      // 3. Save portraits to IDB
      const portraitsPayload: Record<string, string> = {};
      heroines.forEach((h) => {
        if (h.customPortrait) {
          savePortraitToIDB(h.id, h.customPortrait).catch(() => {});
          portraitsPayload[h.id] = h.customPortrait;
        }
      });

      // 4. Update dedicated quick save slot in memory and IDB
      const isRealTime = realTimeState.isEnabled;
      const quickId = isRealTime ? 'slot_realtime_quick_save' : 'slot_quick_save';
      const realDay = realTimeState.firstCreatedTimestamp ? calculateRealTimeDay(realTimeState.firstCreatedTimestamp) : dayCount;
      const quickSlotName = isRealTime
        ? `🚀 现实同步快捷存档 - ${selectedHero.name} (第${realDay}天)`
        : `🚀 快捷存档 - ${selectedHero.name} (第${dayCount}天)`;

      const quickSlot: SaveSlotData = {
        id: quickId,
        slotNumber: 0,
        slotType: 'quick',
        isQuickSave: true,
        isRealTimeSync: isRealTime,
        gameMode: isRealTime ? 'realtime' : 'standard',
        realTimeSyncState: isRealTime ? { ...realTimeState } : undefined,
        name: quickSlotName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        heroId: selectedHero.id,
        heroName: selectedHero.name,
        heroColor: selectedHero.colorTheme?.primary,
        dayCount,
        stats: { ...stats },
        scenarioName: scenarioConfig?.name,
        relationshipTitle: activeRelationship?.title,
        teamCount: activeTeamIds.length,
        teamHeroNames: heroines.filter((h) => activeTeamIds.includes(h.id)).map((h) => h.name),
        activeTeamIds: [...activeTeamIds],
        targetedHeroIds: [...targetedHeroIds],
        progressMap: updatedProgressMap,
        partDamage: { ...partDamage },
        partExposure: { ...partExposure },
        consoleEntries: [...consoleEntries],
        logs: [...logs],
        scenarioConfig: scenarioConfig ? { ...scenarioConfig } : undefined,
        envTheme,
        envParamsOverride: { ...envParamOverrides },
        relationshipState: relationshipState ? { ...relationshipState } : undefined,
        customSettings: { ...customSettings },
        dayConfig: { ...dayConfig },
        aiConfig: { ...aiConfig },
      };
      const updatedSlots = updateDedicatedQuickSaveSlot(quickSlot);

      // 5. CRITICAL: Authoritative Server Disk Storage Sync
      const serverUpdates: Record<string, any> = {
        trainer_heroines_v5: sanitizedHeroines,
        ultra_heroines_v4: sanitizedHeroines,
        ultra_last_selected_hero_id_v1: selectedHero.id,
        ultra_active_team_ids_v1: activeTeamIds,
        ultra_targeted_hero_ids_v1: targetedHeroIds,
        ultra_progress_map_v2: updatedProgressMap,
        ultra_current_chat_entries_v2: consoleEntries,
        ['ultra_chat_entries_v2_' + selectedHero.id]: consoleEntries,
        ultra_custom_skills_v1: customSkills,
        ultra_custom_skill_categories_v1: customCategories,
        ultra_custom_weapon_types_v1: customWeaponTypes,
        ultra_factions_v1: factions,
        ultra_ai_config_v1: aiConfig,
        ultra_day_config_v1: dayConfig,
        ultra_custom_envs: customEnvs,
        ultra_env_param_overrides: envParamOverrides,
        ultra_custom_scenarios_v1: customScenarios,
        ultra_selected_scenario_v1: scenarioConfig,
        ['ultra_relationship_state_v1_' + selectedHero.id]: relationshipState,
        ultra_global_relationship_slots_v1: allSlots,
        ultra_custom_settings_v1: customSettings,
        ultra_real_time_state_v1: realTimeState,
        ultra_game_save_slots_v1: updatedSlots,
      };
      queueServerSave(serverUpdates, portraitsPayload);
      flushServerStorageSync().catch(() => {});

      // 6. Trigger local backup file write / export
      const freshExportData: FullExportData = {
        ...exportData,
        heroines,
        selectedHeroId: selectedHero.id,
        selectedHero,
        currentStats: stats,
        currentDayCount: dayCount,
        currentPartDamage: partDamage,
        currentPartExposure: partExposure,
        currentConsoleEntries: consoleEntries,
        currentLogs: logs,
        progressMap: updatedProgressMap,
        scenarioConfig,
        envTheme,
        relationshipState,
        realTimeState,
      };

      let res: any = null;
      try {
        const autoCfg = getAutoBackupConfig();
        if (autoCfg.folderName) {
          // If a directory is bound, auto-save a snapshot directly to that folder
          res = await downloadFullLocalBackup(freshExportData, '（模拟）_QuickSave', true, false, 'directory');
        }
      } catch (backupErr) {
        console.warn('Quick save snapshot error:', backupErr);
      }

      ultraAudio.playApiReplyChime();
      let destInfo = '';
      if (res?.savedToDirectory) {
        destInfo = `，已自动存入绑定文件夹【${res.fileName}】`;
      } else {
        destInfo = `（快存槽位、本地数据库与服务器持久磁盘均已同步）`;
      }

      setSaveToast({
        message: `✅ 一键保存成功！全部角色、战报、设定与快存槽位已完整持久化${destInfo}`,
        visible: true,
      });
      setTimeout(() => setSaveToast(null), 5000);
    } catch (e: any) {
      console.error('Local save error:', e);
      setSaveToast({
        message: `⚠️ 一键保存提示: ${e?.message || '未知错误'}`,
        visible: true,
      });
      setTimeout(() => setSaveToast(null), 5000);
    } finally {
      setIsQuickSaving(false);
    }
  }, [
    isQuickSaving, heroines, selectedHero, dayCount, stats, partDamage, partExposure, consoleEntries, logs,
    envTheme, isEnergyShock, scenarioConfig, relationshipState, activeRelationship, activeTeamIds,
    targetedHeroIds, progressMap, customSkills, customCategories, customWeaponTypes, factions, aiConfig,
    dayConfig, customEnvs, envParamOverrides, customScenarios, customSettings, exportData, realTimeState
  ]);

  // Handle One-Click Local Restore / Read from File
  const handleQuickReadFromLocal = useCallback(async (file: File) => {
    ultraAudio.playUiClick();
    try {
      const res = await restoreFullLocalBackup(file);
      if (res.success) {
        ultraAudio.playApiReplyChime();
        setSaveToast({
          message: `${res.message} 正在同步加载至界面...`,
          visible: true,
        });

        // Rehydrate in-memory state
        if (res.data) {
          const parsed = res.data;
          const storage = parsed.localStorageData || {};

          // Re-read heroines directly from clean structured payload first
          const rawHeroines = (parsed.heroines && parsed.heroines.length > 0)
            ? parsed.heroines
            : (storage.trainer_heroines_v5 || storage.ultra_heroines_v4);
          let targetHeroId = parsed.selectedHeroId || storage.ultra_last_selected_hero_id_v1;

          if (Array.isArray(rawHeroines) && rawHeroines.length > 0) {
            const portraits = await getAllPortraitsFromIDB();
            const customPortraitsMap = parsed.customPortraits || {};
            const hydrated = rawHeroines.map((h: Ultrawoman) => {
              const p = customPortraitsMap[h.id] || portraits[h.id] || h.customPortrait;
              return p ? { ...h, customPortrait: p } : h;
            });
            setHeroines(hydrated);

            const target = hydrated.find((h) => h.id === targetHeroId) || hydrated[0];
            setSelectedHero(target);
            targetHeroId = target.id;
          }

          // Skills & Categories
          if (parsed.customSkills || storage.ultra_custom_skills_v1) {
            setCustomSkills(parsed.customSkills || storage.ultra_custom_skills_v1);
          }
          if (parsed.customCategories || storage.ultra_custom_skill_categories_v1) {
            setCustomCategories(parsed.customCategories || storage.ultra_custom_skill_categories_v1);
          }
          if (parsed.customWeaponTypes || storage.ultra_custom_weapon_types_v1) {
            setCustomWeaponTypes(parsed.customWeaponTypes || storage.ultra_custom_weapon_types_v1);
          }
          if (parsed.factions || storage.ultra_factions_v1) {
            setFactions(parsed.factions || storage.ultra_factions_v1);
          }
          if (storage.ultra_ai_config_v1 || parsed.aiConfig) {
            const restoredAiConfig = mergeAiConfigPreservingPresets(aiConfig, storage.ultra_ai_config_v1 || parsed.aiConfig);
              setAiConfig((prev) => mergeAiConfigPreservingPresets(prev, restoredAiConfig));
              try {
                safeLocalStorageSet('ultra_ai_config_v1', restoredAiConfig);
              } catch {}
          }
          if (storage.ultra_day_config_v1 || parsed.dayConfig) {
            setDayConfig(storage.ultra_day_config_v1 || parsed.dayConfig);
          }

          // Progress map & active hero combat data
          const pMap = storage.ultra_progress_map_v2 || parsed.progressMap;
          if (pMap && typeof pMap === 'object') {
            setProgressMap(pMap);
          }

          const heroProg: HeroProgress | undefined = (pMap && targetHeroId) ? pMap[targetHeroId] : undefined;

          if (parsed.currentStats || heroProg?.stats) {
            setStats(parsed.currentStats || heroProg!.stats);
          }
          if (typeof parsed.currentDayCount === 'number' || typeof heroProg?.dayCount === 'number') {
            setDayCount(typeof parsed.currentDayCount === 'number' ? parsed.currentDayCount : heroProg!.dayCount);
          }
          if (parsed.currentPartDamage || heroProg?.partDamage) {
            setPartDamage(parsed.currentPartDamage || heroProg!.partDamage);
          }
          if (parsed.currentPartExposure || heroProg?.partExposure) {
            setPartExposure(parsed.currentPartExposure || heroProg!.partExposure);
          }
          if (parsed.currentConsoleEntries && Array.isArray(parsed.currentConsoleEntries) && parsed.currentConsoleEntries.length > 0) {
            setConsoleEntries(parsed.currentConsoleEntries);
          } else if (heroProg?.consoleEntries && Array.isArray(heroProg.consoleEntries) && heroProg.consoleEntries.length > 0) {
            setConsoleEntries(heroProg.consoleEntries);
          } else if (storage.ultra_current_chat_entries_v2) {
            setConsoleEntries(storage.ultra_current_chat_entries_v2);
          }
          if (parsed.currentLogs || heroProg?.logs) {
            setLogs(parsed.currentLogs || heroProg!.logs);
          }
          if (parsed.envTheme || heroProg?.envTheme) {
            setEnvTheme(parsed.envTheme || heroProg!.envTheme);
          }

          if (storage.ultra_active_team_ids_v1 || parsed.activeTeamIds) {
            setActiveTeamIds(storage.ultra_active_team_ids_v1 || parsed.activeTeamIds);
          }
          if (storage.ultra_custom_envs) {
            setCustomEnvs(storage.ultra_custom_envs);
          }
          if (storage.ultra_env_param_overrides) {
            setEnvParamOverrides(storage.ultra_env_param_overrides);
          }
          if (storage.ultra_custom_scenarios_v1 || parsed.customScenarios) {
            setCustomScenarios(storage.ultra_custom_scenarios_v1 || parsed.customScenarios);
          }
          if (storage.ultra_selected_scenario_v1 || parsed.scenarioConfig) {
            setScenarioConfig(storage.ultra_selected_scenario_v1 || parsed.scenarioConfig);
          }
          if (storage.ultra_global_relationship_slots_v1 || parsed.allRelationshipSlots || parsed.relationshipState?.slots) {
            const slots = storage.ultra_global_relationship_slots_v1 || parsed.allRelationshipSlots || parsed.relationshipState?.slots;
            setRelationshipState((prev) => ({
              ...prev,
              slots,
            }));
          }
          if (storage.ultra_real_time_state_v1 || parsed.realTimeState) {
            const rState = storage.ultra_real_time_state_v1 || parsed.realTimeState;
            setRealTimeState({
              ...rState,
              lastVisitedTimestamp: Date.now(),
            });
            safeLocalStorageSet('ultra_real_time_state_v1', rState);
          }
        }

        // Authoritative server disk sync after restore
        collectCurrentLocalData().then(({ storage: localStore, portraits: localPortraits }) => {
          queueServerSave(localStore, localPortraits);
          flushServerStorageSync().catch(() => {});
        });

        setTimeout(() => setSaveToast(null), 5000);
      } else {
        setSaveToast({
          message: res.message,
          visible: true,
        });
        setTimeout(() => setSaveToast(null), 5000);
      }
    } catch (e: any) {
      console.error('Local read error:', e);
      setSaveToast({
        message: `⚠️ 本地读取解析异常: ${e?.message || '未知错误'}`,
        visible: true,
      });
      setTimeout(() => setSaveToast(null), 4000);
    }
  }, []);

  // Quick Save directly into dedicated unified slot (F5 or button)
  const handleQuickSaveSlotNow = useCallback(() => {
    if (!selectedHero) return;
    try {
      // Snapshot current hero into progressMap
      const currentHeroSnap: HeroProgress = {
        heroId: selectedHero.id,
        dayCount,
        stats: { ...stats },
        partDamage: { ...partDamage },
        partExposure: { ...partExposure },
        consoleEntries: [...consoleEntries],
        logs: [...logs],
        envTheme,
        isEnergyShock: !!isEnergyShock,
        scenarioConfig: scenarioConfig ? { ...scenarioConfig } : undefined,
        relationshipState: relationshipState ? { ...relationshipState } : undefined,
        activeRelationship: activeRelationship ? { ...activeRelationship } : undefined,
        lastUpdated: Date.now(),
      };

      const updatedProgressMap: Record<string, HeroProgress> = {
        ...progressMap,
        [selectedHero.id]: currentHeroSnap,
      };

      setProgressMap(updatedProgressMap);
      safeLocalStorageSet('ultra_progress_map_v2', updatedProgressMap);
      safeLocalStorageSet('ultra_current_chat_entries_v2', consoleEntries);
      safeLocalStorageSet('ultra_chat_entries_v2_' + selectedHero.id, consoleEntries);

      const isRealTime = realTimeState.isEnabled;
      const quickId = isRealTime ? 'slot_realtime_quick_save' : 'slot_quick_save';
      const realDay = realTimeState.firstCreatedTimestamp ? calculateRealTimeDay(realTimeState.firstCreatedTimestamp) : dayCount;
      const quickSlotName = isRealTime
        ? `🚀 现实同步快捷存档 - ${selectedHero.name} (第${realDay}天)`
        : `🚀 快捷存档 - ${selectedHero.name} (第${dayCount}天)`;

      const snap: SaveSlotData = {
        id: quickId,
        slotNumber: 0,
        slotType: 'quick',
        isQuickSave: true,
        isRealTimeSync: isRealTime,
        gameMode: isRealTime ? 'realtime' : 'standard',
        realTimeSyncState: isRealTime ? { ...realTimeState } : undefined,
        name: quickSlotName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        heroId: selectedHero.id,
        heroName: selectedHero.name,
        heroColor: selectedHero.colorTheme?.primary,
        dayCount,
        stats: { ...stats },
        scenarioName: scenarioConfig?.name,
        relationshipTitle: activeRelationship?.title,
        teamCount: activeTeamIds.length,
        teamHeroNames: heroines.filter((h) => activeTeamIds.includes(h.id)).map((h) => h.name),
        activeTeamIds: [...activeTeamIds],
        targetedHeroIds: [...targetedHeroIds],
        progressMap: updatedProgressMap,
        partDamage: { ...partDamage },
        partExposure: { ...partExposure },
        consoleEntries: [...consoleEntries],
        logs: [...logs],
        scenarioConfig: scenarioConfig ? { ...scenarioConfig } : undefined,
        envTheme,
        envParamsOverride: { ...envParamOverrides },
        relationshipState: relationshipState ? { ...relationshipState } : undefined,
        customSettings: { ...customSettings },
        dayConfig: { ...dayConfig },
        aiConfig: { ...aiConfig },
      };
      const updatedSlots = updateDedicatedQuickSaveSlot(snap);
      queueServerSave({
        ultra_progress_map_v2: updatedProgressMap,
        ultra_game_save_slots_v1: updatedSlots,
      });
      flushServerStorageSync().catch(() => {});

      setSaveToast({
        message: `🚀 快捷存档成功 (F5)！已覆写专用快捷存档槽位并同步`,
        visible: true,
      });
      ultraAudio.playApiReplyChime();
      setTimeout(() => setSaveToast(null), 3000);
    } catch (e: any) {
      console.error('Quick save error:', e);
    }
  }, [
    selectedHero, dayCount, stats, scenarioConfig, activeRelationship,
    activeTeamIds, heroines, targetedHeroIds, progressMap, partDamage,
    partExposure, consoleEntries, logs, envTheme, isEnergyShock, envParamOverrides,
    relationshipState, customSettings, dayConfig, aiConfig, realTimeState
  ]);

  // Quick Load from dedicated quick/auto save slot (F9 or button)
  const handleQuickLoadSlotNow = useCallback(() => {
    try {
      const slots = getGameSaveSlots();
      const isRealTime = realTimeState.isEnabled;
      const target =
        (isRealTime ? slots.find((s) => s.id === 'slot_realtime_quick_save') : null) ||
        slots.find((s) => s.id === 'slot_quick_save' || s.isQuickSave || s.slotType === 'quick') ||
        slots.find((s) => s.id === 'slot_auto_save' || s.isAutoSave || s.slotType === 'auto') ||
        slots[0];
      if (target) {
        handleLoadSaveSlot(target);
        ultraAudio.playApiReplyChime();
        setSaveToast({
          message: `⚡ 快捷读档成功 (F9)！已载入【${target.name}】`,
          visible: true,
        });
        setTimeout(() => setSaveToast(null), 3000);
      } else {
        setSaveToast({
          message: `⚠️ 暂无可供快捷读取的存档记录！`,
          visible: true,
        });
        setTimeout(() => setSaveToast(null), 3000);
      }
    } catch (e: any) {
      console.error('Quick load error:', e);
    }
  }, [handleLoadSaveSlot]);

  // Trigger Time-Aware Greeting (API or local response according to current real-world hour/time)
  const handleTriggerRealTimeGreeting = async () => {
    if (!selectedHero) return;
    const timeCtx = getRealTimeContext(realTimeState);
    const nowStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const isMultiTeam = activeTeamIds.length > 1;
    const activeHeroes = heroines.filter((h) => activeTeamIds.includes(h.id));

    const promptText = `【实时现实时间感知问候】现实当前时刻为：${timeCtx.currentDateStr} ${timeCtx.currentTimeStr}（${timeCtx.timePeriodDetail}）。已累计相伴第 ${timeCtx.realDayCount} 天（${timeCtx.formattedDuration}）。${timeCtx.offlineDurationStr}。请根据你当前的性格、关系【${activeRelationship.title}】与此时此刻的现实作息氛围（${timeCtx.timePeriod}），向指挥官发表一段富有生活感与真实时间陪伴感的即时问候与心声。`;

    const entryId = `realtime_greet_${Date.now()}`;
    const placeholderEntry: ConsoleEntry = {
      id: entryId,
      type: 'chat_hero',
      sender: 'heroine',
      heroId: selectedHero.id,
      heroName: isMultiTeam ? '👥 在场小队全员' : selectedHero.name,
      speakerName: isMultiTeam ? '👥 在场小队全员' : selectedHero.name,
      text: `⏳ [正在根据现实时间【${timeCtx.currentTimeStr} (${timeCtx.timePeriod})】生成角色实时心声与问候...]`,
      time: nowStr,
      reactionType: 'defiant',
      psychologicalAnalysis: `⏰ 现实时间同步：${timeCtx.currentDateStr} ${timeCtx.timePeriodDetail}，第 ${timeCtx.realDayCount} 天。`,
    };

    setConsoleEntries((prev) => [...prev, placeholderEntry]);

    if (aiConfig.enabled && aiConfig.apiKey) {
      try {
        const res = await fetchWith5Retries('/api/chat-interrogate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hero: sanitizeHeroForAi(selectedHero),
            stats: getStatsPayload(stats, selectedHero),
            activeTeam: heroines
              .filter((h) => activeTeamIds.includes(h.id))
              .map((h) => ({
                hero: sanitizeHeroForAi(h),
                stats: h.id === selectedHero.id ? getStatsPayload(stats, selectedHero) : (progressMap[h.id]?.stats || h.defaultStats),
                isPrimary: h.id === selectedHero.id,
                activeRelationship: getHeroActiveRelationship(h.id),
              })),
            targetScope: isMultiTeam ? 'all' : 'primary',
            partDamage,
            partExposure,
            customSettings,
            environmentTheme: envTheme,
            messages: getEnrichedChatHistory(consoleEntries, selectedHero?.id),
            userMessage: promptText,
            aiConfig,
            dayCount,
            dayConfig,
            scenarioConfig,
            activeRelationship,
            realTimeSyncState: realTimeState,
            realTimeContext: timeCtx,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.text) {
            setConsoleEntries((prev) =>
              prev.map((e) =>
                e.id === entryId
                  ? {
                      ...e,
                      text: data.text,
                      psychologicalAnalysis: data.psychologicalAnalysis || `⏰ 现实时间对齐反馈：${timeCtx.timePeriodDetail}`,
                      reactionType: data.reactionType || e.reactionType,
                      thinkingProcess: data.thinkingProcess,
                      webSearchUsed: Boolean(data.webSearchUsed || (data.webSources && data.webSources.length > 0)),
                      searchEngine: data.webSearchEngine || data.searchEngine,
                      searchQuery: data.webSearchQuery || data.searchQuery,
                      searchSources: data.webSources || data.searchSources,
                    }
                  : e
              )
            );
            if (!isMuted && selectedHero) {
              ultraAudio.speakVoiceLine(data.text, selectedHero.voicePitch);
            }
          }
        }
      } catch (e) {
        console.warn('Real time greeting error:', e);
      }
    } else {
      let fallbackText = '';
      if (timeCtx.timePeriod.includes('深夜') || timeCtx.timePeriod.includes('凌晨')) {
        fallbackText = `“（压低声音，轻轻揉了揉发涩的眼角）已经 ${timeCtx.currentTimeStr} 了……指挥官，这么晚了还不休息吗？我们相处的第 ${timeCtx.realDayCount} 天，可别把身体熬垮了……”`;
      } else if (timeCtx.timePeriod.includes('清晨')) {
        fallbackText = `“（迎着晨光微微颔首）早安，指挥官。今天是相识的第 ${timeCtx.realDayCount} 天，晨光正好，我已经整理好状态，随时可以开始今天的行动。”`;
      } else if (timeCtx.timePeriod.includes('正午')) {
        fallbackText = `“（看了看时间）已经到正午 ${timeCtx.currentTimeStr} 了呢。记得去补充能量和进食，身体可是战术行动的核心本钱。”`;
      } else if (timeCtx.timePeriod.includes('傍晚')) {
        fallbackText = `“（望着渐渐泛红的黄昏余晖）一天的任务又快接近尾声了……今天辛苦了，指挥官。”`;
      } else {
        fallbackText = `“（静静注视着你）现在是 ${timeCtx.currentTimeStr}。不知不觉我们已经相伴度过了 ${timeCtx.formattedDuration}，有你在身边，感觉时间过得格外真切。”`;
      }

      setConsoleEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                text: fallbackText,
                psychologicalAnalysis: `⏰ 现实时间对齐（本地预设响应）：${timeCtx.timePeriodDetail}，第 ${timeCtx.realDayCount} 天。`,
              }
            : e
        )
      );
      if (!isMuted && selectedHero) {
        ultraAudio.speakVoiceLine(fallbackText, selectedHero.voicePitch);
      }
    }
  };

  // Global Keyboard Shortcuts (F5 Quick Save, F9 Quick Load)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        handleQuickSaveSlotNow();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleQuickLoadSlotNow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleQuickSaveSlotNow, handleQuickLoadSlotNow]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono selection:bg-rose-500 selection:text-white flex flex-col">
      {/* Header Bar */}
      <Header
        heroines={heroines}
        selectedHero={safeHero}
        stats={stats}
        activeTeamCount={activeTeamIds.length}
        onSelectHero={handleSelectHero}
        onAddHero={handleAddHeroine}
        onOpenHeroSelector={() => setIsHeroSelectorOpen(true)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        masterVolume={masterVolume}
        onVolumeChange={setMasterVolume}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
        onOpenReport={() => setIsReportOpen(true)}
        onOpenAiConfig={() => setIsAiConfigOpen(true)}
        isAiConfigEnabled={aiConfig.enabled && !!aiConfig.apiKey}
        onResetStats={handleResetStats}
        isTimerBlinking={(stats.energy / (stats.maxEnergy || safeHero.defaultStats?.maxEnergy || 100)) <= 0.3 && stats.energy > 0}
        dayCount={dayCount}
        onPassDay={handlePassDay}
        onChangeDay={handleChangeDay}
        envTheme={envTheme}
        onResetHeroProgress={handleResetCurrentHeroProgress}
        onOpenDayConfig={() => setIsDayConfigOpen(true)}
        onOpenResetConfirm={() => setIsResetConfirmOpen(true)}
        onOpenEnvPanel={() => setIsEnvPanelOpen(true)}
        currentScenario={scenarioConfig}
        onOpenScenarioModal={() => setIsScenarioModalOpen(true)}
        activeRelationshipTitle={activeRelationship.title}
        onOpenRelationshipModal={() => setIsRelationshipModalOpen(true)}
        onOpenStateExportImport={() => {
          setUnifiedSaveModalTab('export');
          setIsUnifiedSaveModalOpen(true);
        }}
        onOpenSaveLoadManager={() => {
          setUnifiedSaveModalTab('slots');
          setIsUnifiedSaveModalOpen(true);
        }}
        onOpenUnifiedSaveManager={(tab) => {
          setUnifiedSaveModalTab(tab || 'slots');
          setIsUnifiedSaveModalOpen(true);
        }}
        onQuickSaveToLocal={handleQuickSaveToLocal}
        isQuickSaving={isQuickSaving}
        onQuickReadFromLocal={handleQuickReadFromLocal}
        realTimeState={realTimeState}
        onOpenRealTimeModal={() => setIsRealTimeModalOpen(true)}
        onToggleRealTimeMode={() => {
          setRealTimeState((prev) => ({
            ...prev,
            isEnabled: !prev.isEnabled,
            lastVisitedTimestamp: Date.now(),
          }));
          ultraAudio.playUiClick();
        }}
      />

      {/* Multi-Hero Team Persistent Bar */}
      {heroines.length > 0 && selectedHero && (
        <MultiHeroTeamBar
          heroines={heroines}
          selectedHero={selectedHero}
          activeTeamIds={activeTeamIds}
          targetScope={targetScope}
          targetedHeroIds={targetedHeroIds}
          progressMap={progressMap}
          onSelectHero={handleSelectHero}
          onToggleTeamMember={handleToggleTeamMember}
          onToggleTargetScope={handleSetTargetScope}
          onToggleTargetHero={handleToggleTargetHero}
          onResetTeamSingle={handleResetTeamSingle}
          onSetSingleHeroMode={handleSetSingleHeroMode}
          onOpenHeroSelector={() => setIsHeroSelectorOpen(true)}
        />
      )}

      {/* Active Low-HP Random Event Toast Notification */}
      {activeRandomEvent && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 animate-bounce">
          <div className={`px-5 py-3 rounded-2xl border shadow-2xl flex items-center space-x-3 text-xs font-bold backdrop-blur-md ${
            activeRandomEvent.type === 'resistance'
              ? 'bg-amber-950/95 border-amber-500 text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.5)]'
              : activeRandomEvent.type === 'whisper'
              ? 'bg-purple-950/95 border-fuchsia-500 text-fuchsia-200 shadow-[0_0_30px_rgba(217,70,239,0.5)]'
              : activeRandomEvent.type === 'surge'
              ? 'bg-cyan-950/95 border-cyan-400 text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,0.5)]'
              : 'bg-rose-950/95 border-rose-500 text-rose-200 shadow-[0_0_30px_rgba(244,63,94,0.5)]'
          }`}>
            <span className="text-xl">{activeRandomEvent.tag.split(' ')[0]}</span>
            <div>
              <div className="text-sm font-extrabold flex items-center gap-2">
                <span>{activeRandomEvent.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-black/60 border border-white/20 font-mono">🎲 HP&lt;30% 临界随机事件</span>
              </div>
              <p className="text-[11px] opacity-90 font-normal mt-0.5 max-w-md">{activeRandomEvent.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout or Pure Clean Initial State */}
      {heroines.length === 0 || !selectedHero ? (
        <main className="flex-1 max-w-[1750px] w-full mx-auto p-4 sm:p-8 flex items-center justify-center">
          <div className="max-w-lg w-full bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-8 text-center backdrop-blur-md shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-5 text-blue-400">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">纯净模式已就绪 · 当前暂无角色</h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              代码包与服务端数据库已彻底处于纯净空白状态，无任何预留角色残留。您可以立即点击下方按钮创建属于您的全新角色，或导入角色卡与备份存档开始体验。
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                id="btn-create-first-hero"
                onClick={handleAddHeroine}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ 创建第一个角色</span>
              </button>
              <button
                id="btn-import-first-hero"
                onClick={() => {
                  setUnifiedSaveModalTab('import');
                  setIsUnifiedSaveModalOpen(true);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <Upload className="w-4 h-4" />
                <span>📥 导入角色卡 / 恢复存档</span>
              </button>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 max-w-[1750px] w-full mx-auto p-2 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0 max-w-full">
        {/* Left Column: Interactive Ultra Visualizer & Unified Console */}
        <div className={`flex flex-col space-y-4 transition-all duration-300 min-w-0 max-w-full ${
          customSettings.consoleWidthMode === 'wide' ? 'lg:col-span-12 xl:col-span-12' : 'lg:col-span-7 xl:col-span-7'
        }`}>
          <UltraViewer
            hero={safeHero}
            onUpdateHero={handleUpdateHeroine}
            stats={stats}
            partDamage={partDamage}
            partExposure={partExposure}
            selectedPart={selectedPart}
            onSelectPart={setSelectedPart}
            onDirectHit={(part) => handleExecuteAttack(selectedWeapon, part, intensity)}
            activeWeapon={selectedWeapon}
            lastHitPart={lastHitPart}
            hitTimestamp={hitTimestamp}
            isContinuousFiring={isContinuousFiring || isAutoAttacking}
            shakeForce={customSettings.physicsShakeForce}
            onApplyLightEffect={handleApplyLightEffect}
            envTheme={envTheme}
            onEnvThemeChange={handleSelectEnvTheme}
            onEnvDamageRateChange={setExtraDailyEnvDamage}
            onLightDailyEffectsChange={setDailyLightEffects}
            videoStreamCache={videoStreamCache}
            activeTeamIds={activeTeamIds}
            teamHeroines={heroines}
          />

          {/* Unified Interrogation & Combat Console */}
          <UnifiedInterrogationConsole
            hero={safeHero}
            stats={stats}
            aiConfig={aiConfig}
            entries={consoleEntries}
            onSendChatMessage={handleSendChatMessage}
            onClearConsole={() => {
              setConsoleEntries([]);
              if (selectedHero?.id) {
                safeLocalStorageSet('ultra_chat_entries_v2_' + selectedHero.id, []);
              }
              safeLocalStorageSet('ultra_current_chat_entries_v2', []);
            }}
            isLoading={isConsoleLoading}
            selectedWeapon={selectedWeapon}
            selectedPart={selectedPart}
            onExecuteAttack={handleExecuteAttack}
            interrogatorIdentity={scenarioConfig.interrogatorIdentity}
            currentScenarioName={scenarioConfig.name}
            activeRelationshipTitle={activeRelationship.title}
            activeRelationship={activeRelationship}
            allRelationshipSlots={allRelationshipSlots}
            scenarioConfig={scenarioConfig}
            dayCount={dayCount}
            dayConfig={dayConfig}
            dialogueFontSize={customSettings.dialogueFontSize || 14}
            onUpdateDialogueFontSize={(size) =>
              setCustomSettings((prev) => ({ ...prev, dialogueFontSize: size }))
            }
            consoleHeight={customSettings.consoleHeight || 650}
            onUpdateConsoleHeight={(height) =>
              setCustomSettings((prev) => ({ ...prev, consoleHeight: height }))
            }
            consoleWidthMode={customSettings.consoleWidthMode || 'normal'}
            onUpdateConsoleWidthMode={(mode) =>
              setCustomSettings((prev) => ({ ...prev, consoleWidthMode: mode }))
            }
            onOpenRelationshipModal={() => setIsRelationshipModalOpen(true)}
            onTriggerRelationshipEval={handleTriggerRelationshipEval}
            onSwitchRelationship={handleSwitchRelationship}
            realTimeState={realTimeState}
            onTriggerRealTimeGreeting={handleTriggerRealTimeGreeting}
            environmentTheme={envTheme}
            partDamage={partDamage}
            partExposure={partExposure}
            presentCharacters={presentCharacterRoster}
            onToggleWebSearch={() => {
              handleUpdateHeroine({
                ...safeHero,
                webSearchEnabled: !safeHero.webSearchEnabled,
              });
            }}
            onChangeSearchEngine={(engine) => {
              handleUpdateHeroine({
                ...safeHero,
                webSearchEnabled: true,
                searchEngine: engine,
              });
            }}
          />
        </div>

        {/* Right Column: Controls, Gauges & Damage Radar */}
        <div className={`flex flex-col space-y-4 transition-all duration-300 min-w-0 max-w-full ${
          customSettings.consoleWidthMode === 'wide' ? 'lg:col-span-12 xl:col-span-12' : 'lg:col-span-5 xl:col-span-5'
        }`}>
          {/* Main Controls Deck */}
          <AttackControls
            weapons={allWeapons}
            selectedWeapon={selectedWeapon}
            onSelectWeapon={setSelectedWeapon}
            selectedPart={selectedPart}
            onSelectPart={setSelectedPart}
            hero={safeHero}
            intensity={intensity}
            onIntensityChange={setIntensity}
            customSettings={customSettings}
            onExecuteAttack={handleExecuteAttack}
            isAutoAttacking={isAutoAttacking}
            onToggleAutoAttack={() => setIsAutoAttacking(!isAutoAttacking)}
            isContinuousFiring={isContinuousFiring}
            onStartContinuousFiring={handleStartContinuousFiring}
            onStopContinuousFiring={handleStopContinuousFiring}
            onOpenCustomSkillModal={() => handleOpenCustomSkillModalTab('arsenal')}
            onOpenCustomSkillModalTab={handleOpenCustomSkillModalTab}
            isLoadingAi={isLoadingAi}
            envTheme={envTheme}
            customCategories={customCategories}
            customWeaponTypes={customWeaponTypes}
            favoriteWeaponIds={favoriteWeaponIds}
            onToggleFavoriteWeapon={handleToggleFavoriteWeapon}
            onDeleteWeapon={handleDeleteWeapon}
            onAddCustomCategory={handleAddCustomCategory}
            activeTeamHeroes={heroines.filter((h) => activeTeamIds.includes(h.id))}
            targetedHeroIds={targetedHeroIds}
            onToggleTargetHero={handleToggleTargetHero}
            onSetTargetScope={handleSetTargetScope}
          />

          {/* Real-Time Stats Gauges Panel */}
          <StatsPanel
            stats={stats}
            partDamage={partDamage}
            partExposure={partExposure}
            hero={safeHero}
            selectedPart={selectedPart}
            onSelectPart={setSelectedPart}
            onUpdatePartDamage={(partId, val) =>
              setPartDamage((prev) => ({ ...prev, [partId]: val }))
            }
            onRestoreAllPartDamage={() =>
              setPartDamage({ head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 })
            }
            dayCount={dayCount}
            envTheme={envTheme}
            onPassDay={handlePassDay}
            onChangeDay={handleChangeDay}
            isRealTimeSync={realTimeState.isEnabled}
          />

          {/* Radar Chart */}
          <DamageRadar hero={safeHero} partDamage={partDamage} logs={logs} />
        </div>
      </main>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 px-4 py-2 text-center text-[10px] text-zinc-600 font-mono tracking-widest uppercase">
        战术系统 // 角色对抗与心理博弈模拟器 v5.0 © {new Date().getFullYear()} 实时遥测记录中
      </footer>

      {/* Modals */}
      <CustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        customSettings={customSettings}
        onChangeSettings={setCustomSettings}
        heroines={heroines}
        selectedHero={safeHero}
        onSelectHero={handleSelectHero}
        onUpdateHero={handleUpdateHeroine}
        onUpdateAllHeroes={(newList) => {
          setHeroines(newList);
          const updatedSel = newList.find((h) => h.id === selectedHero?.id);
          if (updatedSel) setSelectedHero(updatedSel);
        }}
        onAddHero={handleAddHeroine}
        onDeleteHero={handleDeleteHeroine}
        onRestoreDefaultHeroines={handleRestoreDefaultHeroines}
        partDamage={partDamage}
        onUpdatePartDamage={(partId, val) =>
          setPartDamage((prev) => ({ ...prev, [partId]: val }))
        }
        factions={factions}
        onUpdateFactions={setFactions}
      />

      <CustomSkillModal
        isOpen={isCustomSkillModalOpen}
        onClose={() => setIsCustomSkillModalOpen(false)}
        weapons={allWeapons}
        customSkills={customSkills}
        customCategories={customCategories}
        customWeaponTypes={customWeaponTypes}
        favoriteWeaponIds={favoriteWeaponIds}
        initialTab={customSkillModalTab}
        initialEditingSkillId={customSkillModalEditingId}
        onAddCustomCategory={handleAddCustomCategory}
        onUpdateCustomCategory={handleUpdateCustomCategory}
        onDeleteCustomCategory={handleDeleteCustomCategory}
        onAddCustomWeaponType={handleAddCustomWeaponType}
        onDeleteCustomWeaponType={handleDeleteCustomWeaponType}
        onToggleFavoriteWeapon={handleToggleFavoriteWeapon}
        onDeleteWeapon={handleDeleteWeapon}
        onAddCustomSkill={(newSkill) => {
          setCustomSkills((prev) => {
            const filtered = prev.filter((s) => s.id !== newSkill.id);
            return [...filtered, newSkill];
          });
          // Update selected weapon if editing currently active weapon
          if (selectedWeapon.id === newSkill.id) {
            setSelectedWeapon({
              id: newSkill.id,
              name: newSkill.name,
              type: newSkill.type,
              category: newSkill.category,
              iconName: newSkill.iconName || 'Zap',
              damage: newSkill.damage,
              energyDrain: newSkill.energyDrain,
              moraleDamage: newSkill.moraleDamage,
              shameIncrease: newSkill.shameIncrease,
              obedienceGain: newSkill.obedienceGain,
              lustChange: newSkill.lustChange,
              description: newSkill.description,
              sfxType: newSkill.sfxType || 'laser',
            } as AlienWeapon);
          }
        }}
        onResetAllSkills={() => {
          setCustomSkills([]);
          setDeletedWeaponIds([]);
          setSelectedWeapon(FALLBACK_WEAPON);
        }}
      />

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        hero={safeHero}
        stats={stats}
        partDamage={partDamage}
        partExposure={partExposure}
        customSettings={customSettings}
        environmentTheme={envTheme}
        customLights={getSavedCustomLights()}
        logs={logs}
        aiConfig={aiConfig}
        dayCount={dayCount}
        activeRelationship={activeRelationship}
      />

      <AiConfigModal
        isOpen={isAiConfigOpen}
        onClose={() => setIsAiConfigOpen(false)}
        config={aiConfig}
        onSaveConfig={setAiConfig}
        selectedHero={safeHero}
        realTimeState={realTimeState}
        onTriggerRealTimeGreeting={handleTriggerRealTimeGreeting}
      />

      <DayConfigModal
        isOpen={isDayConfigOpen}
        onClose={() => setIsDayConfigOpen(false)}
        dayCount={dayCount}
        onUpdateDayCount={(newDay) => handleChangeDay(newDay, { isDelta: false, simulateEnv: false })}
        dayConfig={dayConfig}
        onUpdateDayConfig={(newConfig) => setDayConfig(newConfig)}
      />

      <ResetConfirmModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        heroName={safeHero.name}
        scenarioName={scenarioConfig.name}
        activeTeamNames={activeTeamIds.length > 1 ? heroines.filter((h) => activeTeamIds.includes(h.id)).map((h) => h.name) : undefined}
        onConfirmReset={handleResetCurrentHeroProgress}
      />

      <EnvironmentPanelModal
        isOpen={isEnvPanelOpen}
        onClose={() => setIsEnvPanelOpen(false)}
        envTheme={envTheme}
        onSelectEnvTheme={handleSelectEnvTheme}
        dayCount={dayCount}
        onPassDay={handlePassDay}
        selectedHero={safeHero}
        dayConfig={dayConfig}
        stats={stats}
        customEnvs={customEnvs}
        onSaveCustomEnvs={handleSaveCustomEnvs}
        envParamOverrides={envParamOverrides}
        onSaveEnvParamOverride={handleSaveEnvParamOverride}
      />

      <ScenarioModal
        isOpen={isScenarioModalOpen}
        onClose={() => setIsScenarioModalOpen(false)}
        currentScenario={scenarioConfig}
        customScenarios={customScenarios.filter((s) => !deletedScenarioIds.includes(s.id))}
        relationshipSlots={getAllRelationshipSlots(relationshipState)}
        heroines={heroines}
        factions={factions}
        selectedHero={safeHero}
        activeTeamIds={activeTeamIds}
        onApplyScenario={handleApplyScenario}
        onSaveCustomScenario={handleSaveCustomScenario}
        onSaveCustomRelationshipSlot={handleSaveCustomRelationshipSlot}
        onDeleteCustomScenario={handleDeleteCustomScenario}
      />

      <RelationshipModal
        isOpen={isRelationshipModalOpen}
        onClose={() => setIsRelationshipModalOpen(false)}
        stats={stats}
        selectedHero={safeHero}
        allHeroes={heroines}
        scenarioConfig={scenarioConfig}
        allScenarios={availableScenarios}
        dayCount={dayCount}
        relationshipState={relationshipState}
        onUpdateRelationshipState={(newState) => {
          if (newState.slots) {
            saveGlobalRelationshipSlots(newState.slots);
          }
          setRelationshipState(newState);
        }}
        onSaveCustomScenario={handleSaveCustomScenario}
        onTriggerEval={handleTriggerRelationshipEval}
        activeTeamHeroes={heroines.filter((h) => activeTeamIds.includes(h.id))}
        onSelectModalHero={(hero) => handleSelectHero(hero)}
        getHeroActiveRelationshipTitle={getHeroActiveRelationshipTitle}
        factions={factions}
      />

      <UnifiedSaveManagerModal
        isOpen={isUnifiedSaveModalOpen || isStateExportImportOpen || isSaveLoadModalOpen}
        onClose={() => {
          setIsUnifiedSaveModalOpen(false);
          setIsStateExportImportOpen(false);
          setIsSaveLoadModalOpen(false);
        }}
        initialTab={unifiedSaveModalTab}
        selectedHero={safeHero}
        heroines={heroines}
        stats={stats}
        dayCount={dayCount}
        partDamage={partDamage}
        partExposure={partExposure}
        consoleEntries={consoleEntries}
        logs={logs}
        scenarioConfig={scenarioConfig}
        envTheme={envTheme}
        envParamOverrides={envParamOverrides}
        relationshipState={relationshipState}
        activeRelationship={activeRelationship}
        activeTeamIds={activeTeamIds}
        targetedHeroIds={targetedHeroIds}
        progressMap={progressMap}
        customSettings={customSettings}
        dayConfig={dayConfig}
        aiConfig={aiConfig}
        onLoadSaveSlot={handleLoadSaveSlot}
        realTimeState={realTimeState}
        exportData={exportData}
        onImportState={handleImportState}
        onQuickSaveToLocal={handleQuickSaveToLocal}
        onQuickReadFromLocal={handleQuickReadFromLocal}
      />

      <RealTimeModeModal
        isOpen={isRealTimeModalOpen}
        onClose={() => setIsRealTimeModalOpen(false)}
        realTimeState={realTimeState}
        onUpdateRealTimeState={(newState) => {
          setRealTimeState(newState);
          if (newState.isEnabled && newState.firstCreatedTimestamp) {
            setDayCount(calculateRealTimeDay(newState.firstCreatedTimestamp));
          }
        }}
        selectedHero={safeHero}
        scenarioConfig={scenarioConfig}
        onTriggerRealTimeGreeting={handleTriggerRealTimeGreeting}
        onOpenAiConfig={() => setIsAiConfigOpen(true)}
      />

      <HeroSelectorModal
        isOpen={isHeroSelectorOpen}
        onClose={() => setIsHeroSelectorOpen(false)}
        heroines={heroines}
        selectedHero={safeHero}
        activeTeamIds={activeTeamIds}
        factions={factions}
        allRelationshipSlots={getAllRelationshipSlots(relationshipState)}
        onSelectHero={handleSelectHero}
        onSetSingleHeroMode={handleSetSingleHeroMode}
        onToggleTeamMember={handleToggleTeamMember}
        onSelectAllTeam={handleSelectAllTeam}
        onResetTeamSingle={handleResetTeamSingle}
        onAddHero={handleAddHeroine}
        onDeleteHero={handleDeleteHeroine}
        onImportCharacterCard={handleImportCharacterCard}
        onImportBatchHeroes={handleImportBatchHeroes}
        onUpdateHero={handleUpdateHeroine}
        onOpenCustomizerForHero={(hero) => {
          handleSelectHero(hero);
          setIsCustomizerOpen(true);
        }}
      />

      {/* Floating One-Click Local Save Notification Toast */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce duration-500">
          <div className="px-4 py-3 rounded-xl bg-emerald-950/90 border border-emerald-500/70 text-emerald-100 text-xs font-bold shadow-[0_0_25px_rgba(16,185,129,0.5)] flex items-center space-x-3 backdrop-blur-md">
            <span>{saveToast.message}</span>
            <button
              onClick={() => setSaveToast(null)}
              className="text-emerald-400 hover:text-white ml-2 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
