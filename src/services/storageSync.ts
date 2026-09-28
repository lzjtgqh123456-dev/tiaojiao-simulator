/**
 * Local Data Management, One-Click Backup, AutoBackup & Local Restore Service
 * 
 * Provides:
 * - 100% Zero-server local storage persistence (localStorage + IndexedDB)
 * - One-Click Full Local Backup Download (.json)
 * - AutoBackup Engine (triggers silent local backup after specified duration of data changes, e.g. 10 mins)
 * - Optional File System Access API support for direct folder saving
 * - One-Click Local Restore / Read for full restoration of characters, portraits, skills & saves
 */
import { getAllPortraitsFromIDB, savePortraitToIDB } from '../lib/portraitStorage';
import { safeLocalStorageSet } from '../utils/storageUtils';
import {
  saveDirectoryHandleToIDB,
  getDirectoryHandleFromIDB,
  clearDirectoryHandleFromIDB,
  saveSlotsToIDB,
} from '../lib/slotStorage';

// List of all recognized application storage keys
export const TRACKED_STORAGE_KEYS = [
  'trainer_heroines_v5',
  'ultra_heroines_v4',
  'ultra_custom_skills_v1',
  'ultra_custom_skill_categories_v1',
  'ultra_custom_weapon_types_v1',
  'ultra_favorite_weapons_v1',
  'ultra_deleted_weapons_v1',
  'ultra_factions_v1',
  'ultra_races_v1',
  'ultra_preset_personalities_v1',
  'ultra_ai_config_v1',
  'ultra_day_config_v1',
  'ultra_last_selected_hero_id_v1',
  'ultra_active_team_ids_v1',
  'ultra_target_scope_v1',
  'ultra_targeted_hero_ids_v1',
  'ultra_selected_weapon_id_v1',
  'ultra_selected_part_v1',
  'ultra_selected_intensity_v1',
  'ultra_progress_map_v2',
  'ultra_custom_envs',
  'ultra_env_param_overrides',
  'ultra_selected_scenario_v1',
  'ultra_custom_scenarios_v1',
  'ultra_deleted_scenarios_v1',
  'ultra_global_relationship_slots_v1',
  'ultra_deleted_rel_slot_ids_v1',
  'ultra_custom_lights_v1',
  'ultra_game_save_slots_v1',
  'ultrawoman_console_height',
  'ultrawoman_console_width_mode',
  'ultrawoman_dialogue_font_size',
  'ultrawoman_show_auto_reply',
  'ultrawoman_auto_interrogate',
  'ultrawoman_sync_attack',
  'ultrawoman_enter_send_mode',
  'ultrawoman_prompt_category',
  'ultrawoman_chat_input_draft',
  'ultrawoman_sync_to_global_library',
  'ultra_custom_settings_v1',
  'ultra_current_chat_entries_v2',
  'ultra_custom_hero_relationship_presets_v1',
  'ultra_custom_personality_slots_v1',
  'ultra_auto_backup_config_v1',
  'ultra_real_time_state_v1',
];

export interface AutoBackupConfig {
  enabled: boolean;
  intervalMinutes: number; // default: 10
  lastBackupTime: number;
  silentNotice: boolean; // default: true (silent notifications without loud sound)
  saveMode: 'downloads' | 'directory';
  folderName?: string;
  scope: 'dialogue' | 'full'; // default: 'dialogue' (仅保存当前对话与战况进度，不全量打包世界观)
}

export interface BackupEvent {
  type: 'manual_save' | 'auto_backup' | 'local_restore';
  success: boolean;
  fileName?: string;
  sizeKb?: number;
  timestamp: number;
  isSilent?: boolean;
  message?: string;
  keysCount?: number;
  portraitsCount?: number;
  scope?: 'dialogue' | 'full';
}

// In-memory directory handle (if supported & granted by user via showDirectoryPicker)
let selectedDirectoryHandle: any = null;
let directoryPermissionStatus: 'connected' | 'needs_permission' | 'unsupported' | 'not_selected' = 'not_selected';

// Try initializing directory handle from IndexedDB on startup
if (typeof window !== 'undefined') {
  setTimeout(() => {
    initDirectoryHandleFromIDB().catch(() => {});
  }, 100);
}

/**
 * Initialize and verify DirectoryHandle from IndexedDB
 */
export async function initDirectoryHandleFromIDB(): Promise<void> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    directoryPermissionStatus = 'unsupported';
    return;
  }
  try {
    const handle = await getDirectoryHandleFromIDB();
    if (handle && typeof handle === 'object') {
      selectedDirectoryHandle = handle;
      if (typeof handle.queryPermission === 'function') {
        try {
          const perm = await handle.queryPermission({ mode: 'readwrite' });
          if (perm === 'granted') {
            directoryPermissionStatus = 'connected';
          } else {
            directoryPermissionStatus = 'needs_permission';
          }
        } catch (permErr) {
          console.warn('[AutoBackup] Error querying permission:', permErr);
          directoryPermissionStatus = 'needs_permission';
        }
      } else {
        directoryPermissionStatus = 'connected';
      }
    } else {
      directoryPermissionStatus = 'not_selected';
    }
  } catch (e) {
    console.warn('[AutoBackup] Error restoring directory handle from IDB:', e);
    directoryPermissionStatus = 'not_selected';
  }
}

/**
 * Check whether the application is running inside an iframe
 */
export function isInsideIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

/**
 * Actively resolve the DirectoryHandle from memory or IndexedDB
 */
export async function resolveDirectoryHandle(): Promise<any | null> {
  if (selectedDirectoryHandle && typeof selectedDirectoryHandle === 'object' && typeof selectedDirectoryHandle.getFileHandle === 'function') {
    return selectedDirectoryHandle;
  }
  try {
    const handle = await getDirectoryHandleFromIDB();
    if (handle && typeof handle === 'object' && typeof handle.getFileHandle === 'function') {
      selectedDirectoryHandle = handle;
      return handle;
    }
  } catch (e) {
    console.warn('[AutoBackup] resolveDirectoryHandle caught error:', e);
  }
  return null;
}

// Data dirty tracking
let isDataDirty = false;
let autoBackupTimerId: any = null;
let serverSyncTimer: any = null;
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
  // A single huge entry (or a large portrait in `portraits`) can still exceed the ~64KB
  // beacon limit, which browsers drop silently. Drop optional sections in priority order
  // so the progress patch — the part that prevents actual data loss — always gets sent.
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

let pendingServerUpdates: Record<string, any> = {};
let pendingServerPortraits: Record<string, string> = {};
// 小体积增量：整表 progressMap 有 6MB（UTF-8 13MB），改用补丁后几百字节，关窗/频繁保存才送得出去
let pendingProgressPatch: Record<string, any> = {};
let pendingChatTailPatch: Record<string, any[]> = {};

/** 把要合并的进度补丁累积起来（同一角色后写覆盖先写） */
function mergeProgressPatch(patch?: Record<string, any>): void {
  if (!patch || typeof patch !== 'object') return;
  for (const [heroId, entry] of Object.entries(patch)) {
    if (!heroId || !entry || typeof entry !== 'object') continue;
    pendingProgressPatch[heroId] = { ...(pendingProgressPatch[heroId] || {}), ...entry };
  }
}

/** 把要追加的对话尾部累积起来（按 id 去重，只留最近的部分） */
function mergeChatTailPatch(patch?: Record<string, any[]>): void {
  if (!patch || typeof patch !== 'object') return;
  for (const [key, entries] of Object.entries(patch)) {
    if (!key || !Array.isArray(entries) || entries.length === 0) continue;
    const merged = [...(pendingChatTailPatch[key] || [])];
    const seen = new Set(merged.map((e) => e && e.id).filter(Boolean));
    for (const e of entries) {
      if (!e || !e.id || seen.has(e.id)) continue;
      seen.add(e.id);
      merged.push(e);
    }
    pendingChatTailPatch[key] = merged.slice(-40);
  }
}

