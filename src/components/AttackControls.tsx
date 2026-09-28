import React, { useState, useMemo } from 'react';
import {
  AlienWeapon,
  BodyPartId,
  BodyPartConfig,
  Ultrawoman,
  CustomSettings,
  EnvironmentTheme,
  CustomSkillCategory,
  CustomWeaponType,
  DEFAULT_WEAPON_TYPES,
} from '../types';
import {
  Zap,
  Play,
  Square,
  Sparkles,
  Target,
  Flame,
  Terminal,
  Plus,
  Search,
  LayoutList,
  LayoutGrid,
  Type,
  ChevronDown,
  ChevronUp,
  X,
  Info,
  ShieldAlert,
  Heart,
  Brain,
  Lock,
  Smile,
  Activity,
  Sliders,
  Check,
  HelpCircle,
  Star,
  Trash2,
  Edit3,
  Copy,
  FolderPlus,
  ArrowUpDown,
  Layers,
  Settings2,
} from 'lucide-react';
import { ultraAudio } from '../utils/audio';
import { getWeaponContinuousActionTitle } from '../utils/stats';
import { DEFAULT_UNIVERSAL_PROMPTS } from '../data/promptPresets';
import { HoverTooltip, WeaponTooltipCard, BodyPartTooltipCard } from './TacticalTooltip';

interface AttackControlsProps {
  weapons: AlienWeapon[];
  selectedWeapon: AlienWeapon;
  onSelectWeapon: (weapon: AlienWeapon) => void;
  selectedPart: BodyPartId;
  onSelectPart: (part: BodyPartId) => void;
  hero: Ultrawoman;
  intensity: number;
  onIntensityChange: (val: number) => void;
  customSettings: CustomSettings;
  onExecuteAttack: (weapon: AlienWeapon, targetPart: BodyPartId, intensity?: number, customQuestion?: string) => void;
  isAutoAttacking: boolean;
  onToggleAutoAttack: () => void;
  isLoadingAi: boolean;
  envTheme?: EnvironmentTheme | string;
  isContinuousFiring?: boolean;
  onStartContinuousFiring?: () => void;
  onStopContinuousFiring?: () => void;
  onOpenCustomSkillModal?: () => void;
  onOpenCustomSkillModalTab?: (tab: 'arsenal' | 'forge' | 'category' | 'types' | 'backup', skillId?: string) => void;
  customCategories?: CustomSkillCategory[];
  customWeaponTypes?: CustomWeaponType[];
  favoriteWeaponIds?: string[];
  onToggleFavoriteWeapon?: (weaponId: string) => void;
  onDeleteWeapon?: (weaponId: string) => void;
  onAddCustomCategory?: (category: CustomSkillCategory) => void;
  activeTeamHeroes?: Ultrawoman[];
  targetedHeroIds?: string[];
  onToggleTargetHero?: (heroId: string) => void;
  onSetTargetScope?: (scope: 'primary' | 'all' | 'custom') => void;
}

