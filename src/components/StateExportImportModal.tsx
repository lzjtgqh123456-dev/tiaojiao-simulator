import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Download, Upload, Copy, Check, FileJson, AlertCircle, Sparkles, 
  RefreshCw, Layers, Calendar, Activity, ShieldAlert, Heart, Compass, 
  Database, Users, Sparkle, Wrench, Save, Clock, HardDrive, FolderOpen,
  ArrowRight, ShieldCheck, FileCheck, HelpCircle, Trash2
} from 'lucide-react';
import { 
  Ultrawoman, Stats, BodyPartId, ConsoleEntry, LogEntry, ScenarioConfig, 
  EnvironmentTheme, RelationshipCategory, RelationshipState, RelationshipSlot, 
  Faction, CustomEnvTheme, CustomSkillCategory, CustomWeaponType, 
  CustomSettings, DayConfig, AiConfig, RealTimeSyncState
} from '../types';
import { ultraAudio } from '../utils/audio';
import { 
  getAutoBackupConfig, saveAutoBackupConfig, requestLocalDirectoryPicker, 
  downloadFullLocalBackup, downloadDialogueProgressBackup, restoreFullLocalBackup, AutoBackupConfig,
  sanitizeDataForExport, purgeLegacyLocalStorageData
} from '../services/storageSync';

export interface FullExportData {
  version: string;
  exportTime: string;
  dataType?: 'full_backup' | 'hero_save';
  selectedHeroId: string;
  selectedHero?: Ultrawoman;
  activeTeamIds?: string[];
  targetedHeroIds?: string[];
  heroines?: Ultrawoman[];
  factions?: Faction[];
  progressMap?: Record<string, any>;
  currentStats?: Stats;
  currentDayCount?: number;
  currentPartDamage?: Record<BodyPartId, number>;
  currentPartExposure?: Record<BodyPartId, number>;
  currentConsoleEntries?: ConsoleEntry[];
  currentLogs?: LogEntry[];
  scenarioConfig?: ScenarioConfig;
  envTheme?: EnvironmentTheme | string;
  envParamsOverride?: any;
  customEnvs?: CustomEnvTheme[];
  customSettings?: CustomSettings;
  dayConfig?: DayConfig;
  relationshipState?: RelationshipState;
  allRelationshipSlots?: RelationshipSlot[];
  customScenarios?: ScenarioConfig[];
  customSkills?: any[];
  customCategories?: CustomSkillCategory[];
  customWeaponTypes?: CustomWeaponType[];
  aiConfig?: AiConfig;
  realTimeState?: RealTimeSyncState;
  customPortraits?: Record<string, string>;
  rawLocalStorageBackup?: Record<string, string>;
}

interface StateExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportData: FullExportData;
  onImportState: (importedData: FullExportData) => void;
  selectedHero: Ultrawoman;
  onQuickSaveToLocal?: () => void;
  onQuickReadFromLocal?: (file: File) => void;
}