/**
 * Server-disk hydration gate.
 *
 * data/app_storage.json is the AUTHORITATIVE store. Until the app has finished re-reading it
 * (App mount -> fetchServerStorage), the in-memory / localStorage values are only a transient
 * cache: pushing them out would overwrite newer presets & save data with stale defaults.
 * Every server-disk write is therefore dropped while this flag is false. It is released as
 * soon as hydration settles (success, failure, or a safety timeout).
 */
let serverStorageHydrated = false;
let hydrationFallbackTimer: any = null;

export function markServerStorageHydrated(): void {
  serverStorageHydrated = true;
  if (hydrationFallbackTimer) {
    clearTimeout(hydrationFallbackTimer);
    hydrationFallbackTimer = null;
  }
}

export function isServerStorageHydrated(): boolean {
  return serverStorageHydrated;
}

/**
 * Force flush pending state updates directly to server local disk storage
 */
export async function flushServerStorageSync(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).__isWipingAllStorage) {
    // A wipe is in progress: never push queued (now-deleted) state back to the server.
    return;
  }
  if (
    Object.keys(pendingServerUpdates).length === 0 &&
    Object.keys(pendingServerPortraits).length === 0 &&
    Object.keys(pendingProgressPatch).length === 0 &&
    Object.keys(pendingChatTailPatch).length === 0
  ) {
    return;
  }
  const updates = { ...pendingServerUpdates };
  const portraits = { ...pendingServerPortraits };
  const progressPatch = { ...pendingProgressPatch };
  const chatTailPatch = { ...pendingChatTailPatch };
  pendingServerUpdates = {};
  pendingServerPortraits = {};
  pendingProgressPatch = {};
  pendingChatTailPatch = {};

  try {
    const res = await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, portraits, progressPatch, chatTailPatch }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    console.log('[LocalStorageEngine] Persisted updates directly to server local disk.');
  } catch (err) {
    // Keep the un-sent data queued so the next debounce/flush retries it instead of
    // silently dropping the update (previously a failed fetch lost the write forever).
    pendingServerUpdates = { ...updates, ...pendingServerUpdates };
    pendingServerPortraits = { ...portraits, ...pendingServerPortraits };
    mergeProgressPatch(progressPatch);
    mergeChatTailPatch(chatTailPatch);
    console.warn('[LocalStorageEngine] Server disk sync notice:', err);
  }
}

/**
 * Schedule debounced sync to local server disk storage
 */
export function scheduleServerDiskSync(
  updates: Record<string, any>,
  portraits?: Record<string, string>,
  patches?: { progressPatch?: Record<string, any>; chatTailPatch?: Record<string, any[]> }
): void {
  if (typeof window !== 'undefined' && (window as any).__isWipingAllStorage) {
    return;
  }

  // Gate: never push the pre-hydration transient cache over the authoritative disk store.
  // (A boot-time write used to overwrite newer presets/saves with stale defaults.)
  if (!serverStorageHydrated) {
    if (typeof window !== 'undefined' && !hydrationFallbackTimer) {
      // Safety net: if hydration never settles, stop blocking writes after 8s.
      hydrationFallbackTimer = setTimeout(() => {
        serverStorageHydrated = true;
        hydrationFallbackTimer = null;
      }, 8000);
    }
    return;
  }

  Object.assign(pendingServerUpdates, updates);
  if (portraits) {
    Object.assign(pendingServerPortraits, portraits);
  }
  if (patches) {
    mergeProgressPatch(patches.progressPatch);
    mergeChatTailPatch(patches.chatTailPatch);
  }

  // Register unload and visibility listeners once to ensure pending and current states are flushed immediately on window close/switch
  if (typeof window !== 'undefined' && !(window as any).__hasServerFlushListener) {
    (window as any).__hasServerFlushListener = true;
    const handleUnload = () => {
      if (typeof window !== 'undefined' && (window as any).__isWipingAllStorage) {
        return;
      }
      // Never flush the transient pre-hydration cache over the authoritative disk store.
      if (!serverStorageHydrated) {
        return;
      }
      try {
        // ★ 关闭时只发"小体积增量"。
        // 旧版把 progressMap(6MB)/当前历史/名册都塞进 sendBeacon —— 而 beacon/keepalive 上限只有
        // ~64KB，于是整个关窗落盘被静默丢弃（last_closed_at 长期不更新就是这么来的），
        // 重开时只能看到很早之前同步过的内容。
        const heroId = (() => {
          try { return localStorage.getItem('ultra_last_selected_hero_id_v1') || ''; } catch { return ''; }
        })();

        const updates: Record<string, any> = { ...pendingServerUpdates };
        // 超大键一律不带（否则整个 beacon 都会被浏览器拒绝）
        delete updates['ultra_progress_map_v2'];
        delete updates['ultra_current_chat_entries_v2'];
        for (const k of Object.keys(updates)) {
          if (k.startsWith('ultra_chat_entries_v2_') || k === 'trainer_heroines_v5' || k === 'ultra_heroines_v4' || k === 'ultra_game_save_slots_v1') {
            delete updates[k];
          }
        }
        if (heroId) updates['ultra_last_selected_hero_id_v1'] = heroId;

        // 名册/存档槽若不大（<20KB）仍可带上，保证快速关闭后不会丢
        try {
          const rawHeroines = localStorage.getItem('trainer_heroines_v5') || localStorage.getItem('ultra_heroines_v4');
          if (rawHeroines && rawHeroines.length < 20000) {
            const parsed = JSON.parse(rawHeroines);
            updates.trainer_heroines_v5 = parsed;
            updates.ultra_heroines_v4 = parsed;
          }
          const rawAiConfig = localStorage.getItem('ultra_ai_config_v1');
          if (rawAiConfig && rawAiConfig.length < 20000) updates.ultra_ai_config_v1 = JSON.parse(rawAiConfig);
        } catch {}

        // 对话尾部：只带该角色一份，并按字节自适应条数（幂等按 id 合并），
        // 确保"关闭前刚说的话"一定能塞进 64KB 的 beacon 限制里。
        const takeTail = (key: string): any[] => {
          if (!key) return [];
          try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
          } catch { return []; }
        };
        const chatTailPatch: Record<string, any[]> = { ...pendingChatTailPatch };
        const heroKey = heroId ? 'ultra_chat_entries_v2_' + heroId : '';
        const heroTailEntries = heroKey ? takeTail(heroKey) : [];

        // 进度补丁：只带这个角色的条目，并去掉 consoleEntries/logs（体积从几百 KB 降到几 KB）
        const progressPatch: Record<string, any> = { ...pendingProgressPatch };
        if (heroId) {
          try {
            const pm = JSON.parse(localStorage.getItem('ultra_progress_map_v2') || '{}');
            const entry = pm && pm[heroId];
            if (entry && typeof entry === 'object') {
              const slim: Record<string, any> = {};
              for (const [k, v] of Object.entries(entry)) {
                if (k === 'consoleEntries' || k === 'logs') continue;
                slim[k] = v;
              }
              progressPatch[heroId] = { ...(progressPatch[heroId] || {}), ...slim };
            }
          } catch {}
        }

        // 整个 payload 自适应到 64KB 以内（尾部对话按需缩减）
        const payloadObj = fitClosePayloadWithTail(
          {
            updates,
            portraits: { ...pendingServerPortraits },
            progressPatch,
            chatTailPatch,
            isCloseFlush: true,
            closedAt: Date.now(),
          },
          heroKey,
          heroTailEntries
        );

        const payload = JSON.stringify(payloadObj);
        console.log('[AutoSave on Close] 关窗落盘（小体积增量），体积:', (payload.length / 1024).toFixed(1), 'KB');

        // 1. Prioritize navigator.sendBeacon for zero-latency survival during browser/window exit
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          const queued = navigator.sendBeacon('/api/storage/flush-sync', blob);
          if (!queued) {
            console.warn('[AutoSave on Close] sendBeacon 被浏览器拒绝（payload 过大），改用 keepalive fetch 兜底。');
          }
        }

        // 2. Fallback to fetch with keepalive: true
        try {
          fetch('/api/storage/flush-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        } catch {}

        // The payload has been handed to the browser: do not re-send this (possibly stale)
        // snapshot on every later visibilitychange / pagehide event.
        pendingServerUpdates = {};
        pendingServerPortraits = {};
      } catch (e) {
        console.warn('[AutoSave on Close Error]:', e);
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleUnload();
      }
    });
  }

  if (serverSyncTimer) clearTimeout(serverSyncTimer);
  serverSyncTimer = setTimeout(() => {
    flushServerStorageSync().catch(() => {});
  }, 300);
}

