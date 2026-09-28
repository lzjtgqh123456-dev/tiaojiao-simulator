import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  HardDrive,
  Sparkle,
  Database,
  FileCheck,
  FileJson,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
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
import {
  queueServerSave,
  deleteSlotFromServerDisk,
  getAutoBackupConfig,
  saveAutoBackupConfig,
  requestLocalDirectoryPicker,
  reconnectDirectoryHandle,
  clearSelectedDirectory,
  getDirectoryConnectionStatus,
  testWriteToSelectedDirectory,
  downloadFullLocalBackup,
  downloadDialogueProgressBackup,
  restoreFullLocalBackup,
  isInsideIframe,
  AutoBackupConfig,
  sanitizeDataForExport,
  purgeLegacyLocalStorageData,
  cancelAllPendingServerSync,
  stopAutoBackupEngine,
} from '../services/storageSync';
import { clearAllPortraitsFromIDB } from '../lib/portraitStorage';
import { clearAllSlotsFromIDB } from '../lib/slotStorage';
import { safeLocalStorageSet } from '../utils/storageUtils';
import {
  SaveSlotData,
  getLocalSaveSlots,
  loadSaveSlotsAsync,
  saveLocalSaveSlots,
  updateDedicatedAutoSaveSlot,
  updateDedicatedQuickSaveSlot,
} from './SaveLoadManagerModal';
import { FullExportData } from './StateExportImportModal';

export type StorageModalTab = 'slots' | 'export' | 'import' | 'autobackup';

interface UnifiedSaveManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: StorageModalTab;
  // Slots props
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
  realTimeState?: RealTimeSyncState;
  // Backup / Import props
  exportData: FullExportData;
  onImportState: (importedData: FullExportData) => void;
  onQuickSaveToLocal?: () => void;
  onQuickReadFromLocal?: (file: File) => void;
}

