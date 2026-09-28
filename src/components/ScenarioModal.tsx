import React, { useState, useEffect } from 'react';
import {
  ScenarioConfig,
  ScenarioCategory,
  DEFAULT_SCENARIO_PRESETS,
  EnvironmentTheme,
  ENV_DAILY_EFFECTS,
  RelationshipSlot,
  RelationshipCategory,
  Ultrawoman,
  ScenarioInitialStatsPct,
  ScenarioStartupConfig,
  Faction,
} from '../types';
import {
  Compass,
  Sparkles,
  Check,
  Edit3,
  Plus,
  Trash2,
  RotateCcw,
  X,
  Shield,
  Activity,
  Heart,
  Eye,
  Sliders,
  Zap,
  MessageSquare,
  Link,
  Users,
  User,
  Crown,
  Copy,
  CheckCircle2,
  Flame,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { ultraAudio } from '../utils/audio';
import { DEFAULT_FACTIONS, getHeroFactionMemberships, getFactionById, getSubFactionById, isHeroInFaction, isHeroUnassigned } from '../data/factions';

function mapScenarioCatToRelCat(cat: string): RelationshipCategory {
  switch (cat) {
    case 'coop':
    case 'medical':
    case 'rescue':
      return 'pure_love';
    case 'interrogation':
      return 'evil_enslavement';
    case 'hypnosis':
      return 'hypnotic_dependency';
    case 'undercover':
    case 'arena':
      return 'rivalry';
    default:
      return 'custom';
  }
}

const DEFAULT_STATS_PCT: ScenarioInitialStatsPct = {
  hpPct: 100,
  energyPct: 100,
  moralePct: 100,
  trustPct: 50,
  shamePct: 0,
  lustPct: 0,
};

interface ScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScenario: ScenarioConfig;
  customScenarios?: ScenarioConfig[];
  relationshipSlots?: RelationshipSlot[];
  heroines?: Ultrawoman[];
  factions?: Faction[];
  selectedHero?: Ultrawoman;
  activeTeamIds?: string[];
  onApplyScenario: (
    scenario: ScenarioConfig,
    applyGreeting?: boolean,
    startupConfig?: ScenarioStartupConfig
  ) => void;
  onSaveCustomScenario?: (scenario: ScenarioConfig) => void;
  onSaveCustomRelationshipSlot?: (slot: RelationshipSlot) => void;
  onDeleteCustomScenario?: (id: string) => void;
}

