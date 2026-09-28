import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  FolderOpen,
  Plus,
  Trash2,
  Download,
  Upload,
  Clock,
  User,
  Users,
  Shield,
  Activity,
  Calendar,
  Sparkles,
  Check,
  AlertCircle,
  FileText,
  Layers,
  Heart,
  RefreshCw,
  Copy,
  Edit2,
  CheckCircle2,
} from 'lucide-react';
import {
  Ultrawoman,
  Stats,
  BodyPartId,
  ConsoleEntry,
  LogEntry,
  ScenarioConfig,
  EnvironmentTheme,
  RelationshipState,
  RelationshipSlot,
  Faction,
  CustomEnvTheme,
  CustomSkillCategory,
  CustomWeaponType,
  CustomSettings,
  DayConfig,
  AiConfig,
  RealTimeSyncState,
} from '../types';
import { ultraAudio } from '../utils/audio';
import { queueServerSave, fetchServerSaves, saveSlotToServerDisk, deleteSlotFromServerDisk, sanitizeDataForExport } from '../services/storageSync';
import { saveSlotsToIDB, getSlotsFromIDB } from '../lib/slotStorage';
import { safeLocalStorageSet } from '../utils/storageUtils';

export interface SaveSlotData {
  id: string;
  slotNumber: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  heroId: string;
  heroName: string;
  heroColor?: string;
  dayCount: number;
  stats: Stats;
  scenarioName?: string;
  relationshipTitle?: string;
  teamCount?: number;
  teamHeroNames?: string[];
  // Full state snapshot
  activeTeamIds: string[];
  targetedHeroIds?: string[];
  progressMap: Record<string, any>;
  partDamage: Record<BodyPartId, number>;
  partExposure: Record<BodyPartId, number>;
  consoleEntries: ConsoleEntry[];
  logs: LogEntry[];
  scenarioConfig?: ScenarioConfig;
  envTheme?: EnvironmentTheme | string;
  envParamsOverride?: any;
  relationshipState?: RelationshipState;
  customSettings?: CustomSettings;
  dayConfig?: DayConfig;
  aiConfig?: AiConfig;
  notes?: string;
  // Type indicator for Unified Save system
  slotType?: 'manual' | 'auto' | 'quick';
  isAutoSave?: boolean;
  isQuickSave?: boolean;
  // Real-Time Mode separation
  gameMode?: 'standard' | 'realtime';
  isRealTimeSync?: boolean;
  realTimeSyncState?: RealTimeSyncState;
}

const STORAGE_KEY = 'ultra_game_save_slots_v1';

// In-memory runtime cache of save slots to prevent any sync delay
let memorySlotsCache: SaveSlotData[] | null = null;

export function getLocalSaveSlots(): SaveSlotData[] {
  if (memorySlotsCache && Array.isArray(memorySlotsCache) && memorySlotsCache.length > 0) {
    return memorySlotsCache;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memorySlotsCache = parsed;
      return parsed;
    }
    return [];
  } catch (e) {
    console.error('Failed to load save slots from localStorage:', e);
    return [];
  }
}

export const getGameSaveSlots = getLocalSaveSlots;

/**
 * Asynchronously loads save slots from server disk, IndexedDB with zero quota limits and fallback to localStorage
 */
export async function loadSaveSlotsAsync(): Promise<SaveSlotData[]> {
  // 1. Prioritize Server Local Disk Saves (data/saves/ and data/app_storage.json)
  try {
    const rawServerSlots = await fetchServerSaves();
    // Defense in depth: a full-backup export can live in the same folder; never let an entry
    // without a real slot id enter the save-slot index.
    const serverSlots: SaveSlotData[] = Array.isArray(rawServerSlots)
      ? rawServerSlots.filter((s: any) => s && typeof s === 'object' && typeof s.id === 'string' && s.id)
      : [];
    if (serverSlots.length > 0) {
      memorySlotsCache = serverSlots;
      saveSlotsToIDB(serverSlots).catch(() => {});
      safeLocalStorageSet(STORAGE_KEY, serverSlots);
      return serverSlots;
    }
  } catch (e) {
    console.warn('[SaveSlots] Server disk read notice:', e);
  }

  // 2. Check IndexedDB
  try {
    const idbSlots = await getSlotsFromIDB();
    if (Array.isArray(idbSlots) && idbSlots.length > 0) {
      memorySlotsCache = idbSlots;
      safeLocalStorageSet(STORAGE_KEY, idbSlots);
      // Also persist to server disk if server was empty
      for (const slot of idbSlots) {
        saveSlotToServerDisk(slot).catch(() => {});
      }
      return idbSlots;
    }
  } catch (e) {
    console.warn('[SaveSlots] IndexedDB read error:', e);
  }

  const localSlots = getLocalSaveSlots();
  if (localSlots.length > 0) {
    saveSlotsToIDB(localSlots).catch(() => {}); // migrate to IDB
    for (const slot of localSlots) {
      saveSlotToServerDisk(slot).catch(() => {});
    }
  }
  return localSlots;
}