/**
 * Cancel all pending server syncs and flush timers immediately (used on Wipe/Reset)
 */
export function cancelAllPendingServerSync(): void {
  if (serverSyncTimer) {
    clearTimeout(serverSyncTimer);
    serverSyncTimer = null;
  }
  if (autoBackupTimerId) {
    clearInterval(autoBackupTimerId);
    autoBackupTimerId = null;
  }
  pendingServerUpdates = {};
  pendingServerPortraits = {};
  // These two were missed before: a wipe followed by any flush (or a removal of the
  // 200ms-later reload) could resurrect deleted progress / chat history on the server.
  pendingProgressPatch = {};
  pendingChatTailPatch = {};
}

/**
 * Stop AutoBackup background engine timer immediately
 */
export function stopAutoBackupEngine(): void {
  if (autoBackupTimerId) {
    clearInterval(autoBackupTimerId);
    autoBackupTimerId = null;
  }
}

/**
 * Fetch authoritative persistent storage data from local server disk
 */
export async function fetchServerStorage(): Promise<{
  storage: Record<string, any>;
  portraits: Record<string, string>;
  count: number;
} | null> {
  try {
    const res = await fetch('/api/storage');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return {
          storage: data.storage || {},
          portraits: data.portraits || {},
          count: data.count || 0,
        };
      }
    }
  } catch (err) {
    console.warn('[LocalStorageEngine] Error fetching server local storage:', err);
  }
  return null;
}

/**
 * Fetch all save slots saved as individual .json files on local server disk
 */
export async function fetchServerSaves(): Promise<any[]> {
  try {
    const res = await fetch('/api/saves');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.slots)) {
        return data.slots;
      }
    }
  } catch (err) {
    console.warn('[LocalStorageEngine] Error fetching server save slots:', err);
  }
  return [];
}

/**
 * Save a single slot directly as a .json file on local server disk
 */
export async function saveSlotToServerDisk(slotData: any): Promise<boolean> {
  if (!slotData || !slotData.id) return false;
  try {
    const safeId = String(slotData.id).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const res = await fetch(`/api/saves/${safeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slotData),
    });
    return res.ok;
  } catch (e) {
    console.warn('[LocalStorageEngine] Error saving slot to server disk:', e);
    return false;
  }
}

/**
 * Delete a save slot file from local server disk
 */
export async function deleteSlotFromServerDisk(slotId: string): Promise<boolean> {
  if (!slotId) return false;
  try {
    const safeId = String(slotId).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const res = await fetch(`/api/saves/${safeId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Subscribers
type BackupListener = (event: BackupEvent) => void;
const backupListeners: Set<BackupListener> = new Set();

const AUTO_BACKUP_CONFIG_KEY = 'ultra_auto_backup_config_v1';
const DEFAULT_AUTO_BACKUP_CONFIG: AutoBackupConfig = {
  enabled: true,
  intervalMinutes: 10,
  lastBackupTime: Date.now(),
  silentNotice: true,
  saveMode: 'downloads',
  scope: 'dialogue', // 默认自动保存当前对话进度
};

/**
 * Load AutoBackup configuration from localStorage
 */
export function getAutoBackupConfig(): AutoBackupConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_AUTO_BACKUP_CONFIG;
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_CONFIG_KEY);
    if (raw) {
      return { ...DEFAULT_AUTO_BACKUP_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {}
  return DEFAULT_AUTO_BACKUP_CONFIG;
}

/**
 * Save AutoBackup configuration
 */
export function saveAutoBackupConfig(cfg: Partial<AutoBackupConfig>): AutoBackupConfig {
  const current = getAutoBackupConfig();
  const updated = { ...current, ...cfg };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(AUTO_BACKUP_CONFIG_KEY, JSON.stringify(updated));
    } catch (e) {}
  }
  scheduleServerDiskSync({ [AUTO_BACKUP_CONFIG_KEY]: updated });
  return updated;
}

/**
 * Subscribe to AutoBackup / Manual Backup events
 */
export function subscribeBackupEvents(listener: BackupListener): () => void {
  backupListeners.add(listener);
  return () => backupListeners.delete(listener);
}

function notifyListeners(event: BackupEvent) {
  backupListeners.forEach((fn) => {
    try {
      fn(event);
    } catch (e) {
      console.warn('[AutoBackup] Listener error:', e);
    }
  });
}

/**
 * Mark that application data has been mutated
 */
export function markStorageDirty(): void {
  isDataDirty = true;
}

/**
 * Local storage queue helper - ensures localStorage write safety, writes to local server disk, and marks storage dirty
 */
export function queueServerSave(
  updates: Record<string, any>,
  portraits?: Record<string, string>,
  patches?: { progressPatch?: Record<string, any>; chatTailPatch?: Record<string, any[]> }
): void {
  // Authoritative Server-side Local Disk Persistence (Sync to local server disk data/app_storage.json)
  scheduleServerDiskSync(updates, portraits, patches);
  markStorageDirty();
}

/**
 * Helper to recursively sanitize runtime chat/log strings for storage deduplication.
 * Retains character configuration, attachments, portraits, and setting assets intact.
 */
export function sanitizeDataForExport(data: any): any {
  if (!data) return data;
  return data;
}

/**
 * Safe JSON stringify helper with circular reference breaking and BigInt conversion
 */
export function safeJsonStringify(obj: any, space?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return undefined; // Break circular reference cleanly
        }
        seen.add(value);
      }
      return value;
    },
    space
  );
}

/**
 * Detect whether a storage key is a legacy version key (v1-v4) or an orphaned key
 * from a hero that no longer exists in current active heroines.
 */
export function isLegacyOrGhostStorageKey(key: string, validHeroIds?: Set<string>): boolean {
  // 1. Obsolete version keys from earlier project iterations
  if (/^trainer_heroines_v[1-4]$/.test(key)) return true;
  if (/^ultra_heroines_v[1-3]$/.test(key)) return true;
  if (key === 'ultra_progress_map_v1') return true;
  if (/^ultra_chat_entries_v1_/.test(key)) return true;
  if (key === 'ultra_quick_save_slots') return true; // obsolete quick save format
  if (key === 'ultra_dialogue_state_v1') return true;
  if (key.startsWith('ultra_test_') || key.startsWith('ultra_debug_')) return true;
  if (key.startsWith('ultra_video_track_') || key === 'ultra_video_stream_cache_v1') return true;
  if (key.startsWith('ultra_state_export_')) return true;

  // 2. Orphaned chat entries or relationship states for deleted heroes
  if (validHeroIds && validHeroIds.size > 0) {
    if (key.startsWith('ultra_chat_entries_v2_')) {
      const heroId = key.slice('ultra_chat_entries_v2_'.length);
      if (!validHeroIds.has(heroId)) return true;
    }
    if (key.startsWith('ultra_relationship_state_v1_')) {
      const heroId = key.slice('ultra_relationship_state_v1_'.length);
      if (!validHeroIds.has(heroId)) return true;
    }
  }

  return false;
}

/**
 * Scan and safely purge obsolete legacy keys (v1-v4) and orphaned deleted hero data from localStorage
 */
