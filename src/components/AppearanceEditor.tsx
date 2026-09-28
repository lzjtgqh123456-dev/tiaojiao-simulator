import React, { useState, useEffect } from 'react';
import { Ultrawoman, Faction, CharacterAppearance, HeroFactionMembership } from '../types';
import { Sparkles, Eye, Shield, Tag, Plus, Trash2, Check, RefreshCw, Layers, Edit3, X, Save, AlertTriangle, Crown, ArrowUp, ArrowDown, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { ultraAudio } from '../utils/audio';
import {
  DEFAULT_FACTIONS,
  getFactionById,
  getHeroFactionMemberships,
  addOrUpdateHeroFactionMembership,
  removeHeroFromFaction,
  moveHeroFactionPriority,
  setHeroFactionAsPrimary,
  FACTION_MEMBERSHIP_TITLE_PRESETS,
} from '../data/factions';
import { RaceDefinition, DEFAULT_RACES, loadRacesFromStorage, saveRacesToStorage } from '../data/races';

interface AppearanceEditorProps {
  hero: Ultrawoman;
  factions: Faction[];
  onUpdateHero: (updatedHero: Ultrawoman) => void;
  onOpenFactionTab?: () => void;
}

const TRAIT_SUGGESTIONS = [
  '高纯光子体质',
  '中枢致命依赖',
  '神经末梢异常敏感',
  '受击时体表微光闪烁',
  '能量抽拔时极度虚脱',
  '纳米自愈缓慢',
  '催眠易感体质',
  '紧身战甲触觉放大',
  '心率过载剧烈喘息',
  '意志动摇时能量外泄',
  '冰火抗性脆弱',
  '光灵解离反应',
];

export const AppearanceEditor: React.FC<AppearanceEditorProps> = ({
  hero,
  factions = DEFAULT_FACTIONS,
  onUpdateHero,
  onOpenFactionTab,
}) => {
  const [racesList, setRacesList] = useState<RaceDefinition[]>(() => loadRacesFromStorage());
  const [newTraitInput, setNewTraitInput] = useState('');
  
  // Custom Race Creator/Editor state
  const [isRaceFormOpen, setIsRaceFormOpen] = useState(false);
  const [editingRaceId, setEditingRaceId] = useState<string | null>(null);
  const [raceFormName, setRaceFormName] = useState('');
  const [raceFormTraits, setRaceFormTraits] = useState('');
  const [raceFormDesc, setRaceFormDesc] = useState('');

  // Persist races whenever list changes
  useEffect(() => {
    saveRacesToStorage(racesList);
  }, [racesList]);

  const currentAppearance: CharacterAppearance = hero.appearance || {
    hairStyle: '',
    eyeColor: '',
    skinTone: '',
    bodyFeatures: '',
    outfit: '',
    accessories: '',
    customVisualPrompt: '',
  };

  const handleAppearanceChange = (key: keyof CharacterAppearance, val: string) => {
    const updatedAppearance: CharacterAppearance = {
      ...currentAppearance,
      [key]: val,
    };
    onUpdateHero({
      ...hero,
      appearance: updatedAppearance,
    });
  };

  const handleRaceChange = (newRace: string) => {
    onUpdateHero({
      ...hero,
      race: newRace,
    });
  };

  const handleAddTrait = (traitToAdd: string) => {
    if (!traitToAdd.trim()) return;
    ultraAudio.playUiClick();
    const currentTraits = Array.isArray(hero.raceTraits) ? [...hero.raceTraits] : [];
    if (!currentTraits.includes(traitToAdd.trim())) {
      currentTraits.push(traitToAdd.trim());
      onUpdateHero({
        ...hero,
        raceTraits: currentTraits,
      });
    }
    setNewTraitInput('');
  };

  const handleRemoveTrait = (traitToRemove: string) => {
    ultraAudio.playUiClick();
    const currentTraits = Array.isArray(hero.raceTraits) ? [...hero.raceTraits] : [];
    const updatedTraits = currentTraits.filter((t) => t !== traitToRemove);
    onUpdateHero({
      ...hero,
      raceTraits: updatedTraits,
    });
  };

  const handleSelectRacePreset = (preset: RaceDefinition) => {
    ultraAudio.playUiClick();
    onUpdateHero({
      ...hero,
      race: preset.name,
      raceTraits: [...preset.traits],
    });
  };

  const handleClearHeroRace = () => {
    ultraAudio.playUiClick();
    onUpdateHero({
      ...hero,
      race: '',
      raceTraits: [],
    });
  };

  // Delete a race preset or custom race
  const handleDeleteRace = (raceId: string, raceName: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    ultraAudio.playUiClick();
    if (window.confirm(`确定要从种族库中彻底删除种族【${raceName}】吗？`)) {
      setRacesList((prev) => prev.filter((r) => r.id !== raceId));
      if (hero.race === raceName) {
        // If current hero uses this race, keep character text or clear
      }
    }
  };

  // Open Race Creator
  const handleOpenNewRaceForm = () => {
    ultraAudio.playUiClick();
    setEditingRaceId(null);
    setRaceFormName('');
    setRaceFormTraits(hero.raceTraits?.join('，') || '高纯光子体质，能量中枢依赖');
    setRaceFormDesc('');
    setIsRaceFormOpen(true);
  };

  // Open Race Editor
  const handleOpenEditRaceForm = (race: RaceDefinition, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    ultraAudio.playUiClick();
    setEditingRaceId(race.id);
    setRaceFormName(race.name);
    setRaceFormTraits(race.traits.join('，'));
    setRaceFormDesc(race.description || '');
    setIsRaceFormOpen(true);
  };

  // Save Race (create or edit)
  const handleSaveRaceForm = () => {
    if (!raceFormName.trim()) return;
    ultraAudio.playUiClick();

    const traitsArray = raceFormTraits
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingRaceId) {
      setRacesList((prev) =>
        prev.map((r) =>
          r.id === editingRaceId
            ? {
                ...r,
                name: raceFormName.trim(),
                traits: traitsArray,
                description: raceFormDesc.trim(),
              }
            : r
        )
      );
      if (hero.race === raceFormName.trim()) {
        onUpdateHero({
          ...hero,
          race: raceFormName.trim(),
          raceTraits: traitsArray,
        });
      }
    } else {
      const newRace: RaceDefinition = {
        id: `race_custom_${Date.now()}`,
        name: raceFormName.trim(),
        traits: traitsArray,
        description: raceFormDesc.trim() || '自定义血脉种族',
        isPreset: false,
      };
      setRacesList((prev) => [...prev, newRace]);
      // Also apply to current hero
      onUpdateHero({
        ...hero,
        race: newRace.name,
        raceTraits: [...newRace.traits],
      });
    }

    setIsRaceFormOpen(false);
  };

  // Restore Default Races
  const handleRestoreDefaultRaces = () => {
    ultraAudio.playUiClick();
    if (window.confirm('确定要重置并恢复所有系统默认预设种族吗？（自定义种族将被覆盖为初始预设列表）')) {
      setRacesList(DEFAULT_RACES);
    }
  };

  // Multi-Faction Membership State
  const [isAddingFaction, setIsAddingFaction] = useState(false);
  const [newFactionId, setNewFactionId] = useState<string>(factions[0]?.id || '');
  const [newSubFactionId, setNewSubFactionId] = useState<string>('none');
  const [newSubFactionOnly, setNewSubFactionOnly] = useState<boolean>(false);
  const [newRole, setNewRole] = useState<string>('战术特勤');
  const [newTitle, setNewTitle] = useState<string>('多重身份');
  const [newCustomNotes, setNewCustomNotes] = useState<string>('');
  const [editingFactionId, setEditingFactionId] = useState<string | null>(null);
  const [editRoleInput, setEditRoleInput] = useState<string>('');
  const [editTitleInput, setEditTitleInput] = useState<string>('');
  const [editNotesInput, setEditNotesInput] = useState<string>('');

  const currentMemberships = getHeroFactionMemberships(hero, factions);

  const handleAddFaction = () => {
    ultraAudio.playUiClick();
    if (!newFactionId) return;
    const targetFac = factions.find((f) => f.id === newFactionId);
    const subObj = newSubFactionId !== 'none' ? targetFac?.subFactions?.find((s) => s.id === newSubFactionId) : undefined;
    const isSubOnly = Boolean(newSubFactionOnly);

    const updated = addOrUpdateHeroFactionMembership(hero, {
      factionId: newFactionId,
      subFactionId: newSubFactionId !== 'none' ? newSubFactionId : undefined,
      subFactionName: subObj?.name,
      role: newRole.trim() || (isSubOnly ? '编制干员' : '战术特勤'),
      title: newTitle.trim() || (isSubOnly ? '从属编制干员' : '多重身份'),
      customNotes: newCustomNotes.trim() || undefined,
      priority: currentMemberships.length + 1,
      membershipType: isSubOnly ? 'sub_unit_only' : 'foreign_subordinate',
      subFactionOnly: isSubOnly,
      affiliationNature: isSubOnly ? '独立从属编制' : undefined,
    });
    onUpdateHero(updated);
    setIsAddingFaction(false);
    setNewSubFactionId('none');
    setNewSubFactionOnly(false);
    setNewRole('战术特勤');
    setNewTitle('多重身份');
    setNewCustomNotes('');
  };

  const handleRemoveFaction = (factionId: string) => {
    ultraAudio.playUiClick();
    const updated = removeHeroFromFaction(hero, factionId);
    onUpdateHero(updated);
  };

  const handleMovePriority = (factionId: string, direction: 'up' | 'down') => {
    ultraAudio.playUiClick();
    const updated = moveHeroFactionPriority(hero, factionId, direction);
    onUpdateHero(updated);
  };

  const handleSetPrimary = (factionId: string) => {
    ultraAudio.playUiClick();
    const updated = setHeroFactionAsPrimary(hero, factionId);
    onUpdateHero(updated);
  };

  const handleSaveEditMembership = (factionId: string) => {
    ultraAudio.playUiClick();
    const existing = currentMemberships.find((m) => m.factionId === factionId);
    const updated = addOrUpdateHeroFactionMembership(hero, {
      factionId,
      role: editRoleInput.trim() || existing?.role || '战术成员',
      title: editTitleInput.trim() || existing?.title,
      customNotes: editNotesInput.trim() || undefined,
      priority: existing?.priority,
    });
    onUpdateHero(updated);
    setEditingFactionId(null);
  };

  return (
    <div className="space-y-6 font-mono text-zinc-100">
      
      {/* 1. Race and Biological Traits */}
      <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800/80 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
          <div className="flex items-center space-x-2">
            <span className="text-base">🧬</span>
            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
              <span>种族起源与生理血脉特质 (`race` & `raceTraits`)</span>
              <span className="text-[10px] bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                共 {racesList.length} 个种族预设 (支持随时删除/自定义)
              </span>
            </h3>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRestoreDefaultRaces}
              className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              title="恢复系统默认预设种族列表"
            >
              <RefreshCw className="w-3 h-3" />
              <span>恢复默认种族</span>
            </button>

            <button
              type="button"
              onClick={handleOpenNewRaceForm}
              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建自定义种族</span>
            </button>
          </div>
        </div>

        {/* Inline Race Creator / Editor Form */}
        {isRaceFormOpen && (
          <div className="bg-zinc-900/95 border border-indigo-500/60 rounded-xl p-3.5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <h4 className="text-xs font-bold text-indigo-300 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>{editingRaceId ? '编辑种族预设' : '创建新种族预设 / 自定义血脉'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsRaceFormOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-bold mb-1">种族名称 / 血统称号:</label>
                <input
                  type="text"
                  value={raceFormName}
                  onChange={(e) => setRaceFormName(e.target.value)}
                  placeholder="例如：原初光灵族、赛博机娘姬、深渊魅魔..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-indigo-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-bold mb-1">生理特质标签 (逗号分割):</label>
                <input
                  type="text"
                  value={raceFormTraits}
                  onChange={(e) => setRaceFormTraits(e.target.value)}
                  placeholder="高纯光子体质，能量依赖，暗影抗性脆弱..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-300 font-bold mb-1 text-xs">种族生理与受损反应简述:</label>
              <input
                type="text"
                value={raceFormDesc}
                onChange={(e) => setRaceFormDesc(e.target.value)}
                placeholder="简述该种族在受击、抽能、触碰或精神受创时的生理特征..."
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setIsRaceFormOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveRaceForm}
                disabled={!raceFormName.trim()}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{editingRaceId ? '更新保存种族' : '存入种族库'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Race Presets Grid with Delete Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-bold">
            <span>可选择与管理的种族预设列表 (点击套用，悬停或点击 🗑️ 可随时删除预设):</span>
            {hero.race && (
              <button
                type="button"
                onClick={handleClearHeroRace}
                className="text-rose-400 hover:text-rose-300 text-[10px] underline cursor-pointer"
                title="清空当前角色的种族与特质"
              >
                清空当前角色种族
              </button>
            )}
          </div>

          {racesList.length === 0 ? (
            <div className="text-center py-4 bg-zinc-900/40 rounded-lg border border-zinc-800 text-zinc-500 text-xs space-y-2">
              <p>种族库已清空，当前暂无任何种族预设</p>
              <button
                type="button"
                onClick={handleRestoreDefaultRaces}
                className="px-3 py-1 bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 rounded text-xs font-bold hover:bg-indigo-600/50 cursor-pointer"
              >
                点击恢复默认种族预设
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {racesList.map((p) => {
                const isSelected = hero.race === p.name;
                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-lg border transition-all flex flex-col justify-between space-y-1.5 ${
                      isSelected
                        ? 'bg-indigo-950/80 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                        : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        onClick={() => handleSelectRacePreset(p)}
                        className="flex items-center gap-1.5 font-bold text-xs cursor-pointer flex-1 truncate"
                        title={`点击套用种族【${p.name}】`}
                      >
                        <span className={isSelected ? 'text-indigo-300' : 'text-zinc-200'}>
                          {p.name}
                        </span>
                        {isSelected && <Check className="w-3 h-3 text-indigo-400 shrink-0" />}
                        {p.isPreset && (
                          <span className="text-[9px] bg-zinc-950 text-zinc-500 px-1 py-0.2 rounded border border-zinc-800">
                            预设
                          </span>
                        )}
                      </div>

                      {/* Action buttons: Edit and Delete */}
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditRaceForm(p, e)}
                          className="p-1 text-zinc-500 hover:text-indigo-300 transition-colors cursor-pointer"
                          title="编辑此种族"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRace(p.id, p.name, e)}
                          className="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title={`删除种族预设【${p.name}】`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Traits tags */}
                    <div className="flex flex-wrap gap-1">
                      {p.traits.slice(0, 3).map((tr) => (
                        <span
                          key={tr}
                          className="text-[9px] bg-zinc-950/80 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-800 truncate max-w-[110px]"
                        >
                          {tr}
                        </span>
                      ))}
                      {p.traits.length > 3 && (
                        <span className="text-[9px] text-zinc-500">+{p.traits.length - 3}</span>
                      )}
                    </div>

                    {/* Apply Button */}
                    <button
                      type="button"
                      onClick={() => handleSelectRacePreset(p)}
                      className={`w-full py-1 rounded text-[10px] font-bold transition-all text-center cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/50'
                          : 'bg-zinc-800 hover:bg-indigo-600 hover:text-white text-zinc-300'
                      }`}
                    >
                      {isSelected ? '✓ 当前已生效' : '套用到此角色'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Race Name Input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-zinc-850">
          <div>
            <label className="block text-zinc-300 font-bold mb-1">当前角色直接输入的种族名称</label>
            <input
              type="text"
              value={hero.race || ''}
              onChange={(e) => handleRaceChange(e.target.value)}
              placeholder="例如：巨人族、纯血魅魔族、深空机巧族..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-bold mb-1">为当前角色新增生理特质标签</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTraitInput}
                onChange={(e) => setNewTraitInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTrait(newTraitInput);
                  }
                }}
                placeholder="输入生理特性并回车添加..."
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100 focus:border-indigo-500 outline-none text-xs"
              />
              <button
                onClick={() => handleAddTrait(newTraitInput)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加</span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Race Traits Tags */}
        <div className="space-y-2">
          <label className="block text-[11px] text-zinc-400 font-bold">当前角色已配置的种族生理特质:</label>
          <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-zinc-900/60 rounded-lg border border-zinc-800/80">
            {Array.isArray(hero.raceTraits) && hero.raceTraits.length > 0 ? (
              hero.raceTraits.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-md bg-indigo-950/80 border border-indigo-500/50 text-indigo-200 text-xs flex items-center gap-1.5 font-bold"
                >
                  <span>🧬 {t}</span>
                  <button
                    onClick={() => handleRemoveTrait(t)}
                    className="text-indigo-400 hover:text-rose-400 cursor-pointer text-xs"
                    title="移除此特质"
                  >
                    ×
                  </button>
                </span>
              ))
            ) : (
              <span className="text-xs text-zinc-500">暂无种族特质，可点击上方推荐词或从种族预设中套用</span>
            )}
          </div>

          {/* Trait Suggestions */}
          <div className="flex flex-wrap gap-1 items-center pt-1">
            <span className="text-[10px] text-zinc-500 mr-1">推荐特质:</span>
            {TRAIT_SUGGESTIONS.map((sug) => {
              const hasIt = hero.raceTraits?.includes(sug);
              if (hasIt) return null;
              return (
                <button
                  key={sug}
                  onClick={() => handleAddTrait(sug)}
                  className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-indigo-300 border border-zinc-800 transition-colors cursor-pointer"
                >
                  + {sug}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Detailed Appearance Profile */}
      <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800/80 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4 text-pink-400" />
            <h3 className="text-xs font-bold text-pink-300 uppercase tracking-wider">
              详细外貌与身形装束设定 (`appearance`)
            </h3>
          </div>
          <span className="text-[10px] text-zinc-400">
            细致描绘角色发型、瞳色、肤质、战甲与身段，AI 将在对白动作中生动呈现
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-zinc-300 font-bold mb-1">发型与发色 (`hairStyle`)</label>
            <input
              type="text"
              value={currentAppearance.hairStyle || ''}
              onChange={(e) => handleAppearanceChange('hairStyle', e.target.value)}
              placeholder="例如：银白色及腰双马尾、璀璨金发大波浪..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-pink-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-bold mb-1">瞳色与眼神特征 (`eyeColor`)</label>
            <input
              type="text"
              value={currentAppearance.eyeColor || ''}
              onChange={(e) => handleAppearanceChange('eyeColor', e.target.value)}
              placeholder="例如：澄澈湛蓝光瞳、泛起羞耻泪光的粉紫瞳..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-pink-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-bold mb-1">肤色与肤质 (`skinTone`)</label>
            <input
              type="text"
              value={currentAppearance.skinTone || ''}
              onChange={(e) => handleAppearanceChange('skinTone', e.target.value)}
              placeholder="例如：白皙柔嫩如凝脂、微透光芒的白玉光子肌肤..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-pink-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-bold mb-1">身段体态与曲线特征 (`bodyFeatures`)</label>
            <input
              type="text"
              value={currentAppearance.bodyFeatures || ''}
              onChange={(e) => handleAppearanceChange('bodyFeatures', e.target.value)}
              placeholder="例如：高挑丰满、纤细腰肢、修长柔韧的双腿与柔美锁骨..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-pink-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-bold mb-1">战甲/紧身衣装束风格 (`outfit`)</label>
            <input
              type="text"
              value={currentAppearance.outfit || ''}
              onChange={(e) => handleAppearanceChange('outfit', e.target.value)}
              placeholder="例如：银白与深蓝紧身皮质战甲、半镂空光子战斗服..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-pink-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-bold mb-1">饰品/头饰/配件 (`accessories`)</label>
            <input
              type="text"
              value={currentAppearance.accessories || ''}
              onChange={(e) => handleAppearanceChange('accessories', e.target.value)}
              placeholder="例如：星芒冰斧头冠、护腕光刃发射器、锁骨光链..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-pink-500 outline-none"
            />
          </div>
        </div>

        {/* Custom Visual Prompt for AI */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-zinc-300 font-bold text-xs">
              综合画面描摹与外貌动词指示 Prompt (`customVisualPrompt`)
            </label>
            <span className="text-[10px] text-zinc-400">
              指导 AI 在输出对白时如何描摹该角色的面部微表情、汗水流淌与衣着受损
            </span>
          </div>
          <textarea
            rows={3}
            value={currentAppearance.customVisualPrompt || ''}
            onChange={(e) => handleAppearanceChange('customVisualPrompt', e.target.value)}
            placeholder="例如：在对白描写中突出其湛蓝双瞳因屈辱而泛起水雾、银白发丝贴在满是汗水的娇颜上，紧身战甲在胸口与腰腹处因拘束而勒出剧烈起伏..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-100 focus:border-pink-500 outline-none resize-y leading-relaxed"
          />
        </div>
      </div>

      {/* 3. Multi-Faction Memberships & Priority Assignment */}
      <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800/80 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
              <span>所属阵营势力与多重归属优先级 (`factionMemberships`)</span>
              <span className="text-[10px] bg-amber-950/80 border border-amber-500/40 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                {currentMemberships.length > 0 ? `已加入 ${currentMemberships.length} 个阵营` : '自由游侠 / 无固定阵营'}
              </span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                setIsAddingFaction(!isAddingFaction);
              }}
              className="px-2.5 py-1 rounded bg-blue-950/70 hover:bg-blue-900 border border-blue-500/40 text-blue-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingFaction ? '收起表单' : '兼任/加入新阵营'}</span>
            </button>
            {onOpenFactionTab && (
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  onOpenFactionTab();
                }}
                className="px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>管理阵营与外交</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline Add Faction Form */}
        {isAddingFaction && (
          <div className="bg-zinc-900/90 p-3.5 rounded-xl border border-blue-500/40 space-y-3 animate-fade-in text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>添加新的阵营归属（支持多重兼任、潜伏卧底或双重身份）</span>
              </span>
              <span className="text-[10px] text-zinc-400">将作为第 {currentMemberships.length + 1} 优先级加入</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-zinc-300 font-bold mb-1">选择目标阵营</label>
                <select
                  value={newFactionId}
                  onChange={(e) => {
                    setNewFactionId(e.target.value);
                    setNewSubFactionId('none');
                  }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 font-bold focus:border-blue-500 outline-none"
                >
                  {factions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.shortName || f.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-bold mb-1">从属编制 / 分支</label>
                {(() => {
                  const targetFac = factions.find((f) => f.id === newFactionId);
                  const subList = targetFac?.subFactions || [];
                  return (
                    <select
                      disabled={subList.length === 0}
                      value={newSubFactionId}
                      onChange={(e) => setNewSubFactionId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-blue-500 outline-none disabled:opacity-40"
                    >
                      <option value="none">{subList.length === 0 ? '该势力暂无下属编制' : '直属本部 / 无特定编制'}</option>
                      {subList.map((sf) => (
                        <option key={sf.id} value={sf.id}>
                          {sf.name}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>

              <div>
                <label className="block text-zinc-300 font-bold mb-1">担任职务 / 岗位</label>
                <input
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="例如: 圣堂禁卫军总长 / 暗影暗杀统领"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-bold mb-1">身份定位 / 归属标签</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例如: 潜伏卧底 / 双重身份 / 名誉顾问"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Sub-Faction Only checkbox */}
            <label className="flex items-center gap-2 pt-0.5 text-xs text-teal-300 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={newSubFactionOnly}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setNewSubFactionOnly(checked);
                  if (checked) {
                    if (!newTitle || newTitle === '多重身份') setNewTitle('从属编制干员');
                  }
                }}
                className="accent-teal-400 rounded cursor-pointer"
              />
              <span>🛡️ 仅加入从属编制 (保持原母国阵营，不直接加入目标大阵营直属本部)</span>
            </label>

            {/* Title Preset Quick Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-zinc-500">快捷预设:</span>
              {FACTION_MEMBERSHIP_TITLE_PRESETS.map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setNewTitle(preset.title);
                    if (preset.desc && !newCustomNotes) setNewCustomNotes(preset.desc);
                  }}
                  className="px-2 py-0.5 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 transition-colors"
                >
                  {preset.title}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 text-[11px]">个人阵营背景备注 / 潜伏动机 (可选)</label>
              <input
                type="text"
                value={newCustomNotes}
                onChange={(e) => setNewCustomNotes(e.target.value)}
                placeholder="例如: 表面为敌方暗杀统领，实为深层特工..."
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-zinc-100 text-xs focus:border-blue-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingFaction(false)}
                className="px-3 py-1 rounded bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800 text-xs"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAddFaction}
                className="px-4 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>确认加入该阵营</span>
              </button>
            </div>
          </div>
        )}

        {/* Current Active Memberships List in Priority Order */}
        {currentMemberships.length === 0 ? (
          <div className="p-6 rounded-xl bg-zinc-900/40 border border-dashed border-zinc-800 text-center space-y-2">
            <Shield className="w-7 h-7 mx-auto text-zinc-600" />
            <p className="text-xs text-zinc-400 font-bold">该角色目前为自由独立游侠（尚未加入任何阵营势力）</p>
            <p className="text-[11px] text-zinc-500">
              可点击右上角「兼任/加入新阵营」按钮为其赋予主属势力或多重阵营身份。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentMemberships.map((membership, idx) => {
              const fac = factions.find((f) => f.id === membership.factionId);
              const isPrimary = idx === 0 || membership.priority === 1;
              const isEditing = editingFactionId === membership.factionId;

              return (
                <div
                  key={membership.factionId}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isPrimary
                      ? 'bg-amber-950/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
                      : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      {/* Priority Badge */}
                      {isPrimary ? (
                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold text-[11px]">
                          <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span>优先级 1 · 首要主属阵营</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-[10px]">
                          <Star className="w-3 h-3 text-cyan-400" />
                          <span>优先级 {membership.priority || idx + 1} · 兼任/潜伏身份</span>
                        </span>
                      )}

                      <span className="text-xs font-bold text-zinc-100">
                        {fac?.name || membership.factionId}
                      </span>
                      {fac?.shortName && fac.shortName !== fac.name && (
                        <span className="text-[10px] text-zinc-400 bg-zinc-950 px-1.5 py-0.2 rounded border border-zinc-800">
                          {fac.shortName}
                        </span>
                      )}
                      {membership.title && (
                        <span className="text-[10px] text-purple-300 bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-800/60 font-medium">
                          【{membership.title}】
                        </span>
                      )}
                    </div>

                    {/* Priority & Management Action Buttons */}
                    <div className="flex items-center gap-1">
                      {/* Up Priority */}
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMovePriority(membership.factionId, 'up')}
                        title="提升优先级（排到上一位）"
                        className="p-1 rounded bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 hover:text-white border border-zinc-800 transition-all cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      {/* Down Priority */}
                      <button
                        type="button"
                        disabled={idx === currentMemberships.length - 1}
                        onClick={() => handleMovePriority(membership.factionId, 'down')}
                        title="降低优先级（排到下一位）"
                        className="p-1 rounded bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 hover:text-white border border-zinc-800 transition-all cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Set as Primary */}
                      {!isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(membership.factionId)}
                          title="设为第一主属阵营"
                          className="px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Crown className="w-3 h-3" />
                          <span>设为主属</span>
                        </button>
                      )}

                      {/* Edit Role/Title */}
                      <button
                        type="button"
                        onClick={() => {
                          ultraAudio.playUiClick();
                          if (isEditing) {
                            setEditingFactionId(null);
                          } else {
                            setEditingFactionId(membership.factionId);
                            setEditRoleInput(membership.role || '');
                            setEditTitleInput(membership.title || '');
                            setEditNotesInput(membership.customNotes || '');
                          }
                        }}
                        title="编辑该阵营中的职务与身份定位"
                        className="p-1 rounded bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-all cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Remove From Faction */}
                      <button
                        type="button"
                        onClick={() => handleRemoveFaction(membership.factionId)}
                        title={`将角色移出「${fac?.name || membership.factionId}」`}
                        className="p-1 rounded bg-zinc-950 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-300 border border-zinc-800 hover:border-rose-700/50 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Editing Mode */}
                  {isEditing ? (
                    <div className="pt-2.5 space-y-2 animate-fade-in text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-zinc-400 text-[10px] mb-0.5">担任职务 / 岗位</label>
                          <input
                            type="text"
                            value={editRoleInput}
                            onChange={(e) => setEditRoleInput(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-zinc-400 text-[10px] mb-0.5">身份定位 / 标签</label>
                          <input
                            type="text"
                            value={editTitleInput}
                            onChange={(e) => setEditTitleInput(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-zinc-400 text-[10px] mb-0.5">背景动机 / 潜伏备注</label>
                        <input
                          type="text"
                          value={editNotesInput}
                          onChange={(e) => setEditNotesInput(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingFactionId(null)}
                          className="px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 text-[11px]"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditMembership(membership.factionId)}
                          className="px-3 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px]"
                        >
                          保存修改
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 space-y-1.5 text-xs">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-300">
                        <div>
                          <span className="text-zinc-500">担任职务: </span>
                          <span className="font-bold text-zinc-200">{membership.role || '战术成员'}</span>
                        </div>
                        {membership.customNotes && (
                          <div className="text-zinc-400 text-[11px] italic">
                            <span>备注: </span>
                            <span>{membership.customNotes}</span>
                          </div>
                        )}
                      </div>

                      {/* Faction Diplomacy Mini Preview */}
                      {fac && (
                        <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/60 text-[11px] space-y-1 mt-1.5">
                          <div className="flex items-center justify-between text-[10px] text-zinc-400">
                            <span>制度: {fac.system || '未设定'} | 稳定度: {fac.stability || '未设定'}</span>
                            <span className="text-indigo-300 font-medium">国家理念: {fac.nationalIdea || '未设定'}</span>
                          </div>

                          {fac.relations && fac.relations.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {fac.relations.map((r) => {
                                const targetF = factions.find((f) => f.id === r.targetFactionId);
                                const tName = targetF?.name || targetF?.shortName || r.targetFactionId;
                                return (
                                  <span
                                    key={r.targetFactionId}
                                    className="px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-[9px] text-zinc-300 flex items-center gap-1"
                                  >
                                    <span className="text-zinc-400">对【{tName}】:</span>
                                    <span className="font-bold text-amber-300">{r.relationName || r.relationType}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