export function saveLocalSaveSlots(slots: SaveSlotData[]): void {
  if (!Array.isArray(slots)) return;
  // Ensure every slot is sanitized to keep media paths only and prevent base64 bloat
  const cleanSlots: SaveSlotData[] = slots.map((s) => sanitizeDataForExport(s));
  memorySlotsCache = cleanSlots;

  // 1. Save clean data to IndexedDB
  saveSlotsToIDB(cleanSlots).catch((err) => console.warn('[SaveSlots] IDB write error:', err));

  // 2. Safely sync to browser localStorage cache for immediate synchronous retrieval
  safeLocalStorageSet(STORAGE_KEY, cleanSlots);

  // 3. Queue server-side disk sync (app_storage.json) & save individual slot files to data/saves/
  queueServerSave({ [STORAGE_KEY]: cleanSlots });
  for (const slot of cleanSlots) {
    saveSlotToServerDisk(slot).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ultra_save_slots_updated', { detail: cleanSlots }));
  }
}

/**
 * Raw read of every slot source except the caller's incoming snapshot.
 * getLocalSaveSlots() short-circuits on a non-empty memorySlotsCache, so it can
 * under-report what is actually on disk — these readers never trust a single source.
 */
function readStoredSlots(): SaveSlotData[] {
  const out: SaveSlotData[] = [];
  if (memorySlotsCache && Array.isArray(memorySlotsCache)) {
    out.push(...memorySlotsCache);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push(...parsed);
    }
  } catch (e) {
    console.warn('[SaveSlots] localStorage read notice:', e);
  }
  return out;
}

/**
 * Keeps one entry per slot id (newest updatedAt wins) so a cache/IDB/server merge
 * can never resurrect duplicate ids or drop a slot that only one source knows about.
 */
function dedupeSlotsById(slots: Array<SaveSlotData | null | undefined>): SaveSlotData[] {
  const byId = new Map<string, SaveSlotData>();
  for (const slot of slots) {
    if (!slot || typeof slot !== 'object' || !slot.id) continue;
    const id = String(slot.id);
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, slot);
      continue;
    }
    const existingAt = Number(existing.updatedAt) || 0;
    const incomingAt = Number(slot.updatedAt) || 0;
    byId.set(id, incomingAt >= existingAt ? slot : existing);
  }
  return Array.from(byId.values());
}

/**
 * Upsert the dedicated slot into the union of all known slots and immediately
 * persist it locally, returning synchronously exactly like before.
 * IMPORTANT: the previous implementation did `getLocalSaveSlots()` -> full rewrite,
 * which truncated the authoritative slot index whenever that cache was incomplete.
 */
function upsertDedicatedSlot(slot: SaveSlotData): SaveSlotData[] {
  const merged = dedupeSlotsById([slot, ...readStoredSlots()]);
  const withoutThis = merged.filter((s) => s.id !== slot.id);
  const updatedSlots = [slot, ...withoutThis];

  saveLocalSaveSlots(updatedSlots);

  // Disk/server reconciliation must never block or alter the synchronous result.
  reconcileSlotsWithServerDisk(updatedSlots).catch((e) => {
    console.warn('[SaveSlots] Server slot reconciliation notice:', e);
  });

  return updatedSlots;
}