export function purgeLegacyLocalStorageData(currentHeroines?: any[]): {
  removedKeys: string[];
  freedBytesEstimate: number;
} {
  const removedKeys: string[] = [];
  let freedBytesEstimate = 0;
  if (typeof localStorage === 'undefined') {
    return { removedKeys, freedBytesEstimate };
  }

  try {
    let validHeroIds: Set<string> | undefined;
    if (currentHeroines && Array.isArray(currentHeroines) && currentHeroines.length > 0) {
      validHeroIds = new Set(currentHeroines.map((h) => h.id).filter(Boolean));
    } else {
      try {
        const raw = localStorage.getItem('trainer_heroines_v5') || localStorage.getItem('ultra_heroines_v4');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            validHeroIds = new Set(parsed.map((h: any) => h.id).filter(Boolean));
          }
        }
      } catch (e) {}
    }

    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) allKeys.push(k);
    }

    for (const key of allKeys) {
      if (isLegacyOrGhostStorageKey(key, validHeroIds)) {
        try {
          const val = localStorage.getItem(key);
          if (val) freedBytesEstimate += val.length * 2;
          localStorage.removeItem(key);
          removedKeys.push(key);
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('[Storage] Error purging legacy localStorage:', e);
  }

  return { removedKeys, freedBytesEstimate };
}

/**
 * Collect all current local data and custom portraits from this browser
 */
export async function collectCurrentLocalData(inMemoryHeroines?: any[]): Promise<{
  storage: Record<string, any>;
  portraits: Record<string, string>;
}> {
  const storage: Record<string, any> = {};
  const activeHeroIds = new Set<string>();
  if (inMemoryHeroines && Array.isArray(inMemoryHeroines)) {
    for (const h of inMemoryHeroines) {
      if (h && h.id) activeHeroIds.add(h.id);
    }
  }

  if (typeof localStorage !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          // Skip legacy version keys (v1-v4) and orphaned deleted hero data
          if (isLegacyOrGhostStorageKey(key, activeHeroIds.size > 0 ? activeHeroIds : undefined)) {
            continue;
          }
          try {
            const raw = localStorage.getItem(key);
            if (raw !== null) {
              try {
                storage[key] = JSON.parse(raw);
              } catch {
                storage[key] = raw;
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  let portraits: Record<string, string> = {};
  try {
    const rawPortraits = await getAllPortraitsFromIDB(1500);
    if (rawPortraits && typeof rawPortraits === 'object') {
      for (const [k, v] of Object.entries(rawPortraits)) {
        if (typeof v === 'string' && v.trim().length > 0) {
          portraits[k] = v;
        }
      }
    }
  } catch (e) {
    console.warn('[Storage] Error reading IDB portraits in collectCurrentLocalData:', e);
  }

  // Harvest from in-memory heroines (read-only, no write during export)
  if (inMemoryHeroines && Array.isArray(inMemoryHeroines)) {
    for (const h of inMemoryHeroines) {
      if (h && h.id && h.customPortrait && typeof h.customPortrait === 'string') {
        if (!portraits[h.id]) {
          portraits[h.id] = h.customPortrait;
        }
      }
    }
  }

  // Also harvest from stored heroines and individual tracks
  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ultra_video_track_')) {
          const heroId = k.replace('ultra_video_track_', '');
          const val = localStorage.getItem(k);
          if (heroId && val && !portraits[heroId]) {
            portraits[heroId] = val;
          }
        }
      }
    }
  } catch (e) {}

  try {
    const storedHeroines = storage.trainer_heroines_v5 || storage.ultra_heroines_v4;
    if (Array.isArray(storedHeroines)) {
      for (const h of storedHeroines) {
        if (h && h.id && h.customPortrait && typeof h.customPortrait === 'string') {
          if (!portraits[h.id]) {
            portraits[h.id] = h.customPortrait;
          }
        }
      }
      // Ensure stored heroines in storage snapshot also include customPortrait
      storage.trainer_heroines_v5 = storedHeroines.map((h: any) => {
        if (h && h.id && portraits[h.id]) {
          return { ...h, customPortrait: portraits[h.id] };
        }
        return h;
      });
      storage.ultra_heroines_v4 = storage.trainer_heroines_v5;
    }
  } catch (e) {}

  return { storage, portraits };
}

/**
 * Collect every portrait the browser currently knows about, from ALL local sources:
 *   - per-hero 'ultra_video_track_*' keys (localStorage + sessionStorage)
 *   - the merged stream cache
 *   - the in-memory heroine list
 * Used before a heroines sync so the authoritative server portrait store can be filled even
 * when a single local copy already went missing (quota / another browser profile / cleared cache).
 */
export function collectLocalPortraitPayload(heroines?: any[]): Record<string, string> {
  const out: Record<string, string> = {};
  const sweep = (storage: Storage | undefined) => {
    if (!storage) return;
    try {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (!k || !k.startsWith('ultra_video_track_')) continue;
        const heroId = k.slice('ultra_video_track_'.length);
        const v = storage.getItem(k);
        if (heroId && typeof v === 'string' && v.length > 0) out[heroId] = v;
      }
    } catch (e) {}
  };
  try {
    if (typeof localStorage !== 'undefined') sweep(localStorage);
    if (typeof sessionStorage !== 'undefined') sweep(sessionStorage);
  } catch (e) {}
  try {
    const raw = (typeof localStorage !== 'undefined' ? localStorage.getItem('ultra_video_stream_cache_v1') : null)
      || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ultra_video_stream_cache_v1') : null);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [heroId, v] of Object.entries(parsed)) {
          if (heroId && typeof v === 'string' && v.length > 0) out[heroId] = out[heroId] || v;
        }
      }
    }
  } catch (e) {}
  if (Array.isArray(heroines)) {
    for (const h of heroines) {
      if (h && h.id && typeof h.customPortrait === 'string' && h.customPortrait.length > 0) {
        out[h.id] = h.customPortrait;
      }
    }
  }
  return out;
}

/**
 * Helper to generate a timestamped backup filename
 */
export function generateBackupFileName(prefix: string = '（模拟）_Backup'): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  return `${prefix}_${dateStr}_${timeStr}.json`;
}

/**
 * Trigger standard browser file download for a Blob
 */
export function triggerBrowserFileDownload(fileName: string, blob: Blob): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (a.parentNode) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      } catch (e) {}
    }, 1000);
  } catch (dlErr) {
    console.warn('[Storage] Browser download error:', dlErr);
  }
}

/**
 * Core unified file writer with strictly isolated destinations:
 * 1. 手动全数据备份与导出 (Manual full data backup & export):
 *    - 必须直接触发浏览器下载文件 (.json)；绝不被后台文件夹静默拦截。
 * 2. 自动保存 (Auto-save):
 *    - 必须自动保存在用户选择的文件夹中；
 *    - 若用户未选择文件夹或缺少授权，仅在本地持久化库安全留存，绝不频繁弹出浏览器下载弹窗骚扰用户。
 */