export const UnifiedSaveManagerModal: React.FC<UnifiedSaveManagerModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'slots',
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
  realTimeState,
  exportData,
  onImportState,
  onQuickSaveToLocal,
  onQuickReadFromLocal,
}) => {
  const [activeTab, setActiveTab] = useState<StorageModalTab>(initialTab);

  // Slots state
  const [slots, setSlots] = useState<SaveSlotData[]>([]);
  const [slotSubTab, setSlotSubTab] = useState<'save' | 'load'>('save');
  const [modeFilter, setModeFilter] = useState<'all' | 'standard' | 'realtime'>('all');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [newSlotName, setNewSlotName] = useState<string>('');
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingSlotName, setEditingSlotName] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmOverwriteId, setConfirmOverwriteId] = useState<string | null>(null);

  // Full backup state
  const [copied, setCopied] = useState(false);
  const [exportMode, setExportMode] = useState<'full' | 'hero'>('full');
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [quickSaveFeedback, setQuickSaveFeedback] = useState<string | null>(null);

  // AutoBackup state
  const [autoBackupCfg, setAutoBackupCfg] = useState<AutoBackupConfig>(getAutoBackupConfig());

  // Import state
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExecuteWipeAll = async () => {
    setIsClearingAll(true);
    // 1. Mark global wiping flag so unload handlers, auto-save timers, and background tasks do not flush old data
    if (typeof window !== 'undefined') {
      (window as any).__isWipingAllStorage = true;
    }

    // 2. Abort all pending debounced server syncs & auto-backup interval
    try {
      cancelAllPendingServerSync();
    } catch {}
    try {
      stopAutoBackupEngine();
    } catch {}

    // 3. Clear server-side persistent files and cache
    try {
      await fetch('/api/storage/clear', { method: 'POST' });
    } catch (e) {
      console.error('Failed to clear server storage:', e);
    }

    // 4. Clear IndexedDB stores explicitly first to avoid connection locks
    try {
      await clearAllPortraitsFromIDB();
    } catch {}
    try {
      await clearAllSlotsFromIDB();
    } catch {}

    // 5. Clear browser local and session storage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}

    // 6. Delete indexedDB databases
    try {
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase('UltraPortraitDB');
        indexedDB.deleteDatabase('UltraSaveSlotsDB');
        indexedDB.deleteDatabase('UltraModelDB');
      }
    } catch (e) {}

    // 7. Clean reload into pure state
    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      const existing = getLocalSaveSlots();
      setSlots(existing);
      loadSaveSlotsAsync().then((idbSlots) => {
        if (Array.isArray(idbSlots)) {
          setSlots(idbSlots);
        }
      }).catch((e) => console.warn('[UnifiedSaveManagerModal] loadSaveSlotsAsync notice:', e));
      setNewSlotName(
        `${selectedHero?.name || '新存档'} - 第${dayCount}天 (${scenarioConfig.name ? scenarioConfig.name.split(' ')[1] || scenarioConfig.name : '剧情进度'})`
      );
      setAutoBackupCfg(getAutoBackupConfig());
      setFeedbackMsg(null);
      setQuickSaveFeedback(null);
      setConfirmDeleteId(null);
      setConfirmOverwriteId(null);
      setImportSuccessMsg(null);
    }

    const handleSlotUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setSlots(e.detail);
      }
    };

    window.addEventListener('ultra_save_slots_updated', handleSlotUpdate);
    return () => window.removeEventListener('ultra_save_slots_updated', handleSlotUpdate);
  }, [isOpen, initialTab, selectedHero?.name, dayCount, scenarioConfig.name]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 3500);
  };

  // Build current snapshot for slot saving
  const buildCurrentSnapshot = (customName?: string): SaveSlotData => {
    const teamHeroNames = heroines
      .filter((h) => activeTeamIds.includes(h.id))
      .map((h) => h.name.split(' ')[0]);

    const nextSlotNum = slots.length > 0 ? Math.max(...slots.map((s) => s.slotNumber || 1)) + 1 : 1;

    const currentHeroSnap = {
      heroId: selectedHero?.id || 'pure_blank',
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
    const effectiveProgressMap = {
      ...progressMap,
      ...(selectedHero?.id ? { [selectedHero.id]: currentHeroSnap } : {}),
    };

    return {
      id: `save_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      slotNumber: nextSlotNum,
      name:
        customName?.trim() ||
        `${selectedHero?.name ? selectedHero.name.split(' ')[0] : '角色'} - 第${dayCount}天 [${scenarioConfig.name ? scenarioConfig.name.split(' ')[1] || scenarioConfig.name : '进度'}]`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      heroId: selectedHero?.id || 'pure_blank',
      heroName: selectedHero?.name || '空白角色',
      heroColor: selectedHero?.colorTheme?.primary || '#3b82f6',
      dayCount,
      stats: { ...stats },
      scenarioName: scenarioConfig.name,
      relationshipTitle: activeRelationship.title,
      teamCount: activeTeamIds.length,
      teamHeroNames,
      activeTeamIds: [...activeTeamIds],
      targetedHeroIds: [...targetedHeroIds],
      progressMap: JSON.parse(JSON.stringify(effectiveProgressMap)),
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
      // Real-Time Mode metadata
      isRealTimeSync: !!realTimeState?.isEnabled,
      gameMode: realTimeState?.isEnabled ? 'realtime' : 'standard',
      realTimeSyncState: realTimeState ? JSON.parse(JSON.stringify(realTimeState)) : undefined,
    };
  };

  // Create new slot
  const handleCreateNewSave = () => {
    ultraAudio.playUiClick();
    const newSave = buildCurrentSnapshot(newSlotName);
    const updated = [newSave, ...slots];
    setSlots(updated);
    saveLocalSaveSlots(updated);

    // Synchronously write active hero snapshot to progressMap, chat storage and localStorage
    try {
      const currentProgress = {
        heroId: selectedHero?.id || 'pure_blank',
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
      const pMap = selectedHero?.id ? { ...progressMap, [selectedHero.id]: currentProgress } : progressMap;
      safeLocalStorageSet('ultra_progress_map_v2', pMap);
      if (selectedHero?.id) {
        safeLocalStorageSet('ultra_chat_entries_v2_' + selectedHero.id, consoleEntries);
      }
      safeLocalStorageSet('ultra_current_chat_entries_v2', consoleEntries);
      queueServerSave({
        ultra_progress_map_v2: pMap,
        ...(selectedHero?.id ? { ['ultra_chat_entries_v2_' + selectedHero.id]: consoleEntries } : {}),
        ultra_current_chat_entries_v2: consoleEntries,
        ultra_game_save_slots_v1: updated,
      });
    } catch (e) {
      console.warn('Failed to sync progress on new save:', e);
    }

    showFeedback('success', `💾 成功新建存档【${newSave.name}】！刷新页面将完整保留此进度与槽位。`);
    ultraAudio.playApiReplyChime();
    setNewSlotName(
      `${selectedHero?.name || '存档'} - 第${dayCount}天 [${new Date().toLocaleTimeString('zh-CN', { hour12: false })}]`
    );
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
        heroId: selectedHero?.id || 'pure_blank',
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
      const pMap = selectedHero?.id ? { ...progressMap, [selectedHero.id]: currentProgress } : progressMap;
      safeLocalStorageSet('ultra_progress_map_v2', pMap);
      if (selectedHero?.id) {
        safeLocalStorageSet('ultra_chat_entries_v2_' + selectedHero.id, consoleEntries);
      }
      safeLocalStorageSet('ultra_current_chat_entries_v2', consoleEntries);
      queueServerSave({
        ultra_progress_map_v2: pMap,
        ...(selectedHero?.id ? { ['ultra_chat_entries_v2_' + selectedHero.id]: consoleEntries } : {}),
        ultra_current_chat_entries_v2: consoleEntries,
        ultra_game_save_slots_v1: updated,
      });
    } catch (e) {
      console.warn('Failed to sync progress on overwrite save:', e);
    }

    setConfirmOverwriteId(null);
    showFeedback('success', `✅ 已成功覆盖更新存档【${targetSlot.name}】！`);
    ultraAudio.playApiReplyChime();
  };

  // Delete slot
  const handleDeleteSave = (id: string) => {
    ultraAudio.playUiClick();
    const updated = slots.filter((s) => s.id !== id);
    setSlots(updated);
    saveLocalSaveSlots(updated);
    deleteSlotFromServerDisk(id).catch(() => {});
    setConfirmDeleteId(null);
    if (selectedSlotId === id) setSelectedSlotId(null);
    showFeedback('success', '🗑️ 存档已成功删除！');
  };

  // Rename slot
  const handleRenameSave = (id: string) => {
    if (!editingSlotName.trim()) return;
    ultraAudio.playUiClick();
    const updated = slots.map((s) => (s.id === id ? { ...s, name: editingSlotName.trim(), updatedAt: Date.now() } : s));
    setSlots(updated);
    saveLocalSaveSlots(updated);
    setEditingSlotId(null);
    showFeedback('success', '✏️ 存档名称已更新！');
  };

  // Load slot
  const handleConfirmLoad = (slot: SaveSlotData) => {
    ultraAudio.playUiClick();
    try {
      onLoadSaveSlot(slot);
      ultraAudio.playApiReplyChime();
      showFeedback('success', `🚀 已成功载入存档【${slot.name}】！页面状态已恢复。`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e: any) {
      console.error('Error loading save slot:', e);
      showFeedback('error', `⚠️ 载入存档失败: ${e?.message || '数据格式异常'}`);
    }
  };

  // Instant Quick Save to Quick-Save Slot
  const handleQuickSaveNow = () => {
    ultraAudio.playUiClick();
    const snap = buildCurrentSnapshot(`🚀 快捷存档 - ${selectedHero?.name || '角色'} (第${dayCount}天)`);
    const updated = updateDedicatedQuickSaveSlot(snap);
    setSlots(updated);
    showFeedback('success', `🚀 快捷存档成功！已更新快捷存档位（支持 F5 快捷键快速覆写）`);
    ultraAudio.playApiReplyChime();
  };

  // Instant Auto-Save to Auto-Save Slot
  const handleTriggerAutoSaveNow = () => {
    ultraAudio.playUiClick();
    const snap = buildCurrentSnapshot(`⚡ 自动保存 - ${selectedHero?.name || '角色'} (第${dayCount}天)`);
    const updated = updateDedicatedAutoSaveSlot(snap);
    setSlots(updated);
    showFeedback('success', `⚡ 自动保存成功！已同步最新游戏数据至自动存档槽位`);
    ultraAudio.playApiReplyChime();
  };

  // Export single slot as JSON file
  const handleExportSingleSlot = (slot: SaveSlotData) => {
    ultraAudio.playUiClick();
    try {
      const jsonStr = JSON.stringify(slot, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = (slot.name || 'save_slot').replace(/[\/\\:*?"<>|]/g, '_');
      link.download = `UltraHero_Slot_${safeName}_Day${slot.dayCount}_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showFeedback('success', `📥 已成功导出单槽位存档【${slot.name}】！`);
    } catch (e: any) {
      showFeedback('error', `导出失败: ${e?.message || '未知错误'}`);
    }
  };

  // AutoBackup updates
  const handleUpdateAutoBackup = (updates: Partial<AutoBackupConfig>) => {
    const updated = saveAutoBackupConfig(updates);
    setAutoBackupCfg(updated);
  };

  const handlePickLocalFolder = async () => {
    ultraAudio.playUiClick();
    const res = await requestLocalDirectoryPicker();
    if (res.success) {
      setAutoBackupCfg(getAutoBackupConfig());
      ultraAudio.playApiReplyChime();
      showFeedback('success', `📁 已成功绑定本地备份文件夹【${res.folderName}】！`);
    } else if (res.error && res.error !== '已取消选择文件夹') {
      showFeedback('error', res.error);
      setTestFolderStatus({
        testing: false,
        result: res.error,
        isError: true,
      });
    }
  };

  const handleReconnectFolder = async () => {
    ultraAudio.playUiClick();
    const res = await reconnectDirectoryHandle();
    if (res.success) {
      setAutoBackupCfg(getAutoBackupConfig());
      ultraAudio.playApiReplyChime();
      showFeedback('success', `📁 成功重新授权并连接至本地文件夹【${res.folderName}】！`);
    } else if (res.error && res.error !== '已取消选择文件夹') {
      showFeedback('error', res.error);
      setTestFolderStatus({
        testing: false,
        result: res.error,
        isError: true,
      });
    }
  };

  const [testFolderStatus, setTestFolderStatus] = useState<{
    testing: boolean;
    result?: string;
    isError?: boolean;
  } | null>(null);

  const handleTestDirectoryWrite = async () => {
    ultraAudio.playUiClick();
    setTestFolderStatus({ testing: true });
    try {
      const res = await testWriteToSelectedDirectory();
      if (res.success) {
        ultraAudio.playApiReplyChime();
        setTestFolderStatus({
          testing: false,
          result: `✅ 写入成功！已成功在目标文件夹【${res.folderName}】中直接生成测试备份文件: ${res.fileName}`,
          isError: false,
        });
      } else {
        setTestFolderStatus({
          testing: false,
          result: `❌ 文件夹写入失败: ${res.error || '未知错误'}`,
          isError: true,
        });
      }
    } catch (e: any) {
      setTestFolderStatus({
        testing: false,
        result: `❌ 测试异常: ${e?.message || '未知错误'}`,
        isError: true,
      });
    }
    setTimeout(() => {
      setTestFolderStatus(null);
    }, 7000);
  };

  const handleClearFolder = async () => {
    ultraAudio.playUiClick();
    await clearSelectedDirectory();
    setAutoBackupCfg(getAutoBackupConfig());
    showFeedback('success', '已解除本地文件夹绑定，已切换为浏览器静默持久化与下载模式。');
  };

  // Build effective JSON for backup memoized
  const effectiveExportData: FullExportData = useMemo(() => {
    const raw =
      exportMode === 'full'
        ? {
            ...exportData,
            dataType: 'full_backup' as const,
          }
        : {
            version: exportData.version,
            exportTime: exportData.exportTime,
            dataType: 'hero_save' as const,
            selectedHeroId: exportData.selectedHeroId,
            currentStats: exportData.currentStats,
            currentDayCount: exportData.currentDayCount,
            currentPartDamage: exportData.currentPartDamage,
            currentPartExposure: exportData.currentPartExposure,
            currentConsoleEntries: exportData.currentConsoleEntries,
            currentLogs: exportData.currentLogs,
            scenarioConfig: exportData.scenarioConfig,
            envTheme: exportData.envTheme,
            relationshipState: exportData.relationshipState,
          };
    return sanitizeDataForExport(raw);
  }, [exportMode, exportData]);

  const { jsonPreviewText, isTruncated, fullJsonLength } = useMemo(() => {
    if (activeTab !== 'export') {
      return { jsonPreviewText: '', isTruncated: false, fullJsonLength: 0 };
    }
    try {
      const fullStr = JSON.stringify(effectiveExportData, null, 2);
      if (fullStr.length > 25000) {
        return {
          jsonPreviewText: fullStr.slice(0, 20000) + `\n\n// ... [数据体积较大 (${Math.round(fullStr.length / 1024)} KB)，预览已智能截断以保持界面丝滑流畅。点击上方“复制 JSON”或下方“保存在本地并下载”即可获取完整备份] ...`,
          isTruncated: true,
          fullJsonLength: fullStr.length,
        };
      }
      return { jsonPreviewText: fullStr, isTruncated: false, fullJsonLength: fullStr.length };
    } catch {
      return { jsonPreviewText: '{}', isTruncated: false, fullJsonLength: 0 };
    }
  }, [activeTab, effectiveExportData]);

  const handleCopy = () => {
    ultraAudio.playUiClick();
    const fullStr = JSON.stringify(effectiveExportData, null, 2);
    navigator.clipboard.writeText(fullStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteQuickSave = async () => {
    ultraAudio.playUiClick();
    setIsSavingLocal(true);
    setQuickSaveFeedback(null);

    try {
      let res: any = null;
      if (exportMode === 'full') {
        res = await downloadFullLocalBackup(effectiveExportData, '（模拟）_FullBackup', false, true, 'download');
      } else {
        res = await downloadDialogueProgressBackup(effectiveExportData, '（模拟）_Dialogue', false, true, 'download');
      }
      setIsSavingLocal(false);
      if (res && res.success) {
        ultraAudio.playApiReplyChime();
        setQuickSaveFeedback(`✅ 导出成功！备份文件已下载至您的浏览器下载目录 [${res.fileName}] (${res.sizeKb} KB)`);
      } else {
        setQuickSaveFeedback(`❌ 导出失败: ${res?.error || '生成备份文件失败，请重试'}`);
      }
    } catch (e: any) {
      setIsSavingLocal(false);
      setQuickSaveFeedback(`❌ 导出出错: ${e?.message || '未知错误'}`);
    }
    setTimeout(() => setQuickSaveFeedback(null), 5000);
  };

  // Import text handlers with debounced validation
  const parseDebounceTimerRef = useRef<any>(null);
  const handleTextChange = (text: string) => {
    setInputText(text);
    setImportSuccessMsg(null);
    if (!text.trim()) {
      setParsedData(null);
      setParseError(null);
      return;
    }

    if (parseDebounceTimerRef.current) {
      clearTimeout(parseDebounceTimerRef.current);
    }
    parseDebounceTimerRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('无效的 JSON 数据格式，必须为合法的 JSON 对象');
        }
        setParsedData(parsed);
        setParseError(null);
      } catch (err: any) {
        setParsedData(null);
        setParseError(err.message || 'JSON 解析失败，请检查语法');
      }
    }, 200);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    ultraAudio.playUiClick();
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);

    if (onQuickReadFromLocal) {
      onQuickReadFromLocal(file);
      setImportSuccessMsg(`✅ 已通过一键本地读取加载备份文件 [${file.name}]，正在恢复所有数据...`);
      setTimeout(() => {
        onClose();
      }, 1200);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleTextChange(content);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!parsedData) return;
    ultraAudio.playApiReplyChime();

    try {
      const res = await restoreFullLocalBackup(parsedData);
      if (res.success) {
        if (onImportState) {
          onImportState(parsedData);
        }
        setImportSuccessMsg(`✅ ${res.message} 页面数据已完全重载。`);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setParseError(res.message);
      }
    } catch (err: any) {
      onImportState(parsedData);
      setImportSuccessMsg('✅ 全数据导入成功！所有角色图鉴、自制招式、剧情开局与存档已完全恢复。');
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-zinc-950 border border-emerald-800/60 rounded-2xl max-w-4xl w-full overflow-hidden shadow-[0_0_60px_rgba(16,185,129,0.25)] flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-cyan-950 p-3.5 border-b border-emerald-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.35)]">
              <FolderOpen className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-emerald-100 flex items-center space-x-2">
                <span>游戏存档与数据中心</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 font-mono">
                  All-in-One 离线持久化
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                多槽位进度存读档、一键保存在本地、全量 JSON 备份导入与自动定时备份配置
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

        {/* Quick Action Banner */}
        <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExecuteQuickSave}
              disabled={isSavingLocal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-[0_0_12px_rgba(16,185,129,0.4)] cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-white" />
              <span>{isSavingLocal ? '正在保存本地...' : '⚡ 一键保存在本地 (即时备份)'}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-200 hover:text-white font-bold text-xs transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)] cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>📂 一键本地读取</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          <div
            onClick={() => setActiveTab('autobackup')}
            className="flex items-center space-x-2 text-[11px] text-zinc-400 bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-purple-500/30 cursor-pointer hover:border-purple-500/60 transition-all"
            title="点击前往自动备份设置"
          >
            <span className="flex items-center space-x-1.5 font-mono">
              <span className={`w-2 h-2 rounded-full ${autoBackupCfg.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span className={autoBackupCfg.enabled ? 'text-emerald-300 font-bold' : 'text-zinc-500'}>
                {autoBackupCfg.enabled ? `自动备份: 每${autoBackupCfg.intervalMinutes}分钟` : '自动备份: 已关闭'}
              </span>
            </span>
            {autoBackupCfg.folderName && (
              <span className="text-zinc-400 text-[10px] truncate max-w-[120px]" title={autoBackupCfg.folderName}>
                📁 {autoBackupCfg.folderName}
              </span>
            )}
          </div>
        </div>

        {/* Global Feedback Alert */}
        {(feedbackMsg || quickSaveFeedback) && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/60 px-4 py-2 text-xs font-bold text-emerald-200 flex items-center justify-between animate-fadeIn">
            <span>{feedbackMsg?.text || quickSaveFeedback}</span>
            <button
              onClick={() => {
                setFeedbackMsg(null);
                setQuickSaveFeedback(null);
              }}
              className="text-emerald-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main 4 Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/60 shrink-0 text-xs font-bold">
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('slots');
            }}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center space-x-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'slots'
                ? 'border-emerald-500 text-emerald-300 bg-emerald-950/30'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>多槽位进度存读档</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
              {slots.length}
            </span>
          </button>

          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('export');
            }}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center space-x-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'border-emerald-500 text-emerald-300 bg-emerald-950/30'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>全数据本地备份与导出</span>
          </button>

          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('import');
            }}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center space-x-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'border-cyan-500 text-cyan-300 bg-cyan-950/30'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>本地读取与导入恢复</span>
          </button>

          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('autobackup');
            }}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center space-x-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'autobackup'
                ? 'border-purple-500 text-purple-300 bg-purple-950/30'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="flex items-center space-x-1">
              <span>自动备份 (AutoBackup)</span>
              {autoBackupCfg.enabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
              )}
            </span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 font-mono text-xs text-zinc-300">
          {/* TAB 1: SLOTS (Merged Multi-Slot & Auto-Save Hub) */}
          {activeTab === 'slots' && (() => {
            const isCurrentRealTime = !!realTimeState?.isEnabled;
            const targetAutoId = isCurrentRealTime ? 'slot_realtime_auto_save' : 'slot_auto_save';
            const targetQuickId = isCurrentRealTime ? 'slot_realtime_quick_save' : 'slot_quick_save';

            const autoSaveSlot = slots.find((s) => s.id === targetAutoId || (s.isAutoSave && (isCurrentRealTime ? s.isRealTimeSync : !s.isRealTimeSync)));
            const quickSaveSlot = slots.find((s) => s.id === targetQuickId || (s.isQuickSave && (isCurrentRealTime ? s.isRealTimeSync : !s.isRealTimeSync)));
            
            const allManualSlots = slots.filter(
              (s) => s.id !== 'slot_auto_save' && s.id !== 'slot_quick_save' && s.id !== 'slot_realtime_auto_save' && s.id !== 'slot_realtime_quick_save' && !s.isAutoSave && !s.isQuickSave && s.slotType !== 'auto' && s.slotType !== 'quick'
            );

            const manualSlots = allManualSlots.filter((s) => {
              if (modeFilter === 'all') return true;
              if (modeFilter === 'realtime') return s.isRealTimeSync || s.gameMode === 'realtime';
              if (modeFilter === 'standard') return !s.isRealTimeSync && s.gameMode !== 'realtime';
              return true;
            });

            const standardCount = allManualSlots.filter((s) => !s.isRealTimeSync && s.gameMode !== 'realtime').length;
            const realtimeCount = allManualSlots.filter((s) => s.isRealTimeSync || s.gameMode === 'realtime').length;

            return (
              <div className="space-y-4">
                {/* Fast Action Command Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-900/90 border border-emerald-900/60 shadow-lg">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleQuickSaveNow}
                      title="立即将当前战况与对话保存至快捷存档位 (F5快捷键)"
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-[0_0_12px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-200" />
                      <span>🚀 快捷存档 (F5)</span>
                    </button>

                    <button
                      onClick={() => {
                        const target = quickSaveSlot || autoSaveSlot || manualSlots[0];
                        if (target) {
                          handleConfirmLoad(target);
                        } else {
                          showFeedback('error', '暂无可供快捷读取的存档！');
                        }
                      }}
                      title="快捷载入最近的快捷存档或自动保存 (F9快捷键)"
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-all cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-cyan-200" />
                      <span>⚡ 快捷读档 (F9)</span>
                    </button>

                    <button
                      onClick={handleTriggerAutoSaveNow}
                      title="立即手动触发一次自动保存并刷新自动存档槽位"
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-[0_0_12px_rgba(168,85,247,0.3)] transition-all cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 text-purple-200" />
                      <span>⚡ 触发自动保存</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-zinc-400 flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                      模式: <strong className={isCurrentRealTime ? 'text-blue-300' : 'text-emerald-300'}>{isCurrentRealTime ? '⏳ 现实时空同步' : '🎮 标准可控时空'}</strong>
                    </span>
                    <span>当前角色：<strong className="text-emerald-300">{selectedHero.name}</strong> (第{dayCount}天)</span>
                    {autoBackupCfg.enabled && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-600/60 text-[10px] text-purple-300 flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
                        <span>自动保存 ({autoBackupCfg.intervalMinutes}m)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Mode Filter Selector Tabs */}
                <div className="flex items-center justify-between p-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
                  <div className="flex items-center space-x-1">
                    <span className="text-[11px] text-zinc-400 px-2">存档模式筛选:</span>
                    <button
                      onClick={() => setModeFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        modeFilter === 'all'
                          ? 'bg-zinc-800 text-white shadow'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                      }`}
                    >
                      🌟 全部存档 ({allManualSlots.length})
                    </button>
                    <button
                      onClick={() => setModeFilter('standard')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        modeFilter === 'standard'
                          ? 'bg-amber-950/60 border border-amber-500/50 text-amber-200 shadow'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                      }`}
                    >
                      <span>🎮 标准时空</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40">({standardCount})</span>
                    </button>
                    <button
                      onClick={() => setModeFilter('realtime')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        modeFilter === 'realtime'
                          ? 'bg-blue-950/60 border border-blue-500/50 text-blue-200 shadow'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                      }`}
                    >
                      <span>⏳ 现实同步</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40">({realtimeCount})</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-zinc-500 pr-2">现实模式与标准模式存档独立分离存放</span>
                </div>

                {/* PINNED DEDICATED SYSTEM SLOTS: Auto-Save & Quick-Save */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 1. ⚡ 自动保存 (Auto-Save) 专属卡片 */}
                  <div className="p-3.5 rounded-xl border border-purple-500/50 bg-gradient-to-br from-purple-950/40 to-zinc-950/80 shadow-[0_0_15px_rgba(168,85,247,0.15)] flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 rounded-lg bg-purple-900/60 text-purple-300 border border-purple-500/40">
                            <Clock className="w-4 h-4 text-purple-400 animate-pulse" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-purple-200 text-xs">⚡ 自动保存 (Auto-Save)</span>
                              {autoSaveSlot && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-900/80 text-purple-300 border border-purple-700/50">
                                  第{autoSaveSlot.dayCount}天
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-purple-400/80 block">
                              {autoSaveSlot
                                ? `更新于: ${new Date(autoSaveSlot.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })} · ${autoSaveSlot.heroName}`
                                : '暂无自动保存记录，系统将自动记录'}
                            </span>
                          </div>
                        </div>

                        {autoSaveSlot && (
                          <span className="text-[10px] text-zinc-400 font-mono">
                            战报 {autoSaveSlot.consoleEntries?.length || 0} 条
                          </span>
                        )}
                      </div>

                      {autoSaveSlot && (
                        <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-[10px] text-zinc-400 bg-black/40 p-2 rounded-lg border border-purple-900/40 font-mono">
                          <div>HP: <strong className="text-rose-400">{autoSaveSlot.stats.hp}%</strong></div>
                          <div>能量: <strong className="text-cyan-400">{autoSaveSlot.stats.energy}%</strong></div>
                          <div>理智: <strong className="text-purple-400">{autoSaveSlot.stats.morale}%</strong></div>
                          <div>顺从: <strong className="text-amber-400">{autoSaveSlot.stats.obedience}%</strong></div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-purple-900/40">
                      <div className="flex items-center space-x-1.5">
                        {autoSaveSlot && (
                          <button
                            onClick={() => handleConfirmLoad(autoSaveSlot)}
                            className="px-3 py-1 rounded bg-cyan-900 hover:bg-cyan-800 border border-cyan-500/60 text-cyan-100 hover:text-white text-xs font-bold transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)] cursor-pointer flex items-center space-x-1"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>⚡ 快捷读档</span>
                          </button>
                        )}
                        <button
                          onClick={handleTriggerAutoSaveNow}
                          className="px-2.5 py-1 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/60 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>更新自动保存</span>
                        </button>
                      </div>

                      {autoSaveSlot && (
                        <button
                          onClick={() => handleExportSingleSlot(autoSaveSlot)}
                          title="导出此自动存档文件"
                          className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. 🚀 快捷存档 (Quick-Save) 专属卡片 */}
                  <div className="p-3.5 rounded-xl border border-amber-500/50 bg-gradient-to-br from-amber-950/40 to-zinc-950/80 shadow-[0_0_15px_rgba(245,158,11,0.15)] flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 rounded-lg bg-amber-900/60 text-amber-300 border border-amber-500/40">
                            <Zap className="w-4 h-4 text-amber-400" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-amber-200 text-xs">🚀 快捷存档 (Quick-Save)</span>
                              {quickSaveSlot && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-900/80 text-amber-300 border border-amber-700/50">
                                  第{quickSaveSlot.dayCount}天
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-amber-400/80 block">
                              {quickSaveSlot
                                ? `更新于: ${new Date(quickSaveSlot.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })} · ${quickSaveSlot.heroName}`
                                : '暂无快捷存档，按 F5 或点击右侧保存'}
                            </span>
                          </div>
                        </div>

                        {quickSaveSlot && (
                          <span className="text-[10px] text-zinc-400 font-mono">
                            战报 {quickSaveSlot.consoleEntries?.length || 0} 条
                          </span>
                        )}
                      </div>

                      {quickSaveSlot && (
                        <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-[10px] text-zinc-400 bg-black/40 p-2 rounded-lg border border-amber-900/40 font-mono">
                          <div>HP: <strong className="text-rose-400">{quickSaveSlot.stats.hp}%</strong></div>
                          <div>能量: <strong className="text-cyan-400">{quickSaveSlot.stats.energy}%</strong></div>
                          <div>理智: <strong className="text-purple-400">{quickSaveSlot.stats.morale}%</strong></div>
                          <div>顺从: <strong className="text-amber-400">{quickSaveSlot.stats.obedience}%</strong></div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-amber-900/40">
                      <div className="flex items-center space-x-1.5">
                        {quickSaveSlot && (
                          <button
                            onClick={() => handleConfirmLoad(quickSaveSlot)}
                            className="px-3 py-1 rounded bg-cyan-900 hover:bg-cyan-800 border border-cyan-500/60 text-cyan-100 hover:text-white text-xs font-bold transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)] cursor-pointer flex items-center space-x-1"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>⚡ 快捷读档</span>
                          </button>
                        )}
                        <button
                          onClick={handleQuickSaveNow}
                          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all shadow-[0_0_10px_rgba(245,158,11,0.3)] cursor-pointer flex items-center space-x-1"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>💾 快捷保存 (F5)</span>
                        </button>
                      </div>

                      {quickSaveSlot && (
                        <button
                          onClick={() => handleExportSingleSlot(quickSaveSlot)}
                          title="导出此快捷存档文件"
                          className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. 💾 手动多槽位存档 (Manual Save Slots) */}
                <div className="bg-zinc-900/90 border border-emerald-900/50 p-3.5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-emerald-300 flex items-center space-x-1.5">
                      <Save className="w-4 h-4 text-emerald-400" />
                      <span>💾 手动保存新存档槽位</span>
                    </div>
                    <span className="text-[11px] text-zinc-400">已保存 {manualSlots.length} 个手动槽位</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newSlotName}
                      onChange={(e) => setNewSlotName(e.target.value)}
                      placeholder="输入此槽位的自定义描述名称（例如：第3天攻破防线、变身前备份...）"
                      className="flex-1 bg-black/60 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      onClick={handleCreateNewSave}
                      disabled={!newSlotName.trim()}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                      <span>保存为新槽位</span>
                    </button>
                  </div>
                </div>

                {/* Manual Slots List */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
                    <span>手动存档槽位列表 ({manualSlots.length} 个)：</span>
                    <span className="text-[11px] text-zinc-500">点击任意栏位可随时读档、覆写更新或导出单槽位</span>
                  </div>

                  {manualSlots.length === 0 ? (
                    <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center text-zinc-500 space-y-2 bg-zinc-950/40">
                      <FolderOpen className="w-10 h-10 mx-auto text-zinc-600 animate-pulse" />
                      <p className="text-xs">暂无手动保存的存档槽位</p>
                      <p className="text-[11px] text-zinc-600">输入名称并点击上方“保存为新槽位”即可创建独立的游戏进度快照</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                      {manualSlots.map((slot) => {
                        const isSelected = selectedSlotId === slot.id;
                        const isEditing = editingSlotId === slot.id;
                        const isConfirmDel = confirmDeleteId === slot.id;
                        const isConfirmOverwrite = confirmOverwriteId === slot.id;

                        return (
                          <div
                            key={slot.id}
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-zinc-900 border-emerald-500/70 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                                <div
                                  className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_8px_currentColor]"
                                  style={{ backgroundColor: slot.heroColor || '#10b981' }}
                                />
                                {isEditing ? (
                                  <div className="flex items-center space-x-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      value={editingSlotName}
                                      onChange={(e) => setEditingSlotName(e.target.value)}
                                      className="bg-black border border-emerald-500 rounded px-2 py-1 text-xs text-white flex-1 font-mono"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleRenameSave(slot.id)}
                                      className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingSlotId(null)}
                                      className="p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                      <span className="font-bold text-zinc-100 text-xs truncate">{slot.name}</span>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                                        第{slot.dayCount}天
                                      </span>
                                      {slot.isRealTimeSync || slot.gameMode === 'realtime' ? (
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950/80 border border-blue-500/50 text-blue-300 font-bold">
                                          ⏳ 现实时空同步
                                        </span>
                                      ) : (
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                                          🎮 标准时空
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 flex items-center space-x-3 mt-0.5">
                                      <span>角色: {slot.heroName}</span>
                                      <span>HP: {slot.stats?.hp ?? 100}%</span>
                                      <span>能量: {slot.stats?.energy ?? 100}%</span>
                                      <span>战报: {slot.consoleEntries?.length || 0}条</span>
                                      <span>时间: {new Date(slot.updatedAt).toLocaleString('zh-CN')}</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {/* Load Button */}
                                <button
                                  onClick={() => handleConfirmLoad(slot)}
                                  title="载入此存档"
                                  className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 hover:text-white text-xs font-bold transition-all shadow-[0_0_8px_rgba(6,182,212,0.2)] cursor-pointer flex items-center space-x-1"
                                >
                                  <FolderOpen className="w-3 h-3" />
                                  <span>读取</span>
                                </button>

                                {/* Overwrite Button */}
                                {isConfirmOverwrite ? (
                                  <button
                                    onClick={() => handleOverwriteSave(slot)}
                                    className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold animate-pulse"
                                  >
                                    确定覆盖?
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setConfirmOverwriteId(slot.id)}
                                    title="以当前最新状态覆盖此槽位"
                                    className="p-1 rounded bg-zinc-800 hover:bg-amber-950/60 hover:text-amber-300 text-zinc-400 border border-zinc-700"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Export Single Slot */}
                                <button
                                  onClick={() => handleExportSingleSlot(slot)}
                                  title="导出此槽位为独立 JSON 存档文件"
                                  className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>

                                {/* Rename */}
                                <button
                                  onClick={() => {
                                    setEditingSlotId(slot.id);
                                    setEditingSlotName(slot.name);
                                  }}
                                  title="重命名槽位"
                                  className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete */}
                                {isConfirmDel ? (
                                  <button
                                    onClick={() => handleDeleteSave(slot.id)}
                                    className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold animate-pulse"
                                  >
                                    确定删除?
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteId(slot.id)}
                                    title="删除槽位"
                                    className="p-1 rounded bg-zinc-800 hover:bg-red-950/60 hover:text-red-300 text-zinc-400 border border-zinc-700"
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
            );
          })()}

          {/* TAB 2: EXPORT & BACKUP */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Storage Isolation Notice Banner */}
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-2.5 text-xs text-emerald-200 flex items-start sm:items-center space-x-2.5">
                <Download className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                <div className="leading-relaxed">
                  <strong className="text-emerald-300">数据隔离机制</strong>：当前页面的手动导出将直接生成并<strong>下载 .json 文件</strong>至您的浏览器下载目录；后台自动保存则会静默自动保存在您所选择绑定的本地文件夹中。
                </div>
              </div>

              {/* Mode Selector */}
              <div className="flex items-center space-x-2 bg-zinc-900/90 p-1.5 rounded-lg border border-zinc-800">
                <button
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setExportMode('hero');
                  }}
                  className={`flex-1 py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    exportMode === 'hero'
                      ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Sparkle className="w-3.5 h-3.5" />
                  <span>💬 导出当前对话与战况进度 (轻量精准，不含全局世界观)</span>
                </button>
                <button
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setExportMode('full');
                  }}
                  className={`flex-1 py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    exportMode === 'full'
                      ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>🌐 全量世界观与全部数据总库 (含全部阵营/招式/全角色)</span>
                </button>
              </div>

              {/* Summary Cards */}
              <div className="bg-black/50 border border-emerald-900/40 p-3.5 rounded-lg space-y-2.5">
                <div className="text-emerald-300 font-bold flex items-center justify-between text-xs">
                  <span className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{exportMode === 'full' ? '全量数据备份概要 (Full Backup Summary)' : '单角色存档概要预览 (Hero Save Summary)'}</span>
                  </span>
                  <span className="text-[10px] text-zinc-400 font-normal">
                    v{exportData.version || '2.0'} | {new Date(exportData.exportTime).toLocaleTimeString('zh-CN')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                  <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">角色总数</span>
                    <strong className="text-emerald-300 truncate block">
                      {exportMode === 'full' ? `${exportData.heroines?.length || 1} 位全角色` : selectedHero.name}
                    </strong>
                  </div>
                  <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">自制招式/类型</span>
                    <strong className="text-amber-300 block">
                      {exportMode === 'full' ? `${exportData.customSkills?.length || 0} 招式 / ${(exportData as any).customCategories?.length || 0} 分类` : `第 ${exportData.currentDayCount || 1} 天`}
                    </strong>
                  </div>
                  <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">剧情开局 & 阵营</span>
                    <strong className="text-cyan-400 block">
                      {exportMode === 'full' ? `${exportData.customScenarios?.length || 0} 剧情 / ${exportData.factions?.length || 0} 阵营` : `HP ${exportData.currentStats?.hp ?? 100}%`}
                    </strong>
                  </div>
                  <div className="bg-zinc-900/80 p-2.5 rounded border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">关系羁绊 & 对话战报</span>
                    <strong className="text-purple-300 block">
                      {exportMode === 'full' ? `${exportData.allRelationshipSlots?.length || 0} 羁绊槽位` : `${exportData.currentConsoleEntries?.length || 0} 条战报`}
                    </strong>
                  </div>
                </div>
              </div>

              {/* JSON Textarea Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span>备份 JSON 文本内容预览：</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? '已复制' : '复制 JSON'}</span>
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={jsonPreviewText}
                  rows={6}
                  className="w-full bg-black/70 border border-zinc-800 rounded-lg p-2.5 text-[11px] text-emerald-300/90 font-mono focus:outline-none resize-none leading-relaxed select-all"
                />
              </div>

              {/* Export Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <button
                  onClick={() => {
                    ultraAudio.playUiClick();
                    const res = purgeLegacyLocalStorageData(exportData.heroines);
                    if (res.removedKeys.length > 0) {
                      ultraAudio.playApiReplyChime();
                      setQuickSaveFeedback(`🧹 已成功清理 ${res.removedKeys.length} 个历史残留键（释放约 ${(res.freedBytesEstimate / 1024).toFixed(1)} KB），旧版本数据已彻底清除！`);
                    } else {
                      setQuickSaveFeedback('✨ 您的本地存储很干净，未发现任何旧版本残留键。');
                    }
                    setTimeout(() => setQuickSaveFeedback(null), 5000);
                  }}
                  className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-300 text-xs flex items-center space-x-1.5 transition-all cursor-pointer border border-zinc-800 hover:border-amber-500/40"
                  title="扫描并删除浏览器中遗留的 V1~V4 旧版本废弃键与孤立死键，不影响当前角色与进度"
                >
                  <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>清理历史版本残留</span>
                </button>

                <button
                  onClick={handleExecuteQuickSave}
                  disabled={isSavingLocal}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {isSavingLocal
                      ? '正在生成并下载...'
                      : exportMode === 'full'
                      ? '📥 立即下载全量数据备份文件 (.json)'
                      : '📥 立即下载当前对话战报备份 (.json)'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: IMPORT & RESTORE */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* File Upload Zone */}
              <div className="border-2 border-dashed border-cyan-800/60 hover:border-cyan-500/80 bg-cyan-950/20 hover:bg-cyan-950/40 rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-2">
                <Upload className="w-8 h-8 text-cyan-400 animate-bounce" />
                <div className="text-xs font-bold text-cyan-200">
                  {selectedFileName ? `已选择文件: ${selectedFileName}` : '点击或拖拽本地备份文件 (.json) 至此'}
                </div>
                <p className="text-[11px] text-zinc-400">
                  支持由「一键保存在本地」或「全数据备份」导出的所有 JSON 备份文件
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all shadow-[0_0_10px_rgba(6,182,212,0.4)] cursor-pointer"
                >
                  浏览本地文件
                </button>
              </div>

              {/* Paste JSON section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span>或在此直接粘贴 JSON 文本：</span>
                  {parsedData && (
                    <span className="text-emerald-400 text-[11px] flex items-center space-x-1">
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>JSON 校验有效</span>
                    </span>
                  )}
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="在此粘贴包含 heroines / customSkills / progressMap 等纯净游戏数据的完整备份 JSON 数据..."
                  rows={6}
                  className={`w-full bg-black/70 border rounded-lg p-2.5 text-[11px] font-mono focus:outline-none resize-none leading-relaxed ${
                    parseError
                      ? 'border-red-500/80 text-red-300'
                      : parsedData
                      ? 'border-emerald-500/80 text-emerald-300'
                      : 'border-zinc-800 text-zinc-300 focus:border-cyan-500'
                  }`}
                />
              </div>

              {/* Error Message */}
              {parseError && (
                <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-lg text-red-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Success Message */}
              {importSuccessMsg && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-lg text-emerald-200 text-xs flex items-center space-x-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{importSuccessMsg}</span>
                </div>
              )}

              {/* Parsed Preview */}
              {parsedData && (
                <div className="p-3 bg-zinc-900/90 border border-cyan-900/50 rounded-lg space-y-2">
                  <div className="text-cyan-300 font-bold text-xs flex items-center space-x-1.5">
                    <FileJson className="w-3.5 h-3.5 text-cyan-400" />
                    <span>检测到备份数据结构：</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-black/40 p-2 rounded border border-zinc-800">
                      <span className="text-zinc-400 block text-[10px]">角色数据</span>
                      <strong className="text-cyan-200">
                        {parsedData.heroines?.length || parsedData.localStorageData?.trainer_heroines_v5?.length || '已包含'}
                      </strong>
                    </div>
                    <div className="bg-black/40 p-2 rounded border border-zinc-800">
                      <span className="text-zinc-400 block text-[10px]">自制招式</span>
                      <strong className="text-amber-300">
                        {parsedData.customSkills?.length || parsedData.localStorageData?.ultra_custom_skills_v1?.length || '已包含'}
                      </strong>
                    </div>
                    <div className="bg-black/40 p-2 rounded border border-zinc-800">
                      <span className="text-zinc-400 block text-[10px]">自制剧情 & 阵营</span>
                      <strong className="text-emerald-300">
                        {parsedData.customScenarios?.length || parsedData.localStorageData?.ultra_custom_scenarios_v1?.length || '已包含'}
                      </strong>
                    </div>
                    <div className="bg-black/40 p-2 rounded border border-zinc-800">
                      <span className="text-zinc-400 block text-[10px]">自制立绘与媒体</span>
                      <strong className="text-purple-300">
                        {parsedData.customPortraits ? `${Object.keys(parsedData.customPortraits).length} 张立绘` : '已包含'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirm Import Button */}
              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-zinc-800">
                <button
                  onClick={handleConfirmImport}
                  disabled={!parsedData}
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" />
                  <span>确认一键导入并恢复全部游戏数据</span>
                </button>
              </div>

              {/* Reset to pure initial state */}
              <div className="pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-red-950/20 p-3.5 rounded-xl border border-red-900/40">
                <div className="max-w-xl">
                  <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>彻底清空所有数据 · 制作纯净分发包</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    彻底清空服务端 data/ 存储文件（app_storage.json、saves/、backups/、portraits.json）与浏览器缓存中全部角色、存档、羁绊与对话，恢复至零角色纯净空白状态。
                  </p>
                </div>

                {!showClearConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="px-4 py-2 rounded-lg bg-red-950/90 hover:bg-red-900 text-red-200 border border-red-800/80 hover:border-red-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 shadow-lg shadow-red-950/50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>全站清空 / 纯净重置</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isClearingAll}
                      onClick={handleExecuteWipeAll}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-red-900/60 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isClearingAll ? '正在彻底清空...' : '⚠️ 确定清空全站并重载'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isClearingAll}
                      onClick={() => setShowClearConfirm(false)}
                      className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AUTOBACKUP */}
          {activeTab === 'autobackup' && (
            <div className="space-y-4 font-sans text-xs">
              <div className="bg-black/50 border border-purple-900/40 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-purple-400" />
                    <div>
                      <h3 className="font-bold text-purple-100 text-sm">自动定期备份引擎 (AutoBackup Engine)</h3>
                      <p className="text-[11px] text-zinc-400">在数据变动达到指定间隔后自动触发本地静默保存与备份</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoBackupCfg.enabled}
                      onChange={(e) => handleUpdateAutoBackup({ enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {/* Scope Selection */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-zinc-300 font-bold flex justify-between">
                    <span>自动保存内容范围：</span>
                    <span className="text-purple-400 font-mono">
                      {autoBackupCfg.scope !== 'full' ? '💬 仅当前对话与战况 (推荐)' : '🌐 全量世界观与总库'}
                    </span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleUpdateAutoBackup({ scope: 'dialogue' })}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        autoBackupCfg.scope !== 'full'
                          ? 'bg-purple-950/80 border-purple-500 text-purple-100 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center space-x-1.5 text-purple-300">
                        <span>💬 仅保存当前对话与战况进度 (推荐)</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                        极度轻量（10~50 KB），仅自动留存当前人物交互记录与战况，绝不随意打包全量世界观与全局库。
                      </p>
                    </button>

                    <button
                      onClick={() => handleUpdateAutoBackup({ scope: 'full' })}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        autoBackupCfg.scope === 'full'
                          ? 'bg-purple-950/80 border-purple-500 text-purple-100 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center space-x-1.5 text-purple-300">
                        <span>🌐 全量世界观与所有数据备份</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                        包含全角色库、所有自定义招式、全局阵营、自定义剧情以及全部角色自制立绘与媒体。
                      </p>
                    </button>
                  </div>
                </div>

                {/* Interval Selection */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-zinc-300 font-bold flex justify-between">
                    <span>备份触发间隔时间：</span>
                    <span className="text-purple-400 font-mono">{autoBackupCfg.intervalMinutes} 分钟</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {[5, 10, 20, 30].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => handleUpdateAutoBackup({ intervalMinutes: mins })}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                          autoBackupCfg.intervalMinutes === mins
                            ? 'bg-purple-900/80 border-purple-500 text-purple-100 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        每 {mins} 分钟
                      </button>
                    ))}
                  </div>
                </div>

                {/* Local Folder Binding */}
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-300 font-bold">本地目标文件夹直存：</span>
                    <span className="text-[11px] text-zinc-500">
                      {autoBackupCfg.folderName ? `已绑定: ${autoBackupCfg.folderName}` : '未绑定 (自动保存将直接保存在您选择的文件夹)'}
                    </span>
                  </div>

                  {isInsideIframe() && (
                    <div className="bg-amber-950/40 border border-amber-500/50 rounded-lg p-2.5 text-xs text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">💡</span>
                        <span>当前处于内嵌预览窗口，浏览器禁止直接访问本地磁盘文件夹。在新标签页中打开即可启用目标文件夹直存！</span>
                      </div>
                      <a
                        href={typeof window !== 'undefined' ? window.location.href : '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] whitespace-nowrap self-end sm:self-auto"
                      >
                        在新标签页打开 ↗
                      </a>
                    </div>
                  )}
                  
                  {autoBackupCfg.folderName ? (
                    <div className="bg-zinc-900/90 border border-purple-800/60 p-3 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2 text-purple-200">
                          <HardDrive className="w-4 h-4 text-purple-400" />
                          <span className="font-bold">绑定目录：{autoBackupCfg.folderName}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 border border-purple-700 text-purple-300">
                          {getDirectoryConnectionStatus() === 'connected' ? '🟢 读写授权有效' : '🟡 需授权确认'}
                        </span>
                      </div>

                      {getDirectoryConnectionStatus() === 'needs_permission' && (
                        <div className="bg-amber-950/60 border border-amber-500/60 rounded p-2 text-xs text-amber-200 flex items-center justify-between">
                          <span>⚡ 浏览器要求重新激活授权以支持后台静默直存</span>
                          <button
                            onClick={handleReconnectFolder}
                            className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold cursor-pointer"
                          >
                            点击一键激活
                          </button>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          onClick={handleReconnectFolder}
                          className="flex-1 py-1.5 px-2.5 rounded bg-purple-900/70 hover:bg-purple-800 border border-purple-500/60 text-purple-100 text-[11px] font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>验证 / 重新授权文件夹</span>
                        </button>
                        <button
                          onClick={handleTestDirectoryWrite}
                          disabled={testFolderStatus?.testing}
                          className="py-1.5 px-2.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-200 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                        >
                          <Zap className="w-3 h-3 text-emerald-400" />
                          <span>{testFolderStatus?.testing ? '测试中...' : '🧪 测试写入'}</span>
                        </button>
                        <button
                          onClick={handlePickLocalFolder}
                          className="py-1.5 px-2.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[11px] font-bold transition-all cursor-pointer"
                        >
                          更换
                        </button>
                        <button
                          onClick={handleClearFolder}
                          className="py-1.5 px-2.5 rounded bg-red-950/60 hover:bg-red-900/80 border border-red-800/60 text-red-300 text-[11px] font-bold transition-all cursor-pointer"
                        >
                          解除绑定
                        </button>
                      </div>

                      {testFolderStatus && (
                        <div
                          className={`p-2 rounded text-xs border ${
                            testFolderStatus.isError
                              ? 'bg-red-950/60 border-red-800/80 text-red-200'
                              : 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
                          }`}
                        >
                          {testFolderStatus.result || '正在执行测试文件写入...'}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={handlePickLocalFolder}
                        className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-purple-500/40 text-purple-200 hover:text-white transition-all cursor-pointer font-bold"
                      >
                        <HardDrive className="w-4 h-4 text-purple-400" />
                        <span>📁 绑定本地专属备份文件夹 (自动直存)</span>
                      </button>

                      {testFolderStatus && (
                        <div
                          className={`p-2.5 rounded text-xs border leading-relaxed ${
                            testFolderStatus.isError
                              ? 'bg-red-950/60 border-red-800/80 text-red-200'
                              : 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
                          }`}
                        >
                          {testFolderStatus.result}
                        </div>
                      )}

                      <p className="text-[11px] text-zinc-500 text-center">
                        选择绑定本地专属文件夹后，系统自动保存将自动静默存入该文件夹（无弹窗打扰）。手动的全数据本地备份与导出则会直接下载 .json 文件。
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Info */}
              <div className="bg-zinc-900/60 p-3.5 rounded-lg border border-zinc-800 text-zinc-400 space-y-1.5 text-[11px]">
                <div className="font-bold text-zinc-300">💡 自动备份机制说明：</div>
                <ul className="list-disc list-inside space-y-1 text-zinc-400 leading-relaxed">
                  <li>仅在您对角色数值、招式、剧情预设或存档进行过改动（产生脏数据）时才会自动触发。</li>
                  <li>触发时将在页面右下角给出轻量静默提示，完全不影响您的正常浏览与游玩。</li>
                  <li>导出的备份文件可通过「一键本地读取」或「导入恢复」随时无损复原。</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