/**
 * Compare the freshly written index against the canonical per-slot files on the
 * server (data/saves/*.json) and repair BOTH directions:
 *  - a slot file that exists on disk but is missing from the local index is added back;
 *  - a slot we hold newer than the server index is written back for that slot only.
 * It only ever adds per-slot files / rewrites the index — it never deletes a slot.
 */
async function reconcileSlotsWithServerDisk(localSlots: SaveSlotData[]): Promise<void> {
  try {
    const serverSlots = await fetchServerSaves();
    if (!Array.isArray(serverSlots) || serverSlots.length === 0) return;

    const localById = new Map<string, SaveSlotData>();
    localSlots.forEach((s) => {
      if (s && s.id) localById.set(String(s.id), s);
    });

    const missingOnLocal: SaveSlotData[] = [];
    const staleOnServer: SaveSlotData[] = [];

    for (const slot of serverSlots) {
      if (!slot || typeof slot !== 'object' || !slot.id) continue;
      const local = localById.get(String(slot.id));
      if (!local) {
        missingOnLocal.push(slot);
        continue;
      }
      const localAt = Number(local.updatedAt) || 0;
      const serverAt = Number(slot.updatedAt) || 0;
      if (localAt > serverAt) {
        staleOnServer.push(local);
      }
    }

    if (missingOnLocal.length === 0 && staleOnServer.length === 0) return;

    const mergedSlots = dedupeSlotsById([...localSlots, ...missingOnLocal]);
    memorySlotsCache = mergedSlots;
    saveSlotsToIDB(mergedSlots).catch(() => {});
    safeLocalStorageSet(STORAGE_KEY, mergedSlots);
    queueServerSave({ [STORAGE_KEY]: mergedSlots });

    for (const slot of [...missingOnLocal, ...staleOnServer]) {
      saveSlotToServerDisk(slot).catch(() => {});
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ultra_save_slots_updated', { detail: mergedSlots }));
    }
    console.log(
      `[SaveSlots] Reconciled with server disk: restored ${missingOnLocal.length} missing, re-pushed ${staleOnServer.length} newer slot(s).`
    );
  } catch (e) {
    console.warn('[SaveSlots] Server slot reconciliation failed (non-fatal):', e);
  }
}

/**
 * Update or create dedicated Auto-Save slot in the unified slot list (upsert + server reconciliation)
 */
export function updateDedicatedAutoSaveSlot(slotData: Omit<SaveSlotData, 'id' | 'slotNumber' | 'slotType' | 'isAutoSave'>): SaveSlotData[] {
  const isRealTime = slotData.isRealTimeSync || slotData.gameMode === 'realtime';
  const autoId = isRealTime ? 'slot_realtime_auto_save' : 'slot_auto_save';
  const defaultName = isRealTime
    ? `⚡ 现实同步自动保存 - ${slotData.heroName || '小队'} (第${slotData.dayCount || 1}天)`
    : `⚡ 自动保存 - ${slotData.heroName || '小队'} (第${slotData.dayCount || 1}天)`;

  const autoSlot: SaveSlotData = {
    ...slotData,
    id: autoId,
    slotNumber: 0,
    name: slotData.name || defaultName,
    slotType: 'auto',
    isAutoSave: true,
    isRealTimeSync: isRealTime,
    gameMode: isRealTime ? 'realtime' : 'standard',
    updatedAt: Date.now(),
  };

  return upsertDedicatedSlot(autoSlot);
}

/**
 * Update or create dedicated Quick-Save slot in the unified slot list (upsert + server reconciliation)
 */
export function updateDedicatedQuickSaveSlot(slotData: Omit<SaveSlotData, 'id' | 'slotNumber' | 'slotType' | 'isQuickSave'>): SaveSlotData[] {
  const isRealTime = slotData.isRealTimeSync || slotData.gameMode === 'realtime';
  const quickId = isRealTime ? 'slot_realtime_quick_save' : 'slot_quick_save';
  const defaultName = isRealTime
    ? `🚀 现实同步快捷存档 - ${slotData.heroName || '小队'} (第${slotData.dayCount || 1}天)`
    : `🚀 快捷存档 - ${slotData.heroName || '小队'} (第${slotData.dayCount || 1}天)`;

  const quickSlot: SaveSlotData = {
    ...slotData,
    id: quickId,
    slotNumber: 0,
    name: slotData.name || defaultName,
    slotType: 'quick',
    isQuickSave: true,
    isRealTimeSync: isRealTime,
    gameMode: isRealTime ? 'realtime' : 'standard',
    updatedAt: Date.now(),
  };

  return upsertDedicatedSlot(quickSlot);
}