export const ScenarioModal: React.FC<ScenarioModalProps> = ({
  isOpen,
  onClose,
  currentScenario,
  customScenarios = [],
  relationshipSlots = [],
  heroines = [],
  factions = DEFAULT_FACTIONS,
  selectedHero,
  activeTeamIds = [],
  onApplyScenario,
  onSaveCustomScenario,
  onSaveCustomRelationshipSlot,
  onDeleteCustomScenario,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioConfig>(currentScenario);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<ScenarioConfig>(currentScenario);
  const [boundSlotId, setBoundSlotId] = useState<string>('none');
  const [syncToRelLibrary, setSyncToRelLibrary] = useState<boolean>(false);

  // Faction & Sub-faction filtering for roster
  const [rosterFactionFilter, setRosterFactionFilter] = useState<string>('all');
  const [rosterSubFactionFilter, setRosterSubFactionFilter] = useState<string>('all');

  // Multi-Hero Selection & Startup Config States
  const [activeHeroTab, setActiveHeroTab] = useState<'roster' | 'stats'>('roster');
  const [selectedHeroIds, setSelectedHeroIds] = useState<string[]>(() => {
    if (currentScenario.startupConfig?.activeHeroIds && currentScenario.startupConfig.activeHeroIds.length > 0) {
      return currentScenario.startupConfig.activeHeroIds;
    }
    if (activeTeamIds && activeTeamIds.length > 0) {
      return activeTeamIds;
    }
    return selectedHero ? [selectedHero.id] : (heroines[0] ? [heroines[0].id] : ['beth']);
  });

  const [primaryHeroId, setPrimaryHeroId] = useState<string>(() => {
    if (currentScenario.startupConfig?.primaryHeroId) {
      return currentScenario.startupConfig.primaryHeroId;
    }
    return selectedHero ? selectedHero.id : (heroines[0] ? heroines[0].id : 'beth');
  });

  const [heroStatsMap, setHeroStatsMap] = useState<Record<string, ScenarioInitialStatsPct>>(() => {
    const baseStats = currentScenario.initialStatsPct || DEFAULT_STATS_PCT;
    const initialMap: Record<string, ScenarioInitialStatsPct> = {};
    heroines.forEach((h) => {
      initialMap[h.id] = currentScenario.startupConfig?.heroStatsMap?.[h.id]
        ? { ...currentScenario.startupConfig.heroStatsMap[h.id] }
        : { ...baseStats };
    });
    return initialMap;
  });

  const [editingHeroId, setEditingHeroId] = useState<string>(() => {
    return primaryHeroId || (heroines[0] ? heroines[0].id : 'beth');
  });

  const [isRealTimeSync, setIsRealTimeSync] = useState<boolean>(() => {
    return !!currentScenario.startupConfig?.isRealTimeSync;
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedScenario(currentScenario);
      setEditForm(currentScenario);
      setBoundSlotId(currentScenario.boundRelationshipSlotId || 'none');
      setIsRealTimeSync(!!currentScenario.startupConfig?.isRealTimeSync);

      const initialHeroes =
        currentScenario.startupConfig?.activeHeroIds && currentScenario.startupConfig.activeHeroIds.length > 0
          ? currentScenario.startupConfig.activeHeroIds
          : activeTeamIds.length > 0
          ? activeTeamIds
          : selectedHero
          ? [selectedHero.id]
          : [heroines[0]?.id || 'beth'];

      setSelectedHeroIds(initialHeroes);

      const leadId =
        currentScenario.startupConfig?.primaryHeroId ||
        (selectedHero ? selectedHero.id : initialHeroes[0] || heroines[0]?.id || 'beth');
      setPrimaryHeroId(leadId);
      setEditingHeroId(leadId);

      const baseStats = currentScenario.initialStatsPct || DEFAULT_STATS_PCT;
      const initialMap: Record<string, ScenarioInitialStatsPct> = {};
      heroines.forEach((h) => {
        initialMap[h.id] = currentScenario.startupConfig?.heroStatsMap?.[h.id]
          ? { ...currentScenario.startupConfig.heroStatsMap[h.id] }
          : { ...baseStats };
      });
      setHeroStatsMap(initialMap);
    }
  }, [isOpen, currentScenario]);

  const allScenarios = [...DEFAULT_SCENARIO_PRESETS, ...customScenarios];

  const handleSelectPreset = (sc: ScenarioConfig) => {
    ultraAudio.playUiClick();
    setSelectedScenario(sc);
    setEditForm(sc);
    setBoundSlotId(sc.boundRelationshipSlotId || 'none');

    // Update initial stats for all heroes based on new preset
    const presetStats = sc.initialStatsPct || DEFAULT_STATS_PCT;
    setHeroStatsMap((prev) => {
      const updated: Record<string, ScenarioInitialStatsPct> = {};
      heroines.forEach((h) => {
        updated[h.id] = sc.startupConfig?.heroStatsMap?.[h.id]
          ? { ...sc.startupConfig.heroStatsMap[h.id] }
          : { ...presetStats };
      });
      return updated;
    });

    if (sc.startupConfig?.activeHeroIds && sc.startupConfig.activeHeroIds.length > 0) {
      setSelectedHeroIds(sc.startupConfig.activeHeroIds);
    }
    if (sc.startupConfig?.primaryHeroId) {
      setPrimaryHeroId(sc.startupConfig.primaryHeroId);
      setEditingHeroId(sc.startupConfig.primaryHeroId);
    }
  };

  const handleToggleHeroSelect = (heroId: string) => {
    ultraAudio.playUiClick();
    setSelectedHeroIds((prev) => {
      if (prev.includes(heroId)) {
        if (prev.length <= 1) return prev; // Keep at least 1 hero
        const next = prev.filter((id) => id !== heroId);
        if (primaryHeroId === heroId && next.length > 0) {
          setPrimaryHeroId(next[0]);
          setEditingHeroId(next[0]);
        }
        return next;
      } else {
        return [...prev, heroId];
      }
    });
  };

  const handleSelectAllHeroes = () => {
    ultraAudio.playUiClick();
    const allIds = heroines.map((h) => h.id);
    setSelectedHeroIds(allIds);
  };

  const handleSelectOnlyPrimary = () => {
    ultraAudio.playUiClick();
    setSelectedHeroIds([primaryHeroId]);
    setEditingHeroId(primaryHeroId);
  };

  const handleSetPrimaryHero = (heroId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    ultraAudio.playUiClick();
    setPrimaryHeroId(heroId);
    setEditingHeroId(heroId);
    if (!selectedHeroIds.includes(heroId)) {
      setSelectedHeroIds((prev) => [...prev, heroId]);
    }
  };

  const handleUpdateHeroStat = (heroId: string, statKey: keyof ScenarioInitialStatsPct, value: number) => {
    setHeroStatsMap((prev) => ({
      ...prev,
      [heroId]: {
        ...(prev[heroId] || DEFAULT_STATS_PCT),
        [statKey]: value,
      },
    }));
  };

  // Quick stat presets
  const handleApplyStatPresetToHero = (heroId: string, preset: ScenarioInitialStatsPct) => {
    ultraAudio.playUiClick();
    setHeroStatsMap((prev) => ({
      ...prev,
      [heroId]: { ...preset },
    }));
  };

  const handleApplyStatPresetToAllSelected = (preset: ScenarioInitialStatsPct) => {
    ultraAudio.playUiClick();
    setHeroStatsMap((prev) => {
      const updated = { ...prev };
      selectedHeroIds.forEach((id) => {
        updated[id] = { ...preset };
      });
      return updated;
    });
  };

  const handleSyncPrimaryStatsToAll = () => {
    ultraAudio.playUiClick();
    const leadStats = heroStatsMap[primaryHeroId] || DEFAULT_STATS_PCT;
    setHeroStatsMap((prev) => {
      const updated = { ...prev };
      selectedHeroIds.forEach((id) => {
        updated[id] = { ...leadStats };
      });
      return updated;
    });
  };

  const buildStartupConfig = (): ScenarioStartupConfig => {
    return {
      activeHeroIds: selectedHeroIds,
      primaryHeroId: primaryHeroId,
      heroStatsMap: heroStatsMap,
      isRealTimeSync: isRealTimeSync,
    };
  };

  const handleApply = (applyGreeting: boolean = true) => {
    ultraAudio.playApiReplyChime();
    const startupCfg = buildStartupConfig();
    const scenarioToApply: ScenarioConfig = {
      ...(isEditing ? editForm : selectedScenario),
      boundRelationshipSlotId: boundSlotId !== 'none' ? boundSlotId : undefined,
      startupConfig: startupCfg,
    };

    onApplyScenario(scenarioToApply, applyGreeting, startupCfg);
    onClose();
  };

  const handleSaveCustom = () => {
    if (!editForm.name.trim()) return;
    ultraAudio.playApiReplyChime();
    const scId = editForm.id.startsWith('custom_') ? editForm.id : `custom_sc_${Date.now()}`;

    let finalBoundId = boundSlotId !== 'none' ? boundSlotId : undefined;

    // Linkage with relationship library
    if (syncToRelLibrary && onSaveCustomRelationshipSlot) {
      const syncSlotId = `custom_rel_from_${scId}`;
      const syncTitle = `✨ ${editForm.name.replace(/^[^\w\u4e00-\u9fa5]+/, '').trim() || editForm.name}`;
      const syncSlot: RelationshipSlot = {
        id: syncSlotId,
        title: syncTitle,
        category: mapScenarioCatToRelCat(editForm.category),
        description: editForm.description || `开局【${editForm.name}】的联动羁绊关系。`,
        stylePrompt: editForm.openingPrompt || '保持此开局剧情下的特定沟通态度与角色动作。',
        customTags: ['开局联动', '自定义绊结'],
        isCustom: true,
        conditions: {
          requiredScenarioId: scId,
          requiredScenarioCategory: editForm.category,
        },
      };
      onSaveCustomRelationshipSlot(syncSlot);
      finalBoundId = syncSlotId;
    }

    const startupCfg = buildStartupConfig();

    const newScenario: ScenarioConfig = {
      ...editForm,
      id: scId,
      category: 'custom',
      boundRelationshipSlotId: finalBoundId,
      startupConfig: startupCfg,
      initialStatsPct: heroStatsMap[primaryHeroId] || editForm.initialStatsPct || DEFAULT_STATS_PCT,
    };

    if (onSaveCustomScenario) {
      onSaveCustomScenario(newScenario);
    }
    setSelectedScenario(newScenario);
    setIsEditing(false);
  };

  const handleCaptureInGameScenario = () => {
    ultraAudio.playApiReplyChime();
    const newId = `custom_sc_${Date.now()}`;
    const activeHeroes = activeTeamIds && activeTeamIds.length > 0 ? activeTeamIds : (selectedHero ? [selectedHero.id] : ['beth']);
    const primaryId = selectedHero ? selectedHero.id : activeHeroes[0];

    const capturedScenario: ScenarioConfig = {
      id: newId,
      name: `自定义开局: ${selectedHero?.name || '特战小队'} (${new Date().toLocaleDateString('zh-CN')})`,
      category: 'custom',
      icon: '✨',
      interrogatorIdentity: currentScenario.interrogatorIdentity || '战术执政官',
      description: `捕获自局内实时阵容【${heroines.filter(h => activeHeroes.includes(h.id)).map(h => h.name).join('、')}】的定制开局预设。`,
      openingPrompt: currentScenario.openingPrompt || '目标已就位，进入战术评估与审讯推演阶段。',
      initialGreeting: currentScenario.initialGreeting || '……不管你们用什么手段，我都绝不会背叛我的信念与战友！',
      defaultEnvTheme: currentScenario.defaultEnvTheme || 'metal',
      isCustom: true,
      initialStatsPct: heroStatsMap[primaryId] || DEFAULT_STATS_PCT,
      startupConfig: {
        activeHeroIds: activeHeroes,
        primaryHeroId: primaryId,
        heroStatsMap: { ...heroStatsMap },
      },
    };

    setEditForm(capturedScenario);
    setSelectedScenario(capturedScenario);
    setSelectedHeroIds(activeHeroes);
    setPrimaryHeroId(primaryId);
    setEditingHeroId(primaryId);
    setIsEditing(true);
  };

  const handleCreateBlankScenario = () => {
    ultraAudio.playUiClick();
    const newId = `custom_sc_${Date.now()}`;
    const activeHeroes = selectedHero ? [selectedHero.id] : (heroines[0] ? [heroines[0].id] : ['beth']);
    const primaryId = activeHeroes[0];

    const blankScenario: ScenarioConfig = {
      id: newId,
      name: '新建自定义开局情境',
      category: 'custom',
      icon: '⚡',
      interrogatorIdentity: '未知审讯者 / 拘束者',
      description: '输入你的自定义开局情境描述与背景设定。',
      openingPrompt: '严格遵循当前设定的开局情境与角色心防状态展开互动。',
      initialGreeting: '……放开我！你们到底想干什么？！',
      defaultEnvTheme: 'metal',
      isCustom: true,
      initialStatsPct: { ...DEFAULT_STATS_PCT },
      startupConfig: {
        activeHeroIds: activeHeroes,
        primaryHeroId: primaryId,
        heroStatsMap: { ...heroStatsMap },
      },
    };

    setEditForm(blankScenario);
    setSelectedScenario(blankScenario);
    setSelectedHeroIds(activeHeroes);
    setPrimaryHeroId(primaryId);
    setEditingHeroId(primaryId);
    setIsEditing(true);
  };

  const currentEditingHero = heroines.find((h) => h.id === editingHeroId) || heroines[0];
  const currentEditingStats = heroStatsMap[editingHeroId] || DEFAULT_STATS_PCT;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="relative w-full max-w-5xl bg-zinc-950 border border-purple-500/50 rounded-xl shadow-[0_0_50px_rgba(168,85,247,0.25)] flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-purple-900/40 bg-gradient-to-r from-purple-950/70 via-zinc-900 to-zinc-950">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-purple-900/40 border border-purple-500/40 rounded-lg text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide text-white flex items-center space-x-2">
                <span>开局主角选择与剧情定制中心</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-600/40 font-mono">
                  支持多主角 & 各自数值独立配置
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                可自由勾选单人或多人主角小队共同开局，并分别自定义每位主角的初始生命、能量、意志、信任度与欲望数值！
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {/* Preset Selector Grid */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-purple-300 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>1. 选择开局剧情模式预设 (Presets Gallery)</span>
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCaptureInGameScenario}
                  className="px-2.5 py-1 rounded bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 border border-purple-500/50 text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                  title="将当前局内选中的主角、数值与环境保存为全新的开局预设"
                >
                  <Copy className="w-3 h-3 text-purple-300" />
                  <span>📥 捕获当前局内配置为新预设</span>
                </button>
                <button
                  type="button"
                  onClick={handleCreateBlankScenario}
                  className="px-2.5 py-1 rounded bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 border border-indigo-500/50 text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-indigo-300" />
                  <span>➕ 新建自定义剧情</span>
                </button>
                <span className="text-[11px] text-zinc-400">共 {allScenarios.length} 款预设</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
              {allScenarios.map((sc) => {
                const isSelected = selectedScenario.id === sc.id;
                return (
                  <div
                    key={sc.id}
                    onClick={() => handleSelectPreset(sc)}
                    className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between space-y-1.5 relative overflow-hidden cursor-pointer group ${
                      isSelected
                        ? 'bg-purple-950/80 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)] text-white ring-1 ring-purple-400/50'
                        : 'bg-zinc-900/70 border-zinc-800 hover:border-purple-800/60 hover:bg-zinc-800/80 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg">{sc.icon}</span>
                      <div className="flex items-center space-x-1">
                        {sc.isCustom && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-900 text-purple-200 border border-purple-600">
                            自定义
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-xs leading-tight break-words">{sc.name}</div>
                      <div className="text-[10px] text-zinc-400 font-mono mt-0.5 break-words">
                        对方: {sc.interrogatorIdentity}
                      </div>
                      {sc.boundRelationshipSlotId && (
                        <div className="text-[9px] text-pink-300 font-mono mt-1 px-1 py-0.5 rounded bg-pink-950/60 border border-pink-800/40 flex items-center space-x-1">
                          <Link className="w-2.5 h-2.5 inline text-pink-400 shrink-0" />
                          <span>已联动羁绊</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 👥 2. Protagonist Squad Selection & Individual Stats Customizer */}
          <div className="bg-zinc-900/90 border border-indigo-900/60 rounded-xl p-4 space-y-3.5 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  2. 选定开局主角（可多选）与各自初始六维数值配置
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono">
                  已选 {selectedHeroIds.length} 位主角 · 主控: {heroines.find((h) => h.id === primaryHeroId)?.name || '未指定'}
                </span>
              </div>

              {/* Sub-tabs */}
              <div className="flex items-center space-x-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setActiveHeroTab('roster');
                  }}
                  className={`px-3 py-1 rounded transition-all flex items-center space-x-1 cursor-pointer font-bold ${
                    activeHeroTab === 'roster'
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>主角阵容多选 ({selectedHeroIds.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setActiveHeroTab('stats');
                  }}
                  className={`px-3 py-1 rounded transition-all flex items-center space-x-1 cursor-pointer font-bold ${
                    activeHeroTab === 'stats'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>各主角初始数值分别微调</span>
                </button>
              </div>
            </div>

            {/* TAB 1: HERO ROSTER SELECTION */}
            {activeHeroTab === 'roster' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-400">
                    点击勾选参与开局剧情的主角（可多选组合为战术小队），并可指定其中一位为【主控第一主角】：
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleSelectOnlyPrimary}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-[11px] font-bold cursor-pointer"
                    >
                      仅选当前主角 (单人)
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAllHeroes}
                      className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 text-[11px] font-bold cursor-pointer"
                    >
                      全选所有在役角色 ({heroines.length}人全阵营)
                    </button>
                  </div>
                </div>

                {/* Faction & Sub-Faction Filter Bars */}
                <div className="space-y-1.5 bg-black/40 p-2 rounded-lg border border-zinc-800/80">
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin text-xs">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-cyan-400" />
                      <span>组织阵营:</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        setRosterFactionFilter('all');
                        setRosterSubFactionFilter('all');
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all shrink-0 cursor-pointer border ${
                        rosterFactionFilter === 'all'
                          ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                      }`}
                    >
                      全部阵营 ({heroines.length})
                    </button>

                    {factions.map((f) => {
                      const count = heroines.filter((h) => isHeroInFaction(h, f.id, factions)).length;
                      const isSelected = rosterFactionFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            ultraAudio.playUiClick();
                            setRosterFactionFilter(f.id);
                            setRosterSubFactionFilter('all');
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? 'bg-zinc-800 text-cyan-300 border-cyan-500 shadow-sm'
                              : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                          }`}
                        >
                          <span>{f.shortName || f.name}</span>
                          <span className="text-[9px] px-1 rounded-full bg-zinc-950 text-zinc-400 border border-zinc-700">
                            {count}
                          </span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        setRosterFactionFilter('unassigned');
                        setRosterSubFactionFilter('all');
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all shrink-0 cursor-pointer border ${
                        rosterFactionFilter === 'unassigned'
                          ? 'bg-zinc-800 text-white border-cyan-500 shadow-sm'
                          : 'bg-zinc-900/60 text-zinc-500 hover:text-zinc-300 border-zinc-800'
                      }`}
                    >
                      未指定
                    </button>
                  </div>

                  {/* Sub-Faction Branch Filter */}
                  {(() => {
                    const activeFaction = factions.find((f) => f.id === rosterFactionFilter);
                    const availableSubFactions = activeFaction
                      ? activeFaction.subFactions || []
                      : rosterFactionFilter === 'all'
                      ? factions.flatMap((f) => f.subFactions || [])
                      : [];

                    if (availableSubFactions.length === 0) return null;

                    return (
                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin text-xs pt-1 border-t border-zinc-800/40">
                        <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                          <Layers className="w-2.5 h-2.5 text-sky-400" />
                          <span>从属编制:</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            ultraAudio.playUiClick();
                            setRosterSubFactionFilter('all');
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all shrink-0 cursor-pointer border ${
                            rosterSubFactionFilter === 'all'
                              ? 'bg-sky-600 text-white border-sky-400 shadow-sm'
                              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                          }`}
                        >
                          全部编制
                        </button>

                        {availableSubFactions.map((sf) => {
                          const isSelected = rosterSubFactionFilter === sf.id;
                          const count = heroines.filter((h) => {
                            const mems = getHeroFactionMemberships(h, factions);
                            return mems.some((m) => m.subFactionId === sf.id);
                          }).length;

                          return (
                            <button
                              key={sf.id}
                              type="button"
                              onClick={() => {
                                ultraAudio.playUiClick();
                                setRosterSubFactionFilter(sf.id);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 border ${
                                isSelected
                                  ? 'bg-sky-950 text-sky-200 border-sky-500 shadow-sm ring-1 ring-sky-500/50'
                                  : 'bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                              }`}
                            >
                              <span>{sf.name}</span>
                              <span className="text-[9px] px-1 rounded-full bg-zinc-950 text-zinc-400 border border-zinc-700">
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Hero Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {heroines
                    .filter((hero) => {
                      if (rosterFactionFilter !== 'all') {
                        if (rosterFactionFilter === 'unassigned') {
                          if (!isHeroUnassigned(hero, factions)) return false;
                        } else {
                          if (!isHeroInFaction(hero, rosterFactionFilter, factions)) return false;
                        }
                      }
                      if (rosterSubFactionFilter !== 'all') {
                        const mems = getHeroFactionMemberships(hero, factions);
                        if (!mems.some((m) => m.subFactionId === rosterSubFactionFilter)) return false;
                      }
                      return true;
                    })
                    .map((hero) => {
                    const isSelected = selectedHeroIds.includes(hero.id);
                    const isPrimary = primaryHeroId === hero.id;
                    const heroMems = getHeroFactionMemberships(hero, factions);
                    const primMem = heroMems[0];
                    const primFac = primMem ? factions.find((f) => f.id === primMem.factionId) : undefined;
                    const primSub = primMem?.subFactionId ? getSubFactionById(factions, primMem.subFactionId) : undefined;
                    const primSubName = primMem?.subFactionName || primSub?.name;

                    return (
                      <div
                        key={hero.id}
                        onClick={() => handleToggleHeroSelect(hero.id)}
                        className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between space-y-2 relative overflow-hidden cursor-pointer group ${
                          isSelected
                            ? isPrimary
                              ? 'bg-amber-950/40 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/60'
                              : 'bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                            : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700 text-zinc-400 opacity-65 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: hero.colorTheme?.primary || '#3b82f6' }}
                            />
                            <span className="font-bold text-xs text-white truncate max-w-[90px]">
                              {hero.name}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1">
                            {isSelected && (
                              <span className="w-4 h-4 rounded-full bg-cyan-500 text-black flex items-center justify-center text-[10px] font-bold">
                                ✓
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Faction & Sub-Faction Badges */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {primFac ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/70 text-amber-300 border border-amber-500/30 truncate flex items-center gap-0.5 max-w-[120px]">
                              <Shield className="w-2 h-2 text-amber-400 shrink-0" />
                              <span className="truncate">{primFac.shortName || primFac.name}</span>
                            </span>
                          ) : (
                            <span className="text-[9px] px-1 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                              自由势力
                            </span>
                          )}
                          {primSubName && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-300 border border-sky-500/30 truncate flex items-center gap-0.5 max-w-[110px]">
                              <Layers className="w-2 h-2 text-sky-400 shrink-0" />
                              <span className="truncate">{primSubName}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-zinc-800/60">
                          <span className="text-zinc-400 truncate">{hero.title || '在役主角'}</span>
                          {isPrimary ? (
                            <span className="flex items-center space-x-0.5 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                              <Crown className="w-2.5 h-2.5" />
                              <span>主控主角</span>
                            </span>
                          ) : isSelected ? (
                            <button
                              type="button"
                              onClick={(e) => handleSetPrimaryHero(hero.id, e)}
                              className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 hover:bg-amber-950 text-zinc-400 hover:text-amber-300 border border-zinc-700 hover:border-amber-500/50 transition-colors font-bold cursor-pointer"
                            >
                              设为主控
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: INDIVIDUAL INITIAL STATS TUNER */}
            {activeHeroTab === 'stats' && (
              <div className="space-y-3 animate-fade-in font-mono text-xs">
                {/* Hero Selector Tabs */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  <span className="text-[11px] font-bold text-zinc-500 shrink-0 mr-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    <span>选择调节目标:</span>
                  </span>

                  {selectedHeroIds.map((hId) => {
                    const hero = heroines.find((h) => h.id === hId);
                    if (!hero) return null;
                    const isCur = editingHeroId === hId;
                    const isPrimary = primaryHeroId === hId;

                    return (
                      <button
                        key={hId}
                        type="button"
                        onClick={() => {
                          ultraAudio.playUiClick();
                          setEditingHeroId(hId);
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 border ${
                          isCur
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: hero.colorTheme?.primary || '#3b82f6' }}
                        />
                        <span>{hero.name}</span>
                        {isPrimary && <Crown className="w-3 h-3 text-amber-300" />}
                      </button>
                    );
                  })}
                </div>

                {/* Stat Tuning Card for Current Editing Hero */}
                <div className="bg-black/60 border border-indigo-900/50 p-3.5 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: currentEditingHero.colorTheme?.primary || '#3b82f6' }}
                      />
                      <span className="font-bold text-sm text-indigo-200">
                        正在配置【{currentEditingHero.name}】的开局初始数值
                      </span>
                      {primaryHeroId === currentEditingHero.id && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 border border-amber-600/50 text-amber-300 font-bold">
                          👑 主控角色
                        </span>
                      )}
                    </div>

                    {/* Quick Presets for this hero */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          handleApplyStatPresetToHero(currentEditingHero.id, {
                            hpPct: 100,
                            energyPct: 100,
                            moralePct: 100,
                            trustPct: 50,
                            shamePct: 0,
                            lustPct: 0,
                          })
                        }
                        className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 cursor-pointer"
                      >
                        ⚡ 满状态
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleApplyStatPresetToHero(currentEditingHero.id, {
                            hpPct: 15,
                            energyPct: 5,
                            moralePct: 30,
                            trustPct: 30,
                            shamePct: 30,
                            lustPct: 0,
                          })
                        }
                        className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/50 cursor-pointer"
                      >
                        💔 濒死虚脱
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleApplyStatPresetToHero(currentEditingHero.id, {
                            hpPct: 80,
                            energyPct: 60,
                            moralePct: 10,
                            trustPct: 95,
                            shamePct: 75,
                            lustPct: 80,
                          })
                        }
                        className="px-2 py-0.5 rounded bg-fuchsia-950/80 hover:bg-fuchsia-900 text-fuchsia-300 border border-fuchsia-700/50 cursor-pointer"
                      >
                        💖 完全顺从
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleApplyStatPresetToHero(currentEditingHero.id, {
                            hpPct: 100,
                            energyPct: 100,
                            moralePct: 100,
                            trustPct: 0,
                            shamePct: 0,
                            lustPct: 0,
                          })
                        }
                        className="px-2 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/50 cursor-pointer"
                      >
                        🛡️ 坚贞不屈
                      </button>
                    </div>
                  </div>

                  {/* 6-Dimensional Slider Controls */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
                    {/* HP */}
                    <div className="bg-zinc-950 p-2 rounded-lg border border-emerald-900/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-300 font-bold">❤️ HP 生命值:</span>
                        <span className="text-emerald-400 font-bold font-mono">
                          {currentEditingStats.hpPct ?? 100}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentEditingStats.hpPct ?? 100}
                        onChange={(e) =>
                          handleUpdateHeroStat(currentEditingHero.id, 'hpPct', Number(e.target.value))
                        }
                        className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                      />
                    </div>

                    {/* Energy */}
                    <div className="bg-zinc-950 p-2 rounded-lg border border-cyan-900/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-cyan-300 font-bold">⚡ 能量 Energy:</span>
                        <span className="text-cyan-400 font-bold font-mono">
                          {currentEditingStats.energyPct ?? 100}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentEditingStats.energyPct ?? 100}
                        onChange={(e) =>
                          handleUpdateHeroStat(currentEditingHero.id, 'energyPct', Number(e.target.value))
                        }
                        className="w-full accent-cyan-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                      />
                    </div>

                    {/* Morale */}
                    <div className="bg-zinc-950 p-2 rounded-lg border border-amber-900/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-300 font-bold">🛡️ 意志 Morale:</span>
                        <span className="text-amber-400 font-bold font-mono">
                          {currentEditingStats.moralePct ?? 100}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentEditingStats.moralePct ?? 100}
                        onChange={(e) =>
                          handleUpdateHeroStat(currentEditingHero.id, 'moralePct', Number(e.target.value))
                        }
                        className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                      />
                    </div>

                    {/* Trust / Obedience */}
                    <div className="bg-zinc-950 p-2 rounded-lg border border-purple-900/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-purple-300 font-bold">🤝 信任 Trust:</span>
                        <span className="text-purple-400 font-bold font-mono">
                          {currentEditingStats.trustPct ?? 50}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentEditingStats.trustPct ?? 50}
                        onChange={(e) =>
                          handleUpdateHeroStat(currentEditingHero.id, 'trustPct', Number(e.target.value))
                        }
                        className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                      />
                    </div>

                    {/* Shame */}
                    <div className="bg-zinc-950 p-2 rounded-lg border border-rose-900/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-rose-300 font-bold">😳 羞耻 Shame:</span>
                        <span className="text-rose-400 font-bold font-mono">
                          {currentEditingStats.shamePct ?? 0}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentEditingStats.shamePct ?? 0}
                        onChange={(e) =>
                          handleUpdateHeroStat(currentEditingHero.id, 'shamePct', Number(e.target.value))
                        }
                        className="w-full accent-rose-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                      />
                    </div>

                    {/* Lust */}
                    <div className="bg-zinc-950 p-2 rounded-lg border border-fuchsia-900/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-fuchsia-300 font-bold">💓 欲望 Lust:</span>
                        <span className="text-fuchsia-400 font-bold font-mono">
                          {currentEditingStats.lustPct ?? 0}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentEditingStats.lustPct ?? 0}
                        onChange={(e) =>
                          handleUpdateHeroStat(currentEditingHero.id, 'lustPct', Number(e.target.value))
                        }
                        className="w-full accent-fuchsia-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Batch Global Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800 text-[11px]">
                    <span className="text-zinc-500">
                      💡 提示：所设置的数值将在开局时直接生效并注入 AI 态度系统（低 HP 虚弱/高信任顺从）。
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleSyncPrimaryStatsToAll}
                        className="px-2.5 py-1 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/60 font-bold cursor-pointer"
                        title="将当前主控主角的六维数值一键同步赋予给所有已选主角"
                      >
                        🔄 一键将主控数值同步给全员
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Scenario Details & Custom Editor */}
          <div className="bg-zinc-900/90 border border-purple-900/50 rounded-xl p-4 space-y-3.5 shadow-inner">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{isEditing ? editForm.icon : selectedScenario.icon}</span>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <span>{isEditing ? editForm.name : selectedScenario.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-900/80 text-purple-200 border border-purple-600/50 font-mono">
                      交互对方: {isEditing ? editForm.interrogatorIdentity : selectedScenario.interrogatorIdentity}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isEditing ? editForm.description : selectedScenario.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {onDeleteCustomScenario && selectedScenario.isCustom && (
                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      if (confirm(`确定要删除副本【${selectedScenario.name}】吗？`)) {
                        onDeleteCustomScenario(selectedScenario.id);
                        const remaining = allScenarios.filter((s) => s.id !== selectedScenario.id);
                        if (remaining.length > 0) {
                          setSelectedScenario(remaining[0]);
                          setEditForm(remaining[0]);
                        }
                      }
                    }}
                    title="删除当前选择的副本"
                    className="px-2.5 py-1.5 rounded border border-rose-800/80 bg-rose-950/50 hover:bg-rose-900 text-rose-200 text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>删除副本</span>
                  </button>
                )}

                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setIsEditing(true);
                      setEditForm(selectedScenario);
                    }}
                    className="px-2.5 py-1.5 rounded border border-purple-800 bg-purple-950/50 hover:bg-purple-900 text-purple-200 text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>微调/自定义此剧情 Prompt</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setIsEditing(false);
                      setEditForm(selectedScenario);
                    }}
                    className="px-2.5 py-1.5 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    取消编辑
                  </button>
                )}
              </div>
            </div>

            {/* Custom Scenario Editing Form */}
            {isEditing ? (
              <div className="space-y-3 pt-1 animate-fade-in font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-bold">剧情预设名称</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="如: 🚀 我的自定义开局"
                      className="w-full bg-zinc-950 border border-purple-900/70 p-2 rounded text-zinc-100 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-bold">交互对方角色身份称号</label>
                    <input
                      type="text"
                      value={editForm.interrogatorIdentity}
                      onChange={(e) => setEditForm({ ...editForm, interrogatorIdentity: e.target.value })}
                      placeholder="如: 战术联合搭档 / 银河医师 / 宇宙审讯官"
                      className="w-full bg-zinc-950 border border-purple-900/70 p-2 rounded text-zinc-100 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-bold">建议开局环境舱</label>
                    <select
                      value={editForm.defaultEnvTheme || 'glass'}
                      onChange={(e) =>
                        setEditForm({ ...editForm, defaultEnvTheme: e.target.value as EnvironmentTheme })
                      }
                      className="w-full bg-zinc-950 border border-purple-900/70 p-2 rounded text-zinc-100 focus:outline-none focus:border-purple-500 cursor-pointer"
                    >
                      {Object.entries(ENV_DAILY_EFFECTS).map(([key, item]) => (
                        <option key={key} value={key}>
                          {item.name} ({key})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-bold">开局背景简述</label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="简要描述开局发生的故事情节..."
                    className="w-full bg-zinc-950 border border-purple-900/70 p-2 rounded text-zinc-100 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-purple-300 mb-1 font-bold flex items-center space-x-1">
                    <Sliders className="w-3.5 h-3.5 text-purple-400" />
                    <span>注入 API 对话的开局剧情 & 关系导引 System Prompt</span>
                  </label>
                  <textarea
                    rows={4}
                    value={editForm.openingPrompt}
                    onChange={(e) => setEditForm({ ...editForm, openingPrompt: e.target.value })}
                    placeholder="写入发送给 API 大模型的剧情导引 Prompt..."
                    className="w-full bg-black/90 border border-purple-900/70 p-2.5 rounded text-purple-200 text-xs font-mono focus:outline-none focus:border-purple-500 leading-relaxed scrollbar-thin"
                  />
                </div>

                <div>
                  <label className="block text-emerald-300 mb-1 font-bold flex items-center space-x-1">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>场景开启时角色的初始台词 (Initial Greeting)</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.initialGreeting || ''}
                    onChange={(e) => setEditForm({ ...editForm, initialGreeting: e.target.value })}
                    placeholder="角色进入该场景时的第一句台词..."
                    className="w-full bg-zinc-950 border border-emerald-900/70 p-2 rounded text-emerald-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* ⚡ 双向联动设置: 绑定角色关系与羁绊 */}
                <div className="bg-purple-950/30 border border-purple-800/50 p-2.5 rounded-lg space-y-2">
                  <label className="block text-purple-300 font-bold flex items-center space-x-1.5 text-xs">
                    <Link className="w-3.5 h-3.5 text-purple-400" />
                    <span>开局与角色羁绊双向联动 (Scenario & Relationship Linkage)</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-400 block mb-1">选择要关联合并绑定的关系预设:</span>
                      <select
                        value={boundSlotId}
                        onChange={(e) => setBoundSlotId(e.target.value)}
                        className="w-full bg-zinc-950 border border-purple-800/70 p-2 rounded text-zinc-100 focus:outline-none focus:border-purple-500 cursor-pointer"
                      >
                        <option value="none">无特定绑定 (按关系数值动态匹配)</option>
                        {relationshipSlots.map((slot) => (
                          <option key={slot.id} value={slot.id}>
                            {slot.title} ({slot.isCustom ? '自定义' : '预设'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center space-x-2 pt-3">
                      <label className="flex items-center space-x-2 cursor-pointer text-purple-200 bg-purple-900/40 p-2 rounded border border-purple-700/50 hover:bg-purple-900/60 transition-colors">
                        <input
                          type="checkbox"
                          checked={syncToRelLibrary}
                          onChange={(e) => setSyncToRelLibrary(e.target.checked)}
                          className="w-4 h-4 rounded accent-purple-500 bg-zinc-900 border-purple-700"
                        />
                        <span className="font-bold text-[11px]">⚡ 保存时同步在【关系预设库】自动创建/更新此羁绊</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveCustom}
                    className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center space-x-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>保存为新自定义开局预设</span>
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode - Details Display */
              <div className="space-y-3 font-mono text-xs">
                <div className="bg-black/80 border border-purple-900/40 p-3 rounded-lg space-y-2">
                  <div className="text-purple-300 font-bold flex items-center justify-between">
                    <span>📌 剧情与双方关系 Prompt 导引 (已自动关联 API 对话)：</span>
                    <span className="text-[10px] text-zinc-400">实时注入系统 Prompt</span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-[11px] bg-zinc-950/80 p-2.5 rounded border border-zinc-800">
                    {selectedScenario.openingPrompt}
                  </p>
                </div>

                {selectedScenario.initialGreeting && (
                  <div className="bg-emerald-950/20 border border-emerald-800/40 p-3 rounded-lg space-y-1">
                    <div className="text-emerald-400 font-bold text-[11px] flex items-center space-x-1">
                      <MessageSquare className="w-3.5 h-3.5 inline" />
                      <span>开局场景独白/第一句台词：</span>
                    </div>
                    <p className="text-emerald-200 italic text-[11px] pl-2 border-l-2 border-emerald-500">
                      {selectedScenario.initialGreeting}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-purple-900/40 bg-zinc-950">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="flex items-center space-x-2 cursor-pointer bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 px-2.5 py-1.5 rounded-lg transition-all">
              <input
                type="checkbox"
                checked={isRealTimeSync}
                onChange={(e) => setIsRealTimeSync(e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-500 bg-zinc-900 border-cyan-700"
              />
              <span className="text-xs font-bold text-cyan-200 flex items-center space-x-1">
                <span>⏰ 开启现实真实时间同步模式</span>
              </span>
            </label>

            <div className="text-xs text-zinc-400 flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5 text-amber-400 inline shrink-0" />
              <span>
                已选 <strong>{selectedHeroIds.length}</strong> 位主角独立应用数值。
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleApply(false)}
              className="px-3 py-2 rounded-lg border border-purple-800 bg-purple-950/60 hover:bg-purple-900 text-purple-200 font-bold text-xs transition-all cursor-pointer"
            >
              仅应用剧情与数值 (保持当前话语)
            </button>
            <button
              onClick={() => handleApply(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>应用并开启新剧情 (替换开局台词)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