async function saveBlobToTargetDestination(
  fileName: string,
  blob: Blob,
  isSilent: boolean,
  scope: 'dialogue' | 'full',
  isUserGesture: boolean = false,
  targetMode?: 'download' | 'directory'
): Promise<{ success: boolean; fileName: string; sizeKb: number; savedToDirectory: boolean; downloaded?: boolean }> {
  const sizeKb = Math.max(1, Math.round(blob.size / 1024));
  const config = getAutoBackupConfig();

  // Determine if this is a manual export/download or an auto-save operation
  const isManualDownload = targetMode === 'download' || (!isSilent && targetMode !== 'directory');

  // =========================================================================
  // 分支 1: 手动全数据本地备份与导出 -> 立即下载文件
  // =========================================================================
  if (isManualDownload) {
    triggerBrowserFileDownload(fileName, blob);

    notifyListeners({
      type: 'manual_save',
      success: true,
      fileName,
      sizeKb,
      timestamp: Date.now(),
      isSilent: false,
      scope,
      message: `[本地导出] 备份文件已下载至系统下载目录: ${fileName} (${sizeKb} KB)`,
    });

    return {
      success: true,
      fileName,
      sizeKb,
      savedToDirectory: false,
      downloaded: true,
    };
  }

  // =========================================================================
  // 分支 2: 自动保存 -> 自动保存在用户选择的文件夹中
  // =========================================================================
  let savedToDirectory = false;
  let targetFolderName = config.folderName || '';

  // 1. Actively resolve directory handle
  const handle = await resolveDirectoryHandle();

  if (handle && typeof handle === 'object' && typeof handle.getFileHandle === 'function') {
    targetFolderName = handle.name || targetFolderName || '本地专属文件夹';
    let canWrite = false;

    // Check queryPermission
    if (typeof handle.queryPermission === 'function') {
      try {
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          canWrite = true;
          directoryPermissionStatus = 'connected';
        } else if (isUserGesture && typeof handle.requestPermission === 'function') {
          perm = await handle.requestPermission({ mode: 'readwrite' });
          if (perm === 'granted') {
            canWrite = true;
            directoryPermissionStatus = 'connected';
            await saveDirectoryHandleToIDB(handle);
          } else {
            directoryPermissionStatus = 'needs_permission';
          }
        } else {
          directoryPermissionStatus = 'needs_permission';
        }
      } catch (permErr) {
        console.warn('[AutoBackup] Error querying permission during auto-save:', permErr);
      }
    } else {
      canWrite = true;
    }

    if (canWrite) {
      try {
        const fileHandle = await handle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        savedToDirectory = true;
        directoryPermissionStatus = 'connected';
      } catch (dirErr: any) {
        console.warn('[AutoBackup] Failed to write directly to directory handle:', dirErr);
        if (dirErr?.name === 'NotAllowedError') {
          directoryPermissionStatus = 'needs_permission';
        }
      }
    }
  }

  if (savedToDirectory) {
    saveAutoBackupConfig({ lastBackupTime: Date.now(), saveMode: 'directory', folderName: targetFolderName });
    isDataDirty = false;

    notifyListeners({
      type: isSilent ? 'auto_backup' : 'manual_save',
      success: true,
      fileName,
      sizeKb,
      timestamp: Date.now(),
      isSilent,
      scope,
      message: `[自动保存] 已自动写入绑定文件夹【${targetFolderName}】: ${fileName} (${sizeKb} KB)`,
    });

    return {
      success: true,
      fileName,
      sizeKb,
      savedToDirectory: true,
      downloaded: false,
    };
  }

  // If not saved to directory:
  // CRITICAL: 自动保存模式下，如果未绑定本地文件夹，绝不弹出浏览器下载弹窗骚扰用户！
  saveAutoBackupConfig({ lastBackupTime: Date.now() });
  isDataDirty = false;

  const statusMsg = config.folderName
    ? `[自动保存] 目标文件夹【${config.folderName}】需要重新激活授权，数据已同步至本地持久化数据库`
    : `[自动保存] 数据已在本地持久化库同步（可在自动备份中绑定本地文件夹以启用文件自动落盘）`;

  notifyListeners({
    type: 'auto_backup',
    success: true,
    fileName,
    sizeKb,
    timestamp: Date.now(),
    isSilent: true,
    scope,
    message: statusMsg,
  });

  return {
    success: true,
    fileName,
    sizeKb,
    savedToDirectory: false,
    downloaded: false,
  };
}

/**
 * Trigger download of current dialogue & battle session progress (.json)
 * - Manual call (isSilent = false or targetMode = 'download'): Downloads the file.
 * - Auto-save call (isSilent = true or targetMode = 'directory'): Saves to selected folder.
 */
