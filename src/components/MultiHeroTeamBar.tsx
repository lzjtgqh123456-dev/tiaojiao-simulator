import React, { useState } from 'react';
import { Ultrawoman, Stats } from '../types';
import { Users, UserPlus, Sparkles, Target, Shield, Zap, X, ChevronDown, ChevronUp, UserCheck, Layers } from 'lucide-react';
import { ultraAudio } from '../utils/audio';
import { PortraitMediaDisplay } from './PortraitMediaDisplay';

interface MultiHeroTeamBarProps {
  heroines: Ultrawoman[];
  selectedHero: Ultrawoman;
  activeTeamIds: string[];
  targetScope: 'primary' | 'all' | 'custom';
  targetedHeroIds: string[];
  progressMap: Record<string, any>;
  onSelectHero: (hero: Ultrawoman) => void;
  onToggleTeamMember: (heroId: string) => void;
  onToggleTargetScope: (scope: 'primary' | 'all' | 'custom') => void;
  onToggleTargetHero: (heroId: string) => void;
  onResetTeamSingle?: () => void;
  onSetSingleHeroMode?: (hero: Ultrawoman) => void;
  onOpenHeroSelector: () => void;
}

export const MultiHeroTeamBar: React.FC<MultiHeroTeamBarProps> = ({
  heroines,
  selectedHero,
  activeTeamIds,
  targetScope,
  targetedHeroIds,
  progressMap,
  onSelectHero,
  onToggleTeamMember,
  onToggleTargetScope,
  onToggleTargetHero,
  onResetTeamSingle,
  onSetSingleHeroMode,
  onOpenHeroSelector,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Active Team Hero Objects
  const teamHeroes = heroines.filter((h) => activeTeamIds.includes(h.id));

  // If activeTeamIds is empty or corrupt, fallback to selectedHero
  if (teamHeroes.length === 0) {
    teamHeroes.push(selectedHero);
  }

  return (
    <div className="w-full bg-zinc-950/90 border-b border-zinc-800/80 backdrop-blur-md shadow-md text-zinc-100 font-mono transition-all">
      {/* Top Header / Controller Strip */}
      <div className="px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-950/80 border border-blue-500/40 text-blue-300 text-xs font-bold shadow-[0_0_10px_rgba(59,130,246,0.2)]">
            <Users className="w-4 h-4 text-blue-400 animate-pulse" />
            <span>当前在场人员</span>
            <span className="bg-blue-600 text-white px-1.5 py-0.2 rounded-full text-[10px]">
              {teamHeroes.length} 位在场
            </span>
          </div>

          {/* Action Scope Target Switcher */}
          {teamHeroes.length > 1 && (
            <div className="flex items-center space-x-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-xs">
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  onToggleTargetScope('primary');
                }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center space-x-1 font-bold ${
                  targetScope === 'primary'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title={`仅针对当前主视角在场人员【${selectedHero.name}】进行招式或言语作用`}
              >
                <Target className="w-3.5 h-3.5 text-blue-200" />
                <span>仅焦点: 【{selectedHero.name.split(' ')[0]}】</span>
              </button>

              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  onToggleTargetScope('all');
                }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center space-x-1 font-bold ${
                  targetScope === 'all'
                    ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="全员同步作用：对在场所有人员施加作用，触发全场人员连锁回应与互动台词"
              >
                <Layers className="w-3.5 h-3.5 text-purple-200" />
                <span>👥 全体在场 ({teamHeroes.length}人)</span>
              </button>

              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  onToggleTargetScope('custom');
                }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center space-x-1 font-bold ${
                  targetScope === 'custom'
                    ? 'bg-rose-600 text-white shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="自定义勾选指定受击/作用目标"
              >
                <Target className="w-3.5 h-3.5 text-rose-200" />
                <span>🎯 指定目标 ({targetedHeroIds.length}人)</span>
              </button>
            </div>
          )}
        </div>

        {/* Right side buttons */}
        <div className="flex items-center space-x-2">
          {teamHeroes.length > 1 && onResetTeamSingle && (
            <button
              onClick={() => {
                ultraAudio.playUiClick();
                onResetTeamSingle();
              }}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-rose-950/80 border border-blue-500/50 hover:border-rose-500/60 text-blue-300 hover:text-rose-200 transition-all text-xs font-bold cursor-pointer shadow-[0_0_8px_rgba(59,130,246,0.2)]"
              title="一键除了主角色外的退场（仅保留当前主角色在场）"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>一键其余退场</span>
            </button>
          )}

          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onOpenHeroSelector();
            }}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 border border-blue-500/40 text-blue-300 hover:text-white transition-all text-xs font-bold cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>调整在场人员</span>
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
            title={isCollapsed ? '展开在场人员列表' : '折叠在场人员列表'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Team Members Bar Content */}
      {!isCollapsed && (
        <div className="p-2 sm:p-3 overflow-x-auto scrollbar-thin">
          <div className="flex items-center space-x-3 min-w-max">
            {teamHeroes.map((hero) => {
              const isSelected = hero.id === selectedHero.id;
              const heroProgress = progressMap[hero.id];
              const heroStats: Stats = heroProgress?.stats || hero.defaultStats;

              const maxHp = heroStats.maxHp || hero.defaultStats?.maxHp || 100;
              const maxEnergy = heroStats.maxEnergy || hero.defaultStats?.maxEnergy || 100;
              const maxMorale = heroStats.maxMorale || hero.defaultStats?.maxMorale || 100;
              const maxObedience = heroStats.maxObedience || hero.defaultStats?.maxObedience || 100;
              const maxShame = heroStats.maxShame || hero.defaultStats?.maxShame || 100;
              const maxLust = heroStats.maxLust || hero.defaultStats?.maxLust || 100;

              const hpPct = Math.max(0, Math.min(100, (heroStats.hp / maxHp) * 100));
              const energyPct = Math.max(0, Math.min(100, (heroStats.energy / maxEnergy) * 100));
              const moralePct = Math.max(0, Math.min(100, (heroStats.morale / maxMorale) * 100));
              const obediencePct = Math.max(0, Math.min(100, ((heroStats.obedience ?? 0) / maxObedience) * 100));
              const shamePct = Math.max(0, Math.min(100, ((heroStats.shame ?? 0) / maxShame) * 100));
              const lustPct = Math.max(0, Math.min(100, ((heroStats.lust ?? 10) / maxLust) * 100));

              const isTargeted = targetedHeroIds.includes(hero.id);

              return (
                <div
                  key={hero.id}
                  onClick={() => {
                    if (!isSelected) {
                      ultraAudio.playUiClick();
                      onSelectHero(hero);
                    }
                  }}
                  className={`relative p-2 rounded-xl border transition-all duration-200 flex items-center space-x-3 cursor-pointer group select-none min-w-[260px] ${
                    isSelected
                      ? 'bg-blue-950/60 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/50'
                      : isTargeted
                      ? 'bg-rose-950/20 border-rose-900/60 hover:bg-rose-950/30'
                      : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  {/* Portrait / Accent Badge */}
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-950 shrink-0">
                    {hero.customPortrait ? (
                      <PortraitMediaDisplay
                        src={hero.customPortrait}
                        alt={hero.name}
                        fitMode="cover"
                        isMuted={true}
                        showMediaBadge={false}
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
                        style={{
                          background: `radial-gradient(circle, ${hero.colorTheme?.primary}88 0%, #09090b 100%)`,
                        }}
                      >
                        {hero.name.slice(0, 1)}
                      </div>
                    )}

                    {isSelected && (
                      <div className="absolute inset-0 border-2 border-blue-400 rounded-lg pointer-events-none" />
                    )}
                  </div>

                  {/* Info & Mini Status Gauges */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-zinc-100 truncate group-hover:text-blue-300 transition-colors">
                        {hero.name.split(' ')[0]}
                      </span>

                      {isSelected ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                          👑 主焦点
                        </span>
                      ) : (
                        <span className="text-[9px] text-zinc-500 group-hover:text-zinc-300">
                          切换
                        </span>
                      )}
                    </div>

                    {/* Progress Bars: All 6 Stats */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-zinc-400">
                      {/* HP Bar */}
                      <div className="flex items-center space-x-1" title={`生命值 (HP): ${heroStats.hp}/${maxHp}`}>
                        <span className="w-3.5 shrink-0 text-[8px] font-bold text-rose-400">HP</span>
                        <div className="flex-1 h-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-gradient-to-r from-rose-600 to-emerald-500 transition-all duration-300"
                            style={{ width: `${hpPct}%` }}
                          />
                        </div>
                        <span className="w-5 text-right font-mono text-[8px] text-zinc-300">{Math.round(hpPct)}%</span>
                      </div>

                      {/* 服从/信任 Bar */}
                      <div className="flex items-center space-x-1" title={`服从/信任: ${heroStats.obedience ?? 0}/${maxObedience}`}>
                        <span className="w-3.5 shrink-0 text-[8px] font-bold text-blue-400">顺</span>
                        <div className="flex-1 h-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${obediencePct}%` }}
                          />
                        </div>
                        <span className="w-5 text-right font-mono text-[8px] text-zinc-300">{Math.round(obediencePct)}%</span>
                      </div>

                      {/* Energy Bar */}
                      <div className="flex items-center space-x-1" title={`能量: ${heroStats.energy}/${maxEnergy}`}>
                        <span className="w-3.5 shrink-0 text-[8px] font-bold text-cyan-400">能</span>
                        <div className="flex-1 h-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-cyan-500 transition-all duration-300"
                            style={{ width: `${energyPct}%` }}
                          />
                        </div>
                        <span className="w-5 text-right font-mono text-[8px] text-zinc-300">{Math.round(energyPct)}%</span>
                      </div>

                      {/* 羞耻 Bar */}
                      <div className="flex items-center space-x-1" title={`羞耻度: ${heroStats.shame ?? 0}/${maxShame}`}>
                        <span className="w-3.5 shrink-0 text-[8px] font-bold text-fuchsia-400">耻</span>
                        <div className="flex-1 h-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-fuchsia-500 transition-all duration-300"
                            style={{ width: `${shamePct}%` }}
                          />
                        </div>
                        <span className="w-5 text-right font-mono text-[8px] text-zinc-300">{Math.round(shamePct)}%</span>
                      </div>

                      {/* 意志 Bar */}
                      <div className="flex items-center space-x-1" title={`意志力: ${heroStats.morale}/${maxMorale}`}>
                        <span className="w-3.5 shrink-0 text-[8px] font-bold text-amber-400">意</span>
                        <div className="flex-1 h-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-amber-500 transition-all duration-300"
                            style={{ width: `${moralePct}%` }}
                          />
                        </div>
                        <span className="w-5 text-right font-mono text-[8px] text-zinc-300">{Math.round(moralePct)}%</span>
                      </div>

                      {/* 欲望 Bar */}
                      <div className="flex items-center space-x-1" title={`欲望值: ${heroStats.lust ?? 10}/${maxLust}`}>
                        <span className="w-3.5 shrink-0 text-[8px] font-bold text-pink-400">欲</span>
                        <div className="flex-1 h-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-pink-500 transition-all duration-300"
                            style={{ width: `${lustPct}%` }}
                          />
                        </div>
                        <span className="w-5 text-right font-mono text-[8px] text-zinc-300">{Math.round(lustPct)}%</span>
                      </div>
                    </div>

                    {/* Target Lock Toggle Badge */}
                    {teamHeroes.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          ultraAudio.playUiClick();
                          onToggleTargetHero(hero.id);
                        }}
                        className={`w-full mt-1 py-0.5 px-1 rounded text-[9px] font-bold flex items-center justify-center space-x-1 transition-all cursor-pointer border ${
                          isTargeted
                            ? 'bg-rose-950/80 text-rose-300 border-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.3)]'
                            : 'bg-zinc-950/90 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
                        }`}
                        title={isTargeted ? '取消勾选该受击目标' : '勾选锁定为受击目标'}
                      >
                        <Target className={`w-3 h-3 ${isTargeted ? 'text-rose-400 animate-pulse' : 'text-zinc-600'}`} />
                        <span>{isTargeted ? '🎯 攻击受击目标' : '⚪ 旁观/不上弹'}</span>
                      </button>
                    )}
                  </div>

                  {/* Remove / Single Hero buttons (if team > 1) */}
                  {teamHeroes.length > 1 && (
                    <div className="flex flex-col gap-1 shrink-0">
                      {onSetSingleHeroMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            ultraAudio.playUiClick();
                            onSetSingleHeroMode(hero);
                          }}
                          className="px-1.5 py-1 rounded bg-zinc-950 hover:bg-blue-950 text-zinc-400 hover:text-blue-300 border border-zinc-800 hover:border-blue-500/60 transition-all cursor-pointer text-[10px] font-bold shrink-0"
                          title="只留此人在场"
                        >
                          仅此人
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          ultraAudio.playUiClick();
                          onToggleTeamMember(hero.id);
                        }}
                        className="p-1 rounded bg-zinc-950/80 hover:bg-rose-950 text-zinc-500 hover:text-rose-400 border border-zinc-800 hover:border-rose-800 transition-all cursor-pointer flex items-center justify-center"
                        title="移出当前现场"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Quick Add Companion Slot Card */}
            <button
              onClick={() => {
                ultraAudio.playUiClick();
                onOpenHeroSelector();
              }}
              className="p-3 rounded-xl border border-dashed border-zinc-800 hover:border-blue-500/60 bg-zinc-900/40 hover:bg-blue-950/20 text-zinc-500 hover:text-blue-300 transition-all flex flex-col items-center justify-center space-y-1 min-w-[130px] h-[64px] cursor-pointer"
            >
              <UserPlus className="w-5 h-5 text-zinc-400" />
              <span className="text-[11px] font-bold">+ 添加在场人员</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
