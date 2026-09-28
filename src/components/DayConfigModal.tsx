import React, { useState } from 'react';
import { DayConfig, DEFAULT_DAY_CONFIG, StagePromptRule, getStagePromptRules, CustomMilestoneNode, DEFAULT_MILESTONES } from '../types';
import { Calendar, MessageSquare, RotateCcw, X, Check, Plus, Trash2, Sparkles, Star, Zap } from 'lucide-react';
import { ultraAudio } from '../utils/audio';

interface DayConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayCount: number;
  onUpdateDayCount: (newDay: number) => void;
  dayConfig: DayConfig;
  onUpdateDayConfig: (newConfig: DayConfig) => void;
}

export const DayConfigModal: React.FC<DayConfigModalProps> = ({
  isOpen,
  onClose,
  dayCount,
  onUpdateDayCount,
  dayConfig,
  onUpdateDayConfig,
}) => {
  const [localConfig, setLocalConfig] = useState<DayConfig>(dayConfig);
  const [isSaved, setIsSaved] = useState(false);

  // Stage Prompt Rules State Handlers
  const currentStageRules = getStagePromptRules(localConfig);

  const handleUpdateStageRule = (index: number, updatedFields: Partial<StagePromptRule>) => {
    const newRules = [...currentStageRules];
    newRules[index] = { ...newRules[index], ...updatedFields };
    setLocalConfig({
      ...localConfig,
      stageRules: newRules,
      earlyStagePrompt: newRules[0]?.prompt || localConfig.earlyStagePrompt,
      midStagePrompt: newRules[1]?.prompt || localConfig.midStagePrompt,
      lateStagePrompt: newRules[2]?.prompt || localConfig.lateStagePrompt,
    });
  };

  const handleAddStageRule = () => {
    ultraAudio.playUiClick();
    const lastRule = currentStageRules[currentStageRules.length - 1];
    const nextMin = lastRule ? (lastRule.maxDay ? lastRule.maxDay + 1 : lastRule.minDay + 5) : 1;
    const newRule: StagePromptRule = {
      id: `stage_${Date.now()}`,
      name: `关押阶段 ${currentStageRules.length + 1}`,
      minDay: nextMin,
      maxDay: null,
      prompt: `【关押第 ${nextMin} 天及以上】在此天数阶段，目标的受打击心理与言语反应 Prompt 指引...`,
    };
    const newRules = [...currentStageRules, newRule];
    setLocalConfig({
      ...localConfig,
      stageRules: newRules,
    });
  };

  const handleDeleteStageRule = (id: string) => {
    ultraAudio.playUiClick();
    if (currentStageRules.length <= 1) {
      alert('最少需保留 1 个 AI 天数心理阶段规则！');
      return;
    }
    const newRules = currentStageRules.filter((r) => r.id !== id);
    setLocalConfig({
      ...localConfig,
      stageRules: newRules,
    });
  };

  // Custom Milestone Nodes Handlers
  const currentMilestones: CustomMilestoneNode[] = Array.isArray(localConfig.milestones)
    ? localConfig.milestones
    : DEFAULT_MILESTONES;

  const handleUpdateMilestone = (index: number, updatedFields: Partial<CustomMilestoneNode>) => {
    const updated = [...currentMilestones];
    updated[index] = { ...updated[index], ...updatedFields };
    setLocalConfig({
      ...localConfig,
      milestones: updated,
    });
  };

  const handleAddMilestone = () => {
    ultraAudio.playUiClick();
    const newId = `milestone_${Date.now()}`;
    const nextTargetDay = dayCount ? Math.min(dayCount + 3, 999) : 5;
    const newMilestone: CustomMilestoneNode = {
      id: newId,
      name: `🌟 自定义重大事件节点 ${currentMilestones.length + 1}`,
      targetDay: nextTargetDay,
      startDay: Math.max(1, nextTargetDay - 1),
      endDay: nextTargetDay + 2,
      description: '重大转折/突发异变经过与环境背景说明...',
      dialogueGuidance: `【重大剧情节点指引 (第${Math.max(1, nextTargetDay - 1)}~${nextTargetDay + 2}天)】角色的言语表达、受击心理与反应需突出该事件造成的影响...`,
      hpDeltaDaily: 0.0,
      energyDeltaDaily: 0.0,
      moraleDeltaDaily: 0.0,
      obedienceDeltaDaily: 1.0,
      shameDeltaDaily: 1.0,
      lustDeltaDaily: 1.0,
      damageMultiplier: 1.0,
      isEnabled: true,
    };
    setLocalConfig({
      ...localConfig,
      milestones: [...currentMilestones, newMilestone],
    });
  };

  const handleDeleteMilestone = (id: string) => {
    ultraAudio.playUiClick();
    const updated = currentMilestones.filter((m) => m.id !== id);
    setLocalConfig({
      ...localConfig,
      milestones: updated,
    });
  };

  const handleToggleMilestone = (index: number) => {
    ultraAudio.playUiClick();
    const updated = [...currentMilestones];
    updated[index] = { ...updated[index], isEnabled: !updated[index].isEnabled };
    setLocalConfig({
      ...localConfig,
      milestones: updated,
    });
  };

  const handleSave = () => {
    ultraAudio.playUiClick();
    onUpdateDayConfig(localConfig);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-amber-500/50 rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.25)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-amber-950/80 via-zinc-900 to-amber-950/80 border-b border-amber-500/30">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-300 tracking-wide">
                📅 日程与审讯心理天数规则设定
              </h2>
              <p className="text-[11px] text-amber-200/60">
                当前处于第 <strong className="text-amber-300">{dayCount}</strong> 天 · 自定义不同关押天数阶段的心态 Prompts 与重大日期事件节点
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="p-1 rounded-md text-zinc-400 hover:text-amber-300 hover:bg-amber-950/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
          {/* Section 1: AI Day Stage Prompt Customization */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-300">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <span>一、审讯心理天数阶段规则自定义 (Stage Prompts)</span>
              </div>
              <button
                type="button"
                onClick={handleAddStageRule}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加阶段规则</span>
              </button>
            </div>
            <p className="text-[10px] text-zinc-500">
              💡 提示：可自由添加、修改或删除天数阶段规则，并单独设置各阶段的名称与天数范围（例如 第1~3天、第4~7天、第8天及以上）。后端 AI 将根据当前实际关押天数自动激活匹配的阶段心态 Prompt！
            </p>

            <div className="space-y-3">
              {currentStageRules.map((rule, idx) => {
                const isCurrentStageActive =
                  dayCount >= rule.minDay && (rule.maxDay === null || rule.maxDay === undefined || dayCount <= rule.maxDay);

                return (
                  <div
                    key={rule.id}
                    className={`bg-zinc-950/80 border rounded-md p-3 space-y-2.5 transition-all ${
                      isCurrentStageActive
                        ? 'border-amber-500/70 bg-amber-950/20 shadow-[0_0_12px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30'
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-800/80">
                      <div className="flex items-center space-x-2 flex-1 min-w-[200px]">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold font-mono border ${
                          isCurrentStageActive
                            ? 'bg-amber-500 text-black border-amber-400 font-extrabold'
                            : 'bg-amber-950/80 text-amber-400 border-amber-500/30'
                        }`}>
                          阶段 {idx + 1} {isCurrentStageActive ? '(当前生效)' : ''}
                        </span>
                        <input
                          type="text"
                          value={rule.name}
                          onChange={(e) => handleUpdateStageRule(idx, { name: e.target.value })}
                          placeholder="阶段名称 (如: 囚禁初期)"
                          className="px-2 py-0.5 text-xs font-bold bg-zinc-900 border border-zinc-700 rounded text-amber-200 focus:outline-none focus:border-amber-400 w-36"
                        />
                      </div>

                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-zinc-400 text-[11px]">关押天数范围:</span>
                        <div className="flex items-center space-x-1">
                          <span className="text-zinc-500 text-[10px]">第</span>
                          <input
                            type="number"
                            min={1}
                            max={9999}
                            value={rule.minDay}
                            onChange={(e) => handleUpdateStageRule(idx, { minDay: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-12 px-1 py-0.5 text-center font-bold text-xs bg-zinc-900 border border-zinc-700 rounded text-amber-300 focus:outline-none focus:border-amber-400"
                          />
                          <span className="text-zinc-500 text-[10px]">天</span>
                        </div>

                        <span className="text-zinc-500 font-bold">~</span>

                        {rule.maxDay === null || rule.maxDay === undefined ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-amber-400 font-bold text-xs bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                              及以上 (无上限)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateStageRule(idx, { maxDay: rule.minDay + 2 })}
                              className="text-[10px] text-zinc-400 underline hover:text-amber-300 cursor-pointer"
                            >
                              [设置上限]
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <span className="text-zinc-500 text-[10px]">第</span>
                            <input
                              type="number"
                              min={rule.minDay}
                              max={9999}
                              value={rule.maxDay}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                handleUpdateStageRule(idx, { maxDay: isNaN(val) ? rule.minDay : Math.max(rule.minDay, val) });
                              }}
                              className="w-12 px-1 py-0.5 text-center font-bold text-xs bg-zinc-900 border border-zinc-700 rounded text-amber-300 focus:outline-none focus:border-amber-400"
                            />
                            <span className="text-zinc-500 text-[10px]">天</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateStageRule(idx, { maxDay: null })}
                              className="text-[10px] text-zinc-400 underline hover:text-amber-300 cursor-pointer ml-1"
                            >
                              [设为无上限]
                            </button>
                          </div>
                        )}

                        {currentStageRules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteStageRule(rule.id)}
                            title="删除此天数阶段规则"
                            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <textarea
                        rows={2}
                        value={rule.prompt}
                        onChange={(e) => handleUpdateStageRule(idx, { prompt: e.target.value })}
                        className="w-full p-2 text-xs bg-zinc-900 border border-zinc-800 rounded text-amber-100 focus:outline-none focus:border-amber-500"
                        placeholder={`请输入【${rule.name}】下的 AI 对白与受打击心态 Prompt 指引...`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Custom Milestone Critical Dates & Range Effects */}
          <div className="bg-zinc-900/50 border border-amber-500/40 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>二、🌟 自定义重大日期节点与影响范围 (Milestones & Date Range)</span>
              </div>
              <button
                type="button"
                onClick={handleAddMilestone}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all cursor-pointer shadow-[0_0_8px_rgba(245,158,11,0.2)]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加重大日期节点</span>
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              💡 设定指定某一天作为<strong className="text-amber-300 font-bold">重大事件爆发关键日</strong>（如能量异变、意志转折、外部风暴），并可指定其<strong className="text-amber-300 font-bold">前后影响日期范围</strong>。API 对话在处于该日期或影响周期内时将深度体现事件剧情与心理状态，并在每日环境结算中自动累加属性变动与伤害倍率！
            </p>

            <div className="space-y-3.5">
              {currentMilestones.map((milestone, mIdx) => {
                const isTarget = dayCount === milestone.targetDay;
                const isInRange = dayCount >= milestone.startDay && dayCount <= milestone.endDay;
                const isEnabled = milestone.isEnabled !== false;

                return (
                  <div
                    key={milestone.id}
                    className={`bg-zinc-950/90 border rounded-lg p-3.5 space-y-3 transition-all ${
                      !isEnabled
                        ? 'border-zinc-800 opacity-60'
                        : isTarget
                        ? 'border-amber-400 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/40'
                        : isInRange
                        ? 'border-purple-500/60 bg-purple-950/20 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-800/80">
                      <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
                        <button
                          type="button"
                          onClick={() => handleToggleMilestone(mIdx)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer flex items-center space-x-1 ${
                            isEnabled
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                              : 'bg-zinc-900 text-zinc-500 border-zinc-700'
                          }`}
                        >
                          <Check className={`w-3 h-3 ${isEnabled ? 'text-emerald-400' : 'text-zinc-600'}`} />
                          <span>{isEnabled ? '生效中' : '已停用'}</span>
                        </button>

                        <input
                          type="text"
                          value={milestone.name}
                          onChange={(e) => handleUpdateMilestone(mIdx, { name: e.target.value })}
                          placeholder="重大节点名称 (如: ⚡ 能量核心过载异变)"
                          className="px-2 py-0.5 text-xs font-bold bg-zinc-900 border border-zinc-700 rounded text-amber-200 focus:outline-none focus:border-amber-400 flex-1 max-w-[280px]"
                        />
                      </div>

                      {/* Active Status Badge */}
                      <div className="flex items-center space-x-2">
                        {isEnabled && isTarget && (
                          <span className="px-2 py-0.5 rounded bg-amber-500 text-black text-[10px] font-extrabold shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse flex items-center space-x-1">
                            <Star className="w-3 h-3 fill-black" />
                            <span>★ 今日爆发关键日 (第 {dayCount} 天)</span>
                          </span>
                        )}
                        {isEnabled && !isTarget && isInRange && (
                          <span className="px-2 py-0.5 rounded bg-purple-900/80 text-purple-200 border border-purple-500/50 text-[10px] font-bold flex items-center space-x-1">
                            <Zap className="w-3 h-3 text-purple-400" />
                            <span>⚡ 处于影响周期内 (第 {dayCount} 天)</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteMilestone(milestone.id)}
                          title="删除此重大日期节点"
                          className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Date Range & Target Day Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-zinc-900/60 p-2.5 rounded border border-zinc-800/80">
                      <div className="flex items-center space-x-2">
                        <span className="text-amber-400 font-bold text-[11px] shrink-0">🎯 爆发关键日:</span>
                        <div className="flex items-center space-x-1">
                          <span className="text-zinc-500 text-[10px]">第</span>
                          <input
                            type="number"
                            min={1}
                            max={9999}
                            value={milestone.targetDay}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              handleUpdateMilestone(mIdx, {
                                targetDay: val,
                                startDay: Math.min(milestone.startDay, val),
                                endDay: Math.max(milestone.endDay, val),
                              });
                            }}
                            className="w-14 px-1 py-0.5 text-center font-bold text-xs bg-zinc-950 border border-amber-500/50 rounded text-amber-300 focus:outline-none focus:border-amber-400"
                          />
                          <span className="text-zinc-500 text-[10px]">天</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-zinc-400 text-[11px] shrink-0">📅 影响日期范围:</span>
                        <div className="flex items-center space-x-1">
                          <span className="text-zinc-500 text-[10px]">第</span>
                          <input
                            type="number"
                            min={1}
                            max={milestone.endDay || 9999}
                            value={milestone.startDay}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              handleUpdateMilestone(mIdx, { startDay: val });
                            }}
                            className="w-12 px-1 py-0.5 text-center font-bold text-xs bg-zinc-950 border border-zinc-700 rounded text-zinc-200 focus:outline-none focus:border-amber-400"
                          />
                          <span className="text-zinc-500 text-[10px]">天</span>
                          <span className="text-zinc-500 font-bold">~</span>
                          <span className="text-zinc-500 text-[10px]">第</span>
                          <input
                            type="number"
                            min={milestone.startDay || 1}
                            max={9999}
                            value={milestone.endDay}
                            onChange={(e) => {
                              const val = Math.max(milestone.startDay || 1, parseInt(e.target.value) || 1);
                              handleUpdateMilestone(mIdx, { endDay: val });
                            }}
                            className="w-12 px-1 py-0.5 text-center font-bold text-xs bg-zinc-950 border border-zinc-700 rounded text-zinc-200 focus:outline-none focus:border-amber-400"
                          />
                          <span className="text-zinc-500 text-[10px]">天</span>
                        </div>
                      </div>
                    </div>

                    {/* Description & Prompt Guidance */}
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-400 flex items-center space-x-1 pb-1">
                          <span>📖 节点剧情背景与事件经过:</span>
                        </label>
                        <textarea
                          rows={2}
                          value={milestone.description}
                          onChange={(e) => handleUpdateMilestone(mIdx, { description: e.target.value })}
                          placeholder="描述该重大事件的起因、环境剧变或剧情经过..."
                          className="w-full p-2 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-amber-300/90 flex items-center space-x-1 pb-1">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                          <span>💬 影响期内 AI 对话与心理指引 Prompt:</span>
                        </label>
                        <textarea
                          rows={2}
                          value={milestone.dialogueGuidance}
                          onChange={(e) => handleUpdateMilestone(mIdx, { dialogueGuidance: e.target.value })}
                          placeholder="指导 AI 在这几天期间的角色言行、受击反应、深层心理以及对玩家交互的态度..."
                          className="w-full p-2 text-xs bg-zinc-900 border border-amber-900/60 rounded text-amber-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Daily Settlement Influence & Damage Multiplier */}
                    <div className="bg-zinc-900/40 p-2.5 rounded border border-zinc-800/80 space-y-2 text-xs">
                      <div className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
                        <span>⚡ 影响期内每日额外数值结算与效果加成:</span>
                        <div className="flex items-center space-x-1 text-amber-400">
                          <span>攻击/效果倍率:</span>
                          <input
                            type="number"
                            step="any"
                            min="0.1"
                            value={milestone.damageMultiplier ?? 1.0}
                            onChange={(e) => handleUpdateMilestone(mIdx, { damageMultiplier: Math.max(0.01, parseFloat(e.target.value) || 1.0) })}
                            className="w-16 px-1 py-0.5 text-center font-bold text-xs bg-zinc-950 border border-amber-500/50 rounded text-amber-300"
                          />
                          <span>x</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[10px]">
                        <div>
                          <span className="text-zinc-500 block">每日 HP:</span>
                          <input
                            type="number"
                            step="0.5"
                            value={milestone.hpDeltaDaily ?? 0}
                            onChange={(e) => handleUpdateMilestone(mIdx, { hpDeltaDaily: parseFloat(e.target.value) || 0 })}
                            className="w-full px-1 py-0.5 text-center bg-zinc-950 border border-zinc-800 rounded text-zinc-300 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-zinc-500 block">每日能量:</span>
                          <input
                            type="number"
                            step="0.5"
                            value={milestone.energyDeltaDaily ?? 0}
                            onChange={(e) => handleUpdateMilestone(mIdx, { energyDeltaDaily: parseFloat(e.target.value) || 0 })}
                            className="w-full px-1 py-0.5 text-center bg-zinc-950 border border-zinc-800 rounded text-zinc-300 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-zinc-500 block">每日意志:</span>
                          <input
                            type="number"
                            step="0.5"
                            value={milestone.moraleDeltaDaily ?? 0}
                            onChange={(e) => handleUpdateMilestone(mIdx, { moraleDeltaDaily: parseFloat(e.target.value) || 0 })}
                            className="w-full px-1 py-0.5 text-center bg-zinc-950 border border-zinc-800 rounded text-zinc-300 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-zinc-500 block">每日服从:</span>
                          <input
                            type="number"
                            step="0.5"
                            value={milestone.obedienceDeltaDaily ?? 0}
                            onChange={(e) => handleUpdateMilestone(mIdx, { obedienceDeltaDaily: parseFloat(e.target.value) || 0 })}
                            className="w-full px-1 py-0.5 text-center bg-zinc-950 border border-zinc-800 rounded text-zinc-300 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-zinc-500 block">每日羞耻:</span>
                          <input
                            type="number"
                            step="0.5"
                            value={milestone.shameDeltaDaily ?? 0}
                            onChange={(e) => handleUpdateMilestone(mIdx, { shameDeltaDaily: parseFloat(e.target.value) || 0 })}
                            className="w-full px-1 py-0.5 text-center bg-zinc-950 border border-zinc-800 rounded text-zinc-300 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-zinc-500 block">每日发情:</span>
                          <input
                            type="number"
                            step="0.5"
                            value={milestone.lustDeltaDaily ?? 0}
                            onChange={(e) => handleUpdateMilestone(mIdx, { lustDeltaDaily: parseFloat(e.target.value) || 0 })}
                            className="w-full px-1 py-0.5 text-center bg-zinc-950 border border-zinc-800 rounded text-zinc-300 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-zinc-900 border-t border-zinc-800">
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setLocalConfig(DEFAULT_DAY_CONFIG);
            }}
            className="flex items-center space-x-1 px-3 py-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors text-xs font-bold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>恢复默认规则与节点</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                ultraAudio.playUiClick();
                onClose();
              }}
              className="px-4 py-1.5 rounded border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200 transition-colors text-xs cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className={`flex items-center space-x-1 px-5 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                isSaved
                  ? 'bg-emerald-500 text-black border border-emerald-400'
                  : 'bg-amber-500 hover:bg-amber-400 text-black border border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaved ? '已应用保存！' : '保存天数规则与节点'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