export async function downloadDialogueProgressBackup(
  dialoguePayload?: any,
  prefix: string = '（模拟）_Dialogue',
  isSilent: boolean = false,
  isUserGesture: boolean = false,
  targetMode?: 'download' | 'directory'
): Promise<{ success: boolean; fileName: string; sizeKb: number; savedToDirectory?: boolean; downloaded?: boolean; error?: string }> {
  try {
    const now = new Date();
    const heroName = dialoguePayload?.selectedHero?.name || dialoguePayload?.selectedHeroName || 'ActiveHero';
    const cleanHeroName = String(heroName).replace(/[^\w\u4e00-\u9fa5]/g, '_');
    const fileName = generateBackupFileName(`${prefix}_${cleanHeroName}`);

    const exportObject = {
      version: '2.0-dialogue',
      exportTime: now.toISOString(),
      app: '（模拟）_Interactive_Console',
      type: 'dialogue_progress_backup',
      description: '当前角色专属对话记录、审讯战况、受损状态与互动进度（不含全量世界观与全局库）',
      ...dialoguePayload,
    };

    const jsonString = safeJsonStringify(exportObject, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    return await saveBlobToTargetDestination(fileName, blob, isSilent, 'dialogue', isUserGesture, targetMode);
  } catch (err: any) {
    console.error('Failed to export dialogue backup:', err);
    notifyListeners({
      type: isSilent ? 'auto_backup' : 'manual_save',
      success: false,
      timestamp: Date.now(),
      isSilent,
      scope: 'dialogue',
      message: `对话进度保存失败: ${err?.message || '未知错误'}`,
    });
    return { success: false, fileName: '', sizeKb: 0, savedToDirectory: false, error: err?.message || '未知错误' };
  }
}

/**
 * Trigger immediate one-click export/download of the complete local backup file (.json)
 * - Manual call (default): Downloads the file directly to user's system downloads.
 * - Auto-save call (isSilent = true): Automatically writes into the user-selected folder.
 */
export async function downloadFullLocalBackup(
  customPayload?: any,
  prefix: string = '（模拟）_FullBackup',
  isSilent: boolean = false,
  isUserGesture: boolean = false,
  targetMode?: 'download' | 'directory'
): Promise<{ success: boolean; fileName: string; sizeKb: number; savedToDirectory?: boolean; downloaded?: boolean; error?: string }> {
  try {
    const inMemoryHeroines = customPayload?.heroines;
    const now = new Date();
    const fileName = generateBackupFileName(prefix);

    // Safely collect local data without throwing
    let storage: Record<string, any> = {};
    let portraits: Record<string, string> = {};
    try {
      const collected = await collectCurrentLocalData(inMemoryHeroines);
      storage = collected.storage || {};
      portraits = collected.portraits || {};
    } catch (collectErr) {
      console.warn('[Storage] Non-fatal collectCurrentLocalData error:', collectErr);
    }

    // Merge in-payload custom portraits if present
    if (customPayload?.customPortraits && typeof customPayload.customPortraits === 'object') {
      portraits = { ...customPayload.customPortraits, ...portraits };
    }

    // Build active heroine IDs set for orphan filtering
    const activeHeroIds = new Set<string>();
    const effectiveHeroines = customPayload?.heroines || inMemoryHeroines;
    if (effectiveHeroines && Array.isArray(effectiveHeroines)) {
      for (const h of effectiveHeroines) {
        if (h && h.id) activeHeroIds.add(h.id);
      }
    }

    // Clean payload sanitization
    const cleanPayload = customPayload ? sanitizeDataForExport(customPayload) : {};

    // Helper to safely read a specific structured key from localStorage if not provided in payload
    const getStructuredFallback = (key: string) => {
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        return raw ? JSON.parse(raw) : undefined;
      } catch {
        return undefined;
      }
    };

    // Ensure all critical structured game fields are present as top-level properties
    const heroines = cleanPayload.heroines || inMemoryHeroines || getStructuredFallback('trainer_heroines_v5') || getStructuredFallback('ultra_heroines_v4') || [];
    const customSkills = cleanPayload.customSkills || getStructuredFallback('ultra_custom_skills_v1') || [];
    const customCategories = cleanPayload.customCategories || getStructuredFallback('ultra_custom_skill_categories_v1') || [];
    const customScenarios = cleanPayload.customScenarios || getStructuredFallback('ultra_custom_scenarios_v1') || [];
    const customWeaponTypes = cleanPayload.customWeaponTypes || getStructuredFallback('ultra_custom_weapon_types_v1') || [];
    const factions = cleanPayload.factions || getStructuredFallback('ultra_factions_v1') || [];
    const customSettings = cleanPayload.customSettings || getStructuredFallback('ultra_custom_settings_v1') || {};
    const dayConfig = cleanPayload.dayConfig || getStructuredFallback('ultra_day_config_v1') || {};
    const allRelationshipSlots = cleanPayload.allRelationshipSlots || getStructuredFallback('ultra_global_relationship_slots_v1') || [];
    const progressMap = cleanPayload.progressMap || getStructuredFallback('ultra_progress_map_v2') || {};
    const saveSlots = cleanPayload.saveSlots || getStructuredFallback('ultra_game_save_slots_v1') || [];

    // Also harvest in-memory heroine portraits if any
    if (Array.isArray(heroines)) {
      for (const h of heroines) {
        if (h && h.id && h.customPortrait && typeof h.customPortrait === 'string') {
          if (!portraits[h.id]) portraits[h.id] = h.customPortrait;
        }
      }
    }

    // Build the 100% pure structured JSON game state (STRICTLY NO localStorageData / NO raw browser cache dump)
    const fullExportObject: Record<string, any> = {
      dataType: 'full_backup',
      version: '2.0-structured',
      exportTime: now.toISOString(),
      app: '（模拟）_Interactive_Console',
      type: 'one_click_local_full_backup',
      description: '全量纯净结构化游戏数据备份（含角色阵容、招式技能、剧情阵营、战报战况、羁绊与自制立绘媒体），无任何浏览器底层缓存键。',
      ...cleanPayload,
      heroines,
      customSkills,
      customCategories,
      customScenarios,
      customWeaponTypes,
      factions,
      customSettings,
      dayConfig,
      allRelationshipSlots,
      progressMap,
      saveSlots,
      ...(Object.keys(portraits).length > 0 ? { customPortraits: portraits } : {}),
    };

    // CRITICAL: Explicitly ensure localStorageData is completely forbidden and deleted
    delete fullExportObject.localStorageData;

    let jsonString: string;
    try {
      jsonString = safeJsonStringify(fullExportObject);
    } catch (stringifyErr) {
      console.warn('[Storage] Full export JSON stringify failed, falling back to core payload:', stringifyErr);
      // Fallback: serialize essential payload without any browser cache
      const fallbackExportObject: Record<string, any> = {
        dataType: 'full_backup',
        version: '2.0-structured',
        exportTime: now.toISOString(),
        app: '（模拟）_Interactive_Console',
        type: 'one_click_local_full_backup',
        description: '全量纯净结构化游戏数据备份',
        ...cleanPayload,
        heroines,
        customSkills,
        factions,
        progressMap,
        saveSlots,
        ...(Object.keys(portraits).length > 0 ? { customPortraits: portraits } : {}),
      };
      delete fallbackExportObject.localStorageData;
      jsonString = safeJsonStringify(fallbackExportObject);
    }

    const blob = new Blob([jsonString], { type: 'application/json' });
    return await saveBlobToTargetDestination(fileName, blob, isSilent, 'full', isUserGesture, targetMode);
  } catch (err: any) {
    console.error('Failed to export local backup:', err);
    notifyListeners({
      type: isSilent ? 'auto_backup' : 'manual_save',
      success: false,
      timestamp: Date.now(),
      isSilent,
      scope: 'full',
      message: `备份导出失败: ${err?.message || '未知错误'}`,
    });

    // Last-ditch emergency download: if user initiated a manual download and primary path threw
    if (!isSilent || targetMode === 'download') {
      try {
        const emergencyFileName = generateBackupFileName(`${prefix}_Emergency`);
        const emergencyExport = {
          version: '2.0-fallback',
          exportTime: new Date().toISOString(),
          app: '（模拟）_Interactive_Console',
          type: 'emergency_full_backup',
          ...(customPayload || {}),
        };
        const safeStr = safeJsonStringify(emergencyExport);
        const blob = new Blob([safeStr], { type: 'application/json' });
        return await saveBlobToTargetDestination(emergencyFileName, blob, false, 'full', isUserGesture, 'download');
      } catch (e2) {
        console.error('Emergency backup download failed:', e2);
      }
    }

    return { success: false, fileName: '', sizeKb: 0, savedToDirectory: false, error: err?.message || '未知错误' };
  }
}

/**
 * Check and execute AutoBackup if data changed and interval elapsed
 */
export async function checkAndExecuteAutoBackup(
  dialoguePayloadProvider?: () => any,
  fullPayloadProvider?: () => any
): Promise<boolean> {
  const config = getAutoBackupConfig();
  if (!config.enabled) return false;

  const now = Date.now();
  const intervalMs = Math.max(1, config.intervalMinutes) * 60 * 1000;
  const elapsedMs = now - (config.lastBackupTime || 0);

  // If data was mutated and elapsed time exceeds configured interval (e.g. 10 mins)
  if (isDataDirty && elapsedMs >= intervalMs) {
    if (config.scope === 'full') {
      const payload = fullPayloadProvider ? fullPayloadProvider() : (dialoguePayloadProvider ? dialoguePayloadProvider() : undefined);
      await downloadFullLocalBackup(payload, '（模拟）_Full_AutoBackup', true, false, 'directory');
    } else {
      // 默认：自动保存当前对话与审讯战况进度，绝不一股脑导出全量世界观
      const payload = dialoguePayloadProvider ? dialoguePayloadProvider() : (fullPayloadProvider ? fullPayloadProvider() : undefined);
      await downloadDialogueProgressBackup(payload, '（模拟）_Dialogue_AutoBackup', true, false, 'directory');
    }
    return true;
  }
  return false;
}

/**
 * Initialize AutoBackup background worker
 */
export function initAutoBackupEngine(
  dialoguePayloadProvider?: () => any,
  fullPayloadProvider?: () => any
): () => void {
  if (autoBackupTimerId) {
    clearInterval(autoBackupTimerId);
  }

  // Periodic poll check every 30 seconds
  autoBackupTimerId = setInterval(() => {
    checkAndExecuteAutoBackup(dialoguePayloadProvider, fullPayloadProvider).catch((e) => {
      console.warn('[AutoBackup] Background check error:', e);
    });
  }, 30000);

  return () => {
    if (autoBackupTimerId) {
      clearInterval(autoBackupTimerId);
      autoBackupTimerId = null;
    }
  };
}

/**
 * Request user to pick a local folder for silent direct file saving (File System Access API)
 */
export async function requestLocalDirectoryPicker(): Promise<{
  success: boolean;
  folderName?: string;
  error?: string;
  isIframeBlocked?: boolean;
}> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    return {
      success: false,
      error: '当前浏览器环境不支持 File System Access API（或浏览器关闭了本地文件系统直存）。系统已为您开启永久 IndexedDB + 极速本地备份双重持久化保障。',
    };
  }

  try {
    const dirHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    });
    if (!dirHandle) {
      return { success: false, error: '未获取到有效的文件夹句柄' };
    }
    selectedDirectoryHandle = dirHandle;
    directoryPermissionStatus = 'connected';
    await saveDirectoryHandleToIDB(dirHandle);

    const folderName = dirHandle.name || '本地备份文件夹';
    saveAutoBackupConfig({
      saveMode: 'directory',
      folderName,
    });
    return { success: true, folderName };
  } catch (err: any) {
    console.warn('[AutoBackup] requestLocalDirectoryPicker caught error:', err);
    if (err?.name === 'AbortError') {
      return { success: false, error: '已取消选择文件夹' };
    }
    const errMsg = err?.message || String(err || '');
    if (
      err?.name === 'SecurityError' ||
      errMsg.includes('Cross-origin') ||
      errMsg.includes('subframe') ||
      errMsg.includes('iframe') ||
      errMsg.includes('not allowed')
    ) {
      return {
        success: false,
        isIframeBlocked: true,
        error: '安全沙箱限制：浏览器禁止在内嵌预览窗口（iframe）中直接选择本地磁盘文件夹。建议点击右上角在新标签页中打开应用，即可畅享本地文件夹直存；在此之前，系统内置的无上限永久 IndexedDB 与一键本地下载备份已全面护航！',
      };
    }
    if (err?.name === 'NotAllowedError') {
      return { success: false, error: '未能获取文件夹读写授权，请在浏览器权限提示中选择“允许”' };
    }
    return { success: false, error: errMsg || '获取文件夹权限失败' };
  }
}

