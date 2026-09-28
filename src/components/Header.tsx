import React, { useState, useRef, useEffect } from 'react';
import { Ultrawoman, EnvironmentTheme, ENV_DAILY_EFFECTS, ScenarioConfig, RelationshipCategory, Stats } from '../types';
import {
  Volume2,
  VolumeX,
  Settings,
  FileText,
  Activity,
  Cpu,
  Signal,
  Plus,
  Bot,
  Calendar,
  RotateCcw,
  Sliders,
  TestTube,
  Compass,
  Heart,
  Download,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Zap,
  FolderOpen,
  Save,
  Upload,
  HardDrive,
  Clock,
  Database,
  Sparkles,
  Loader2,
  Power,
  Monitor,
  ExternalLink,
  ShieldCheck,
  Laptop,
} from 'lucide-react';
import { ultraAudio } from '../utils/audio';
import {
  getAutoBackupConfig,
  saveAutoBackupConfig,
  requestLocalDirectoryPicker,
  getSelectedDirectoryName,
  AutoBackupConfig,
} from '../services/storageSync';
import { StorageModalTab } from './UnifiedSaveManagerModal';
import { RealTimeSyncState } from '../types';

interface HeaderProps {
  heroines: Ultrawoman[];
  selectedHero: Ultrawoman;
  stats?: Stats;
  activeTeamCount?: number;
  onSelectHero: (hero: Ultrawoman) => void;
  onAddHero: () => void;
  onOpenHeroSelector?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  masterVolume?: number;
  onVolumeChange?: (v: number) => void;
  onOpenCustomizer: () => void;
  onOpenReport: () => void;
  onOpenAiConfig: () => void;
  isAiConfigEnabled?: boolean;
  onResetStats: () => void;
  isTimerBlinking: boolean;
  dayCount: number;
  onPassDay: () => void;
  onChangeDay?: (value: number, options?: { isDelta?: boolean; simulateEnv?: boolean }) => void;
  envTheme: EnvironmentTheme | string;
  onResetHeroProgress?: () => void;
  onOpenDayConfig?: () => void;
  onOpenResetConfirm?: () => void;
  onOpenEnvPanel?: () => void;
  currentScenario?: ScenarioConfig;
  onOpenScenarioModal?: () => void;
  activeRelationshipTitle?: string;
  onOpenRelationshipModal?: () => void;
  onOpenStateExportImport?: () => void;
  onOpenSaveLoadManager?: () => void;
  onOpenUnifiedSaveManager?: (initialTab?: StorageModalTab) => void;
  onQuickSaveToLocal?: () => void;
  isQuickSaving?: boolean;
  onQuickReadFromLocal?: (file: File) => void;
  realTimeState?: RealTimeSyncState;
  onOpenRealTimeModal?: () => void;
  onToggleRealTimeMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  heroines,
  selectedHero,
  stats,
  activeTeamCount,
  onSelectHero,
  onAddHero,
  onOpenHeroSelector,
  isMuted,
  onToggleMute,
  masterVolume = 0.8,
  onVolumeChange,
  onOpenCustomizer,
  onOpenReport,
  onOpenAiConfig,
  isAiConfigEnabled,
  onResetStats,
  isTimerBlinking,
  dayCount,
  onPassDay,
  onChangeDay,
  envTheme,
  onResetHeroProgress,
  onOpenDayConfig,
  onOpenResetConfirm,
  onOpenEnvPanel,
  currentScenario,
  onOpenScenarioModal,
  activeRelationshipTitle,
  onOpenRelationshipModal,
  onOpenStateExportImport,
  onOpenSaveLoadManager,
  onOpenUnifiedSaveManager,
  onQuickSaveToLocal,
  isQuickSaving,
  onQuickReadFromLocal,
  realTimeState,
  onOpenRealTimeModal,
  onToggleRealTimeMode,
}) => {
  const [isDayInputOpen, setIsDayInputOpen] = useState(false);
  const [dayInputValue, setDayInputValue] = useState(dayCount.toString());
  const [isQuickStepOpen, setIsQuickStepOpen] = useState(false);
  const [simulateEnvOnJump, setSimulateEnvOnJump] = useState(true);

  // AutoBackup Configuration & State
  const [autoBackupCfg, setAutoBackupCfg] = useState<AutoBackupConfig>(getAutoBackupConfig());
  const [isAutoBackupDropdownOpen, setIsAutoBackupDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Standalone Independent Window State
  const [isStandaloneDropdownOpen, setIsStandaloneDropdownOpen] = useState(false);
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandalone =
        (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) ||
        (window.navigator as any).standalone === true ||
        window.location.search.includes('standalone=true') ||
        (window.opener != null && window.name === 'TrainerSimApp');
      setIsStandaloneMode(!!isStandalone);
    };
    checkStandalone();
    window.addEventListener('resize', checkStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('resize', checkStandalone);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Keep state synced
  useEffect(() => {
    setAutoBackupCfg(getAutoBackupConfig());
    const interval = setInterval(() => {
      setAutoBackupCfg(getAutoBackupConfig());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
    } else if (res.error && res.error !== '已取消选择文件夹') {
      console.warn('[Header] Folder pick error:', res.error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onQuickReadFromLocal) {
      onQuickReadFromLocal(file);
    }
    if (e.target) e.target.value = '';
  };

  const openSaveManagerWithTab = (tab: StorageModalTab) => {
    ultraAudio.playUiClick();
    if (onOpenUnifiedSaveManager) {
      onOpenUnifiedSaveManager(tab);
    } else if (tab === 'slots' && onOpenSaveLoadManager) {
      onOpenSaveLoadManager();
    } else if (onOpenStateExportImport) {
      onOpenStateExportImport();
    }
  };

  const envEffect = (ENV_DAILY_EFFECTS as Record<string, any>)[envTheme] || ENV_DAILY_EFFECTS.glass;

  const handleApplyDayInput = () => {
    const val = parseInt(dayInputValue, 10);
    if (!isNaN(val) && val >= 1 && val <= 9999) {
      ultraAudio.playUiClick();
      if (onChangeDay) {
        onChangeDay(val, { isDelta: false, simulateEnv: simulateEnvOnJump });
      }
      setIsDayInputOpen(false);
    }
  };

  const handleStepDay = (delta: number, simEnv: boolean = true) => {
    ultraAudio.playUiClick();
    if (onChangeDay) {
      onChangeDay(delta, { isDelta: true, simulateEnv: simEnv });
    } else if (delta > 0) {
      onPassDay();
    }
  };

  const currentHeroStats = stats || selectedHero?.defaultStats;
  const maxHp = currentHeroStats?.maxHp || selectedHero?.defaultStats?.maxHp || 100;
  const maxEnergy = currentHeroStats?.maxEnergy || selectedHero?.defaultStats?.maxEnergy || 100;
  const maxMorale = currentHeroStats?.maxMorale || selectedHero?.defaultStats?.maxMorale || 100;
  const maxObedience = currentHeroStats?.maxObedience || selectedHero?.defaultStats?.maxObedience || 100;
  const maxShame = currentHeroStats?.maxShame || selectedHero?.defaultStats?.maxShame || 100;
  const maxLust = currentHeroStats?.maxLust || selectedHero?.defaultStats?.maxLust || 100;

  const hpPct = currentHeroStats ? Math.round(Math.max(0, Math.min(100, (currentHeroStats.hp / maxHp) * 100))) : 100;
  const energyPct = currentHeroStats ? Math.round(Math.max(0, Math.min(100, (currentHeroStats.energy / maxEnergy) * 100))) : 100;
  const moralePct = currentHeroStats ? Math.round(Math.max(0, Math.min(100, (currentHeroStats.morale / maxMorale) * 100))) : 100;
  const obediencePct = currentHeroStats ? Math.round(Math.max(0, Math.min(100, ((currentHeroStats.obedience ?? 0) / maxObedience) * 100))) : 0;
  const shamePct = currentHeroStats ? Math.round(Math.max(0, Math.min(100, ((currentHeroStats.shame ?? 0) / maxShame) * 100))) : 0;
  const lustPct = currentHeroStats ? Math.round(Math.max(0, Math.min(100, ((currentHeroStats.lust ?? 10) / maxLust) * 100))) : 10;

  return (
    <header className="bg-zinc-950/95 border-b border-zinc-800/80 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-4 py-2 text-zinc-100 shadow-2xl">
      <div className="max-w-[1750px] mx-auto flex flex-wrap items-center justify-between gap-2.5">
        {/* Left Section: Logo & System Identity */}
        <div className="flex items-center space-x-2.5">
          <div className="relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/10 border border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.3)]">
            <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 animate-pulse" />
            {isTimerBlinking && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xs sm:text-sm font-mono tracking-wider text-blue-400 font-bold uppercase">
                调教模拟器 v4.5
              </h1>
            </div>
            <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-400">
              <span className="text-zinc-400">
                目标：<strong className="text-blue-300">{selectedHero?.name ? selectedHero.name.split(' ')[0] : '目标'}</strong>
              </span>
              <span className="hidden md:inline text-zinc-600">•</span>
              <span className="hidden md:inline text-emerald-400">
                <Signal className="w-2.5 h-2.5 inline mr-0.5" /> 信号 100%
              </span>
            </div>
          </div>
        </div>

        {/* Stats Percentage Bar */}
        {currentHeroStats && (
          <div className="hidden xl:flex items-center space-x-2 bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1 font-mono text-[11px] shadow-inner">
            <span className="text-zinc-400 font-bold">全属性:</span>
            <div className="flex items-center space-x-2 font-bold text-[11px]">
              <span className="text-rose-400" title={`生命值 (HP): ${currentHeroStats.hp}/${maxHp}`}>HP {hpPct}%</span>
              <span className="text-cyan-300" title={`护盾能量: ${currentHeroStats.energy}/${maxEnergy}`}>能量 {energyPct}%</span>
              <span className="text-amber-300" title={`意志力: ${currentHeroStats.morale}/${maxMorale}`}>意志 {moralePct}%</span>
              <span className="text-blue-400" title={`服从/信任: ${currentHeroStats.obedience ?? 0}/${maxObedience}`}>服从 {obediencePct}%</span>
              <span className="text-fuchsia-300" title={`羞耻度: ${currentHeroStats.shame ?? 0}/${maxShame}`}>羞耻 {shamePct}%</span>
              <span className="text-pink-300" title={`欲望值: ${currentHeroStats.lust ?? 10}/${maxLust}`}>欲望 {lustPct}%</span>
            </div>
          </div>
        )}

        {/* Streamlined Day & Environment Control */}
        <div className={`flex items-center space-x-1.5 rounded-lg px-2 py-1 font-mono text-xs shadow-inner ${
          realTimeState?.isEnabled
            ? 'bg-blue-950/80 border border-blue-500/50 text-blue-200'
            : 'bg-zinc-900/90 border border-amber-500/30 text-amber-200'
        }`}>
          {realTimeState?.isEnabled ? (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  if (onOpenRealTimeModal) onOpenRealTimeModal();
                }}
                title="现实时间同步运行中：时间与现实客观时间对齐。点击管理现实模式"
                className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-blue-900/60 hover:bg-blue-800/80 text-blue-200 font-bold border border-blue-400/40 shadow-[0_0_10px_rgba(59,130,246,0.3)] cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-blue-300 animate-pulse" />
                <span>第 <strong className="text-white underline decoration-dotted">{dayCount}</strong> 天 (现实同步)</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  ultraAudio.playUiClick();
                  if (onToggleRealTimeMode) {
                    onToggleRealTimeMode();
                  }
                }}
                title="点击立即退出现实时间同步，切回自由步进天数模拟模式"
                className="px-1.5 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white font-bold text-[10px] border border-rose-500/40 cursor-pointer transition-colors flex items-center gap-1"
              >
                <Power className="w-3 h-3 text-rose-400" />
                <span>切回标准</span>
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleStepDay(-1, simulateEnvOnJump)}
                disabled={dayCount <= 1}
                title={dayCount <= 1 ? "已是第 1 天" : "回退 1 天"}
                className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-amber-400 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {isDayInputOpen ? (
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="1"
                    max="9999"
                    value={dayInputValue}
                    onChange={(e) => setDayInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyDayInput();
                      if (e.key === 'Escape') setIsDayInputOpen(false);
                    }}
                    autoFocus
                    className="w-12 px-1 py-0.5 bg-zinc-950 border border-amber-400 text-amber-300 font-bold text-xs rounded text-center outline-none"
                  />
                  <button
                    onClick={handleApplyDayInput}
                    className="p-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setDayInputValue(dayCount.toString());
                    setIsDayInputOpen(true);
                  }}
                  title="点击输入天数快速跳转"
                  className="flex items-center space-x-1 text-amber-400 font-bold px-1 rounded hover:bg-amber-500/10 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>第 <strong className="text-amber-300 underline decoration-dotted">{dayCount}</strong> 天</span>
                </button>
              )}

              <button
                onClick={() => handleStepDay(1, true)}
                title="下一天 (+1天)"
                className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Quick Steps & Environment Combined */}
              <div className="relative">
                <button
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setIsQuickStepOpen(!isQuickStepOpen);
                  }}
                  className="flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] cursor-pointer"
                >
                  <span>快调</span>
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </button>

                {isQuickStepOpen && (
                  <div
                    className="absolute left-0 top-full mt-1 w-56 bg-zinc-950 border border-amber-500/50 rounded-xl p-2.5 shadow-2xl z-50 backdrop-blur-md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold mb-2 pb-1 border-b border-zinc-800">
                      <span>天数任意跳转</span>
                      <button onClick={() => setIsQuickStepOpen(false)} className="text-zinc-500 hover:text-white">✕</button>
                    </div>
                    <div className="space-y-1.5 text-[10px]">
                      <div className="grid grid-cols-4 gap-1">
                        {[-1, -3, -7, -30].map((d) => (
                          <button
                            key={d}
                            disabled={dayCount + d < 1}
                            onClick={() => {
                              handleStepDay(d, false);
                              setIsQuickStepOpen(false);
                            }}
                            className="py-1 rounded bg-zinc-900 text-rose-300 hover:bg-zinc-800 disabled:opacity-30 font-bold"
                          >
                            {d}天
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[1, 3, 7, 30].map((d) => (
                          <button
                            key={d}
                            onClick={() => {
                              handleStepDay(d, simulateEnvOnJump);
                              setIsQuickStepOpen(false);
                            }}
                            className="py-1 rounded bg-zinc-900 text-amber-300 hover:bg-zinc-800 font-bold"
                          >
                            +{d}天
                          </button>
                        ))}
                      </div>
                    </div>
                    {onOpenDayConfig && (
                      <button
                        onClick={() => {
                          setIsQuickStepOpen(false);
                          onOpenDayConfig();
                        }}
                        className="w-full mt-2 pt-1.5 border-t border-zinc-800 text-left text-zinc-400 hover:text-amber-300 text-[10px]"
                      >
                        ⚙️ 天数阶段与心理设置...
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Combined Environment Badge */}
          {onOpenEnvPanel && (
            <button
              onClick={() => {
                ultraAudio.playUiClick();
                onOpenEnvPanel();
              }}
              title="收容环境与每日体蚀结算设置"
              className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold cursor-pointer transition-all ml-1"
            >
              <TestTube className="w-3 h-3 text-cyan-400" />
              <span>{envEffect.name}</span>
            </button>
          )}
        </div>

        {/* Hero Selector Button */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              if (onOpenHeroSelector) onOpenHeroSelector();
            }}
            title="点击打开全角色图鉴与切换控制台"
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900/90 border border-blue-500/50 text-blue-200 hover:text-white transition-all shadow-[0_0_10px_rgba(59,130,246,0.2)] cursor-pointer font-mono"
          >
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_8px_currentColor]"
              style={{ backgroundColor: selectedHero?.colorTheme?.primary || '#3b82f6' }}
            />
            <span className="text-xs font-bold text-zinc-100">
              {selectedHero?.name ? selectedHero.name.split(' ')[0] : '选择角色'}
            </span>
            <Users className="w-3.5 h-3.5 text-blue-400 ml-0.5" />
          </button>

          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onAddHero();
            }}
            title="新建角色槽位"
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-blue-950/80 border border-zinc-800 hover:border-blue-500/40 text-blue-300 hover:text-white transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Section: Streamlined Action Controls */}
        <div className="flex items-center space-x-1.5 font-mono text-xs">
          {/* Mute Button */}
          <button
            onClick={onToggleMute}
            title={isMuted ? '取消静音' : '静音音效'}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isMuted
                ? 'bg-red-950/40 border-red-800/60 text-red-400'
                : 'bg-zinc-900 border-zinc-800 text-blue-400 hover:border-blue-500/40'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Volume Slider */}
          {onVolumeChange && (
            <div className="hidden sm:flex items-center gap-1.5 px-1.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900/90" title={`主音量：${Math.round(masterVolume * 100)}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(masterVolume * 100)}
                onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
                className="w-16 h-1 accent-blue-500 cursor-pointer"
              />
              <span className="text-[10px] text-zinc-500 w-7 text-center tabular-nums">{Math.round(masterVolume * 100)}</span>
            </div>
          )}

          {/* Hero Recovery Group: 满血 + 重置 (Unified Pair) */}
          <div className="inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900/90 overflow-hidden shadow-inner">
            <button
              onClick={onResetStats}
              title="满血充能：仅恢复HP与能量值"
              className="flex items-center space-x-1 px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 transition-all text-[11px] font-bold cursor-pointer border-r border-zinc-800"
            >
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>满血</span>
            </button>
            {onResetHeroProgress && (
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  if (onOpenResetConfirm) {
                    onOpenResetConfirm();
                  } else {
                    onResetHeroProgress();
                  }
                }}
                title={activeTeamCount && activeTeamCount > 1 ? "一键重置全队数值与天数" : "一键重置当前角色数值与天数"}
                className="flex items-center space-x-1 px-2 py-1 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 transition-all text-[11px] font-bold cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-amber-400" />
                <span>重置</span>
              </button>
            )}
          </div>

          {/* ========================================================= */}
          {/* 🌟 核心：存档、备份与醒目的「自动保存」组件 🌟 */}
          {/* ========================================================= */}
          <div className="inline-flex items-center rounded-lg border border-emerald-500/70 bg-emerald-950/80 shadow-[0_0_12px_rgba(16,185,129,0.3)] overflow-hidden">
            {/* 1. 一键保存在本地 */}
            {onQuickSaveToLocal && (
              <button
                onClick={() => {
                  if (!isQuickSaving) {
                    ultraAudio.playUiClick();
                    onQuickSaveToLocal();
                  }
                }}
                disabled={isQuickSaving}
                title="一键保存：立即持久化保存所有角色、立绘、招式设定与存档至本地与服务器，并更新快存槽位与备份"
                className={`flex items-center space-x-1 px-2.5 py-1 bg-emerald-900/90 hover:bg-emerald-800 text-emerald-200 hover:text-white transition-all text-[11px] font-bold cursor-pointer border-r border-emerald-600/50 ${
                  isQuickSaving ? 'opacity-75 cursor-wait' : ''
                }`}
              >
                {isQuickSaving ? (
                  <Loader2 className="w-3.5 h-3.5 text-emerald-300 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>{isQuickSaving ? '正在保存...' : '一键保存'}</span>
              </button>
            )}

            {/* 1.1 快捷本地导入 */}
            {onQuickReadFromLocal && (
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  fileInputRef.current?.click();
                }}
                title="快捷导入本地备份或存档文件 (.json)"
                className="flex items-center space-x-1 px-2 py-1 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all text-[11px] font-bold cursor-pointer border-r border-emerald-600/50"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>导入</span>
              </button>
            )}

            {/* 2. 🌟 极显眼的「自动保存」状态按钮 🌟 */}
            <div className="relative border-r border-emerald-600/50">
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsAutoBackupDropdownOpen(!isAutoBackupDropdownOpen);
                }}
                title="自动保存状态控制器：点击快速开关、切换时间间隔或配置专属备份文件夹"
                className={`flex items-center space-x-1 px-2.5 py-1 transition-all text-[11px] font-bold cursor-pointer ${
                  autoBackupCfg.enabled
                    ? 'bg-purple-950/90 hover:bg-purple-900 text-purple-200'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400'
                }`}
              >
                <Clock className={`w-3.5 h-3.5 ${autoBackupCfg.enabled ? 'text-purple-400 animate-pulse' : 'text-zinc-500'}`} />
                <span>自动保存: {autoBackupCfg.enabled ? `${autoBackupCfg.intervalMinutes}m` : '关'}</span>
                {autoBackupCfg.enabled && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping ml-0.5"></span>
                )}
                <ChevronDown className="w-2.5 h-2.5 ml-0.5 opacity-70" />
              </button>

              {/* Quick AutoBackup Dropdown */}
              {isAutoBackupDropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-64 bg-zinc-950 border border-purple-500/60 rounded-xl p-3 shadow-2xl z-50 backdrop-blur-md animate-fadeIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-purple-300 pb-2 border-b border-zinc-800">
                    <span className="flex items-center space-x-1.5">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span>🕒 自动定期保存设置</span>
                    </span>
                    <button
                      onClick={() => setIsAutoBackupDropdownOpen(false)}
                      className="text-zinc-500 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="py-2.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-300 font-bold">开启自动备份：</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoBackupCfg.enabled}
                          onChange={(e) => handleUpdateAutoBackup({ enabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    {/* Scope Selector */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-400 font-bold">自动保存范围：</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => handleUpdateAutoBackup({ scope: 'dialogue' })}
                          className={`py-1 px-1.5 rounded text-[10px] font-bold text-center transition-all ${
                            autoBackupCfg.scope !== 'full'
                              ? 'bg-purple-600 text-white shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                          title="仅自动保存当前对话记录与审讯战况（轻量高效）"
                        >
                          💬 当前对话进度
                        </button>
                        <button
                          onClick={() => handleUpdateAutoBackup({ scope: 'full' })}
                          className={`py-1 px-1.5 rounded text-[10px] font-bold text-center transition-all ${
                            autoBackupCfg.scope === 'full'
                              ? 'bg-purple-600 text-white shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                          title="自动保存全量世界观、招式与角色库"
                        >
                          🌐 全量世界观
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-400">备份触发周期：</span>
                      <div className="grid grid-cols-4 gap-1">
                        {[5, 10, 20, 30].map((m) => (
                          <button
                            key={m}
                            onClick={() => handleUpdateAutoBackup({ intervalMinutes: m })}
                            className={`py-1 rounded text-[10px] font-bold transition-all ${
                              autoBackupCfg.intervalMinutes === m
                                ? 'bg-purple-600 text-white shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {m}分
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handlePickLocalFolder}
                      className="w-full mt-1 py-1 px-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-purple-500/40 text-purple-300 text-[10px] font-bold flex items-center justify-center space-x-1"
                    >
                      <HardDrive className="w-3 h-3" />
                      <span>{autoBackupCfg.folderName ? `📁 已绑定: ${autoBackupCfg.folderName}` : '📁 选择自动保存文件夹'}</span>
                    </button>

                    <div className="text-[9px] text-zinc-500 leading-tight pt-1">
                      💡 自动保存将自动保存在您选择的文件夹；手动的全数据本地备份与导出则会直接下载文件。
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsAutoBackupDropdownOpen(false);
                      openSaveManagerWithTab('autobackup');
                    }}
                    className="w-full pt-2 border-t border-zinc-800 text-center text-[10px] text-purple-400 hover:text-purple-200 font-bold"
                  >
                    打开完整数据管理中心 →
                  </button>
                </div>
              )}
            </div>

            {/* 3. 存档与数据管理中心 (All-in-One Hub) */}
            <button
              onClick={() => openSaveManagerWithTab('slots')}
              title="存档与数据中心：多栏位即时存档、读档跳转、全量 JSON 备份与恢复"
              className="flex items-center space-x-1 px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 hover:text-white transition-all text-[11px] font-bold cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>存档/备份中心</span>
            </button>
          </div>

          {/* 4. 🖥️ 独立程序 / 独立窗口模式与关闭保存保障 */}
          <div className="relative inline-flex items-center">
            <button
              onClick={() => {
                ultraAudio.playUiClick();
                setIsStandaloneDropdownOpen(!isStandaloneDropdownOpen);
              }}
              title="独立程序窗口：脱离浏览器标签页，以原生无地址栏独立窗口运行，关闭时全量自动保存"
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                isStandaloneMode
                  ? 'bg-blue-950/90 border-blue-500/80 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.35)]'
                  : 'bg-zinc-900/90 hover:bg-zinc-800 border-zinc-700/80 text-zinc-300 hover:text-white'
              }`}
            >
              <Monitor className={`w-3.5 h-3.5 ${isStandaloneMode ? 'text-blue-400' : 'text-zinc-400'}`} />
              <span>{isStandaloneMode ? '独立应用窗口' : '独立窗口'}</span>
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                title="关闭即时持久化保存已激活"
              ></span>
              <ChevronDown className="w-2.5 h-2.5 opacity-70" />
            </button>

            {/* Standalone Window Dropdown Menu */}
            {isStandaloneDropdownOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-72 bg-zinc-950 border border-blue-500/60 rounded-xl p-3 shadow-2xl z-50 backdrop-blur-md animate-fadeIn"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between text-xs font-bold text-blue-300 pb-2 border-b border-zinc-800">
                  <span className="flex items-center space-x-1.5">
                    <Monitor className="w-4 h-4 text-blue-400" />
                    <span>🖥️ 独立程序与免浏览器模式</span>
                  </span>
                  <button
                    onClick={() => setIsStandaloneDropdownOpen(false)}
                    className="text-zinc-500 hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="py-2.5 space-y-2 text-xs">
                  {/* Option 1: Open popup window */}
                  {!isStandaloneMode ? (
                    <button
                      onClick={() => {
                        ultraAudio.playUiClick();
                        setIsStandaloneDropdownOpen(false);
                        const w = 1440;
                        const h = 920;
                        const left = Math.max(0, (window.screen.width - w) / 2);
                        const top = Math.max(0, (window.screen.height - h) / 2);
                        window.open(
                          window.location.origin + window.location.pathname + '?standalone=true',
                          'TrainerSimApp',
                          `popup=yes,width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
                        );
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-blue-950/80 hover:bg-blue-900/90 border border-blue-500/50 text-blue-200 font-bold transition-all text-left cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <ExternalLink className="w-4 h-4 text-blue-400 shrink-0" />
                        <div>
                          <div className="font-bold text-white text-[11px]">弹出无边框独立窗口</div>
                          <div className="text-[10px] text-blue-300 font-normal">去除所有地址栏/标签页，原生无干扰视界</div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-blue-500/30 px-1.5 py-0.5 rounded text-blue-200 font-mono">打开</span>
                    </button>
                  ) : (
                    <div className="p-2 rounded-lg bg-blue-950/60 border border-blue-500/40 text-blue-200 flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-[11px] font-bold">当前已在专属独立窗口中运行</span>
                    </div>
                  )}

                  {/* Option 2: Install as Desktop App (PWA) */}
                  {installPrompt && (
                    <button
                      onClick={async () => {
                        ultraAudio.playUiClick();
                        setIsStandaloneDropdownOpen(false);
                        try {
                          await installPrompt.prompt();
                          const choice = await installPrompt.userChoice;
                          if (choice.outcome === 'accepted') {
                            setInstallPrompt(null);
                          }
                        } catch (err) {
                          console.warn('Install prompt error:', err);
                        }
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-purple-950/70 hover:bg-purple-900 border border-purple-500/40 text-purple-200 font-bold transition-all text-left cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <Laptop className="w-4 h-4 text-purple-400 shrink-0" />
                        <div>
                          <div className="font-bold text-white text-[11px]">安装为桌面应用程序 (PWA)</div>
                          <div className="text-[10px] text-purple-300 font-normal">生成桌面图标，像单机游戏一样一键启动</div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-purple-500/30 px-1.5 py-0.5 rounded text-purple-200 font-mono">安装</span>
                    </button>
                  )}

                  {/* Feature: Standalone bat launch guidance */}
                  <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[10px] text-zinc-300 space-y-1">
                    <div className="font-bold text-zinc-200 flex items-center space-x-1">
                      <span className="text-amber-400">⚡</span>
                      <span>本地零浏览器完全独立启动：</span>
                    </div>
                    <p className="text-zinc-400 leading-relaxed">
                      直接双击根目录的 <span className="text-amber-300 font-mono font-bold">启动独立程序.bat</span> 或 <span className="text-amber-300 font-mono font-bold">start.bat</span>，将自动调用系统原生独立应用引擎（Edge / Chrome App 模式），无需浏览器即可运行！
                    </p>
                  </div>

                  {/* Status: Guaranteed Auto-Save on Close */}
                  <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[10px] text-emerald-200 space-y-1">
                    <div className="font-bold text-emerald-300 flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>每次关闭自动保存保障（已生效）：</span>
                    </div>
                    <p className="text-emerald-300/90 leading-relaxed">
                      无论是点击右上角 [X]、Alt+F4 或最小化，进度均在 0ms 内自动持久化写入本地磁盘 <span className="text-white font-mono">./data/app_storage.json</span>。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hidden File Input for One-Click Local Read */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Story & Bond Paired Group */}
          <div className="hidden lg:inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900/90 overflow-hidden shadow-inner">
            {onOpenScenarioModal && (
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  onOpenScenarioModal();
                }}
                title="切换或自定义开局剧情预设"
                className="flex items-center space-x-1 px-2 py-1 bg-purple-950/40 hover:bg-purple-900/60 text-purple-200 transition-all text-[11px] font-bold cursor-pointer border-r border-zinc-800"
              >
                <Compass className="w-3 h-3 text-purple-400 animate-spin-slow" />
                <span>剧情</span>
                {currentScenario?.name && (
                  <span className="text-[10px] text-purple-300 font-mono">
                    ({currentScenario.name.split(' ')[1] || currentScenario.name.substring(0, 4)})
                  </span>
                )}
              </button>
            )}

            {onOpenRelationshipModal && (
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  onOpenRelationshipModal();
                }}
                title="关系/羁绊状态与槽位管理"
                className="flex items-center space-x-1 px-2 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 transition-all text-[11px] font-bold cursor-pointer"
              >
                <Heart className="w-3 h-3 text-rose-400 animate-pulse" />
                <span>羁绊</span>
                {activeRelationshipTitle && (
                  <span className="text-[10px] text-rose-300 font-mono">
                    ({activeRelationshipTitle.split(' ')[1] || activeRelationshipTitle.substring(0, 4)})
                  </span>
                )}
              </button>
            )}
          </div>

          {/* System & AI Group */}
          <div className="flex items-center space-x-1">
            {/* Real-Time Sync Mode Button */}
            {onOpenRealTimeModal && (
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  onOpenRealTimeModal();
                }}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-[11px] font-mono transition-all cursor-pointer ${
                  realTimeState?.isEnabled
                    ? 'bg-blue-950/80 border-blue-500/80 text-blue-200 shadow-[0_0_10px_rgba(59,130,246,0.3)] font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-blue-400 hover:border-blue-500/50'
                }`}
                title="现实时间同步模式：开启后根据现实世界API时间与开局时间进行真实时间推演，禁用手动跳天"
              >
                <Clock className={`w-3.5 h-3.5 ${realTimeState?.isEnabled ? 'text-blue-300 animate-pulse' : 'text-blue-400'}`} />
                <span className="hidden sm:inline">{realTimeState?.isEnabled ? '现实同步:开' : '现实时间'}</span>
                {realTimeState?.isEnabled && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
                )}
              </button>
            )}

            {/* AI / API Config */}
            <button
              id="header-api-ai-config-button"
              onClick={onOpenAiConfig}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all cursor-pointer ${
                isAiConfigEnabled
                  ? 'bg-purple-950/80 border-purple-500/80 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.4)] font-bold'
                  : 'bg-zinc-900 border-zinc-700 text-purple-300 hover:border-purple-500/60 hover:text-white'
              }`}
              title="打开【API / AI设置】界面（含模型接入、破限词与现实时间感应问候）"
            >
              <Bot className={`w-3.5 h-3.5 ${isAiConfigEnabled ? 'text-purple-400 animate-pulse' : 'text-purple-400'}`} />
              <span className="font-bold tracking-tight">API / AI破限</span>
              {isAiConfigEnabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
              )}
            </button>

            {/* Customizer */}
            <button
              onClick={onOpenCustomizer}
              title="参数、弱点与字号定制"
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-purple-300 hover:text-white hover:border-purple-500/50 transition-all cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-purple-400" />
            </button>

            {/* Report Modal */}
            <button
              onClick={onOpenReport}
              title="战术评估报告"
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-rose-300 hover:text-white hover:border-rose-500/50 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