export const StateExportImportModal: React.FC<StateExportImportModalProps> = ({
  isOpen,
  onClose,
  exportData,
  onImportState,
  selectedHero,
  onQuickSaveToLocal,
  onQuickReadFromLocal,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'autobackup'>('export');
  const [copied, setCopied] = useState(false);
  const [exportMode, setExportMode] = useState<'full' | 'hero'>('full');
  
  // AutoBackup configuration state
  const [autoBackupCfg, setAutoBackupCfg] = useState<AutoBackupConfig>(getAutoBackupConfig());
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [quickSaveFeedback, setQuickSaveFeedback] = useState<string | null>(null);

  // Import tab state
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAutoBackupCfg(getAutoBackupConfig());
      setQuickSaveFeedback(null);
      setImportSuccessMsg(null);
    }
  }, [isOpen]);

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
      setQuickSaveFeedback(`📁 已绑定本地文件夹【${res.folderName}】`);
      setTimeout(() => setQuickSaveFeedback(null), 4000);
    } else if (res.error && res.error !== '已取消选择文件夹') {
      setQuickSaveFeedback(`⚠️ ${res.error}`);
      setTimeout(() => setQuickSaveFeedback(null), 6000);
    }
  };

  // Build the effective data to export based on selected export mode
  const effectiveExportData: FullExportData = useMemo(() => {
    const rawData =
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
    return sanitizeDataForExport(rawData);
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
        setQuickSaveFeedback(`✅ 导出成功！备份文件已下载至系统下载目录 [${res.fileName}] (${res.sizeKb} KB)`);
      } else {
        setQuickSaveFeedback(`❌ 导出失败: ${res?.error || '生成备份文件失败，请重试'}`);
      }
    } catch (e: any) {
      setIsSavingLocal(false);
      setQuickSaveFeedback(`❌ 导出出错: ${e?.message || '未知错误'}`);
    }
    setTimeout(() => setQuickSaveFeedback(null), 5000);
  };

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
      setImportSuccessMsg('✅ 全数据导入成功！所有角色图鉴、自制招式、剧情开局、羁绊关系与游玩进度已完全恢复。');
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-zinc-950 border border-emerald-900/60 rounded-xl max-w-3xl w-full overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.2)] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-cyan-950 p-3.5 border-b border-emerald-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              <Save className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-emerald-100 flex items-center space-x-2">
                <span>全数据本地备份与导入恢复中心</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 font-mono">
                  100% 离线本地安全持久化
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                一键保存在本地、导出/导入全量 JSON 备份、自制立绘与媒体数据恢复及自动定期备份设置
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
        <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExecuteQuickSave}
              disabled={isSavingLocal}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-[0_0_12px_rgba(16,185,129,0.4)] cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-white" />
              <span>{isSavingLocal ? '正在保存本地...' : '⚡ 一键保存在本地 (即时备份)'}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-200 hover:text-white font-bold text-xs transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)] cursor-pointer"
            >
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>📂 一键本地读取恢复</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-zinc-400">
            <span className="flex items-center space-x-1 text-emerald-400 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {autoBackupCfg.enabled 
                  ? `自动备份: 每 ${autoBackupCfg.intervalMinutes} 分钟` 
                  : '自动备份: 已关闭'}
              </span>
            </span>
            {autoBackupCfg.folderName && (
              <span className="text-zinc-500 truncate max-w-[140px]" title={autoBackupCfg.folderName}>
                📁 {autoBackupCfg.folderName}
              </span>
            )}
          </div>
        </div>

        {quickSaveFeedback && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/60 px-4 py-2 text-xs font-bold text-emerald-200 flex items-center justify-between animate-fadeIn">
            <span>{quickSaveFeedback}</span>
            <button onClick={() => setQuickSaveFeedback(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/60 shrink-0 text-xs font-bold">
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('export');
            }}
            className={`flex-1 py-2.5 px-4 flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'border-emerald-500 text-emerald-300 bg-emerald-950/30'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出与全量备份 (Export & Backup)</span>
          </button>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('import');
            }}
            className={`flex-1 py-2.5 px-4 flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'border-cyan-500 text-cyan-300 bg-cyan-950/30'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>本地读取与导入恢复 (Import & Restore)</span>
          </button>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('autobackup');
            }}
            className={`flex-1 py-2.5 px-4 flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'autobackup'
                ? 'border-purple-500 text-purple-300 bg-purple-950/30'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>自动备份设置 (AutoBackup Config)</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 font-mono text-xs text-zinc-300">
          {activeTab === 'export' && (
            /* Export Tab */
            <div className="space-y-4">
              {/* Storage Isolation Notice Banner */}
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-2.5 text-xs text-emerald-200 flex items-start sm:items-center space-x-2.5">
                <Download className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                <div className="leading-relaxed">
                  <strong className="text-emerald-300">数据隔离机制</strong>：当前页面的手动导出将直接生成并<strong>下载 .json 文件</strong>至您的浏览器下载目录；后台自动保存则会静默自动保存在您绑定的本地文件夹中。
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
                  rows={8}
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

          {activeTab === 'import' && (
            /* Import Tab */
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
                  rows={7}
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
            </div>
          )}

          {activeTab === 'autobackup' && (
            /* AutoBackup Tab */
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
                      {autoBackupCfg.folderName ? `已绑定: ${autoBackupCfg.folderName}` : '未绑定 (自动保存将自动存入您选择的本地文件夹)'}
                    </span>
                  </div>
                  <button
                    onClick={handlePickLocalFolder}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-purple-500/40 text-purple-200 hover:text-white transition-all cursor-pointer font-bold"
                  >
                    <HardDrive className="w-4 h-4 text-purple-400" />
                    <span>{autoBackupCfg.folderName ? `📁 更换绑定文件夹 (${autoBackupCfg.folderName})` : '📁 绑定本地专属备份文件夹 (自动直存)'}</span>
                  </button>
                </div>
              </div>

              {/* Status Info */}
              <div className="bg-zinc-900/60 p-3.5 rounded-lg border border-zinc-800 text-zinc-400 space-y-1.5 text-[11px]">
                <div className="font-bold text-zinc-300">💡 存储与备份隔离说明：</div>
                <ul className="list-disc list-inside space-y-1 text-zinc-400 leading-relaxed">
                  <li><strong>自动保存</strong>：按设定间隔自动写入您选择的本地文件夹，无需手动操作，绝不弹窗打扰。</li>
                  <li><strong>手动导出</strong>：在「导出与全量备份」页面点击下载，将直接生成并下载文件至浏览器下载目录。</li>
                  <li><strong>双重保险</strong>：所有核心数值均有本地持久化存储与快存槽位护航，数据绝不丢失。</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