/**
 * Reconnect / Re-authorize previously selected folder without re-opening directory picker dialog
 */
export async function reconnectDirectoryHandle(): Promise<{
  success: boolean;
  folderName?: string;
  error?: string;
}> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    return { success: false, error: '当前环境不支持本地文件夹直存' };
  }
  try {
    let handle = selectedDirectoryHandle;
    if (!handle) {
      handle = await getDirectoryHandleFromIDB();
    }
    if (!handle) {
      return requestLocalDirectoryPicker();
    }
    if (typeof handle.requestPermission !== 'function') {
      return requestLocalDirectoryPicker();
    }
    try {
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        selectedDirectoryHandle = handle;
        directoryPermissionStatus = 'connected';
        await saveDirectoryHandleToIDB(handle);
        return { success: true, folderName: handle.name || '本地备份文件夹' };
      } else {
        directoryPermissionStatus = 'needs_permission';
        return { success: false, error: '未授予文件夹读写权限，请在弹出的浏览器提示中点击“允许/查看文件”' };
      }
    } catch (permErr: any) {
      console.warn('[AutoBackup] requestPermission error in reconnect:', permErr);
      return {
        success: false,
        error: `文件夹重新授权受限: ${permErr?.message || '请尝试重新绑定文件夹'}`,
      };
    }
  } catch (e: any) {
    console.warn('[AutoBackup] reconnectDirectoryHandle caught error:', e);
    return { success: false, error: e?.message || '重新授权文件夹失败' };
  }
}

/**
 * Clear designated folder
 */
export async function clearSelectedDirectory(): Promise<void> {
  selectedDirectoryHandle = null;
  directoryPermissionStatus = 'not_selected';
  await clearDirectoryHandleFromIDB();
  saveAutoBackupConfig({
    saveMode: 'downloads',
    folderName: undefined,
  });
}

/**
 * Get current folder connection status
 */
export function getDirectoryConnectionStatus(): 'connected' | 'needs_permission' | 'unsupported' | 'not_selected' {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    return 'unsupported';
  }
  if (!selectedDirectoryHandle) {
    return 'not_selected';
  }
  return directoryPermissionStatus;
}

/**
 * Get current designated folder name if any
 */
export function getSelectedDirectoryName(): string | null {
  const cfg = getAutoBackupConfig();
  return selectedDirectoryHandle?.name || cfg.folderName || null;
}

/**
 * Perform an immediate test write to the currently selected folder to verify real FileSystem writes
 */
export async function testWriteToSelectedDirectory(): Promise<{
  success: boolean;
  fileName?: string;
  folderName?: string;
  error?: string;
}> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    return {
      success: false,
      error: '当前浏览器环境不支持 File System Access API（或处于安全沙箱/iframe中）。',
    };
  }

  try {
    let handle = selectedDirectoryHandle;
    if (!handle) {
      handle = await getDirectoryHandleFromIDB();
    }
    if (!handle || typeof handle !== 'object') {
      return {
        success: false,
        error: '尚未绑定本地专属文件夹，请先点击“绑定本地备份文件夹”按钮选择目标目录。',
      };
    }

    // Safely check queryPermission
    if (typeof handle.queryPermission === 'function') {
      try {
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted' && typeof handle.requestPermission === 'function') {
          try {
            const reqPerm = await handle.requestPermission({ mode: 'readwrite' });
            if (reqPerm !== 'granted') {
              return {
                success: false,
                error: '未能获取文件夹读写授权，请在浏览器权限提示中允许访问该文件夹。',
              };
            }
          } catch (reqErr: any) {
            console.warn('[AutoBackup] requestPermission error:', reqErr);
            return {
              success: false,
              error: `请求文件夹读写权限失败: ${reqErr?.message || '请确保在用户交互手势下点击授权'}`,
            };
          }
        }
      } catch (queryErr: any) {
        console.warn('[AutoBackup] queryPermission error:', queryErr);
      }
    }

    selectedDirectoryHandle = handle;
    directoryPermissionStatus = 'connected';
    await saveDirectoryHandleToIDB(handle);

    const testFileName = `（模拟）_Folder_Test_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Date.now().toString().slice(-4)}.json`;
    const testContent = {
      testTime: new Date().toISOString(),
      app: '（模拟）_Interactive_Console',
      status: 'Folder write permission verified successfully!',
      folderName: handle.name || '本地专属文件夹',
      notice: '此文件为本地文件夹直存写入连通性测试文件，可安全保留或删除。',
    };

    const blob = new Blob([JSON.stringify(testContent, null, 2)], { type: 'application/json' });

    if (typeof handle.getFileHandle !== 'function') {
      return {
        success: false,
        error: '文件夹句柄已失效或被浏览器释放，请重新点击“更换”或“绑定本地专属文件夹”。',
      };
    }

    const fileHandle = await handle.getFileHandle(testFileName, { create: true });
    if (!fileHandle || typeof fileHandle.createWritable !== 'function') {
      return {
        success: false,
        error: '目标文件夹不支持 createWritable 写入流接口。',
      };
    }

    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    return {
      success: true,
      fileName: testFileName,
      folderName: handle.name || '本地专属文件夹',
    };
  } catch (err: any) {
    console.error('[AutoBackup] testWriteToSelectedDirectory caught error:', err);
    return {
      success: false,
      error: err?.message || '写入测试文件到文件夹失败',
    };
  }
}

/**
 * Restore complete local backup from JSON string, object or File
 */
