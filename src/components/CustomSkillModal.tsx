import React, { useState, useMemo } from 'react';
import {
  CustomSkill,
  WeaponType,
  AlienWeapon,
  CustomSkillCategory,
  DEFAULT_SKILL_CATEGORIES,
  CustomWeaponType,
  DEFAULT_WEAPON_TYPES,
  BodyPartId,
} from '../types';
import {
  Plus,
  Trash2,
  X,
  Sparkles,
  Zap,
  Shield,
  Flame,
  Edit3,
  RotateCcw,
  Copy,
  Check,
  Tag,
  Search,
  Sliders,
  Download,
  Upload,
  Star,
  Layers,
  Heart,
  Brain,
  Smile,
  AlertCircle,
  HelpCircle,
  FolderPlus,
  Wrench,
  Dna,
  Share2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { ultraAudio } from '../utils/audio';

export type SkillModalTab = 'arsenal' | 'forge' | 'category' | 'types' | 'backup';

interface CustomSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  weapons: AlienWeapon[];
  customSkills: CustomSkill[];
  customCategories?: CustomSkillCategory[];
  customWeaponTypes?: CustomWeaponType[];
  favoriteWeaponIds?: string[];
  initialTab?: SkillModalTab;
  initialEditingSkillId?: string | null;
  onAddCustomSkill: (skill: CustomSkill) => void;
  onDeleteWeapon: (weaponId: string) => void;
  onToggleFavoriteWeapon?: (weaponId: string) => void;
  onAddCustomCategory?: (cat: CustomSkillCategory) => void;
  onUpdateCustomCategory?: (cat: CustomSkillCategory) => void;
  onDeleteCustomCategory?: (catId: string) => void;
  onAddCustomWeaponType?: (wpt: CustomWeaponType) => void;
  onDeleteCustomWeaponType?: (wptId: string) => void;
  onResetAllSkills?: () => void;
}

// Preset Quick Skill Templates for instant forge populating
const PRESET_TEMPLATES: any[] = [];

const EMOJI_PICKER_OPTIONS = [
  '⚔️', '♥', '🌀', '⛓️', '⚡', '❇️', '😈', '🧠', '🔮', '🔒',
  '🧬', '💉', '🧪', '🪐', '👑', '🩸', '🎭', '🔥', '❄️', '🍓',
  '🔊', '💫', '✨', '🌊', '💥', '🛡️', '🎯', '🐾', '🎀', '💎',
];

