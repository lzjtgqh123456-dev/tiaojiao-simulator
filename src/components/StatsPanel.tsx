import React from 'react';
import { Stats, BodyPartId, BodyPartConfig, Ultrawoman, EnvironmentTheme, ENV_DAILY_EFFECTS } from '../types';
import { DEFAULT_ANATOMY_PARTS } from '../utils/cardUtils';
import { Heart, Zap, Brain, Lock, Eye, AlertOctagon, Activity, ShieldCheck, Gauge, Flame, Calendar, FastForward, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { HoverTooltip, BodyPartTooltipCard } from './TacticalTooltip';

interface StatsPanelProps {
  stats: Stats;
  partDamage: Record<BodyPartId, number>;
  partExposure: Record<BodyPartId, number>;
  hero: Ultrawoman;
  selectedPart: BodyPartId;
  onSelectPart: (part: BodyPartId) => void;
  onUpdatePartDamage?: (partId: BodyPartId, damage: number) => void;
  onRestoreAllPartDamage?: () => void;
  dayCount?: number;
  envTheme?: EnvironmentTheme | string;
  onPassDay?: () => void;
  onChangeDay?: (value: number, options?: { isDelta?: boolean; simulateEnv?: boolean }) => void;
  isRealTimeSync?: boolean;
}

const BaseStatsPanel: React.FC<StatsPanelProps> = ({
  stats,
  partDamage,
  partExposure,
  hero,
  selectedPart,
  onSelectPart,
  onUpdatePartDamage,
  onRestoreAllPartDamage,
  dayCount = 1,
  envTheme = 'glass',
  onPassDay,
  onChangeDay,
  isRealTimeSync,
}) => {
  const envEffect = ENV_DAILY_EFFECTS[envTheme] || ENV_DAILY_EFFECTS.glass;
  const safeStats = stats || hero?.defaultStats || {
    hp: 100,
    energy: 100,
    morale: 100,
    obedience: 0,
    shame: 0,
    lust: 10,
    maxHp: 100,
    maxEnergy: 100,
    maxMorale: 100,
    maxObedience: 100,
    maxShame: 100,
    maxLust: 100,
  };
  const maxHp = safeStats.maxHp || hero?.defaultStats?.maxHp || 100;
  const maxEnergy = safeStats.maxEnergy || hero?.defaultStats?.maxEnergy || 100;
  const maxMorale = safeStats.maxMorale || hero?.defaultStats?.maxMorale || 100;
  const maxObedience = safeStats.maxObedience || hero?.defaultStats?.maxObedience || 100;
  const maxShame = safeStats.maxShame || hero?.defaultStats?.maxShame || 100;
  const maxLust = safeStats.maxLust || hero?.defaultStats?.maxLust || 100;

  const curHp = safeStats.hp ?? 100;
  const curEnergy = safeStats.energy ?? 100;
  const curMorale = safeStats.morale ?? 100;
  const curObedience = safeStats.obedience ?? 0;
  const curShame = safeStats.shame ?? 0;
  const curLust = safeStats.lust ?? 10;

  const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (curHp / maxHp) * 100)) : 100;
  const energyPct = maxEnergy > 0 ? Math.max(0, Math.min(100, (curEnergy / maxEnergy) * 100)) : 100;
  const moralePct = maxMorale > 0 ? Math.max(0, Math.min(100, (curMorale / maxMorale) * 100)) : 100;
  const obediencePct = maxObedience > 0 ? Math.max(0, Math.min(100, (curObedience / maxObedience) * 100)) : 0;
  const shamePct = maxShame > 0 ? Math.max(0, Math.min(100, (curShame / maxShame) * 100)) : 0;
  const lustPct = maxLust > 0 ? Math.max(0, Math.min(100, (curLust / maxLust) * 100)) : 10;

  const isHpZero = curHp <= 0 || hpPct <= 0;
  const isEnergyZero = curEnergy <= 0 || energyPct <= 0;
  const isMoraleZero = curMorale <= 0 || moralePct <= 0;
  const isObedienceMax = obediencePct >= 100 || curObedience >= maxObedience;

  const isTimerCritical = energyPct <= 30 && !isEnergyZero;

  // Conversion / Obedience Stage
  let stageText = '阶段 1: 顽强抵抗';
  let stageBadgeClass = 'bg-emerald-950 text-emerald-400 border-emerald-600/40';

  if (isHpZero) {
    stageText = '☠️ 最终状态: 生命归零·死亡';
    stageBadgeClass = 'bg-black text-rose-500 border-rose-600 animate-pulse font-black';
  } else if (isEnergyZero) {
    stageText = '⚡ 最终状态: 能量归零·休克';
    stageBadgeClass = 'bg-zinc-950 text-cyan-400 border-cyan-500 animate-pulse font-black';
  } else if (isMoraleZero) {
    stageText = '🧠 最终状态: 精神归零·崩溃';
    stageBadgeClass = 'bg-purple-950 text-purple-300 border-purple-500 animate-pulse font-black';
  } else if (isObedienceMax) {
    stageText = '⛓️ 最终状态: 信任值100%·绝对臣服';
    stageBadgeClass = 'bg-rose-950 text-rose-300 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)] animate-bounce font-black';
  } else if (obediencePct >= 80) {
    stageText = '阶段 4: 极度亲密屈服';
    stageBadgeClass = 'bg-rose-950 text-rose-400 border-rose-500 animate-pulse';
  } else if (obediencePct >= 50) {
    stageText = '阶段 3: 信任构建瓦解';
    stageBadgeClass = 'bg-amber-950 text-amber-400 border-amber-500';
  } else if (obediencePct >= 25) {
    stageText = '阶段 2: 心理防线建立';
    stageBadgeClass = 'bg-blue-950 text-blue-300 border-blue-500';
  }

  return (
    <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-3.5 text-zinc-100 flex flex-col space-y-3 shadow-2xl font-mono overflow-hidden min-w-0 max-w-full">
      {/* Critical Status Alert Banners */}
      {(isHpZero || isEnergyZero || isMoraleZero || isObedienceMax) && (
        <div className="flex flex-col space-y-1.5 p-2.5 rounded-md border text-xs font-bold animate-fadeIn">
          {isHpZero && (
            <div className="bg-red-950/90 border-red-600 text-rose-200 p-2 rounded flex items-center justify-between shadow-[0_0_15px_rgba(225,29,72,0.5)]">
              <span className="flex items-center space-x-1.5">
                <span className="text-base">☠️</span>
                <span>【生命体征告警】目标生命值归零，确定处于【死亡】状态，生理活动停止！</span>
              </span>
              <span className="bg-black/80 px-2 py-0.5 rounded text-[10px] text-rose-400 border border-rose-700">死亡判定</span>
            </div>
          )}
          {isEnergyZero && (
            <div className="bg-cyan-950/90 border-cyan-500 text-cyan-200 p-2 rounded flex items-center justify-between shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <span className="flex items-center space-x-1.5">
                <span className="text-base">⚡</span>
                <span>【核心能量告警】魔能值归零，目标处于【能量休克】(未死亡，保留浅意识与眩晕)！</span>
              </span>
              <span className="bg-black/80 px-2 py-0.5 rounded text-[10px] text-cyan-300 border border-cyan-600">休克判定</span>
            </div>
          )}
          {isMoraleZero && (
            <div className="bg-purple-950/90 border-purple-500 text-purple-200 p-2 rounded flex items-center justify-between shadow-[0_0_15px_rgba(168,85,247,0.5)]">
              <span className="flex items-center space-x-1.5">
                <span className="text-base">🧠</span>
                <span>【精神防线告警】精神意志力归零，目标神经中枢彻底【精神崩溃】！</span>
              </span>
              <span className="bg-black/80 px-2 py-0.5 rounded text-[10px] text-purple-300 border border-purple-600">崩溃判定</span>
            </div>
          )}
          {isObedienceMax && (
            <div className="bg-rose-950/90 border-rose-500 text-rose-100 p-2 rounded flex items-center justify-between shadow-[0_0_15px_rgba(244,63,94,0.6)]">
              <span className="flex items-center space-x-1.5">
                <span className="text-base">⛓️</span>
                <span>【信任值达成】信任归顺转化率达到100%，目标已完全归顺转化为【忠诚搭档/臣服】！</span>
              </span>
              <span className="bg-rose-900 px-2 py-0.5 rounded text-[10px] text-rose-200 border border-rose-400 animate-pulse">完全归顺</span>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
        <div className="flex items-center space-x-2">
          <Gauge className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-bold tracking-widest text-blue-400 uppercase text-glow-blue">
            目标生命与生理状态遥测：{(hero?.name || '').split(' ')[0]}
          </h2>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${stageBadgeClass}`}>
          {stageText}
        </span>
      </div>

      {/* Environment Daily Effect & Time Preview Banner */}
      <div className={`p-2 rounded flex flex-wrap items-center justify-between gap-2 text-xs border ${
        isRealTimeSync ? 'bg-blue-950/40 border-blue-500/40' : 'bg-zinc-900/90 border-zinc-800'
      }`}>
        <div className="flex items-center space-x-1.5">
          <Calendar className={`w-4 h-4 ${isRealTimeSync ? 'text-blue-400' : 'text-amber-400'}`} />
          {onChangeDay && !isRealTimeSync && (
            <button
              onClick={() => onChangeDay(-1, { isDelta: true, simulateEnv: false })}
              disabled={dayCount <= 1}
              title="时间回退 1 天"
              className="p-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-amber-400"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}
          <span className={`font-bold ${isRealTimeSync ? 'text-blue-300' : 'text-amber-300'}`}>
            第 {dayCount} 天 {isRealTimeSync && <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-900/80 text-blue-200 border border-blue-600/50 ml-1">⏳ 现实同步</span>}
          </span>
          {onChangeDay && !isRealTimeSync && (
            <button
              onClick={() => onChangeDay(1, { isDelta: true, simulateEnv: true })}
              title="推进 1 天"
              className="p-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-400"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          <span className="text-zinc-500">|</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${envEffect.badgeColor}`}>
            {envEffect.name}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] text-zinc-400">
            每日耗损/恢复:
            <span className={envEffect.hpChange >= 0 ? 'text-emerald-400 font-bold ml-1' : 'text-rose-400 font-bold ml-1'}>
              {envEffect.hpChange >= 0 ? '+' : ''}{envEffect.hpChange}% HP
            </span>
            <span className={envEffect.energyChange >= 0 ? 'text-cyan-400 font-bold ml-1' : 'text-amber-400 font-bold ml-1'}>
              {envEffect.energyChange >= 0 ? '+' : ''}{envEffect.energyChange}% 能量
            </span>
          </span>

          {isRealTimeSync ? (
            <span
              title="现实时间同步运行中：时间与现实世界客观流逝对齐，跨天跳跃已锁定"
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/40 text-blue-300 text-[10px] font-mono cursor-default"
            >
              <Lock className="w-3 h-3 text-blue-400" />
              <span>时间随现实流逝</span>
            </span>
          ) : (
            (onChangeDay || onPassDay) && (
              <button
                onClick={() => {
                  if (onChangeDay) onChangeDay(1, { isDelta: true, simulateEnv: true });
                  else if (onPassDay) onPassDay();
                }}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 text-amber-200 text-[10px] font-bold transition-all cursor-pointer shadow-[0_0_6px_rgba(245,158,11,0.2)]"
              >
                <FastForward className="w-3 h-3 text-amber-400" />
                <span>过一天</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Stats Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* HP */}
        <div className={`p-2.5 rounded border flex flex-col space-y-1 ${
          isHpZero ? 'bg-red-950/80 border-red-600' : 'bg-zinc-900/80 border-zinc-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center space-x-1 text-rose-400">
              <Heart className="w-3.5 h-3.5 fill-rose-500/20" />
              <span>生命耐久度 (HP)</span>
            </span>
            <span className={isHpZero ? 'text-red-400 font-black animate-pulse' : 'text-rose-400 font-mono'}>
              {hpPct.toFixed(1)}% ({curHp % 1 === 0 ? curHp : curHp.toFixed(1)} / {maxHp}) {isHpZero ? '[死亡]' : ''}
            </span>
          </div>
          <div className="w-full bg-zinc-950 rounded-sm h-2 overflow-hidden border border-zinc-800">
            <div
              className={`h-full transition-all duration-300 ${isHpZero ? 'bg-zinc-700' : 'bg-gradient-to-r from-rose-600 to-emerald-500'}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <p className="text-[9px] text-zinc-400 font-sans leading-tight">
            【HP效用】受击扣除肉体生命。低于30%触发战损视效，归0触发休克/死亡。
          </p>
        </div>

        {/* Energy / Color Timer */}
        <div className={`p-2.5 rounded border flex flex-col space-y-1 transition-all ${
          isEnergyZero
            ? 'bg-cyan-950/80 border-cyan-500'
            : isTimerCritical
            ? 'bg-red-950/40 border-red-500/60'
            : 'bg-zinc-900/80 border-zinc-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center space-x-1 text-blue-400">
              <Zap className={`w-3.5 h-3.5 ${isEnergyZero ? 'text-cyan-300' : isTimerCritical ? 'text-red-400 animate-bounce' : 'text-blue-400'}`} />
              <span>魔能值 (能量)</span>
            </span>
            <span className={isEnergyZero ? 'text-cyan-300 font-black animate-pulse' : isTimerCritical ? 'text-red-400 font-bold animate-pulse' : 'text-blue-300'}>
              {energyPct.toFixed(1)}% ({curEnergy % 1 === 0 ? curEnergy : curEnergy.toFixed(1)} / {maxEnergy}) {
                isEnergyZero ? '[休克·浅意识]' : energyPct <= 10 ? '[重度眩晕·黑视]' : energyPct <= 20 ? '[中度眩晕·重影]' : energyPct <= 30 ? '[轻微眩晕显现]' : ''
              }
            </span>
          </div>
          <div className="w-full bg-zinc-950 rounded-sm h-2 overflow-hidden border border-zinc-800">
            <div
              className={`h-full transition-all duration-300 ${
                isEnergyZero
                  ? 'bg-zinc-800'
                  : isTimerCritical
                  ? 'bg-gradient-to-r from-red-600 to-rose-500 animate-pulse'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-400'
              }`}
              style={{ width: `${energyPct}%` }}
            />
          </div>
          <div className="text-[10px] flex items-center justify-between pt-0.5 font-sans">
            {energyPct > 30 ? (
              <span className="text-blue-300 font-bold flex items-center space-x-1">
                <span>🛡️ 能量护盾: 生效中</span>
                <span className="text-zinc-400">({(energyPct * 0.75).toFixed(0)}% 减免)</span>
              </span>
            ) : energyPct > 20 ? (
              <span className="text-amber-300 font-bold animate-pulse flex items-center space-x-1">
                <span>🌀 状态: 低能轻微眩晕</span>
                <span className="text-amber-200/80 text-[9px]">(重影初现/微晃)</span>
              </span>
            ) : energyPct > 10 ? (
              <span className="text-orange-400 font-bold animate-pulse flex items-center space-x-1">
                <span>🌀 状态: 极低中度眩晕</span>
                <span className="text-orange-300 text-[9px]">(强烈重影/手扶额)</span>
              </span>
            ) : energyPct > 0 ? (
              <span className="text-rose-400 font-bold animate-pulse flex items-center space-x-1">
                <span>🌀 状态: 濒危重度眩晕</span>
                <span className="text-rose-300 text-[9px]">(眼前黑视/剧烈失重)</span>
              </span>
            ) : (
              <span className="text-cyan-300 font-bold animate-pulse flex items-center space-x-1">
                <span>🌀 状态: 能量归零休克 (保留浅意识/眩晕)</span>
                <span className="text-cyan-400 text-[9px]">(待充能&gt;10%复苏)</span>
              </span>
            )}
            {curEnergy <= 0 ? (
              <span className="text-cyan-400 font-bold text-[9px]">自然回复: 已停止 (能量归零锁死)</span>
            ) : (
              <span className="text-zinc-500 text-[9px]">自然回复: +{(hero?.energyRegenRate ?? 0.5).toFixed(1)}%/s</span>
            )}
          </div>
          <p className="text-[9px] text-zinc-400 font-sans leading-tight pt-0.5">
            【能量效用】护盾吸收率。高于50%减免75%伤害，归0%休克。
          </p>
        </div>

        {/* Morale / Willpower */}
        <div className={`p-2.5 rounded border flex flex-col space-y-1 ${
          isMoraleZero ? 'bg-purple-950/80 border-purple-500' : 'bg-zinc-900/80 border-zinc-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center space-x-1 text-purple-400">
              <Brain className="w-3.5 h-3.5" />
              <span>意志防线 (精神力)</span>
            </span>
            <span className={isMoraleZero ? 'text-purple-300 font-black animate-pulse' : 'text-purple-300 font-mono'}>
              {moralePct.toFixed(1)}% ({curMorale % 1 === 0 ? curMorale : curMorale.toFixed(1)} / {maxMorale}) {isMoraleZero ? '[精神崩溃]' : ''}
            </span>
          </div>
          <div className="w-full bg-zinc-950 rounded-sm h-2 overflow-hidden border border-zinc-800">
            <div
              className={`h-full transition-all duration-300 ${isMoraleZero ? 'bg-zinc-700' : 'bg-gradient-to-r from-purple-600 to-indigo-500'}`}
              style={{ width: `${moralePct}%` }}
            />
          </div>
          <p className="text-[9px] text-zinc-400 font-sans leading-tight">
            【意志效用】抵抗审讯信念。降低产生心理动摇，低于20%触发绝望求饶台词。
          </p>
        </div>

        {/* Obedience / Conversion */}
        <div className={`p-2.5 rounded border flex flex-col space-y-1 ${
          isObedienceMax ? 'bg-rose-950/90 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]' : 'bg-zinc-900/80 border-zinc-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center space-x-1 text-emerald-400">
              <Lock className="w-3.5 h-3.5" />
              <span>信任值 / 归顺度 (信任)</span>
            </span>
            <span className={isObedienceMax ? 'text-rose-300 font-black animate-bounce' : 'text-emerald-300 font-mono'}>
              {obediencePct.toFixed(1)}% ({curObedience % 1 === 0 ? curObedience : curObedience.toFixed(1)} / {maxObedience}) {isObedienceMax ? '[完全信任/归顺]' : ''}
            </span>
          </div>
          <div className="w-full bg-zinc-950 rounded-sm h-2 overflow-hidden border border-zinc-800">
            <div
              className="bg-gradient-to-r from-emerald-600 via-teal-500 to-rose-500 h-full transition-all duration-300"
              style={{ width: `${obediencePct}%` }}
            />
          </div>
          <p className="text-[9px] text-zinc-400 font-sans leading-tight">
            【信任效用】对互动与指令的信任依赖程度。70%以上解锁高信任与顺从合作深入剧情。
          </p>
        </div>

        {/* Shame / Psychological Vulnerability */}
        <div className="p-2.5 rounded border flex flex-col space-y-1 bg-zinc-900/80 border-zinc-800">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center space-x-1 text-amber-400">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>耻辱暴露破绽 (羞耻)</span>
            </span>
            <span className="text-amber-300 font-mono">
              {shamePct.toFixed(1)}% ({curShame % 1 === 0 ? curShame : curShame.toFixed(1)} / {maxShame})
            </span>
          </div>
          <div className="w-full bg-zinc-950 rounded-sm h-2 overflow-hidden border border-zinc-800">
            <div
              className="bg-gradient-to-r from-amber-600 via-yellow-500 to-rose-400 h-full transition-all duration-300"
              style={{ width: `${shamePct}%` }}
            />
          </div>
          <p className="text-[9px] text-zinc-400 font-sans leading-tight">
            【羞耻效用】暴露与受打击下的窘迫程度。提升使喘息与动容气场更热烈。
          </p>
        </div>

        {/* Lust / Arousal */}
        <div className="p-2.5 rounded border flex flex-col space-y-1 bg-zinc-900/80 border-zinc-800">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center space-x-1 text-pink-400">
              <Flame className="w-3.5 h-3.5 text-pink-500 animate-pulse" />
              <span>色情诱发值 (欲望/沉沦度)</span>
            </span>
            <span className="text-pink-300 font-mono">
              {lustPct.toFixed(1)}% ({curLust % 1 === 0 ? curLust : curLust.toFixed(1)} / {maxLust})
            </span>
          </div>
          <div className="w-full bg-zinc-950 rounded-sm h-2 overflow-hidden border border-zinc-800">
            <div
              className="bg-gradient-to-r from-pink-600 via-fuchsia-500 to-rose-400 h-full transition-all duration-300"
              style={{ width: `${lustPct}%` }}
            />
          </div>
          <p className="text-[9px] text-zinc-400 font-sans leading-tight">
            【欲望效用】反映生理发情敏感度。数值越高放大后续触碰与打击的加成倍率。
          </p>
        </div>
      </div>

      {/* 🏆 Achievements & Milestones Progress Bar Breakdown */}
      <div className="bg-zinc-900/90 p-2.5 rounded border border-purple-900/50 flex flex-col space-y-2 shadow-[0_0_15px_rgba(168,85,247,0.1)] font-mono">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
          <span className="text-xs font-bold text-purple-300 flex items-center space-x-1">
            <span>🏆 审讯战术阶段成就与里程碑解锁 (百分比触发)</span>
          </span>
          <span className="text-[10px] text-zinc-400">
            已解锁: {
              [
                obediencePct >= 25,
                obediencePct >= 50,
                obediencePct >= 80,
                obediencePct >= 100,
                moralePct <= 50,
                moralePct <= 20,
                moralePct <= 0,
                shamePct >= 50,
                lustPct >= 50,
                hpPct <= 30,
              ].filter(Boolean).length
            } / 10
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
          {/* Achievement 1: 信任度里程碑 */}
          <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex flex-col space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="text-emerald-400">⛓️ 信任值归顺阶段成就</span>
              <span className="text-zinc-300 font-mono">{obediencePct.toFixed(1)}%</span>
            </div>
            <div className="relative w-full bg-zinc-900 h-2 rounded overflow-hidden border border-zinc-800 my-1">
              <div
                className="bg-gradient-to-r from-emerald-600 via-teal-500 to-rose-500 h-full transition-all duration-300"
                style={{ width: `${obediencePct}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-sans">
              <span className={obediencePct >= 25 ? 'text-emerald-300 font-bold' : 'text-zinc-600'}>25%防线破裂</span>
              <span className={obediencePct >= 50 ? 'text-teal-300 font-bold' : 'text-zinc-600'}>50%意志动摇</span>
              <span className={obediencePct >= 80 ? 'text-rose-400 font-bold' : 'text-zinc-600'}>80%极度屈服</span>
              <span className={obediencePct >= 100 ? 'text-rose-300 font-black animate-pulse' : 'text-zinc-600'}>100%完全臣服</span>
            </div>
          </div>

          {/* Achievement 2: 精神崩解里程碑 */}
          <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex flex-col space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="text-purple-400">🧠 精神防线崩解阶段</span>
              <span className="text-zinc-300 font-mono">崩解 {(100 - moralePct).toFixed(1)}%</span>
            </div>
            <div className="relative w-full bg-zinc-900 h-2 rounded overflow-hidden border border-zinc-800 my-1">
              <div
                className="bg-gradient-to-r from-purple-800 via-indigo-600 to-rose-600 h-full transition-all duration-300"
                style={{ width: `${100 - moralePct}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-sans">
              <span className={moralePct <= 75 ? 'text-purple-300 font-bold' : 'text-zinc-600'}>25%动摇</span>
              <span className={moralePct <= 50 ? 'text-indigo-300 font-bold' : 'text-zinc-600'}>50%防线过半</span>
              <span className={moralePct <= 20 ? 'text-rose-400 font-bold' : 'text-zinc-600'}>80%绝望求饶</span>
              <span className={moralePct <= 0 ? 'text-rose-300 font-black animate-pulse' : 'text-zinc-600'}>100%彻底崩溃</span>
            </div>
          </div>

          {/* Achievement 3: 耻辱暴露 */}
          <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex flex-col space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="text-amber-400">🙈 耻辱破绽暴露成就</span>
              <span className={shamePct >= 50 ? 'text-amber-300 font-bold' : 'text-zinc-500'}>
                {shamePct >= 50 ? '🔥 [成就达成: 50%耻辱破绽]' : `进行中 (${shamePct.toFixed(1)}%/50%)`}
              </span>
            </div>
            <div className="relative w-full bg-zinc-900 h-1.5 rounded overflow-hidden border border-zinc-800">
              <div className="bg-gradient-to-r from-amber-600 to-rose-500 h-full transition-all duration-300" style={{ width: `${shamePct}%` }} />
            </div>
          </div>

          {/* Achievement 4: 欲望沉沦 */}
          <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex flex-col space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="text-pink-400">💖 发情沉沦沉迷成就</span>
              <span className={lustPct >= 50 ? 'text-pink-300 font-bold' : 'text-zinc-500'}>
                {lustPct >= 50 ? '✨ [成就达成: 50%发情沉沦]' : `进行中 (${lustPct.toFixed(1)}%/50%)`}
              </span>
            </div>
            <div className="relative w-full bg-zinc-900 h-1.5 rounded overflow-hidden border border-zinc-800">
              <div className="bg-gradient-to-r from-pink-600 to-rose-400 h-full transition-all duration-300" style={{ width: `${lustPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Regional Body Parts Health & Exposure Bar Breakdown */}
      <div className="bg-zinc-900/60 p-2.5 rounded border border-zinc-800 flex flex-col space-y-2">
        <h3 className="text-xs font-bold text-zinc-300 flex items-center justify-between uppercase tracking-wider">
          <span>解剖部位损伤与受压剖析</span>
          <div className="flex items-center space-x-1">
            {onRestoreAllPartDamage && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestoreAllPartDamage();
                }}
                className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 font-bold cursor-pointer transition-all"
                title="一键将所有部位损伤度归零"
              >
                💚 一键修复破损
              </button>
            )}
            <span className="text-[10px] text-zinc-500 font-normal hidden sm:inline">点击选择目标部位</span>
          </div>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {(() => {
            const safeParts = hero?.bodyParts || DEFAULT_ANATOMY_PARTS;
            return (Object.entries(safeParts) as [BodyPartId, BodyPartConfig][]).map(([partId, config]) => {
              const isSelected = selectedPart === partId;
              const isWeakness = hero?.weakPart === partId;
              const dmgPercent = partDamage?.[partId as BodyPartId] || 0;
              const expPercent = partExposure?.[partId as BodyPartId] || 0;

            return (
              <HoverTooltip
                key={partId}
                position="auto"
                className="w-full"
                content={
                  <BodyPartTooltipCard
                    partId={partId}
                    config={config}
                    hero={hero}
                    damagePercent={dmgPercent}
                    exposurePercent={expPercent}
                    isSelected={isSelected}
                  />
                }
              >
                <div
                  onClick={() => onSelectPart(partId as BodyPartId)}
                  className={`p-2 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.3)] ring-1 ring-rose-400/50'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold flex items-center space-x-1 text-[11px]">
                      <span>{config?.name || partId}</span>
                      {isWeakness && (
                        <span className="text-[9px] bg-rose-950 text-rose-300 border border-rose-600/50 px-1 rounded font-bold animate-pulse">
                          ★弱点
                        </span>
                      )}
                      {hero.sensitivePart === partId && (
                        <span className="text-[9px] bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-600/50 px-1 rounded font-bold">
                          ♥敏感
                        </span>
                      )}
                    </span>
                    <div className="flex items-center space-x-1.5 text-[10px] font-mono">
                      <span className={dmgPercent > 0 ? "text-rose-400 font-bold" : "text-zinc-400"}>
                        损伤:{Math.round(dmgPercent)}%
                      </span>
                      {onUpdatePartDamage && dmgPercent > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdatePartDamage(partId as BodyPartId, 0);
                          }}
                          className="text-[9px] text-emerald-400 hover:text-emerald-300 underline font-bold cursor-pointer"
                          title="单个部位一键修复损伤"
                        >
                          [修复]
                        </button>
                      )}
                      <span className="text-purple-300" title="生理变化/异化转变">
                        异化:{Math.round(expPercent)}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-900 rounded-sm h-1.5 overflow-hidden flex border border-zinc-800">
                    <div
                      className="bg-gradient-to-r from-rose-600 to-red-500 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, dmgPercent)}%` }}
                    />
                    <div
                      className="bg-gradient-to-r from-purple-500 to-fuchsia-500 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100 - dmgPercent, expPercent)}%` }}
                    />
                  </div>
                </div>
              </HoverTooltip>
            );
          });
          })()}
        </div>
      </div>
    </div>
  );
};

export const StatsPanel = React.memo(BaseStatsPanel);