export async function restoreFullLocalBackup(fileOrContent: File | string | object): Promise<{
  success: boolean;
  message: string;
  keysRestored: number;
  portraitsRestored: number;
  data?: any;
}> {
  try {
    let parsed: any = null;

    if (fileOrContent instanceof File) {
      const text = await fileOrContent.text();
      parsed = JSON.parse(text);
    } else if (typeof fileOrContent === 'string') {
      parsed = JSON.parse(fileOrContent);
    } else if (typeof fileOrContent === 'object' && fileOrContent !== null) {
      parsed = fileOrContent;
    } else {
      throw new Error('无效的文件或数据格式');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('解析备份文件失败：内容非合法 JSON 对象');
    }

    let keysCount = 0;
    let portraitsCount = 0;

    // 1. Restore localStorageData if present (Full Backup Format)
    if (parsed.localStorageData && typeof parsed.localStorageData === 'object') {
      for (const [key, val] of Object.entries(parsed.localStorageData)) {
        // Skip any legacy version keys (v1-v4) or deprecated test keys
        if (isLegacyOrGhostStorageKey(key)) {
          continue;
        }
        try {
          if (val === undefined || val === null) {
            localStorage.removeItem(key);
          } else {
            safeLocalStorageSet(key, val);
          }
          keysCount++;
        } catch (e) {}
      }
    }

    // 2. Restore individual standard export fields if direct StateExport format
    if (parsed.heroines && Array.isArray(parsed.heroines)) {
      const portraitsMap: Record<string, string> = {};
      parsed.heroines.forEach((h: any) => {
        if (h && h.id && h.customPortrait && typeof h.customPortrait === 'string') {
          savePortraitToIDB(h.id, h.customPortrait).catch(() => {});
          portraitsMap[h.id] = h.customPortrait;
          try {
            localStorage.setItem(`ultra_video_track_${h.id}`, h.customPortrait);
          } catch (e) {}
        }
      });
      if (Object.keys(portraitsMap).length > 0) {
        queueServerSave({}, portraitsMap);
      }

      const sanitized = parsed.heroines.map((h: any) => {
        if (h.customPortrait && h.customPortrait.startsWith('data:') && h.customPortrait.length > 2000) {
          return { ...h, customPortrait: undefined };
        }
        return h;
      });
      localStorage.setItem('trainer_heroines_v5', JSON.stringify(sanitized));
      localStorage.setItem('ultra_heroines_v4', JSON.stringify(sanitized));
      keysCount++;
    }
    if (parsed.customSkills && Array.isArray(parsed.customSkills)) {
      localStorage.setItem('ultra_custom_skills_v1', JSON.stringify(parsed.customSkills));
      keysCount++;
    }
    if (parsed.customCategories && Array.isArray(parsed.customCategories)) {
      localStorage.setItem('ultra_custom_skill_categories_v1', JSON.stringify(parsed.customCategories));
      keysCount++;
    }
    if (parsed.customWeaponTypes && Array.isArray(parsed.customWeaponTypes)) {
      localStorage.setItem('ultra_custom_weapon_types_v1', JSON.stringify(parsed.customWeaponTypes));
      keysCount++;
    }
    if (parsed.factions && Array.isArray(parsed.factions)) {
      localStorage.setItem('ultra_factions_v1', JSON.stringify(parsed.factions));
      keysCount++;
    }
    if (parsed.aiConfig) {
      localStorage.setItem('ultra_ai_config_v1', JSON.stringify(parsed.aiConfig));
      keysCount++;
    }
    if (parsed.dayConfig) {
      safeLocalStorageSet('ultra_day_config_v1', parsed.dayConfig);
      keysCount++;
    }
    if (parsed.progressMap && typeof parsed.progressMap === 'object') {
      safeLocalStorageSet('ultra_progress_map_v2', parsed.progressMap);
      keysCount++;
    }
    if (parsed.selectedHeroId || parsed.selectedHero?.id) {
      const hid = parsed.selectedHeroId || parsed.selectedHero?.id;
      safeLocalStorageSet('ultra_last_selected_hero_id_v1', hid);
      keysCount++;
    }
    if (parsed.currentConsoleEntries && Array.isArray(parsed.currentConsoleEntries)) {
      const hid = parsed.selectedHeroId || parsed.selectedHero?.id;
      if (hid) {
        safeLocalStorageSet('ultra_chat_entries_v2_' + hid, parsed.currentConsoleEntries);
      }
      safeLocalStorageSet('ultra_current_chat_entries_v2', parsed.currentConsoleEntries);
      keysCount++;
    }
    if (parsed.activeTeamIds && Array.isArray(parsed.activeTeamIds)) {
      safeLocalStorageSet('ultra_active_team_ids_v1', parsed.activeTeamIds);
      keysCount++;
    }
    if (parsed.scenarioConfig) {
      safeLocalStorageSet('ultra_selected_scenario_v1', parsed.scenarioConfig);
      keysCount++;
    }
    if (parsed.customScenarios && Array.isArray(parsed.customScenarios)) {
      safeLocalStorageSet('ultra_custom_scenarios_v1', parsed.customScenarios);
      keysCount++;
    }
    if (parsed.realTimeState || parsed.localStorageData?.ultra_real_time_state_v1) {
      const rState = parsed.realTimeState || parsed.localStorageData?.ultra_real_time_state_v1;
      safeLocalStorageSet('ultra_real_time_state_v1', rState);
      keysCount++;
    }
    const relSlotsToSave = parsed.allRelationshipSlots || parsed.relationshipState?.slots || parsed.relationshipState?.customSlots;
    if (relSlotsToSave && Array.isArray(relSlotsToSave)) {
      safeLocalStorageSet('ultra_global_relationship_slots_v1', relSlotsToSave);
      keysCount++;
    }
    if (parsed.deletedRelSlotIds && Array.isArray(parsed.deletedRelSlotIds)) {
      safeLocalStorageSet('ultra_deleted_rel_slot_ids_v1', parsed.deletedRelSlotIds);
      keysCount++;
    }

    // 3. Restore custom portraits to IndexedDB
    const portraitsToSave: Record<string, string> = {
      ...(parsed.customPortraits || {}),
    };

    // Also check if heroines in payload have portraits
    if (parsed.heroines && Array.isArray(parsed.heroines)) {
      parsed.heroines.forEach((h: any) => {
        if (h && h.id && h.customPortrait && !portraitsToSave[h.id]) {
          portraitsToSave[h.id] = h.customPortrait;
        }
      });
    }
    const legacyHeroines = parsed.localStorageData?.trainer_heroines_v5 || parsed.localStorageData?.ultra_heroines_v4;
    if (Array.isArray(legacyHeroines)) {
      legacyHeroines.forEach((h: any) => {
        if (h && h.id && h.customPortrait && !portraitsToSave[h.id]) {
          portraitsToSave[h.id] = h.customPortrait;
        }
      });
    }

    for (const [heroId, portraitData] of Object.entries(portraitsToSave)) {
      if (typeof portraitData === 'string' && portraitData.length > 0) {
        try {
          await savePortraitToIDB(heroId, portraitData);
          portraitsCount++;
        } catch (e) {}
      }
    }

    if (Object.keys(portraitsToSave).length > 0) {
      try {
        const existingSession = sessionStorage.getItem('ultra_video_stream_cache_v1');
        const parsedSession = existingSession ? JSON.parse(existingSession) : {};
        const mergedSession = { ...parsedSession, ...portraitsToSave };
        sessionStorage.setItem('ultra_video_stream_cache_v1', JSON.stringify(mergedSession));
        localStorage.setItem('ultra_video_stream_cache_v1', JSON.stringify(mergedSession));
      } catch (e) {}
    }

    // 4. Restore game save slots (if present in payload or localStorageData)
    const rawSlots = parsed.saveSlots || parsed.localStorageData?.ultra_game_save_slots_v1;
    if (Array.isArray(rawSlots) && rawSlots.length > 0) {
      try {
        saveSlotsToIDB(rawSlots).catch(() => {});
        safeLocalStorageSet('ultra_game_save_slots_v1', rawSlots);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ultra_save_slots_updated', { detail: rawSlots }));
        }
        keysCount++;
      } catch (e) {}
    }

    // Clear dirty flag
    isDataDirty = false;

    // Immediately push restored data to server storage so server disk is authoritative
    collectCurrentLocalData().then(({ storage: updatedStore, portraits: updatedPortraits }) => {
      queueServerSave(updatedStore, updatedPortraits);
      flushServerStorageSync().catch(() => {});
    }).catch((e) => console.warn('[LocalStorageEngine] collectCurrentLocalData restore notice:', e));

    notifyListeners({
      type: 'local_restore',
      success: true,
      timestamp: Date.now(),
      keysCount,
      portraitsCount,
      message: `✅ 本地读取成功！已恢复 ${keysCount} 项存储数据及 ${portraitsCount} 张角色立绘。`,
    });

    return {
      success: true,
      message: `✅ 本地读取成功！已恢复 ${keysCount} 项存储数据及 ${portraitsCount} 张角色立绘。`,
      keysRestored: keysCount,
      portraitsRestored: portraitsCount,
      data: parsed,
    };
  } catch (err: any) {
    console.error('Failed to restore local backup:', err);
    return {
      success: false,
      message: `❌ 本地读取失败: ${err?.message || '文件格式不正确'}`,
      keysRestored: 0,
      portraitsRestored: 0,
    };
  }
}