export const CustomSkillModal: React.FC<CustomSkillModalProps> = ({
  isOpen,
  onClose,
  weapons,
  customSkills,
  customCategories = [],
  customWeaponTypes = [],
  favoriteWeaponIds = [],
  initialTab = 'arsenal',
  initialEditingSkillId = null,
  onAddCustomSkill,
  onDeleteWeapon,
  onToggleFavoriteWeapon,
  onAddCustomCategory,
  onUpdateCustomCategory,
  onDeleteCustomCategory,
  onAddCustomWeaponType,
  onDeleteCustomWeaponType,
  onResetAllSkills,
}) => {
  const [activeTab, setActiveTab] = useState<SkillModalTab>(initialTab);

  // Skill Editor Form State
  const [editingSkillId, setEditingSkillId] = useState<string | null>(initialEditingSkillId);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('attack');
  const [type, setType] = useState<WeaponType>('beam');
  const [damage, setDamage] = useState<number>(20);
  const [energyDrain, setEnergyDrain] = useState<number>(15);
  const [moraleDamage, setMoraleDamage] = useState<number>(15);
  const [shameIncrease, setShameIncrease] = useState<number>(10);
  const [obedienceGain, setObedienceGain] = useState<number>(10);
  const [lustChange, setLustChange] = useState<number>(5);
  const [partDamageChange, setPartDamageChange] = useState<number>(0);
  const [partExposureChange, setPartExposureChange] = useState<number>(0);
  const [shieldPenetration, setShieldPenetration] = useState<number>(20);
  const [preferredTarget, setPreferredTarget] = useState<BodyPartId | 'none'>('none');
  const [sfxType, setSfxType] = useState<'laser' | 'zap' | 'siphon' | 'wave' | 'acid' | 'chains' | 'touch' | 'chime' | 'heal'>('laser');
  const [description, setDescription] = useState('');

  // Arsenal Tab Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'damage_desc' | 'energy_desc' | 'morale_desc' | 'obedience_desc' | 'custom_first'>('default');

  // Category Manager Form State
  const [newCatId, setNewCatId] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('✨');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Weapon Type Form State
  const [newTypeId, setNewTypeId] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeIcon, setNewTypeIcon] = useState('⚡');

  // Backup & Import/Export State
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Sync initial editing state if passed
  React.useEffect(() => {
    if (initialEditingSkillId) {
      const target = weapons.find((w) => w.id === initialEditingSkillId);
      if (target) {
        handleStartEdit(target);
        setActiveTab('forge');
      }
    }
  }, [initialEditingSkillId]);

  const allCategories: CustomSkillCategory[] = [
    ...DEFAULT_SKILL_CATEGORIES,
    ...customCategories,
  ];

  const allWeaponTypes: CustomWeaponType[] = [
    ...DEFAULT_WEAPON_TYPES,
    ...customWeaponTypes,
  ];

  const handleStartEdit = (wpn: AlienWeapon | CustomSkill) => {
    ultraAudio.playUiClick();
    setEditingSkillId(wpn.id);
    setName(wpn.name);
    setCategory(wpn.category || 'attack');
    setType(wpn.type || 'beam');
    setDamage(wpn.damage ?? 20);
    setEnergyDrain(wpn.energyDrain ?? 15);
    setMoraleDamage(wpn.moraleDamage ?? 15);
    setShameIncrease(wpn.shameIncrease ?? 10);
    setObedienceGain(wpn.obedienceGain ?? 10);
    setLustChange(wpn.lustChange ?? 5);
    setPartDamageChange(wpn.partDamageChange ?? 0);
    setPartExposureChange(wpn.partExposureChange ?? 0);
    setShieldPenetration((wpn as any).shieldPenetration ?? 20);
    setPreferredTarget((wpn.preferredTarget as BodyPartId) || 'none');
    setSfxType((wpn.sfxType as any) || 'laser');
    setDescription(wpn.description || '');
    setActiveTab('forge');
  };

  const handleCancelEdit = () => {
    ultraAudio.playUiClick();
    setEditingSkillId(null);
    setName('');
    setDescription('');
    setCategory('attack');
    setType('beam');
    setDamage(20);
    setEnergyDrain(15);
    setMoraleDamage(15);
    setShameIncrease(10);
    setObedienceGain(10);
    setLustChange(5);
    setPartDamageChange(0);
    setPartExposureChange(0);
    setShieldPenetration(20);
    setPreferredTarget('none');
    setSfxType('laser');
  };

  const handleApplyTemplate = (tmpl: typeof PRESET_TEMPLATES[0]) => {
    ultraAudio.playApiReplyChime();
    setEditingSkillId(null);
    setName(tmpl.name);
    setCategory(tmpl.category);
    setType(tmpl.type);
    setDamage(tmpl.damage);
    setEnergyDrain(tmpl.energyDrain);
    setMoraleDamage(tmpl.moraleDamage);
    setShameIncrease(tmpl.shameIncrease);
    setObedienceGain(tmpl.obedienceGain);
    setLustChange(tmpl.lustChange);
    setPartDamageChange(tmpl.partDamageChange);
    setPartExposureChange(tmpl.partExposureChange);
    setShieldPenetration(tmpl.shieldPenetration);
    setPreferredTarget(tmpl.preferredTarget);
    setSfxType(tmpl.sfxType);
    setDescription(tmpl.description);
  };

  const handleCloneSkill = (wpn: AlienWeapon) => {
    ultraAudio.playUiClick();
    setEditingSkillId(null);
    setName(`${wpn.name} [副本]`);
    setCategory(wpn.category || 'attack');
    setType(wpn.type || 'beam');
    setDamage(wpn.damage ?? 20);
    setEnergyDrain(wpn.energyDrain ?? 15);
    setMoraleDamage(wpn.moraleDamage ?? 15);
    setShameIncrease(wpn.shameIncrease ?? 10);
    setObedienceGain(wpn.obedienceGain ?? 10);
    setLustChange(wpn.lustChange ?? 5);
    setPartDamageChange(wpn.partDamageChange ?? 0);
    setPartExposureChange(wpn.partExposureChange ?? 0);
    setShieldPenetration((wpn as any).shieldPenetration ?? 20);
    setPreferredTarget((wpn.preferredTarget as BodyPartId) || 'none');
    setSfxType((wpn.sfxType as any) || 'laser');
    setDescription(`${wpn.description} (自定义修改副本)`);
    setActiveTab('forge');
  };

  const handleSubmitSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const skillId = editingSkillId
      ? editingSkillId
      : `skill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newSkill: CustomSkill = {
      id: skillId,
      name: name.trim(),
      category,
      type,
      damage,
      energyDrain,
      moraleDamage,
      shameIncrease,
      obedienceGain,
      lustChange,
      partDamageChange,
      partExposureChange,
      shieldPenetration,
      preferredTarget: preferredTarget === 'none' ? undefined : (preferredTarget as BodyPartId),
      sfxType,
      hpHeal: damage < 0 ? Math.abs(damage) : (category === 'heal' ? 25 : undefined),
      description: description.trim() || `战术手段: ${name.trim()}`,
      isCustom: true,
      createdAt: Date.now(),
    };

    ultraAudio.playApiReplyChime();
    onAddCustomSkill(newSkill);
    handleCancelEdit();
    setActiveTab('arsenal');
  };

  // Category Submit
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const catId = editingCatId
      ? editingCatId
      : (newCatId.trim() || `cat_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`).toLowerCase().replace(/\s+/g, '_');

    const catObj: CustomSkillCategory = {
      id: catId,
      name: newCatName.trim(),
      icon: newCatIcon.trim() || '✨',
      description: newCatDesc.trim() || `自定义战术分类: ${newCatName.trim()}`,
      isCustom: true,
    };

    ultraAudio.playUiClick();
    if (editingCatId && onUpdateCustomCategory) {
      onUpdateCustomCategory(catObj);
    } else if (onAddCustomCategory) {
      onAddCustomCategory(catObj);
    }

    setEditingCatId(null);
    setNewCatId('');
    setNewCatName('');
    setNewCatIcon('✨');
    setNewCatDesc('');
  };

  // Weapon Type Submit
  const handleSaveWeaponType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim() || !onAddCustomWeaponType) return;
    const typeId = (newTypeId.trim() || `type_${Date.now()}`).toLowerCase().replace(/\s+/g, '_');
    onAddCustomWeaponType({
      id: typeId,
      name: newTypeName.trim(),
      icon: newTypeIcon.trim() || '⚡',
    });
    setNewTypeId('');
    setNewTypeName('');
    setNewTypeIcon('⚡');
  };

  // Filtered & Sorted Weapons
  const filteredAndSortedWeapons = useMemo(() => {
    let list = weapons.filter((w) => {
      // Category filter
      if (filterCategory !== 'all') {
        if (filterCategory === 'custom') {
          if (!w.isCustom && !customSkills.some((cs) => cs.id === w.id)) return false;
        } else if (filterCategory === 'favorites') {
          if (!favoriteWeaponIds.includes(w.id)) return false;
        } else if (filterCategory === 'pure_love') {
          const isPure =
            w.description.includes('纯爱关怀') ||
            w.id.includes('pure') ||
            w.id.includes('radiant') ||
            w.id.includes('nutrient') ||
            w.id.includes('towel') ||
            w.id.includes('vow');
          if (!isPure) return false;
        } else if (filterCategory === 'evil_care') {
          const isEvil =
            w.description.includes('深度支配') ||
            w.description.includes('邪恶') ||
            w.id.includes('parasitic') ||
            w.id.includes('aphrodisiac') ||
            w.id.includes('master_slave') ||
            w.id.includes('alien_blood') ||
            w.id.includes('bliss');
          if (!isEvil) return false;
        } else if (w.category !== filterCategory) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = w.name.toLowerCase().includes(q);
        const matchDesc = (w.description || '').toLowerCase().includes(q);
        const matchType = (w.type || '').toLowerCase().includes(q);
        const matchCat = (w.category || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchType && !matchCat) return false;
      }

      return true;
    });

    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === 'damage_desc') return (b.damage || 0) - (a.damage || 0);
      if (sortBy === 'energy_desc') return (b.energyDrain || 0) - (a.energyDrain || 0);
      if (sortBy === 'morale_desc') return (b.moraleDamage || 0) - (a.moraleDamage || 0);
      if (sortBy === 'obedience_desc') return (b.obedienceGain || 0) - (a.obedienceGain || 0);
      if (sortBy === 'custom_first') {
        const aCustom = a.isCustom || customSkills.some((cs) => cs.id === a.id) ? 1 : 0;
        const bCustom = b.isCustom || customSkills.some((cs) => cs.id === b.id) ? 1 : 0;
        return bCustom - aCustom;
      }
      return 0;
    });

    return list;
  }, [weapons, customSkills, favoriteWeaponIds, filterCategory, searchQuery, sortBy]);

  // Export Full Arsenal JSON
  const handleExportFullArsenal = () => {
    ultraAudio.playUiClick();
    const exportPayload = {
      version: 'ultra_arsenal_v1',
      exportedAt: new Date().toISOString(),
      weapons: weapons,
      customSkills: customSkills,
      customCategories: customCategories,
      customWeaponTypes: customWeaponTypes,
      favoriteWeaponIds: favoriteWeaponIds,
    };
    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ultra_arsenal_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy Full Arsenal JSON
  const handleCopyArsenalJson = () => {
    ultraAudio.playUiClick();
    const exportPayload = {
      version: 'ultra_arsenal_v1',
      exportedAt: new Date().toISOString(),
      weapons: weapons,
      customSkills: customSkills,
      customCategories: customCategories,
      customWeaponTypes: customWeaponTypes,
    };
    navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Import Arsenal JSON
  const handleConfirmImport = (mode: 'merge' | 'replace') => {
    ultraAudio.playUiClick();
    setImportError(null);
    setImportSuccess(null);
    try {
      const parsed = JSON.parse(importJsonText.trim());
      let skillsToImport: CustomSkill[] = [];
      let catsToImport: CustomSkillCategory[] = [];
      let typesToImport: CustomWeaponType[] = [];

      if (Array.isArray(parsed)) {
        skillsToImport = parsed;
      } else if (parsed.customSkills || parsed.weapons) {
        skillsToImport = parsed.customSkills || parsed.weapons;
        if (Array.isArray(parsed.customCategories)) catsToImport = parsed.customCategories;
        if (Array.isArray(parsed.customWeaponTypes)) typesToImport = parsed.customWeaponTypes;
      } else if (parsed.name && (parsed.damage !== undefined || parsed.type)) {
        skillsToImport = [parsed];
      } else {
        throw new Error('无法识别的数据格式，请提供正确的技能手段或武器库备份 JSON。');
      }

      // Add skills
      skillsToImport.forEach((sk) => {
        onAddCustomSkill({
          ...sk,
          id: sk.id || `skill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          isCustom: true,
        });
      });

      // Add categories
      if (onAddCustomCategory && catsToImport.length > 0) {
        catsToImport.forEach((cat) => onAddCustomCategory(cat));
      }

      // Add types
      if (onAddCustomWeaponType && typesToImport.length > 0) {
        typesToImport.forEach((tp) => onAddCustomWeaponType(tp));
      }

      setImportSuccess(`✅ 成功导入 ${skillsToImport.length} 个攻击手段与 ${catsToImport.length} 个分类！`);
      setImportJsonText('');
      setTimeout(() => {
        setImportSuccess(null);
        setActiveTab('arsenal');
      }, 2000);
    } catch (e: any) {
      setImportError(e.message || 'JSON 解析失败，请检查格式');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
      <div className="bg-zinc-950 border border-purple-500/70 rounded-2xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-[0_0_80px_rgba(168,85,247,0.35)] overflow-hidden text-zinc-100">
        {/* Top Header */}
        <div className="p-3.5 sm:p-4 border-b border-purple-900/60 bg-gradient-to-r from-purple-950/80 via-zinc-900 to-indigo-950/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-purple-900/50 border border-purple-500/50 shadow-inner">
              <Sparkles className="w-5 h-5 text-purple-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-extrabold tracking-wider text-purple-200 uppercase">
                  ⚔️ 战术武装与攻击手段工坊 (Arsenal Forge)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/80 text-purple-300 border border-purple-500/40 font-bold">
                  {weapons.length} 个可用手段
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-normal">
                自由新增、定制、删除与分类管理所有战术手段、伤害属性与生理交互效果
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onResetAllSkills && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('确定要重置并恢复官方默认初始武器手段库吗？自定义手段将保留。')) {
                    ultraAudio.playUiClick();
                    onResetAllSkills();
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-amber-500/50 text-zinc-300 hover:text-amber-300 flex items-center space-x-1.5 cursor-pointer transition-all"
                title="恢复所有被删除/修改的内置官方手段"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">恢复默认库</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                onClose();
              }}
              className="text-zinc-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-zinc-800/80 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-3 sm:px-4 pt-2 border-b border-zinc-800 bg-zinc-900/60 overflow-x-auto no-scrollbar gap-1 text-xs">
          <button
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('arsenal');
            }}
            className={`px-3 py-2 rounded-t-xl font-bold flex items-center space-x-1.5 transition-all border-t border-x cursor-pointer ${
              activeTab === 'arsenal'
                ? 'bg-zinc-950 text-purple-300 border-purple-500/60 border-b-transparent shadow-sm'
                : 'text-zinc-400 border-transparent hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>⚔️ 手段总库管理 ({weapons.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('forge');
            }}
            className={`px-3 py-2 rounded-t-xl font-bold flex items-center space-x-1.5 transition-all border-t border-x cursor-pointer ${
              activeTab === 'forge'
                ? 'bg-zinc-950 text-amber-300 border-amber-500/60 border-b-transparent shadow-sm'
                : 'text-zinc-400 border-transparent hover:text-zinc-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span>{editingSkillId ? '🛠️ 编辑攻击手段' : '➕ 打造新攻击手段'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('category');
            }}
            className={`px-3 py-2 rounded-t-xl font-bold flex items-center space-x-1.5 transition-all border-t border-x cursor-pointer ${
              activeTab === 'category'
                ? 'bg-zinc-950 text-cyan-300 border-cyan-500/60 border-b-transparent shadow-sm'
                : 'text-zinc-400 border-transparent hover:text-zinc-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-cyan-400" />
            <span>🏷️ 分类管理 ({allCategories.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('types');
            }}
            className={`px-3 py-2 rounded-t-xl font-bold flex items-center space-x-1.5 transition-all border-t border-x cursor-pointer ${
              activeTab === 'types'
                ? 'bg-zinc-950 text-rose-300 border-rose-500/60 border-b-transparent shadow-sm'
                : 'text-zinc-400 border-transparent hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-rose-400" />
            <span>⚡ 伤害属性类型 ({allWeaponTypes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('backup');
            }}
            className={`px-3 py-2 rounded-t-xl font-bold flex items-center space-x-1.5 transition-all border-t border-x cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-zinc-950 text-emerald-300 border-emerald-500/60 border-b-transparent shadow-sm'
                : 'text-zinc-400 border-transparent hover:text-zinc-200'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>📦 备份与导入导出</span>
          </button>
        </div>

        {/* Modal Body Area */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 scrollbar-thin text-xs space-y-4">
          {/* ======================= TAB 1: ARSENAL LIBRARY ======================= */}
          {activeTab === 'arsenal' && (
            <div className="space-y-3.5">
              {/* Search, Filter & Quick Add Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索手段名称、类型、描述..."
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Sort By */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="default">默认排序</option>
                    <option value="custom_first">✨ 用户自制优先</option>
                    <option value="damage_desc">💥 生命打击最高</option>
                    <option value="energy_desc">⚡ 能量抽取最高</option>
                    <option value="morale_desc">🧠 意志削弱最高</option>
                    <option value="obedience_desc">🤝 顺从增益最高</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      handleCancelEdit();
                      setActiveTab('forge');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-bold flex items-center space-x-1.5 shadow-[0_0_12px_rgba(168,85,247,0.4)] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>➕ 打造新手段</span>
                  </button>
                </div>
              </div>

              {/* Category Filter Chips Bar */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setFilterCategory('all');
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all border cursor-pointer ${
                    filterCategory === 'all'
                      ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  🌐 全部 ({weapons.length})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setFilterCategory('favorites');
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center space-x-1 ${
                    filterCategory === 'favorites'
                      ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>已收藏 ({favoriteWeaponIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setFilterCategory('custom');
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all border cursor-pointer ${
                    filterCategory === 'custom'
                      ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  ✨ 用户自制 ({weapons.filter((w) => w.isCustom || customSkills.some((cs) => cs.id === w.id)).length})
                </button>

                {allCategories.map((cat) => {
                  const count = weapons.filter((w) => w.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        setFilterCategory(cat.id);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center space-x-1 ${
                        filterCategory === cat.id
                          ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span>{cat.icon || '✨'}</span>
                      <span>{cat.name} ({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Weapons Card Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
                {filteredAndSortedWeapons.length === 0 ? (
                  <div className="col-span-full p-8 text-center bg-zinc-900/40 rounded-xl border border-zinc-800 text-zinc-500 space-y-2">
                    <AlertCircle className="w-8 h-8 mx-auto text-zinc-600" />
                    <p className="text-xs">暂无符合条件的攻击手段，请尝试更换搜索词或筛选标签。</p>
                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        handleCancelEdit();
                        setActiveTab('forge');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-900/60 border border-purple-500/50 text-purple-200 text-xs font-bold hover:bg-purple-800 transition-all cursor-pointer inline-flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>立即打造新手段</span>
                    </button>
                  </div>
                ) : (
                  filteredAndSortedWeapons.map((w) => {
                    const isFav = favoriteWeaponIds.includes(w.id);
                    const isCustom = w.isCustom || customSkills.some((cs) => cs.id === w.id);
                    const matchedCat = allCategories.find((c) => c.id === w.category);

                    return (
                      <div
                        key={w.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-2.5 relative group ${
                          isCustom
                            ? 'bg-purple-950/20 border-purple-800/60 hover:border-purple-500/80 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                            : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {/* Card Header: Title, Category Badge, Action Buttons */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span className="font-bold text-zinc-100 text-sm font-sans">
                                {w.name}
                              </span>
                              {isCustom && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900 text-purple-300 border border-purple-500/50 font-bold">
                                  自制
                                </span>
                              )}
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                {matchedCat ? `${matchedCat.icon} ${matchedCat.name}` : w.category || '未分类'}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800">
                                {w.type}
                              </span>
                            </div>
                          </div>

                          {/* Actions: Favorite, Edit, Clone, Delete */}
                          <div className="flex items-center space-x-1 shrink-0">
                            {onToggleFavoriteWeapon && (
                              <button
                                type="button"
                                onClick={() => {
                                  ultraAudio.playUiClick();
                                  onToggleFavoriteWeapon(w.id);
                                }}
                                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                                  isFav
                                    ? 'text-amber-400 hover:bg-amber-950/50'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                                }`}
                                title={isFav ? '取消收藏' : '加入常用收藏'}
                              >
                                <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400' : ''}`} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleStartEdit(w)}
                              className="p-1.5 rounded-md text-zinc-400 hover:text-purple-300 hover:bg-purple-950/60 transition-all cursor-pointer"
                              title="编辑此手段"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCloneSkill(w)}
                              className="p-1.5 rounded-md text-zinc-400 hover:text-indigo-300 hover:bg-indigo-950/60 transition-all cursor-pointer"
                              title="克隆此手段为副本"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`确定要删除/移除攻击手段【${w.name}】吗？`)) {
                                  ultraAudio.playUiClick();
                                  onDeleteWeapon(w.id);
                                }
                              }}
                              className="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-950/60 transition-all cursor-pointer"
                              title="删除此手段"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-zinc-300 font-sans leading-relaxed text-[11px] line-clamp-2">
                          {w.description || '暂无详细描述'}
                        </p>

                        {/* Stats Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-zinc-800/80 text-[10px] font-mono">
                          {w.damage !== 0 && (
                            <span
                              className={`px-1.5 py-0.5 rounded border font-bold ${
                                w.damage > 0
                                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                                  : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                              }`}
                            >
                              {w.damage > 0 ? `💥 伤: -${w.damage}` : `🩹 疗: +${Math.abs(w.damage)}`}
                            </span>
                          )}

                          {w.energyDrain !== 0 && (
                            <span className="px-1.5 py-0.5 rounded border bg-amber-950/80 border-amber-500/50 text-amber-300 font-bold">
                              ⚡ 能: -{w.energyDrain}%
                            </span>
                          )}

                          {w.moraleDamage !== 0 && (
                            <span className="px-1.5 py-0.5 rounded border bg-purple-950/80 border-purple-500/50 text-purple-300 font-bold">
                              🧠 志: -{w.moraleDamage}
                            </span>
                          )}

                          {w.shameIncrease !== 0 && (
                            <span className={`px-1.5 py-0.5 rounded border font-bold ${w.shameIncrease > 0 ? 'bg-fuchsia-950/80 border-fuchsia-500/50 text-fuchsia-300' : 'bg-amber-950/80 border-amber-500/50 text-amber-300'}`}>
                              {w.shameIncrease > 0 ? `😳 羞: +${w.shameIncrease}` : `😌 羞: -${Math.abs(w.shameIncrease)}`}
                            </span>
                          )}

                          {w.obedienceGain !== 0 && (
                            <span className={`px-1.5 py-0.5 rounded border font-bold ${w.obedienceGain > 0 ? 'bg-blue-950/80 border-blue-500/50 text-blue-300' : 'bg-rose-950/80 border-rose-500/50 text-rose-300'}`}>
                              {w.obedienceGain > 0 ? `🤝 服: +${w.obedienceGain}` : `⚡ 顺: -${Math.abs(w.obedienceGain)}`}
                            </span>
                          )}

                          {(w.lustChange ?? 5) !== 0 && (
                            <span className={`px-1.5 py-0.5 rounded border font-bold ${(w.lustChange ?? 5) > 0 ? 'bg-pink-950/80 border-pink-500/50 text-pink-300' : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'}`}>
                              {(w.lustChange ?? 5) > 0 ? `💓 欲: +${w.lustChange ?? 5}` : `🧊 欲: -${Math.abs(w.lustChange ?? 5)}`}
                            </span>
                          )}

                          {(w.shieldPenetration ?? 20) > 0 && (
                            <span className="px-1.5 py-0.5 rounded border bg-indigo-950/80 border-indigo-500/50 text-indigo-300 font-bold">
                              🛡️ 穿盾: {w.shieldPenetration ?? 20}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ======================= TAB 2: SKILL FORGE & EDITOR ======================= */}
          {activeTab === 'forge' && (
            <div className="space-y-4">
              {/* Quick Template Presets Bar */}
              <div className="bg-zinc-900/90 p-3 rounded-xl border border-amber-900/50 space-y-2">
                <div className="flex items-center space-x-1.5 text-amber-300 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>快速应用经典战术模板 (一键填充灵感与数值):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      type="button"
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-amber-950/60 border border-zinc-800 hover:border-amber-500/50 text-zinc-300 hover:text-amber-200 text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1"
                    >
                      <span>{tmpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Skill Edit Form */}
              <form onSubmit={handleSubmitSkill} className="bg-zinc-900/80 p-4 rounded-xl border border-purple-500/50 space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                  <h3 className="font-bold text-purple-300 flex items-center space-x-2 text-sm">
                    <Edit3 className="w-4 h-4 text-purple-400" />
                    <span>{editingSkillId ? `正在编辑手段: 【${name}】` : '打造专属全新战术手段'}</span>
                  </h3>
                  {editingSkillId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-2.5 py-1 rounded-lg text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                    >
                      清空/新建
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Name */}
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold block">
                      手段名称 <span className="text-rose-400">*</span>:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="例如: 极光能量震荡波"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-purple-500 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-600 outline-none"
                    />
                  </div>

                  {/* Category Selection */}
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold block">所属战术分类:</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-purple-500 rounded-lg px-3 py-2 text-zinc-100 outline-none cursor-pointer"
                    >
                      {allCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Weapon Type Selection */}
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold block">伤害属性类型 (Type):</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-purple-500 rounded-lg px-3 py-2 text-zinc-100 outline-none cursor-pointer"
                    >
                      {allWeaponTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.icon ? `${t.icon} ` : ''}{t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Preferred Target */}
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold block">偏好攻击部位:</label>
                    <select
                      value={preferredTarget}
                      onChange={(e) => setPreferredTarget(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-purple-500 rounded-lg px-3 py-2 text-zinc-100 outline-none cursor-pointer"
                    >
                      <option value="none">无特定偏好 (全部位适用)</option>
                      <option value="timer">核心灵能晶石 (能量中枢)</option>
                      <option value="chest">胸前战甲 / 护心甲</option>
                      <option value="torso">腰腹躯干 / 神经回路</option>
                      <option value="head">头部面罩 / 精神中枢</option>
                      <option value="leftArm">左臂 / 防御手套</option>
                      <option value="rightArm">右臂 / 攻击端</option>
                      <option value="legs">腿部战靴 / 机动下肢</option>
                    </select>
                  </div>

                  {/* SFX Audio */}
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold block">打击生效音效 (SFX):</label>
                    <select
                      value={sfxType}
                      onChange={(e) => setSfxType(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-purple-500 rounded-lg px-3 py-2 text-zinc-100 outline-none cursor-pointer"
                    >
                      <option value="laser">激光爆破 / 高能贯穿 (laser)</option>
                      <option value="zap">电磁脉冲 / 电极击晕 (zap)</option>
                      <option value="siphon">量子虹吸 / 能量抽离 (siphon)</option>
                      <option value="wave">脑波侵蚀 / 心智共鸣 (wave)</option>
                      <option value="acid">生化强酸 / 异变寄生 (acid)</option>
                      <option value="chains">反重力锁链 / 机械拘束 (chains)</option>
                      <option value="touch">敏感触碰 / 肉体接触 (touch)</option>
                      <option value="heal">圣光微粒 / 纳米修复 (heal)</option>
                      <option value="chime">真言回响 / 神圣钟鸣 (chime)</option>
                    </select>
                  </div>

                  {/* Shield Penetration */}
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold block">
                      护盾穿透率 ({shieldPenetration}%):
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={shieldPenetration}
                      onChange={(e) => setShieldPenetration(Number(e.target.value))}
                      className="w-full accent-purple-500 bg-zinc-900 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Numerical Parameters Grid */}
                <div className="p-3 rounded-xl bg-black/50 border border-zinc-800 space-y-3">
                  <div className="text-xs font-bold text-purple-300 flex items-center justify-between">
                    <span>战术数值与状态干涉调节 (支持输入正负值):</span>
                    <span className="text-[10px] text-zinc-500 font-normal">正值造成削减/破坏，负值产生修复/充能</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {/* HP Damage / Heal */}
                    <div className="p-2 rounded-lg bg-zinc-900/80 border border-rose-950 space-y-1">
                      <label className="text-[11px] font-bold text-rose-300 block">
                        💥 生命变动 (HP):
                      </label>
                      <input
                        type="number"
                        value={damage}
                        onChange={(e) => setDamage(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-rose-200 outline-none font-mono"
                      />
                      <span className="text-[9px] text-zinc-500 block">
                        {damage > 0 ? `造成 ${damage} 点生命打击` : damage < 0 ? `产生 ${Math.abs(damage)} 点生命治疗` : '无生命影响'}
                      </span>
                    </div>

                    {/* Energy Drain */}
                    <div className="p-2 rounded-lg bg-zinc-900/80 border border-amber-950 space-y-1">
                      <label className="text-[11px] font-bold text-amber-300 block">
                        ⚡ 能量变动 (Energy %):
                      </label>
                      <input
                        type="number"
                        value={energyDrain}
                        onChange={(e) => setEnergyDrain(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-amber-200 outline-none font-mono"
                      />
                      <span className="text-[9px] text-zinc-500 block">
                        {energyDrain > 0 ? `剥离 ${energyDrain}% 核心魔能` : `注入 ${Math.abs(energyDrain)}% 能量`}
                      </span>
                    </div>

                    {/* Morale Damage */}
                    <div className="p-2 rounded-lg bg-zinc-900/80 border border-purple-950 space-y-1">
                      <label className="text-[11px] font-bold text-purple-300 block">
                        🧠 意志削弱 (Morale):
                      </label>
                      <input
                        type="number"
                        value={moraleDamage}
                        onChange={(e) => setMoraleDamage(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-purple-200 outline-none font-mono"
                      />
                      <span className="text-[9px] text-zinc-500 block">
                        {moraleDamage > 0 ? `击溃 ${moraleDamage} 精神意志` : `抚慰振奋 ${Math.abs(moraleDamage)} 意志`}
                      </span>
                    </div>

                    {/* Shame Increase */}
                    <div className="p-2 rounded-lg bg-zinc-900/80 border border-fuchsia-950 space-y-1">
                      <label className="text-[11px] font-bold text-fuchsia-300 block">
                        😳 羞耻度变动 (Shame):
                      </label>
                      <input
                        type="number"
                        value={shameIncrease}
                        onChange={(e) => setShameIncrease(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-fuchsia-200 outline-none font-mono"
                      />
                      <span className="text-[9px] text-zinc-500 block">
                        {shameIncrease > 0 ? `增加 ${shameIncrease} 羞耻感` : `平复 ${Math.abs(shameIncrease)} 羞耻`}
                      </span>
                    </div>

                    {/* Obedience Gain */}
                    <div className="p-2 rounded-lg bg-zinc-900/80 border border-blue-950 space-y-1">
                      <label className="text-[11px] font-bold text-blue-300 block">
                        🤝 顺从度变动 (Obedience):
                      </label>
                      <input
                        type="number"
                        value={obedienceGain}
                        onChange={(e) => setObedienceGain(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-blue-200 outline-none font-mono"
                      />
                      <span className="text-[9px] text-zinc-500 block">
                        {obedienceGain > 0 ? `提高 ${obedienceGain} 顺从服从` : `激化 ${Math.abs(obedienceGain)} 抵触叛逆`}
                      </span>
                    </div>

                    {/* Lust Change */}
                    <div className="p-2 rounded-lg bg-zinc-900/80 border border-pink-950 space-y-1">
                      <label className="text-[11px] font-bold text-pink-300 block">
                        💓 欲望敏感 (Lust):
                      </label>
                      <input
                        type="number"
                        value={lustChange}
                        onChange={(e) => setLustChange(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-pink-200 outline-none font-mono"
                      />
                      <span className="text-[9px] text-zinc-500 block">
                        {lustChange > 0 ? `提升 ${lustChange} 发情度` : `平息 ${Math.abs(lustChange)} 欲望`}
                      </span>
                    </div>

                    {/* Part Damage % */}
                    <div className="p-2 rounded-lg bg-zinc-900/80 border border-orange-950 space-y-1">
                      <label className="text-[11px] font-bold text-orange-300 block">
                        👗 部位装甲损坏变动:
                      </label>
                      <input
                        type="number"
                        value={partDamageChange}
                        onChange={(e) => setPartDamageChange(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-orange-200 outline-none font-mono"
                      />
                      <span className="text-[9px] text-zinc-500 block">
                        {partDamageChange > 0 ? `加重 ${partDamageChange}% 破损` : `修复 ${Math.abs(partDamageChange)}% 装甲`}
                      </span>
                    </div>

                    {/* Part Exposure / Alienation % */}
                    <div className="p-2 rounded-lg bg-zinc-900/80 border border-indigo-950 space-y-1">
                      <label className="text-[11px] font-bold text-indigo-300 block">
                        🧬 生理异化/暴衣变动:
                      </label>
                      <input
                        type="number"
                        value={partExposureChange}
                        onChange={(e) => setPartExposureChange(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-indigo-200 outline-none font-mono"
                      />
                      <span className="text-[9px] text-zinc-500 block">
                        {partExposureChange > 0 ? `加深 ${partExposureChange}% 异变` : `净化还原 ${Math.abs(partExposureChange)}%`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-zinc-300 font-bold block">
                    战术描述与剧情交互意图说明:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="详细描述该攻击手段的视觉光效、作用机理及目标角色遭遇时的生理与心理反应..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-purple-500 rounded-lg p-2.5 text-zinc-100 placeholder-zinc-600 outline-none font-mono resize-y"
                  />
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold cursor-pointer"
                  >
                    重置清空
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-bold transition-all shadow-[0_0_16px_rgba(168,85,247,0.4)] cursor-pointer flex items-center space-x-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingSkillId ? '更新保存手段' : '立即加入战术手段库'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ======================= TAB 3: CATEGORY MANAGER ======================= */}
          {activeTab === 'category' && (
            <div className="space-y-4">
              {/* Category Add/Edit Form */}
              <form onSubmit={handleSaveCategory} className="bg-zinc-900/80 p-4 rounded-xl border border-cyan-500/50 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <h3 className="font-bold text-cyan-300 flex items-center space-x-2 text-sm">
                    <FolderPlus className="w-4 h-4 text-cyan-400" />
                    <span>{editingCatId ? `编辑分类: 【${newCatName}】` : '➕ 新建攻击手段分类 (New Category)'}</span>
                  </h3>
                  {editingCatId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatId(null);
                        setNewCatId('');
                        setNewCatName('');
                        setNewCatIcon('✨');
                        setNewCatDesc('');
                      }}
                      className="px-2.5 py-0.5 rounded text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                    >
                      取消编辑
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold block">
                      分类名称 <span className="text-rose-400">*</span>:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="例如: 维度支配 / 神经骇入"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-zinc-100 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold block">
                      分类图标 (Emoji):
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newCatIcon}
                        onChange={(e) => setNewCatIcon(e.target.value)}
                        className="w-14 bg-zinc-950 border border-zinc-700 text-center rounded-lg px-2 py-2 text-lg text-zinc-100 outline-none"
                      />
                      <div className="flex-1 overflow-x-auto flex items-center gap-1 p-1 bg-zinc-950 rounded-lg border border-zinc-800 no-scrollbar">
                        {EMOJI_PICKER_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setNewCatIcon(emoji)}
                            className="p-1 hover:bg-zinc-800 rounded text-sm cursor-pointer transition-all shrink-0"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold block">分类 ID (可选):</label>
                    <input
                      type="text"
                      placeholder="英文标识如: dimension_hack"
                      value={newCatId}
                      disabled={!!editingCatId}
                      onChange={(e) => setNewCatId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-zinc-100 disabled:opacity-60 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-300 font-bold block">分类说明与战术定位:</label>
                  <input
                    type="text"
                    placeholder="简要概括该分类手段的战术特征与适用场景..."
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all shadow-[0_0_12px_rgba(6,182,212,0.4)] cursor-pointer flex items-center space-x-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingCatId ? '保存分类修改' : '确认创建分类'}</span>
                  </button>
                </div>
              </form>

              {/* Categories List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-400 flex items-center justify-between">
                  <span>当前全部战术手段分类 ({allCategories.length}):</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {allCategories.map((cat) => {
                    const count = weapons.filter((w) => w.category === cat.id).length;
                    const isCustom = cat.isCustom || !DEFAULT_SKILL_CATEGORIES.some((dc) => dc.id === cat.id);

                    return (
                      <div
                        key={cat.id}
                        className={`p-3 rounded-xl border flex items-center justify-between space-x-2 transition-all ${
                          isCustom
                            ? 'bg-cyan-950/20 border-cyan-800/60 hover:border-cyan-500/80 shadow-sm'
                            : 'bg-zinc-900/60 border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span className="text-2xl p-1 bg-black/40 rounded-lg border border-zinc-800 shrink-0">
                            {cat.icon || '✨'}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-zinc-100 truncate">{cat.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono shrink-0">
                                {count} 项
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 truncate">{cat.description || cat.id}</p>
                          </div>
                        </div>

                        {/* Actions for Custom Categories */}
                        <div className="flex items-center space-x-1 shrink-0">
                          {isCustom && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCatId(cat.id);
                                  setNewCatId(cat.id);
                                  setNewCatName(cat.name);
                                  setNewCatIcon(cat.icon);
                                  setNewCatDesc(cat.description || '');
                                }}
                                className="p-1 rounded text-zinc-400 hover:text-cyan-300 hover:bg-zinc-800 cursor-pointer"
                                title="编辑分类"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {onDeleteCustomCategory && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`确定要删除自定义分类【${cat.name}】吗？`)) {
                                      ultraAudio.playUiClick();
                                      onDeleteCustomCategory(cat.id);
                                    }
                                  }}
                                  className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer"
                                  title="删除分类"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ======================= TAB 4: WEAPON TYPES ======================= */}
          {activeTab === 'types' && (
            <div className="space-y-4">
              {/* Type Form */}
              <form onSubmit={handleSaveWeaponType} className="bg-zinc-900/80 p-4 rounded-xl border border-rose-500/50 space-y-3.5 shadow-lg">
                <div className="flex items-center space-x-2 border-b border-zinc-800 pb-2 text-rose-300 font-bold text-sm">
                  <Zap className="w-4 h-4 text-rose-400" />
                  <span>➕ 新增伤害属性类型 (Custom Damage Type)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold block">属性名称:</label>
                    <input
                      type="text"
                      required
                      placeholder="例如: 维度坍缩 (Collapse)"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-rose-500 rounded-lg px-3 py-2 text-zinc-100 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold block">属性图标 (Emoji):</label>
                    <input
                      type="text"
                      placeholder="如: 🌀"
                      value={newTypeIcon}
                      onChange={(e) => setNewTypeIcon(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-rose-500 rounded-lg px-3 py-2 text-zinc-100 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-300 font-bold block">属性 ID (英文字母):</label>
                    <input
                      type="text"
                      placeholder="如: collapse"
                      value={newTypeId}
                      onChange={(e) => setNewTypeId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 focus:border-rose-500 rounded-lg px-3 py-2 text-zinc-100 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-[0_0_12px_rgba(244,63,94,0.4)] cursor-pointer flex items-center space-x-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>添加属性类型</span>
                  </button>
                </div>
              </form>

              {/* Types Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {allWeaponTypes.map((t) => {
                  const isCustom = !DEFAULT_WEAPON_TYPES.some((dt) => dt.id === t.id);
                  return (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span className="text-base">{t.icon || '⚡'}</span>
                        <span className="font-bold text-zinc-200 truncate">{t.name}</span>
                      </div>
                      {isCustom && onDeleteCustomWeaponType && (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomWeaponType(t.id)}
                          className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================= TAB 5: BACKUP & IMPORT/EXPORT ======================= */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Export Card */}
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-emerald-500/40 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-emerald-300 font-bold text-sm">
                      <Download className="w-5 h-5 text-emerald-400" />
                      <span>导出全部手段与分类配置 (.json)</span>
                    </div>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      将当前拥有的全部 {weapons.length} 个攻击手段、自定义分类及伤害属性导出为独立备份文件，以便在其他设备中导入或分享。
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={handleExportFullArsenal}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center space-x-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>下载 .json 备份</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyArsenalJson}
                      className="py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center space-x-1 transition-all cursor-pointer"
                    >
                      {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{isCopied ? '已复制' : '复制 JSON'}</span>
                    </button>
                  </div>
                </div>

                {/* File Upload Helper */}
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-purple-500/40 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-purple-300 font-bold text-sm">
                      <Upload className="w-5 h-5 text-purple-400" />
                      <span>从本地 JSON 文件读取导入</span>
                    </div>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      选择本地的攻击手段或武器备份 .json 文件，将自动解析并在下方填入配置文本。
                    </p>
                  </div>

                  <div>
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            setImportJsonText(evt.target?.result as string);
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="w-full text-xs text-zinc-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-950 file:text-purple-300 hover:file:bg-purple-900 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Paste JSON Area */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 block">
                  直接粘贴 JSON 数据以导入:
                </label>
                <textarea
                  rows={6}
                  value={importJsonText}
                  onChange={(e) => {
                    setImportJsonText(e.target.value);
                    setImportError(null);
                    setImportSuccess(null);
                  }}
                  placeholder='在此粘贴形如 [{"name": "...", "damage": 20, "type": "beam"}] 或全量备份 JSON...'
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 rounded-xl p-3 text-xs text-zinc-200 font-mono outline-none resize-y"
                />
              </div>

              {importError && (
                <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/60 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-xs text-emerald-300 flex items-center gap-2 font-bold">
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{importSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleConfirmImport('merge')}
                  disabled={!importJsonText.trim()}
                  className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>合并导入手段库</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