const BaseAttackControls: React.FC<AttackControlsProps> = ({
  weapons,
  selectedWeapon,
  onSelectWeapon,
  selectedPart,
  onSelectPart,
  hero,
  intensity,
  onIntensityChange,
  customSettings,
  onExecuteAttack,
  isAutoAttacking,
  onToggleAutoAttack,
  isLoadingAi,
  envTheme,
  isContinuousFiring = false,
  onStartContinuousFiring,
  onStopContinuousFiring,
  onOpenCustomSkillModal,
  onOpenCustomSkillModalTab,
  customCategories = [],
  customWeaponTypes = [],
  favoriteWeaponIds = [],
  onToggleFavoriteWeapon,
  onDeleteWeapon,
  onAddCustomCategory,
  activeTeamHeroes = [],
  targetedHeroIds = [],
  onToggleTargetHero,
  onSetTargetScope,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isHoldingMouse, setIsHoldingMouse] = useState(false);
  const [speechText, setSpeechText] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'default' | 'dmg_desc' | 'energy_desc' | 'morale_desc' | 'custom_first'>('default');
  const [viewMode, setViewMode] = useState<'detailed' | 'grid'>('detailed');
  const [fontSizeMode, setFontSizeMode] = useState<'normal' | 'large'>('normal');
  const [showAllPromptsModal, setShowAllPromptsModal] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [showQuickAddCat, setShowQuickAddCat] = useState(false);

  const currentPartConfig = hero.bodyParts[selectedPart];
  const partMult = currentPartConfig?.weaknessMultiplier || 1.0;
  const isWeak = hero.weakPart === selectedPart;
  const isSensitive = hero.sensitivePart === selectedPart;
  const weaknessBonus = isWeak ? customSettings.weaknessMultiplier : 1.0;

  // Check active Environmental Weakness linkage for current selection
  const activeEnvWeaknesses = (hero.envWeaknesses || []).filter((ew) => ew.enabled);
  const matchedEw = activeEnvWeaknesses.find((ew) => {
    const matchEnv = ew.envTheme === 'any' || ew.envTheme === envTheme;
    const matchPart = !ew.targetPartId || ew.targetPartId === 'any' || ew.targetPartId === selectedPart;
    const matchCat = !ew.weaponCategory || ew.weaponCategory === 'any' || ew.weaponCategory === selectedWeapon.category;
    const matchType = !ew.weaponType || ew.weaponType === 'any' || ew.weaponType === selectedWeapon.type;
    return matchEnv && matchPart && matchCat && matchType;
  });
  const envWeaknessBonus = matchedEw ? (matchedEw.damageMultiplier || 1.5) : 1.0;

  const activeTotalMult = intensity * partMult * weaknessBonus * envWeaknessBonus;

  const handleSingleFire = () => {
    ultraAudio.playUiClick();
    onExecuteAttack(selectedWeapon, selectedPart, intensity, speechText.trim() || undefined);
  };

  const currentWeaponRealDmg = selectedWeapon.damage > 0
    ? Math.max(0.1, Math.round(selectedWeapon.damage * activeTotalMult * 0.6 * 10) / 10)
    : selectedWeapon.damage < 0
    ? Math.round(selectedWeapon.damage * 10) / 10
    : 0;

  // Category counts calculation
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: weapons.length,
      favorites: 0,
      custom_only: 0,
      pure_love: 0,
      evil_care: 0,
      attack: 0,
      touch: 0,
      hypnosis: 0,
      restraint: 0,
      drain: 0,
      heal: 0,
    };

    weapons.forEach((w) => {
      if (w.isFavorite || favoriteWeaponIds.includes(w.id)) {
        counts.favorites = (counts.favorites || 0) + 1;
      }
      if (w.isCustom) {
        counts.custom_only = (counts.custom_only || 0) + 1;
      }

      if (
        w.description.includes('纯爱关怀') ||
        w.id.includes('pure') ||
        w.id.includes('radiant') ||
        w.id.includes('nutrient') ||
        w.id.includes('towel') ||
        w.id.includes('vow')
      ) {
        counts.pure_love = (counts.pure_love || 0) + 1;
      }

      if (
        w.description.includes('深度支配') ||
        w.description.includes('邪恶') ||
        w.id.includes('parasitic') ||
        w.id.includes('aphrodisiac') ||
        w.id.includes('master_slave') ||
        w.id.includes('alien_blood') ||
        w.id.includes('bliss')
      ) {
        counts.evil_care = (counts.evil_care || 0) + 1;
      }

      if (w.category === 'attack' || !w.category) {
        counts.attack = (counts.attack || 0) + 1;
      }

      if (w.category && counts[w.category] !== undefined && !['attack', 'pure_love', 'evil_care'].includes(w.category)) {
        counts[w.category] = (counts[w.category] || 0) + 1;
      } else if (w.category) {
        counts[w.category] = (counts[w.category] || 0) + 1;
      }
    });

    return counts;
  }, [weapons, favoriteWeaponIds]);

  // Filter weapons by category and search query, and sort
  const filteredWeapons = useMemo(() => {
    const list = weapons.filter((w) => {
      // Category filter
      let matchCategory = true;
      if (activeCategory !== 'all') {
        if (activeCategory === 'favorites') {
          matchCategory = !!(w.isFavorite || favoriteWeaponIds.includes(w.id));
        } else if (activeCategory === 'custom_only') {
          matchCategory = !!w.isCustom;
        } else if (activeCategory === 'pure_love') {
          matchCategory =
            w.description.includes('纯爱关怀') ||
            w.id.includes('pure') ||
            w.id.includes('radiant') ||
            w.id.includes('nutrient') ||
            w.id.includes('towel') ||
            w.id.includes('vow');
        } else if (activeCategory === 'evil_care') {
          matchCategory =
            w.description.includes('深度支配') ||
            w.description.includes('邪恶') ||
            w.id.includes('parasitic') ||
            w.id.includes('aphrodisiac') ||
            w.id.includes('master_slave') ||
            w.id.includes('alien_blood') ||
            w.id.includes('bliss');
        } else if (activeCategory === 'attack') {
          matchCategory = w.category === 'attack' || !w.category;
        } else {
          matchCategory = w.category === activeCategory;
        }
      }

      if (!matchCategory) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = w.name.toLowerCase().includes(q);
        const matchDesc = w.description.toLowerCase().includes(q);
        const matchType = w.type.toLowerCase().includes(q);
        const matchCategoryText = (w.category || '').toLowerCase().includes(q);
        return matchName || matchDesc || matchType || matchCategoryText;
      }

      return true;
    });

    // Sorting
    return [...list].sort((a, b) => {
      if (sortBy === 'dmg_desc') {
        return (b.damage || 0) - (a.damage || 0);
      }
      if (sortBy === 'energy_desc') {
        return (b.energyDrain || 0) - (a.energyDrain || 0);
      }
      if (sortBy === 'morale_desc') {
        return (b.moraleDamage || 0) - (a.moraleDamage || 0);
      }
      if (sortBy === 'custom_first') {
        if (a.isCustom && !b.isCustom) return -1;
        if (!a.isCustom && b.isCustom) return 1;
        return 0;
      }
      return 0;
    });
  }, [weapons, activeCategory, searchQuery, sortBy, favoriteWeaponIds]);

  const handleDeleteWeaponItem = (weaponId: string, weaponName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`确定要删除攻击手段【${weaponName}】吗？`)) return;
    ultraAudio.playUiClick();
    if (onDeleteWeapon) {
      onDeleteWeapon(weaponId);
    }
  };

  const handleEditWeaponItem = (weapon: AlienWeapon, e: React.MouseEvent) => {
    e.stopPropagation();
    ultraAudio.playUiClick();
    if (onOpenCustomSkillModalTab) {
      onOpenCustomSkillModalTab('forge', weapon.id);
    } else if (onOpenCustomSkillModal) {
      onOpenCustomSkillModal();
    }
  };

  const handleQuickAddCategory = () => {
    if (!quickCatName.trim()) return;
    const newCat: CustomSkillCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: quickCatName.trim(),
      icon: '✨',
      color: '#3b82f6',
      description: '快捷自建分类',
      isCustom: true,
      createdAt: Date.now(),
    };
    if (onAddCustomCategory) {
      onAddCustomCategory(newCat);
    }
    setQuickCatName('');
    setShowQuickAddCat(false);
    setActiveCategory(newCat.id);
    ultraAudio.playPowerUp();
  };

  // Hold mouse continuous attack handlers
  const handleMouseDownHold = (e: React.MouseEvent | React.TouchEvent) => {
    if ('button' in e && e.button !== 0) return;

    setIsHoldingMouse(true);
    if (onStartContinuousFiring) onStartContinuousFiring();

    const handleGlobalRelease = () => {
      setIsHoldingMouse(false);
      if (onStopContinuousFiring) onStopContinuousFiring();
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('pointerup', handleGlobalRelease);
      window.removeEventListener('touchend', handleGlobalRelease);
      window.removeEventListener('touchcancel', handleGlobalRelease);
    };

    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('pointerup', handleGlobalRelease);
    window.addEventListener('touchend', handleGlobalRelease);
    window.addEventListener('touchcancel', handleGlobalRelease);
  };

  const handleMouseUpHold = () => {
    setIsHoldingMouse(false);
    if (onStopContinuousFiring) onStopContinuousFiring();
  };

  const handleMouseEnterOrMoveHold = (e: React.MouseEvent) => {
    if (e.buttons !== 1) {
      if (isHoldingMouse) {
        handleMouseUpHold();
      }
    }
  };

  // Helper for weapon type badge styling
  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case 'touch':
      case 'sensual':
        return 'bg-fuchsia-950/90 text-fuchsia-300 border-fuchsia-500/60';
      case 'hypnosis':
      case 'psy':
        return 'bg-purple-950/90 text-purple-300 border-purple-500/60';
      case 'lava':
      case 'corrode':
        return 'bg-amber-950/90 text-amber-300 border-amber-500/60 animate-pulse';
      case 'frost':
        return 'bg-cyan-950/90 text-cyan-300 border-cyan-500/60';
      case 'plasma':
      case 'shock':
        return 'bg-yellow-950/90 text-yellow-300 border-yellow-500/60';
      case 'drain':
        return 'bg-rose-950/90 text-rose-300 border-rose-500/60';
      case 'heal':
        return 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60';
      case 'restraint':
        return 'bg-indigo-950/90 text-indigo-300 border-indigo-500/60';
      default:
        return 'bg-blue-950/90 text-blue-300 border-blue-500/60';
    }
  };

  // Helper to map 0-1000 slider range smoothly to 0.1x - 10000x (logarithmic curve)
  const sliderToIntensity = (sliderPos: number): number => {
    // sliderPos: 0 to 1000
    // log10(0.1) = -1, log10(10000) = 4, range = 5
    const exp = -1 + (sliderPos / 1000) * 5;
    const raw = Math.pow(10, exp);
    if (raw < 1) return Math.round(raw * 10) / 10;
    if (raw < 10) return Math.round(raw * 10) / 10;
    if (raw < 100) return Math.round(raw);
    if (raw < 1000) return Math.round(raw / 10) * 10;
    if (raw < 5000) return Math.round(raw / 50) * 50;
    return Math.min(10000, Math.round(raw / 100) * 100);
  };

  const intensityToSlider = (val: number): number => {
    const clamped = Math.max(0.1, Math.min(10000, val || 0.1));
    const exp = Math.log10(clamped);
    return Math.round(((exp - (-1)) / 5) * 1000);
  };

  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-3 sm:p-4 text-zinc-100 flex flex-col space-y-3.5 shadow-2xl font-mono relative overflow-hidden min-w-0 max-w-full">
      {/* 1. Header Toolbar with Title & View Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/90 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-blue-950/80 border border-blue-500/50 text-blue-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold tracking-wider text-blue-300 uppercase flex items-center gap-2">
              <span>交互控制台</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-normal">
                共 {filteredWeapons.length} 项
              </span>
            </h2>
          </div>
        </div>

        {/* View Mode & Custom Skill Actions */}
        <div className="flex items-center space-x-1.5">
          {/* Font Size Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              setFontSizeMode((prev) => (prev === 'normal' ? 'large' : 'normal'));
            }}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center space-x-1 border transition-all cursor-pointer ${
              fontSizeMode === 'large'
                ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="切换文字舒适大字号 / 标准字号"
          >
            <Type className="w-3.5 h-3.5" />
            <span>{fontSizeMode === 'large' ? '大字号' : '标准字号'}</span>
          </button>

          {/* Detailed List vs Compact Grid View Toggle */}
          <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                setViewMode('detailed');
              }}
              className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                viewMode === 'detailed'
                  ? 'bg-blue-900/80 text-blue-200 border border-blue-500/50 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="切换为详实清单视图（完整显示所有文字与属性）"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>详实列表</span>
            </button>
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                setViewMode('grid');
              }}
              className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-blue-900/80 text-blue-200 border border-blue-500/50 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="切换为卡片网格视图"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>卡片网格</span>
            </button>
          </div>

          {/* Add Custom Skill Button */}
          {onOpenCustomSkillModal && (
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                onOpenCustomSkillModal();
              }}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-950 border border-purple-500/60 text-purple-200 hover:bg-purple-900 transition-all cursor-pointer shadow-[0_0_8px_rgba(168,85,247,0.3)]"
              title="创建与编辑自定义战术技能"
            >
              <Plus className="w-3.5 h-3.5 text-purple-300" />
              <span className="hidden sm:inline">➕ 自定义技能</span>
              <span className="sm:hidden">➕技能</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Multi-Hero Target Selection Control Panel */}
      {activeTeamHeroes.length > 1 && (
        <div className="bg-zinc-900/90 p-2.5 rounded-lg border border-purple-900/60 shadow-[0_0_12px_rgba(168,85,247,0.15)] space-y-1.5">
          <div className="flex flex-wrap items-center justify-between text-xs font-bold gap-2 border-b border-zinc-800 pb-1.5">
            <div className="flex items-center space-x-1.5 text-purple-300">
              <Target className="w-4 h-4 text-purple-400 animate-pulse" />
              <span>👥 多人模式攻击受击目标锁定 ({targetedHeroIds.length}/{activeTeamHeroes.length}人受击)</span>
            </div>

            <div className="flex items-center space-x-1 text-[10px]">
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  if (onSetTargetScope) onSetTargetScope('all');
                }}
                className="px-2 py-0.5 rounded bg-purple-950 border border-purple-500/50 text-purple-200 hover:bg-purple-900 transition-all cursor-pointer font-bold"
              >
                全员受击
              </button>
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  if (onSetTargetScope) onSetTargetScope('primary');
                }}
                className="px-2 py-0.5 rounded bg-blue-950 border border-blue-500/50 text-blue-200 hover:bg-blue-900 transition-all cursor-pointer font-bold"
              >
                仅主焦点
              </button>
            </div>
          </div>

          {/* Hero Target Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {activeTeamHeroes.map((teamHero) => {
              const isTargeted = targetedHeroIds.includes(teamHero.id);
              const isPrimary = teamHero.id === hero.id;

              return (
                <button
                  key={teamHero.id}
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    if (onToggleTargetHero) onToggleTargetHero(teamHero.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer border ${
                    isTargeted
                      ? 'bg-gradient-to-r from-rose-950/90 to-purple-950/90 text-rose-200 border-rose-500/80 shadow-[0_0_10px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/40'
                      : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isTargeted ? 'bg-rose-400 animate-ping' : 'bg-zinc-600'}`} />
                  <span className="font-sans font-medium">{teamHero.name}</span>
                  {isPrimary && (
                    <span className="text-[9px] px-1 bg-blue-950 text-blue-300 border border-blue-500/30 rounded">
                      主焦点
                    </span>
                  )}
                  <span className={`text-[10px] ${isTargeted ? 'text-rose-300 font-extrabold' : 'text-zinc-600'}`}>
                    {isTargeted ? '🎯受击' : '⚪旁观'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Target & Intensity Row */}
      <div className="flex flex-col gap-3 bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 min-w-0 max-w-full">
        {/* Target Part Dropdown */}
        <div className="flex flex-col space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center justify-between text-xs font-bold text-zinc-300 gap-1">
            <HoverTooltip
              position="auto"
              content={
                currentPartConfig ? (
                  <BodyPartTooltipCard
                    partId={selectedPart}
                    config={currentPartConfig}
                    hero={hero}
                    damagePercent={hero.bodyParts[selectedPart]?.exposure || 0}
                    isSelected={true}
                  />
                ) : null
              }
            >
              <span className="flex items-center space-x-1 cursor-help group">
                <Target className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="group-hover:text-rose-300 transition-colors">选择打击部位 (悬浮查看详情)</span>
                <HelpCircle className="w-3 h-3 text-zinc-500 group-hover:text-rose-300 shrink-0" />
              </span>
            </HoverTooltip>
            <span className="text-[10px] text-zinc-400 font-normal">
              弱点/敏感区可造成更高成效
            </span>
          </div>

          <select
            value={selectedPart}
            onChange={(e) => {
              ultraAudio.playUiClick();
              onSelectPart(e.target.value as BodyPartId);
            }}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-blue-300 focus:outline-none focus:border-blue-500 font-mono cursor-pointer"
          >
            {(Object.entries(hero.bodyParts) as [BodyPartId, BodyPartConfig][]).map(([pId, conf]) => (
              <option key={pId} value={pId}>
                {conf.name} {hero.weakPart === pId ? '★致命弱点' : ''} {hero.sensitivePart === pId ? '♥敏感发情区' : ''} (基础倍率: {conf.weaknessMultiplier || 1.0}x)
              </option>
            ))}
          </select>

          <div className="text-[11px] text-zinc-400 flex flex-wrap items-center justify-between gap-1 pt-0.5">
            <span>当前部位倍率: <strong className="text-amber-400 font-bold">{partMult}x</strong></span>
            {isWeak && <span className="text-rose-400 font-bold">★弱点加成 ({customSettings.weaknessMultiplier}x)</span>}
            {isSensitive && <span className="text-fuchsia-400 font-bold">♥敏感/发情 ({customSettings.sensitiveMultiplier || 2.5}x 羞耻度)</span>}
          </div>
        </div>

        {/* Intensity Slider & Multiplier Controls (Slider max 10000x with Smooth Logarithmic Curve & Direct Input) */}
        <div className="flex flex-col space-y-2 bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800 min-w-0 max-w-full">
          <div className="flex flex-wrap items-center justify-between text-xs font-bold text-zinc-300 gap-1.5">
            <div className="flex items-center space-x-1.5 flex-wrap">
              <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
              <span>伤害/作用功率:</span>
              <div className="flex items-center space-x-1 bg-zinc-900 border border-amber-500/50 rounded px-1.5 py-0.5">
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={isNaN(intensity) ? '' : intensity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0) {
                      onIntensityChange(val);
                    }
                  }}
                  className="w-16 sm:w-20 bg-transparent text-amber-300 text-xs font-mono font-extrabold text-right focus:outline-none"
                  placeholder="倍率"
                />
                <span className="text-amber-400 text-xs font-mono font-bold">x</span>
              </div>
            </div>

            <span className="text-[10px] text-amber-300 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-500/40 font-mono font-bold truncate max-w-full">
              {intensity <= 0.2
                ? '0.1x 极轻触碰'
                : intensity < 0.8
                ? '低功率压制'
                : intensity === 1.0
                ? '1.0x 标准测试'
                : intensity <= 2.0
                ? '高压过载'
                : intensity <= 5.0
                ? '5.0x 极限毁伤'
                : intensity <= 20.0
                ? `⚡ 超能过载打击 (${intensity.toFixed(1)}x)`
                : intensity <= 100.0
                ? `🔥 歼星级超频破坏 (${intensity.toFixed(0)}x)`
                : intensity <= 1000.0
                ? `💥 概念级因果崩解 (${intensity.toFixed(0)}x)`
                : intensity <= 10000.0
                ? `🌌 无限神罚超界打击 (${intensity.toFixed(0)}x)`
                : `⚡ 破界无上限神明权柄 (${intensity >= 1000000 ? intensity.toExponential(2) : intensity.toLocaleString()}x)`}
            </span>
          </div>

          {/* Range Slider with 10000x Upper Bound & Smooth Logarithmic Response */}
          <div className="space-y-1 min-w-0">
            <input
              type="range"
              min="0"
              max="1000"
              step="1"
              value={intensityToSlider(intensity)}
              onChange={(e) => onIntensityChange(sliderToIntensity(parseFloat(e.target.value)))}
              className="w-full accent-amber-500 bg-zinc-900 rounded h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-zinc-500 font-mono flex-wrap gap-x-2">
              <span>0.1x (微弱)</span>
              <span>1.0x (标准)</span>
              <span>10x (高强)</span>
              <span>100x (歼星)</span>
              <span>1000x (崩解)</span>
              <span className="text-amber-400 font-bold">10000x (滑条刻度)</span>
            </div>
          </div>

          {/* Fast Presets & Multiplier Quick Steppers (Responsive Overflow-Free Grids, Uncapped Direct Scale) */}
          <div className="space-y-1.5 pt-0.5 min-w-0">
            {/* Quick Multiplier Presets Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
              {[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 50.0, 100.0, 500.0, 1000.0, 5000.0, 10000.0].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    onIntensityChange(preset);
                  }}
                  className={`py-1 px-1 text-[10px] rounded font-mono font-bold transition-all border cursor-pointer text-center truncate ${
                    Math.abs(intensity - preset) < (preset >= 100 ? 5 : 0.05)
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.3)]'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {preset >= 10 ? `${preset}x` : `${preset.toFixed(1)}x`}
                </button>
              ))}
            </div>

            {/* Scale Steppers (÷10, ÷2, -1, Reset, +1, ×2, ×10, ×100 - 无上限放大) */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 text-[10px] font-mono text-zinc-400">
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  onIntensityChange(Math.max(0.01, Math.round((intensity / 10) * 100) / 100));
                }}
                className="py-1 px-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:text-zinc-200 cursor-pointer text-center truncate"
                title="缩小10倍"
              >
                ÷10
              </button>
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  onIntensityChange(Math.max(0.01, Math.round((intensity / 2) * 10) / 10));
                }}
                className="py-1 px-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:text-zinc-200 cursor-pointer text-center truncate"
                title="减半"
              >
                ÷2
              </button>
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  onIntensityChange(Math.max(0.1, Math.round((intensity - 1) * 10) / 10));
                }}
                className="py-1 px-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:text-zinc-200 cursor-pointer text-center truncate"
                title="减1x"
              >
                -1x
              </button>
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  onIntensityChange(1.0);
                }}
                className="py-1 px-0.5 rounded bg-zinc-900 hover:bg-amber-950/40 border border-zinc-700 text-amber-300 font-bold cursor-pointer text-center truncate"
                title="重置为标准 1.0x"
              >
                重置
              </button>
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  onIntensityChange(Math.round((intensity + 1) * 10) / 10);
                }}
                className="py-1 px-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:text-zinc-200 cursor-pointer text-center truncate"
                title="加1x (无上限)"
              >
                +1x
              </button>
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  onIntensityChange(Math.round((intensity * 2) * 10) / 10);
                }}
                className="py-1 px-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:text-zinc-200 cursor-pointer text-center truncate"
                title="翻倍 (无上限)"
              >
                ×2
              </button>
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  onIntensityChange(Math.round((intensity * 10) * 10) / 10);
                }}
                className="py-1 px-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:text-zinc-200 cursor-pointer text-center truncate"
                title="放大10倍 (无上限)"
              >
                ×10
              </button>
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  onIntensityChange(Math.round((intensity * 100) * 10) / 10);
                }}
                className="py-1 px-0.5 rounded bg-zinc-900 hover:bg-rose-950/50 border border-rose-800 text-rose-300 font-bold cursor-pointer text-center truncate"
                title="放大100倍 (无上限)"
              >
                ×100
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Real-time Combined Multiplier Bar */}
      <div className="bg-zinc-900/70 p-2.5 rounded-lg border border-zinc-800 flex flex-wrap items-center justify-between text-xs gap-2 min-w-0 max-w-full">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="text-zinc-400 font-bold">综合实算总倍率:</span>
          <strong className="text-rose-400 text-sm font-extrabold px-1.5 py-0.2 rounded bg-rose-950/60 border border-rose-500/40">
            {activeTotalMult >= 1000000 ? activeTotalMult.toExponential(2) : activeTotalMult.toFixed(2)}x
          </strong>
          <span className="text-[11px] text-zinc-400 truncate">
            ({intensity >= 100000 ? intensity.toExponential(1) : intensity.toFixed(1)}x 功率 × {partMult.toFixed(1)}x 部位
            {isWeak ? ` × ${customSettings.weaknessMultiplier.toFixed(1)}x 弱点` : ''}
            {matchedEw ? ` × ${envWeaknessBonus.toFixed(1)}x 环境联动` : ''})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {matchedEw && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/60 text-amber-300 font-bold animate-pulse flex items-center space-x-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>环境弱点联动: {matchedEw.name} ({matchedEw.damageMultiplier}x)</span>
            </span>
          )}
          {isSensitive && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-fuchsia-950/80 border border-fuchsia-500/50 text-fuchsia-300 font-bold animate-pulse">
              ♥ 敏感/发情区域触发
            </span>
          )}
          <span className="text-zinc-300 font-bold text-xs">
            预估单次变动:{' '}
            <strong
              className={
                currentWeaponRealDmg > 0
                  ? 'text-rose-400 text-xs font-bold'
                  : currentWeaponRealDmg < 0
                  ? 'text-emerald-400 text-xs font-bold'
                  : 'text-zinc-400 text-xs'
              }
            >
              {currentWeaponRealDmg > 0
                ? `-${currentWeaponRealDmg} HP (伤害)`
                : currentWeaponRealDmg < 0
                ? `+${Math.abs(currentWeaponRealDmg)} HP (恢复)`
                : '0 HP'}
            </strong>
          </span>
        </div>
      </div>

      {/* 5. Search, Sort & Category Filter Toolbar */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索技能名称、属性、分类或效果描述..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center space-x-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer font-mono"
            >
              <option value="default" className="bg-zinc-900 text-zinc-200">默认排序</option>
              <option value="dmg_desc" className="bg-zinc-900 text-zinc-200">💥 伤害从高到低</option>
              <option value="energy_desc" className="bg-zinc-900 text-zinc-200">⚡ 抽能从高到低</option>
              <option value="morale_desc" className="bg-zinc-900 text-zinc-200">🧠 意志打击最高</option>
              <option value="custom_first" className="bg-zinc-900 text-zinc-200">✨ 用户自制优先</option>
            </select>
          </div>

          {/* Category Management Shortcut */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                if (onOpenCustomSkillModalTab) {
                  onOpenCustomSkillModalTab('category');
                } else if (onOpenCustomSkillModal) {
                  onOpenCustomSkillModal();
                }
              }}
              className="px-2 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-blue-500 hover:text-blue-300 flex items-center space-x-1 transition-all cursor-pointer"
              title="管理自定义分类体系"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">分类管理</span>
            </button>
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                setShowQuickAddCat(!showQuickAddCat);
              }}
              className="p-1.5 rounded-lg text-xs font-bold bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-emerald-500 hover:text-emerald-300 flex items-center transition-all cursor-pointer"
              title="快速新建自定义分类"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          </div>
        </div>

        {/* Quick Add Category Inline Form */}
        {showQuickAddCat && (
          <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-emerald-500/40 flex items-center gap-2 animate-fadeIn">
            <FolderPlus className="w-4 h-4 text-emerald-400 shrink-0" />
            <input
              type="text"
              value={quickCatName}
              onChange={(e) => setQuickCatName(e.target.value)}
              placeholder="输入新分类名称 (例如: 精神暗示, 圣光洗礼)..."
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAddCategory()}
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleQuickAddCategory}
              disabled={!quickCatName.trim()}
              className="px-3 py-1 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 cursor-pointer"
            >
              创建
            </button>
            <button
              type="button"
              onClick={() => setShowQuickAddCat(false)}
              className="p-1 text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Category Tabs with Count Badges */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {(() => {
            const builtInCatIds = new Set([
              'all',
              'favorites',
              'custom_only',
              'pure_love',
              'evil_care',
              'attack',
              'touch',
              'hypnosis',
              'restraint',
              'drain',
              'heal',
            ]);
            const extraCategories: { id: string; label: string; count?: number }[] = [];

            if (customCategories) {
              customCategories.forEach((cc) => {
                if (!builtInCatIds.has(cc.id)) {
                  extraCategories.push({
                    id: cc.id,
                    label: `${cc.icon || '✨'} ${cc.name}`,
                    count: categoryCounts[cc.id] || 0,
                  });
                  builtInCatIds.add(cc.id);
                }
              });
            }

            weapons.forEach((w) => {
              if (w.category && !builtInCatIds.has(w.category)) {
                extraCategories.push({
                  id: w.category,
                  label: `✨ ${w.category}`,
                  count: categoryCounts[w.category] || 0,
                });
                builtInCatIds.add(w.category);
              }
            });

            const allTabs = [
              { id: 'all', label: '🌐 全部手段', count: categoryCounts.all },
              { id: 'favorites', label: '⭐ 常用收藏', count: categoryCounts.favorites },
              { id: 'custom_only', label: '✨ 自制技能', count: categoryCounts.custom_only },
              { id: 'pure_love', label: '❇️ 纯爱关怀', count: categoryCounts.pure_love },
              { id: 'evil_care', label: '😈 深度支配', count: categoryCounts.evil_care },
              { id: 'attack', label: '⚔️ 高能打击', count: categoryCounts.attack },
              { id: 'touch', label: '♥ 敏感触碰', count: categoryCounts.touch || 0 },
              { id: 'hypnosis', label: '🌀 催眠真言', count: categoryCounts.hypnosis || 0 },
              { id: 'restraint', label: '⛓️ 重力束缚', count: categoryCounts.restraint || 0 },
              { id: 'drain', label: '⚡ 能量抽离', count: categoryCounts.drain || 0 },
              { id: 'heal', label: '💉 医疗复苏', count: categoryCounts.heal || 0 },
              ...extraCategories,
            ];

            return allTabs.map((tab) => {
              const isCatActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setActiveCategory(tab.id);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center space-x-1.5 ${
                    isCatActive
                      ? tab.id === 'pure_love'
                        ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                        : tab.id === 'evil_care'
                        ? 'bg-purple-600/30 border-purple-400 text-purple-200 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                        : tab.id === 'favorites'
                        ? 'bg-amber-600/30 border-amber-400 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                        : 'bg-blue-600/30 border-blue-400 text-blue-200 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isCatActive
                        ? 'bg-white/20 text-white font-extrabold'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {tab.count ?? 0}
                  </span>
                </button>
              );
            });
          })()}
        </div>
      </div>

      {/* 6. Weapons & Interaction Items List (Detailed View vs Grid View) with Rich Hover Tooltip */}
      {viewMode === 'detailed' ? (
        /* Detailed List View: 100% UNTRUNCATED TEXT, FULL LABELED STATS, HIGH READABILITY + HOVER TOOLTIP */
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
          {/* Quick Create Weapon Header Banner */}
          <div
            onClick={() => {
              ultraAudio.playUiClick();
              if (onOpenCustomSkillModalTab) {
                onOpenCustomSkillModalTab('forge');
              } else if (onOpenCustomSkillModal) {
                onOpenCustomSkillModal();
              }
            }}
            className="p-2.5 rounded-lg border border-dashed border-purple-500/50 bg-purple-950/20 hover:bg-purple-950/40 text-purple-200 flex items-center justify-between cursor-pointer transition-all group"
          >
            <div className="flex items-center space-x-2">
              <div className="p-1 rounded bg-purple-900/60 text-purple-300">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-purple-200 group-hover:text-purple-100 flex items-center gap-1.5">
                  <span>打造并添加新的自定义攻击 / 关怀手段</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 font-normal">
                    支持自定义数值、分类与专属效果
                  </span>
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-purple-400 group-hover:text-purple-300">立即锻造 ➔</span>
          </div>

          {filteredWeapons.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 text-xs bg-zinc-900/40 rounded-lg border border-zinc-800">
              未找到符合条件的战术手段，请尝试切换分类或搜索词。
            </div>
          ) : (
            filteredWeapons.map((w) => {
              const isSelected = w.id === selectedWeapon.id;
              const isFav = w.isFavorite || favoriteWeaponIds.includes(w.id);
              const allKnownTypes = [...DEFAULT_WEAPON_TYPES, ...customWeaponTypes];
              const foundType = allKnownTypes.find((t) => t.id === w.type);
              const typeLabel = foundType
                ? `${foundType.icon ? foundType.icon : ''} ${foundType.name}`
                : w.type;

              const realDmg =
                w.damage > 0
                  ? Math.max(0.1, Math.round(w.damage * activeTotalMult * 10) / 10)
                  : w.damage < 0
                  ? Math.round(w.damage * 10) / 10
                  : 0;

              return (
                <HoverTooltip
                  key={w.id}
                  position="auto"
                  className="w-full"
                  content={
                    <WeaponTooltipCard
                      weapon={w}
                      hero={hero}
                      selectedPartId={selectedPart}
                      intensity={intensity}
                      totalMultiplier={activeTotalMult}
                      isSelected={isSelected}
                      customWeaponTypes={customWeaponTypes}
                    />
                  }
                >
                  <div
                    onClick={() => {
                      ultraAudio.playUiClick();
                      onSelectWeapon(w);
                    }}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative group flex flex-col space-y-2 ${
                      isSelected
                        ? 'bg-blue-950/50 border-blue-400 text-blue-100 shadow-[0_0_16px_rgba(59,130,246,0.35)] ring-1 ring-blue-400/60'
                        : 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900'
                    }`}
                  >
                    {/* Top: Name, Type Badge, Action Icons */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <div className="flex items-center space-x-1.5">
                          {isSelected ? (
                            <span className="p-0.5 rounded-full bg-blue-500 text-white shrink-0">
                              <Check className="w-3 h-3" />
                            </span>
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 shrink-0 group-hover:border-zinc-500" />
                          )}
                          <span
                            className={`font-bold font-sans break-words ${
                              fontSizeMode === 'large' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                            } ${isSelected ? 'text-blue-300 font-extrabold' : 'text-zinc-100'}`}
                          >
                            {w.name}
                          </span>
                          {w.isCustom && (
                            <span className="px-1.5 py-0.2 rounded bg-purple-950 border border-purple-500/50 text-purple-300 text-[10px] font-bold">
                              自制
                            </span>
                          )}
                          {w.category && (
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 text-[10px]">
                              {w.category}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${getTypeBadgeStyle(
                            w.type
                          )}`}
                        >
                          {typeLabel}
                        </span>

                        {/* Action buttons */}
                        <div className="flex items-center space-x-1 bg-zinc-950/80 p-0.5 rounded border border-zinc-800">
                          {onToggleFavoriteWeapon && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                ultraAudio.playUiClick();
                                onToggleFavoriteWeapon(w.id);
                              }}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                isFav ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                              title={isFav ? '取消收藏' : '加入常用收藏'}
                            >
                              <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400' : ''}`} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleEditWeaponItem(w, e)}
                            className="p-1 rounded text-zinc-400 hover:text-blue-300 transition-colors cursor-pointer"
                            title="编辑此手段参数或克隆定制"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {w.isCustom && onDeleteWeapon && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteWeaponItem(w.id, w.name, e)}
                              className="p-1 rounded text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                              title="删除此自制技能"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Full, Readable Description */}
                    <p
                      className={`font-sans leading-relaxed text-zinc-300 break-words ${
                        fontSizeMode === 'large' ? 'text-xs sm:text-sm' : 'text-xs'
                      }`}
                    >
                      {w.description}
                    </p>

                    {/* Bottom: Clear Labeled Stats Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-zinc-800/80 text-[11px] font-mono">
                      {/* HP Change */}
                      {w.damage !== 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                            realDmg > 0
                              ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                              : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                          }`}
                        >
                          {realDmg > 0 ? `💥 伤害: -${realDmg} HP` : `🩹 治疗: +${Math.abs(realDmg)} HP`}
                        </span>
                      )}

                      {/* Energy Drain */}
                      {w.energyDrain !== 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                            w.energyDrain > 0
                              ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                              : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                          }`}
                        >
                          {w.energyDrain > 0 ? `⚡ 抽能: -${w.energyDrain}%` : `🔋 充能: +${Math.abs(w.energyDrain)}%`}
                        </span>
                      )}

                      {/* Morale Damage */}
                      {w.moraleDamage !== 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                            w.moraleDamage > 0
                              ? 'bg-purple-950/80 border-purple-500/50 text-purple-300'
                              : 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300'
                          }`}
                        >
                          {w.moraleDamage > 0 ? `🧠 意志: -${w.moraleDamage}` : `🛡️ 振奋: +${Math.abs(w.moraleDamage)}`}
                        </span>
                      )}

                      {/* Shame Increase */}
                      {w.shameIncrease !== 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                            w.shameIncrease > 0
                              ? 'bg-fuchsia-950/80 border-fuchsia-500/50 text-fuchsia-300'
                              : 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                          }`}
                        >
                          {w.shameIncrease > 0 ? `😳 羞耻: +${w.shameIncrease}` : `😌 平复: -${Math.abs(w.shameIncrease)}`}
                        </span>
                      )}

                      {/* Obedience Gain */}
                      {w.obedienceGain !== 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                            w.obedienceGain > 0
                              ? 'bg-blue-950/80 border-blue-500/50 text-blue-300'
                              : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                          }`}
                        >
                          {w.obedienceGain > 0 ? `🤝 顺从: +${w.obedienceGain}` : `⚡ 抵触: -${Math.abs(w.obedienceGain)}`}
                        </span>
                      )}

                      {/* Lust Change */}
                      {(w.lustChange ?? 5) !== 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                            (w.lustChange ?? 5) > 0
                              ? 'bg-pink-950/80 border-pink-500/50 text-pink-300'
                              : 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                          }`}
                        >
                          {(w.lustChange ?? 5) > 0 ? `💓 欲望: +${w.lustChange ?? 5}` : `❄️ 冷静: ${w.lustChange ?? 5}`}
                        </span>
                      )}

                      {/* Shield Penetration Badge if present */}
                      {w.shieldPenetration && (
                        <span className="px-1.5 py-0.5 rounded border text-[10px] font-bold bg-indigo-950/80 border-indigo-500/50 text-indigo-300">
                          🛡️ 破盾贯穿
                        </span>
                      )}
                    </div>
                  </div>
                </HoverTooltip>
              );
            })
          )}
        </div>
      ) : (
        /* Comfortable Responsive Grid View with Hover Tooltips */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
          {/* Quick Create Card in Grid View */}
          <div
            onClick={() => {
              ultraAudio.playUiClick();
              if (onOpenCustomSkillModalTab) {
                onOpenCustomSkillModalTab('forge');
              } else if (onOpenCustomSkillModal) {
                onOpenCustomSkillModal();
              }
            }}
            className="p-3 rounded-lg border border-dashed border-purple-500/50 bg-purple-950/20 hover:bg-purple-950/40 text-purple-200 flex flex-col justify-center items-center text-center cursor-pointer transition-all group min-h-[100px]"
          >
            <Plus className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform mb-1" />
            <span className="text-xs font-bold text-purple-200">➕ 打造新攻击手段</span>
            <span className="text-[10px] text-purple-400 mt-0.5">自定义参数与伤害属性</span>
          </div>

          {filteredWeapons.map((w) => {
            const isSelected = w.id === selectedWeapon.id;
            const isFav = w.isFavorite || favoriteWeaponIds.includes(w.id);
            const allKnownTypes = [...DEFAULT_WEAPON_TYPES, ...customWeaponTypes];
            const foundType = allKnownTypes.find((t) => t.id === w.type);
            const typeLabel = foundType
              ? `${foundType.icon ? foundType.icon : ''} ${foundType.name.split(' ')[0]}`
              : w.type;

            const realDmg =
              w.damage > 0
                ? Math.max(0.1, Math.round(w.damage * activeTotalMult * 10) / 10)
                : 0;

            return (
              <HoverTooltip
                key={w.id}
                position="auto"
                className="w-full"
                content={
                  <WeaponTooltipCard
                    weapon={w}
                    hero={hero}
                    selectedPartId={selectedPart}
                    intensity={intensity}
                    totalMultiplier={activeTotalMult}
                    isSelected={isSelected}
                    customWeaponTypes={customWeaponTypes}
                  />
                }
              >
                <div
                  onClick={() => {
                    ultraAudio.playUiClick();
                    onSelectWeapon(w);
                  }}
                  className={`w-full p-2.5 rounded-lg text-left transition-all border flex flex-col justify-between space-y-2 cursor-pointer relative group ${
                    isSelected
                      ? 'bg-blue-500/15 border-blue-400 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.4)] ring-1 ring-blue-400/50'
                      : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center space-x-1 overflow-hidden">
                      {isFav && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                      <span
                        className={`font-bold font-sans break-words leading-tight truncate ${
                          fontSizeMode === 'large' ? 'text-sm' : 'text-xs'
                        } ${isSelected ? 'text-blue-300 font-extrabold' : 'text-zinc-200'}`}
                      >
                        {w.name}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 border ${getTypeBadgeStyle(
                        w.type
                      )}`}
                    >
                      {typeLabel}
                    </span>
                  </div>

                  <p
                    className={`text-zinc-400 font-sans leading-relaxed break-words line-clamp-2 ${
                      fontSizeMode === 'large' ? 'text-xs' : 'text-[11px]'
                    }`}
                    title={w.description}
                  >
                    {w.description}
                  </p>

                  {/* Dynamic Stats Row with Labels */}
                  <div className="flex flex-wrap items-center justify-between text-[10px] pt-1.5 border-t border-zinc-800/80 font-bold font-mono gap-1">
                    <span className={realDmg > 0 ? 'text-rose-400' : realDmg < 0 ? 'text-emerald-400' : 'text-zinc-500'}>
                      {realDmg > 0 ? `💥 -${realDmg}` : realDmg < 0 ? `🩹 +${Math.abs(realDmg)}` : '0 HP'}
                    </span>
                    <span className={w.shameIncrease > 0 ? 'text-fuchsia-400' : w.shameIncrease < 0 ? 'text-amber-400' : 'text-zinc-500'}>
                      {w.shameIncrease > 0 ? `😳 +${w.shameIncrease}` : w.shameIncrease < 0 ? `😌 -${Math.abs(w.shameIncrease)}` : '😳 0'}
                    </span>
                    <span className={w.obedienceGain > 0 ? 'text-blue-400' : w.obedienceGain < 0 ? 'text-rose-400' : 'text-zinc-500'}>
                      {w.obedienceGain > 0 ? `🤝 +${w.obedienceGain}` : w.obedienceGain < 0 ? `⚡ -${Math.abs(w.obedienceGain)}` : '🤝 0'}
                    </span>
                    <span className={(w.lustChange ?? 5) > 0 ? 'text-pink-400' : (w.lustChange ?? 5) < 0 ? 'text-amber-400' : 'text-zinc-500'}>
                      {(w.lustChange ?? 5) > 0 ? `💓 +${w.lustChange ?? 5}` : (w.lustChange ?? 5) < 0 ? `🧊 -${Math.abs(w.lustChange ?? 5)}` : '💓 0'}
                    </span>
                  </div>
                </div>
              </HoverTooltip>
            );
          })}
        </div>
      )}

      {/* 7. Selected Weapon Detail Feature Card with Prominent Tooltip */}
      <div className="bg-gradient-to-r from-blue-950/70 via-zinc-900 to-purple-950/70 border border-blue-500/40 rounded-xl p-3.5 flex flex-col space-y-2.5 shadow-lg relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-500/30 pb-2">
          <HoverTooltip
            position="bottom"
            content={
              <WeaponTooltipCard
                weapon={selectedWeapon}
                hero={hero}
                selectedPartId={selectedPart}
                intensity={intensity}
                totalMultiplier={activeTotalMult}
                isSelected={true}
                customWeaponTypes={customWeaponTypes}
              />
            }
          >
            <div className="flex items-center space-x-2 flex-wrap cursor-help group">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
              <span
                className={`font-extrabold text-blue-300 font-sans tracking-wide group-hover:text-amber-300 transition-colors ${
                  fontSizeMode === 'large' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                }`}
              >
                当前装配使用的手段：【{selectedWeapon.name}】
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getTypeBadgeStyle(
                  selectedWeapon.type
                )}`}
              >
                {selectedWeapon.type.toUpperCase()}
              </span>
              <HelpCircle className="w-3.5 h-3.5 text-blue-400 group-hover:text-amber-400" />
            </div>
          </HoverTooltip>

          <div className="text-xs text-zinc-300">
            推荐打击目标:{' '}
            <strong className="text-amber-300 font-bold">
              {hero.bodyParts[selectedWeapon.preferredTarget || 'torso']?.name || '全躯干/通用'}
            </strong>
          </div>
        </div>

        {/* FULL UNTRUNCATED TEXT DESCRIPTION BOX */}
        <div className="bg-zinc-950/90 p-3 rounded-lg border border-blue-900/60 leading-relaxed font-sans shadow-inner">
          <p
            className={`text-zinc-200 font-medium break-words ${
              fontSizeMode === 'large' ? 'text-xs sm:text-sm' : 'text-xs'
            }`}
          >
            <span className="text-amber-300 font-bold font-mono mr-1.5">💬 战术手段功效详解:</span>
            {selectedWeapon.description}
          </p>
        </div>

        {/* Tactical Parameters Breakdown (2x3 or 3x2 Grid for Non-Cluttered Space) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs pt-1 font-mono">
          <div className="bg-zinc-900/90 p-2 rounded-lg border border-zinc-800 text-center flex flex-col justify-between">
            <span className="text-zinc-400 text-[11px] block">体能/伤害变动</span>
            <strong
              className={`text-xs font-bold mt-1 ${
                selectedWeapon.damage > 0
                  ? 'text-rose-400'
                  : selectedWeapon.damage < 0
                  ? 'text-emerald-400'
                  : 'text-zinc-400'
              }`}
            >
              {selectedWeapon.damage > 0
                ? `-${selectedWeapon.damage} HP (伤害)`
                : selectedWeapon.damage < 0
                ? `+${Math.abs(selectedWeapon.damage)} HP (恢复)`
                : '0 HP'}
            </strong>
          </div>

          <div className="bg-zinc-900/90 p-2 rounded-lg border border-zinc-800 text-center flex flex-col justify-between">
            <span className="text-zinc-400 text-[11px] block">核心能量变动</span>
            <strong
              className={`text-xs font-bold mt-1 ${
                selectedWeapon.energyDrain > 0
                  ? 'text-amber-400'
                  : selectedWeapon.energyDrain < 0
                  ? 'text-cyan-400'
                  : 'text-zinc-400'
              }`}
            >
              {selectedWeapon.energyDrain > 0
                ? `-${selectedWeapon.energyDrain}% (抽能)`
                : selectedWeapon.energyDrain < 0
                ? `+${Math.abs(selectedWeapon.energyDrain)}% (充能)`
                : '0%'}
            </strong>
          </div>

          <div className="bg-zinc-900/90 p-2 rounded-lg border border-zinc-800 text-center flex flex-col justify-between">
            <span className="text-zinc-400 text-[11px] block">精神意志变动</span>
            <strong
              className={`text-xs font-bold mt-1 ${
                selectedWeapon.moraleDamage > 0
                  ? 'text-purple-400'
                  : selectedWeapon.moraleDamage < 0
                  ? 'text-indigo-400'
                  : 'text-zinc-400'
              }`}
            >
              {selectedWeapon.moraleDamage > 0
                ? `-${selectedWeapon.moraleDamage} (打击)`
                : selectedWeapon.moraleDamage < 0
                ? `+${Math.abs(selectedWeapon.moraleDamage)} (提升)`
                : '0'}
            </strong>
          </div>

          <div className="bg-zinc-900/90 p-2 rounded-lg border border-zinc-800 text-center flex flex-col justify-between">
            <span className="text-zinc-400 text-[11px] block">羞耻度变动</span>
            <strong
              className={`text-xs font-bold mt-1 ${
                selectedWeapon.shameIncrease > 0
                  ? 'text-fuchsia-400'
                  : selectedWeapon.shameIncrease < 0
                  ? 'text-amber-400'
                  : 'text-zinc-400'
              }`}
            >
              {selectedWeapon.shameIncrease > 0
                ? `+${selectedWeapon.shameIncrease} (诱发)`
                : selectedWeapon.shameIncrease < 0
                ? `-${Math.abs(selectedWeapon.shameIncrease)} (平复)`
                : '0'}
            </strong>
          </div>

          <div className="bg-zinc-900/90 p-2 rounded-lg border border-zinc-800 text-center flex flex-col justify-between">
            <span className="text-zinc-400 text-[11px] block">顺从/信任变动</span>
            <strong
              className={`text-xs font-bold mt-1 ${
                selectedWeapon.obedienceGain > 0
                  ? 'text-blue-400'
                  : selectedWeapon.obedienceGain < 0
                  ? 'text-rose-400'
                  : 'text-zinc-400'
              }`}
            >
              {selectedWeapon.obedienceGain > 0
                ? `+${selectedWeapon.obedienceGain} (提升)`
                : selectedWeapon.obedienceGain < 0
                ? `-${Math.abs(selectedWeapon.obedienceGain)} (降低)`
                : '0'}
            </strong>
          </div>

          <div className="bg-zinc-900/90 p-2 rounded-lg border border-zinc-800 text-center flex flex-col justify-between">
            <span className="text-zinc-400 text-[11px] block">敏感欲望变动</span>
            <strong
              className={`text-xs font-bold mt-1 ${
                (selectedWeapon.lustChange ?? 5) > 0
                  ? 'text-pink-400'
                  : (selectedWeapon.lustChange ?? 5) < 0
                  ? 'text-amber-400'
                  : 'text-zinc-400'
              }`}
            >
              {(selectedWeapon.lustChange ?? 5) > 0
                ? `+${selectedWeapon.lustChange ?? 5} (刺激)`
                : (selectedWeapon.lustChange ?? 5) < 0
                ? `-${Math.abs(selectedWeapon.lustChange ?? 5)} (平复)`
                : '0'}
            </strong>
          </div>
        </div>
      </div>

      {/* 8. Synchronized Interrogation Speech Accompanying Attack Input */}
      <div className="bg-zinc-950/90 p-3 rounded-lg border border-purple-900/40 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-purple-300 flex items-center gap-1.5 flex-wrap">
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            <span>💬 伴随打入的质问/言语挑衅 (与本次【{selectedWeapon.name}】同步打入):</span>
          </span>
          {speechText && (
            <button
              type="button"
              onClick={() => setSpeechText('')}
              className="text-[11px] text-zinc-400 hover:text-rose-400 cursor-pointer"
            >
              清空文字
            </button>
          )}
        </div>

        <input
          type="text"
          value={speechText}
          onChange={(e) => setSpeechText(e.target.value)}
          placeholder={`输入伴随此战术交互时对 ${hero.name} 说的质问、指令或台词...`}
          className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
        />

        {/* Quick Universal Prompts Toolbar with Full Hover Tooltip */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 font-bold">常用通用质问口令:</span>
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                setShowAllPromptsModal(!showAllPromptsModal);
              }}
              className="text-purple-400 hover:text-purple-200 underline cursor-pointer text-[10px]"
            >
              {showAllPromptsModal ? '收起完整口令库' : '展开查看所有口令完整文本'}
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
            {DEFAULT_UNIVERSAL_PROMPTS.map((preset, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  setSpeechText(preset);
                }}
                title={preset}
                className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-purple-200 hover:border-purple-500/50 whitespace-nowrap cursor-pointer transition-all shrink-0 font-sans text-xs"
              >
                💬 {preset}
              </button>
            ))}
          </div>

          {/* Expanded Full Prompts Card */}
          {showAllPromptsModal && (
            <div className="bg-black/80 p-3 rounded-lg border border-purple-800/60 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto">
              {DEFAULT_UNIVERSAL_PROMPTS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setSpeechText(preset);
                    setShowAllPromptsModal(false);
                  }}
                  className="p-2 rounded bg-zinc-900 border border-zinc-800 hover:border-purple-500 text-left text-xs text-zinc-200 transition-all cursor-pointer hover:bg-purple-950/40"
                >
                  <div className="font-sans leading-relaxed">💬 {preset}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 9. Tactical Execution Buttons: Single Fire vs Hold Mouse Continuous Attack with Tooltips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {/* Single Fire Button */}
        <HoverTooltip
          position="top"
          className="w-full"
          content={
            <div className="w-64 bg-zinc-950 border border-blue-500/60 p-2.5 rounded-lg text-xs space-y-1 shadow-xl">
              <div className="font-bold text-blue-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-yellow-300" />
                <span>执行单次【{selectedWeapon.name}】打入</span>
              </div>
              <p className="text-zinc-300 text-[11px]">
                以当前 {intensity.toFixed(1)}x 功率，瞄准【{hero.bodyParts[selectedPart]?.name || '目标部位'}】进行单次交互并触发角色专属反应与台词。
              </p>
            </div>
          }
        >
          <button
            type="button"
            onClick={handleSingleFire}
            disabled={isLoadingAi}
            className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-blue-700 via-rose-700 to-amber-700 hover:from-blue-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm tracking-wider shadow-lg flex flex-col items-center justify-center space-y-0.5 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <Zap className={`w-4 h-4 ${isLoadingAi ? 'text-zinc-400 animate-spin' : 'text-yellow-300 animate-bounce'}`} />
              <span>{isLoadingAi ? '⏳ API反应分析中...' : '执行单次战术打入'}</span>
            </div>
            <span className="text-[11px] text-blue-200/90 font-normal truncate max-w-full font-sans">
              【{selectedWeapon.name}】
            </span>
          </button>
        </HoverTooltip>

        {/* Hold Mouse Continuous Attack Button */}
        <HoverTooltip
          position="top"
          className="w-full"
          content={
            <div className="w-64 bg-zinc-950 border border-amber-500/60 p-2.5 rounded-lg text-xs space-y-1 shadow-xl">
              <div className="font-bold text-amber-300 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>持续【{selectedWeapon.name}】模式</span>
              </div>
              <p className="text-zinc-300 text-[11px]">
                按住鼠标左键或触摸屏不放，以高频周期持续对【{hero.bodyParts[selectedPart]?.name || '目标部位'}】进行施压，松开即可立即终止。
              </p>
            </div>
          }
        >
          <button
            type="button"
            onMouseDown={handleMouseDownHold}
            onMouseUp={handleMouseUpHold}
            onMouseLeave={handleMouseUpHold}
            onMouseEnter={handleMouseEnterOrMoveHold}
            onMouseMove={handleMouseEnterOrMoveHold}
            onTouchStart={handleMouseDownHold}
            onTouchEnd={handleMouseUpHold}
            onTouchCancel={handleMouseUpHold}
            className={`w-full py-3 px-4 rounded-lg font-bold text-xs sm:text-sm tracking-wider shadow-lg flex flex-col items-center justify-center space-y-0.5 transition-all cursor-pointer select-none border ${
              isContinuousFiring || isHoldingMouse
                ? 'bg-rose-950 border-rose-500 text-rose-200 animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.6)] scale-[0.99]'
                : 'bg-zinc-900 hover:bg-zinc-800 border-amber-500/60 text-amber-300 hover:border-amber-400'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Flame
                className={`w-4 h-4 ${
                  isContinuousFiring || isHoldingMouse ? 'text-rose-400 animate-spin' : 'text-amber-400 animate-pulse'
                }`}
              />
              <span>
                {isContinuousFiring || isHoldingMouse
                  ? `🔥 持续${getWeaponContinuousActionTitle(selectedWeapon)}中...`
                  : `🔥 按住持续${getWeaponContinuousActionTitle(selectedWeapon)}`}
              </span>
            </div>
            <span className="text-[11px] text-amber-200/80 font-normal truncate max-w-full font-sans">
              【{selectedWeapon.name}】(松开停止)
            </span>
          </button>
        </HoverTooltip>
      </div>
    </div>
  );
};

export const AttackControls = React.memo(BaseAttackControls);
