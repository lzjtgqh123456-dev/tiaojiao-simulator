import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Zap,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  MessageSquare,
  Shield,
  Heart,
  Timer,
  Play,
  Pause,
  Info,
  Bot,
  ArrowRight,
} from 'lucide-react';
import { Ultrawoman, ScenarioConfig } from '../types';
import {
  RealTimeSyncState,
  RealTimeContextInfo,
  getRealTimeContext,
  formatRealTimeDuration,
  DEFAULT_REAL_TIME_STATE,
} from '../utils/realTimeUtils';
import { ultraAudio } from '../utils/audio';

interface RealTimeModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  realTimeState: RealTimeSyncState;
  onUpdateRealTimeState: (newState: RealTimeSyncState) => void;
  selectedHero: Ultrawoman;
  scenarioConfig?: ScenarioConfig;
  onTriggerRealTimeGreeting?: () => void;
  onOpenAiConfig?: () => void;
}

export const RealTimeModeModal: React.FC<RealTimeModeModalProps> = ({
  isOpen,
  onClose,
  realTimeState,
  onUpdateRealTimeState,
  selectedHero,
  scenarioConfig,
  onTriggerRealTimeGreeting,
  onOpenAiConfig,
}) => {
  const [context, setContext] = useState<RealTimeContextInfo>(() => getRealTimeContext(realTimeState));
  const [confirmToggle, setConfirmToggle] = useState<boolean>(false);

  // Live timer tick every 1 second
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setContext(getRealTimeContext(realTimeState));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, realTimeState]);

  if (!isOpen) return null;

  const handleToggleMode = () => {
    ultraAudio.playUiClick();
    if (!realTimeState.isEnabled) {
      // Enabling Real-Time Sync Mode
      const now = Date.now();
      const updated: RealTimeSyncState = {
        isEnabled: true,
        firstCreatedTimestamp: realTimeState.firstCreatedTimestamp || now,
        lastVisitedTimestamp: now,
        initialRealDateStr: realTimeState.initialRealDateStr || new Date().toISOString().split('T')[0],
      };
      onUpdateRealTimeState(updated);
      setContext(getRealTimeContext(updated));
      ultraAudio.playApiReplyChime();
    } else {
      // Disabling Real-Time Sync Mode
      const updated: RealTimeSyncState = {
        ...realTimeState,
        isEnabled: false,
        lastVisitedTimestamp: Date.now(),
      };
      onUpdateRealTimeState(updated);
      setContext(getRealTimeContext(updated));
    }
    setConfirmToggle(false);
  };

  const handleResetStartDate = () => {
    ultraAudio.playUiClick();
    const now = Date.now();
    const updated: RealTimeSyncState = {
      isEnabled: true,
      firstCreatedTimestamp: now,
      lastVisitedTimestamp: now,
      initialRealDateStr: new Date().toISOString().split('T')[0],
    };
    onUpdateRealTimeState(updated);
    setContext(getRealTimeContext(updated));
    ultraAudio.playApiReplyChime();
  };

  const renderPeriodIcon = () => {
    const period = context.timePeriod;
    if (period.includes('清晨') || period.includes('破晓')) {
      return <Sunrise className="w-5 h-5 text-amber-400 animate-pulse" />;
    } else if (period.includes('正午') || period.includes('上午') || period.includes('午后')) {
      return <Sun className="w-5 h-5 text-amber-300 animate-spin-slow" />;
    } else if (period.includes('傍晚') || period.includes('黄昏')) {
      return <Sunset className="w-5 h-5 text-orange-400 animate-pulse" />;
    } else {
      return <Moon className="w-5 h-5 text-indigo-400 animate-pulse" />;
    }
  };

  const firstDateStr = realTimeState.firstCreatedTimestamp
    ? new Date(realTimeState.firstCreatedTimestamp).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '今天';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-blue-500/40 rounded-2xl shadow-[0_0_50px_rgba(59,130,246,0.2)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-blue-950/90 via-indigo-950/80 to-zinc-950 border-b border-blue-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/50 flex items-center justify-center text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
              <Clock className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider text-blue-200 flex items-center gap-1.5">
                <span>现实世界时空同步模式</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono border font-bold ${
                    realTimeState.isEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {realTimeState.isEnabled ? '● 运行中 (ACTIVE)' : '○ 未开启 (STANDBY)'}
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                以现实客观时间为准流逝，AI 角色实时感知昼夜交替与相伴天数
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs scrollbar-thin">
          {/* Main Status Display Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-blue-950/40 border border-blue-500/30 space-y-3 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
              <div className="flex items-center space-x-2">
                {renderPeriodIcon()}
                <div>
                  <div className="text-base font-bold text-white font-mono flex items-center gap-2">
                    <span>{context.currentTimeStr}</span>
                    <span className="text-xs text-blue-300 font-sans font-medium px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30">
                      {context.timePeriod}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400">{context.currentDateStr}</div>
                </div>
              </div>

              {/* Mode Toggle Switch */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleToggleMode}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl font-bold text-xs transition-all shadow-lg cursor-pointer ${
                    realTimeState.isEnabled
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  }`}
                >
                  {realTimeState.isEnabled ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>切回标准时间模式</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>开启现实时间同步</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800">
                <div className="text-[10px] text-zinc-400 flex items-center gap-1 mb-1">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  <span>相伴天数</span>
                </div>
                <div className="text-sm font-bold text-amber-300 font-mono">
                  第 {context.realDayCount} 天
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800">
                <div className="text-[10px] text-zinc-400 flex items-center gap-1 mb-1">
                  <Timer className="w-3 h-3 text-cyan-400" />
                  <span>已累计相处时长</span>
                </div>
                <div className="text-xs font-bold text-cyan-300 font-mono truncate" title={context.formattedDuration}>
                  {context.formattedDuration}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800">
                <div className="text-[10px] text-zinc-400 flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-indigo-400" />
                  <span>开局缔结日期</span>
                </div>
                <div className="text-xs font-bold text-indigo-300 font-mono">
                  {firstDateStr}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800">
                <div className="text-[10px] text-zinc-400 flex items-center gap-1 mb-1">
                  <Heart className="w-3 h-3 text-rose-400" />
                  <span>离线间隔感知</span>
                </div>
                <div className="text-xs font-bold text-rose-300 truncate" title={context.offlineDurationStr}>
                  {context.offlineDurationStr}
                </div>
              </div>
            </div>

            {/* Atmospheric Guidance Preview */}
            <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-500/20 text-[11px] text-blue-200/90 leading-relaxed">
              <strong className="text-blue-300 font-bold block mb-1">
                🌌 当前时段氛围 ({context.timePeriodDetail}):
              </strong>
              {context.timePeriodTone}
            </div>
          </div>

          {/* Rule Breakdown Cards */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              <span>现实时间同步模式机制与规则</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1">
                  <span>📅 真实时间为基准计算天数</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  以第一次开局（或首次开启此模式）的时间为第 1 天。每过自然日 24 小时自动核算增加天数，与现实时间百分之百同步。
                </p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                <div className="font-bold text-rose-300 flex items-center gap-1">
                  <span>🚫 禁用手动时间跃迁功能</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  为了最纯粹真实的陪伴与养成沉浸感，此模式下禁用“+1天”、“天数快跳”等作弊跃迁，时间仅随真实世界自然推进。
                </p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                <div className="font-bold text-cyan-300 flex items-center gap-1">
                  <span>💾 独立专用存档系统</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  现实同步模式的存档与原本的标准时间存档分类隔开。保存或载入时会自动识别模式，互不干扰、互不覆盖。
                </p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                <div className="font-bold text-emerald-300 flex items-center gap-1">
                  <span>🌌 真实昼夜与沉浸氛围</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  角色状态与环境根据现实早、中、晚、深夜的时段自然转换，体验真实的时间流逝与陪伴。
                </p>
              </div>
            </div>
          </div>

          {/* Start Date Reset Option */}
          {realTimeState.isEnabled && (
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-zinc-300 block">将当前时刻重设为第 1 天起点</span>
                <span className="text-[10px] text-zinc-500">若想重新从今天开始计日相伴，可重置开局起点时间戳</span>
              </div>
              <button
                onClick={handleResetStartDate}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
              >
                重设为第1天
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-zinc-500">
            状态：{realTimeState.isEnabled ? '⏳ 现实同步运行中' : '🎮 标准可控时间模式'}
          </span>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            完成并返回
          </button>
        </div>
      </div>
    </div>
  );
};