interface SaveLoadManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedHero: Ultrawoman;
  heroines: Ultrawoman[];
  stats: Stats;
  dayCount: number;
  partDamage: Record<BodyPartId, number>;
  partExposure: Record<BodyPartId, number>;
  consoleEntries: ConsoleEntry[];
  logs: LogEntry[];
  scenarioConfig: ScenarioConfig;
  envTheme: EnvironmentTheme | string;
  envParamOverrides: any;
  relationshipState: RelationshipState;
  activeRelationship: RelationshipSlot;
  activeTeamIds: string[];
  targetedHeroIds: string[];
  progressMap: Record<string, any>;
  customSettings: CustomSettings;
  dayConfig: DayConfig;
  aiConfig: AiConfig;
  onLoadSaveSlot: (slot: SaveSlotData) => void;
}

export const SaveLoadManagerModal: React.FC<SaveLoadManagerModalProps> = ({
  isOpen,
  onClose,
  selectedHero,
  heroines,
  stats,
  dayCount,
  partDamage,
  partExposure,
  consoleEntries,
  logs,
  scenarioConfig,
  envTheme,
  envParamOverrides,
  relationshipState,
  activeRelationship,
  activeTeamIds,
  targetedHeroIds,
  progressMap,
  customSettings,
  dayConfig,
  aiConfig,
  onLoadSaveSlot,
}) => {
  const [slots, setSlots] = useState<SaveSlotData[]>([]);
  const [activeTab, setActiveTab] = useState<'save' | 'load'>('save');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [newSlotName, setNewSlotName] = useState<string>('');
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingSlotName, setEditingSlotName] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmOverwriteId, setConfirmOverwriteId] = useState<string | null>(null);

  // Load existing slots on open & sync with IndexedDB
  useEffect(() => {
    if (isOpen) {
      const existing = getLocalSaveSlots();
      setSlots(existing);
      loadSaveSlotsAsync().then((idbSlots) => {
        if (Array.isArray(idbSlots)) {
          setSlots(idbSlots);
        }
      }).catch((e) => console.warn('[SaveLoadManagerModal] loadSaveSlotsAsync notice:', e));
      setNewSlotName(`${selectedHero.name} - 第${dayCount}天 (${scenarioConfig.name ? scenarioConfig.name.split(' ')[1] || scenarioConfig.name : '剧情进度'})`);
      setFeedbackMsg(null);
      setConfirmDeleteId(null);
      setConfirmOverwriteId(null);
    }

    const handleSlotUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setSlots(e.detail);
      }
    };

    window.addEventListener('ultra_save_slots_updated', handleSlotUpdate);
    return () => window.removeEventListener('ultra_save_slots_updated', handleSlotUpdate);
  }, [isOpen, selectedHero.name, dayCount, scenarioConfig.name]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 3000);
  };

  // Create current state snapshot
  const buildCurrentSnapshot = (customName?: string): SaveSlotData => {
    const teamHeroNames = heroines
      .filter((h) => activeTeamIds.includes(h.id))
      .map((h) => h.name.split(' ')[0]);

    const nextSlotNum = slots.length > 0 ? Math.max(...slots.map((s) => s.slotNumber || 1)) + 1 : 1;

    return {
      id: `save_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      slotNumber: nextSlotNum,
      name:
        customName?.trim() ||
        `${selectedHero.name.split(' ')[0]} - 第${dayCount}天 [${scenarioConfig.name ? scenarioConfig.name.split(' ')[1] || scenarioConfig.name : '进度'}]`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      heroId: selectedHero.id,
      heroName: selectedHero.name,
      heroColor: selectedHero.colorTheme?.primary || '#3b82f6',
      dayCount,
      stats: { ...stats },
      scenarioName: scenarioConfig.name,
      relationshipTitle: activeRelationship.title,
      teamCount: activeTeamIds.length,
      teamHeroNames,
      activeTeamIds: [...activeTeamIds],
      targetedHeroIds: [...targetedHeroIds],
      progressMap: JSON.parse(JSON.stringify(progressMap)),
      partDamage: { ...partDamage },
      partExposure: { ...partExposure },
      consoleEntries: JSON.parse(JSON.stringify(consoleEntries)),
      logs: JSON.parse(JSON.stringify(logs)),
      scenarioConfig: JSON.parse(JSON.stringify(scenarioConfig)),
      envTheme,
      envParamsOverride: envParamOverrides ? JSON.parse(JSON.stringify(envParamOverrides)) : undefined,
      relationshipState: JSON.parse(JSON.stringify(relationshipState)),
      customSettings: JSON.parse(JSON.stringify(customSettings)),
      dayConfig: JSON.parse(JSON.stringify(dayConfig)),
      aiConfig: JSON.parse(JSON.stringify(aiConfig)),
    };
  };

  // Save to new slot
  const handleCreateNewSave = () => {
    ultraAudio.playUiClick();
    const newSave = buildCurrentSnapshot(newSlotName);
    const updated = [newSave, ...slots];
    setSlots(updated);
    saveLocalSaveSlots(updated);

    try {
      const currentProgress = {
        heroId: selectedHero.id,
        dayCount,
        stats: { ...stats },
        partDamage: { ...partDamage },
        partExposure: { ...partExposure },
        consoleEntries: [...consoleEntries],
        logs: [...logs],
        envTheme,
        scenarioConfig,
        relationshipState,
        activeRelationship,
        lastUpdated: Date.now(),
      };
      const pMap = { ...progressMap, [selectedHero.id]: currentProgress };
      localStorage.setItem('ultra_progress_map_v2', JSON.stringify(pMap));
      localStorage.setItem('ultra_last_selected_hero_id_v1', selectedHero.id);
      if (consoleEntries && consoleEntries.length > 0) {
        localStorage.setItem('ultra_chat_entries_v2_' + selectedHero.id, JSON.stringify(consoleEntries));
        localStorage.setItem('ultra_current_chat_entries_v2', JSON.stringify(consoleEntries));
      }
      queueServerSave({
        ultra_progress_map_v2: pMap,
        ['ultra_chat_entries_v2_' + selectedHero.id]: consoleEntries,
        ultra_current_chat_entries_v2: consoleEntries,
        ultra_game_save_slots_v1: updated,
      });
    } catch (e) {
      console.warn('Failed to sync progress on new save:', e);
    }

    showFeedback('success', `💾 成功新建存档【${newSave.name}】！刷新页面将完整保留此进度与槽位。`);
    ultraAudio.playApiReplyChime();
    setNewSlotName(`${selectedHero.name} - 第${dayCount}天 [${new Date().toLocaleTimeString('zh-CN', { hour12: false })}]`);
  };

  // Overwrite existing slot
  const handleOverwriteSave = (targetSlot: SaveSlotData) => {
    ultraAudio.playUiClick();
    const newSave = buildCurrentSnapshot(targetSlot.name);
    newSave.id = targetSlot.id;
    newSave.slotNumber = targetSlot.slotNumber;
    newSave.createdAt = targetSlot.createdAt;
    newSave.updatedAt = Date.now();

    const updated = slots.map((s) => (s.id === targetSlot.id ? newSave : s));
    setSlots(updated);
    saveLocalSaveSlots(updated);

    try {
      const currentProgress = {
        heroId: selectedHero.id,
        dayCount,
        stats: { ...stats },
        partDamage: { ...partDamage },
        partExposure: { ...partExposure },
        consoleEntries: [...consoleEntries],
        logs: [...logs],
        envTheme,
        scenarioConfig,
        relationshipState,
        activeRelationship,
        lastUpdated: Date.now(),
      };
      const pMap = { ...progressMap, [selectedHero.id]: currentProgress };
      localStorage.setItem('ultra_progress_map_v2', JSON.stringify(pMap));
      localStorage.setItem('ultra_last_selected_hero_id_v1', selectedHero.id);
      if (consoleEntries && consoleEntries.length > 0) {
        localStorage.setItem('ultra_chat_entries_v2_' + selectedHero.id, JSON.stringify(consoleEntries));
        localStorage.setItem('ultra_current_chat_entries_v2', JSON.stringify(consoleEntries));
      }
      queueServerSave({
        ultra_progress_map_v2: pMap,
        ['ultra_chat_entries_v2_' + selectedHero.id]: consoleEntries,
        ultra_current_chat_entries_v2: consoleEntries,
        ultra_game_save_slots_v1: updated,
      });
    } catch (e) {
      console.warn('Failed to sync progress on overwrite save:', e);
    }

    setConfirmOverwriteId(null);
    showFeedback('success', `💾 已成功覆盖存档【${newSave.name}】！`);
    ultraAudio.playApiReplyChime();
  };

  // Load slot
  const handleLoadSlot = (slot: SaveSlotData) => {
    ultraAudio.playUiClick();
    try {
      onLoadSaveSlot(slot);
      ultraAudio.playApiReplyChime();
      showFeedback('success', `📂 成功读取存档【${slot.name}】！正在恢复状态...`);
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (e: any) {
      console.error('Error loading save slot:', e);
      showFeedback('error', `⚠️ 读取存档失败: ${e?.message || '数据格式异常'}`);
    }
  };

  // Delete slot
  const handleDeleteSlot = (id: string) => {
    ultraAudio.playUiClick();
    const updated = slots.filter((s) => s.id !== id);
    setSlots(updated);
    saveLocalSaveSlots(updated);
    deleteSlotFromServerDisk(id).catch(() => {});
    setConfirmDeleteId(null);
    showFeedback('success', '🗑️ 存档已安全删除。');
  };

  // Rename slot
  const handleSaveRename = (id: string) => {
    if (!editingSlotName.trim()) return;
    ultraAudio.playUiClick();
    const updated = slots.map((s) => (s.id === id ? { ...s, name: editingSlotName.trim(), updatedAt: Date.now() } : s));
    setSlots(updated);
    saveLocalSaveSlots(updated);
    setEditingSlotId(null);
    showFeedback('success', '✏️ 存档名称已更新。');
  };

  // Export single slot as JSON file
  const handleExportSlotFile = (slot: SaveSlotData) => {
    ultraAudio.playUiClick();
    const jsonStr = JSON.stringify(slot, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeHeroName = slot.heroName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    a.href = url;
    a.download = `（模拟）_SlotSave_${safeHeroName}_Day${slot.dayCount}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback('success', '📥 独立存档文件已导出至本地！');
  };

  // Import single slot from JSON file
  const handleImportSlotFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    ultraAudio.playUiClick();
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (!parsed || !parsed.stats || typeof parsed.dayCount !== 'number') {
          throw new Error('存档文件结构不正确');
        }

        const importedSlot: SaveSlotData = {
          ...parsed,
          id: `save_imported_${Date.now()}`,
          slotNumber: slots.length > 0 ? Math.max(...slots.map((s) => s.slotNumber || 1)) + 1 : 1,
          name: parsed.name ? `[导入] ${parsed.name}` : `[导入存档] ${parsed.heroName || '角色'} - 第${parsed.dayCount}天`,
          updatedAt: Date.now(),
        };

        const updated = [importedSlot, ...slots];
        setSlots(updated);
        saveLocalSaveSlots(updated);
        showFeedback('success', `✅ 成功导入存档【${importedSlot.name}】！`);
        ultraAudio.playApiReplyChime();
      } catch (err: any) {
        showFeedback('error', `❌ 导入失败：${err.message || '文件格式有误'}`);
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fadeIn font-mono">
      <div className="bg-zinc-950 border border-emerald-900/60 rounded-xl max-w-3xl w-full overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.25)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-blue-950 p-3.5 border-b border-emerald-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
              <FolderOpen className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-emerald-100 flex items-center space-x-2">
                <span>进度存档与读档管理中心 (Save & Load Manager)</span>
              </h2>
              <p className="text-[10px] text-zinc-400">
                支持多栏位即时存档、读档跳转、多角色小队状态快照与独立存档导出导入
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/60 shrink-0 text-xs font-bold">
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('save');
            }}
            className={`flex-1 py-2.5 px-4 flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'save'
                ? 'border-emerald-500 text-emerald-300 bg-emerald-950/30'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>保存当前进度 (Save Game)</span>
          </button>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('load');
            }}
            className={`flex-1 py-2.5 px-4 flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'load'
                ? 'border-blue-500 text-blue-300 bg-blue-950/30'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>读取历史存档 (Load Game - {slots.length}个存档)</span>
          </button>
        </div>

        {/* Feedback Alert Toast */}
        {feedbackMsg && (
          <div
            className={`p-2.5 text-xs font-bold flex items-center space-x-2 shrink-0 animate-fadeIn ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-b border-emerald-800/60'
                : 'bg-rose-950/80 text-rose-300 border-b border-rose-800/60'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Current State Summary Card (Header Overview) */}
        <div className="p-3 bg-zinc-900/80 border-b border-zinc-800/80 shrink-0 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5">
              <span className="text-zinc-400">当前主视角:</span>
              <span
                className="font-bold px-2 py-0.5 rounded text-white flex items-center space-x-1"
                style={{ backgroundColor: selectedHero.colorTheme?.primary || '#3b82f6' }}
              >
                <span>{selectedHero.name.split(' ')[0]}</span>
              </span>
            </div>

            <div className="flex items-center space-x-1 text-amber-300 font-bold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
              <Calendar className="w-3.5 h-3.5" />
              <span>第 {dayCount} 天</span>
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-zinc-300">
              <span>
                HP: <strong className="text-rose-400">{Math.round(stats.hp)}%</strong>
              </span>
              <span>
                能量: <strong className="text-cyan-400">{Math.round(stats.energy)}%</strong>
              </span>
              <span>
                意志: <strong className="text-amber-400">{Math.round(stats.morale)}%</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {activeTeamIds.length > 1 && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/50 flex items-center space-x-1">
                <Users className="w-3 h-3" />
                <span>战术小队共 {activeTeamIds.length} 人在场</span>
              </span>
            )}
            <label className="flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-all text-xs font-bold cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>从文件导入存档</span>
              <input type="file" accept=".json" onChange={handleImportSlotFile} className="hidden" />
            </label>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Quick Create New Slot Section (Visible in 'save' tab or top of modal) */}
          {activeTab === 'save' && (
            <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-300 flex items-center space-x-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>新建独立存档位 (Create New Save Slot)</span>
                </label>
                <span className="text-[10px] text-zinc-400">将完整记录当前全队人物、创伤度、天数与对话战报</span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newSlotName}
                  onChange={(e) => setNewSlotName(e.target.value)}
                  placeholder="输入存档备注名称，如：巡航第3天·能量过载前夕..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-black border border-emerald-900/80 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  onClick={handleCreateNewSave}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 flex items-center space-x-1.5 transition-all cursor-pointer shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>保存为新存档</span>
                </button>
              </div>
            </div>
          )}

          {/* Slots List Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-bold text-zinc-300 flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>现有存档列表 ({slots.length} 个)</span>
              </span>
              <span>提示：支持点击读取、覆盖更新、重命名与导出为独立文件</span>
            </div>

            {slots.length === 0 ? (
              <div className="p-8 text-center bg-zinc-900/40 rounded-lg border border-dashed border-zinc-800 space-y-2">
                <FolderOpen className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">暂无任何游戏存档记录</p>
                <p className="text-[11px] text-zinc-500">点击上方“保存为新存档”或从本地文件导入即可开始使用！</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {slots.map((slot, index) => {
                  const isSelected = selectedSlotId === slot.id;
                  const isEditing = editingSlotId === slot.id;
                  const isConfirmingDelete = confirmDeleteId === slot.id;
                  const isConfirmingOverwrite = confirmOverwriteId === slot.id;
                  const formattedTime = new Date(slot.updatedAt || slot.createdAt).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-900/90 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                          : 'bg-zinc-900/50 hover:bg-zinc-900/80 border-zinc-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        {/* Left Info */}
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-[10px] text-zinc-400 font-bold border border-zinc-700">
                              #{index + 1}
                            </span>

                            {isEditing ? (
                              <div
                                className="flex items-center space-x-1.5 flex-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="text"
                                  value={editingSlotName}
                                  onChange={(e) => setEditingSlotName(e.target.value)}
                                  className="px-2 py-0.5 rounded bg-black border border-blue-500 text-xs text-white flex-1"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveRename(slot.id)}
                                  className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setEditingSlotId(null)}
                                  className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1.5 truncate">
                                <span className="font-bold text-xs text-zinc-100 truncate group-hover:text-emerald-300">
                                  {slot.name}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    ultraAudio.playUiClick();
                                    setEditingSlotId(slot.id);
                                    setEditingSlotName(slot.name);
                                  }}
                                  className="p-0.5 rounded text-zinc-500 hover:text-blue-300 transition-colors"
                                  title="重命名存档"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Snapshot tags */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400">
                            <span
                              className="px-1.5 py-0.2 rounded text-white font-bold"
                              style={{ backgroundColor: slot.heroColor || '#3b82f6' }}
                            >
                              {slot.heroName.split(' ')[0]}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 font-bold">
                              第 {slot.dayCount} 天
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                              HP: <strong className="text-rose-400">{Math.round(slot.stats.hp)}%</strong>
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                              能量: <strong className="text-cyan-400">{Math.round(slot.stats.energy)}%</strong>
                            </span>
                            {slot.teamCount && slot.teamCount > 1 && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
                                👥 {slot.teamCount} 人在场
                              </span>
                            )}
                            {slot.relationshipTitle && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40 truncate max-w-[150px]">
                                {slot.relationshipTitle.split(' ')[1] || slot.relationshipTitle}
                              </span>
                            )}
                            <span className="text-zinc-500 flex items-center space-x-1 ml-auto">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{formattedTime}</span>
                            </span>
                          </div>
                        </div>

                        {/* Right Action Buttons */}
                        <div
                          className="flex items-center space-x-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Load Button */}
                          <button
                            onClick={() => handleLoadSlot(slot)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center space-x-1 shadow-sm transition-all cursor-pointer"
                            title="读取此存档并恢复所有人物状态与进度"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>读取</span>
                          </button>

                          {/* Overwrite Button */}
                          {isConfirmingOverwrite ? (
                            <div className="flex items-center space-x-1 bg-amber-950/90 p-0.5 rounded border border-amber-500 animate-fadeIn">
                              <span className="text-[10px] text-amber-300 font-bold px-1">确认覆盖?</span>
                              <button
                                onClick={() => handleOverwriteSave(slot)}
                                className="px-1.5 py-1 rounded bg-amber-600 text-white text-[10px] font-bold"
                              >
                                确定
                              </button>
                              <button
                                onClick={() => setConfirmOverwriteId(null)}
                                className="px-1.5 py-1 rounded bg-zinc-800 text-zinc-300 text-[10px]"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                ultraAudio.playUiClick();
                                setConfirmOverwriteId(slot.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-amber-950/60 text-zinc-300 hover:text-amber-300 border border-zinc-700 hover:border-amber-500/50 text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer"
                              title="将当前最新状态覆盖保存至此栏位"
                            >
                              <Save className="w-3.5 h-3.5 text-amber-400" />
                              <span className="hidden sm:inline">覆盖</span>
                            </button>
                          )}

                          {/* Export file button */}
                          <button
                            onClick={() => handleExportSlotFile(slot)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-all cursor-pointer"
                            title="将此存档导出为独立 JSON 文件"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          {isConfirmingDelete ? (
                            <div className="flex items-center space-x-1 bg-rose-950/90 p-0.5 rounded border border-rose-500 animate-fadeIn">
                              <span className="text-[10px] text-rose-300 font-bold px-1">确认删除?</span>
                              <button
                                onClick={() => handleDeleteSlot(slot.id)}
                                className="px-1.5 py-1 rounded bg-rose-600 text-white text-[10px] font-bold"
                              >
                                删
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-1 rounded bg-zinc-800 text-zinc-300 text-[10px]"
                              >
                                否
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                ultraAudio.playUiClick();
                                setConfirmDeleteId(slot.id);
                                setConfirmOverwriteId(null);
                              }}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 border border-zinc-700 hover:border-rose-500/40 transition-all cursor-pointer"
                              title="删除此存档"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-zinc-900/90 p-3 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
          <div className="flex items-center space-x-2">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>所有存档数据自动保存在本地浏览器中，不受页面刷新影响。</span>
          </div>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold transition-all cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
