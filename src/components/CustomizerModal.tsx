import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CustomSettings, Ultrawoman, BodyPartId, BodyPartConfig, PersonalityPreset, UltrawomanVoiceLines, CustomVoiceTrigger, TriggerConditionType, EnvironmentWeakness, EnvironmentTheme, CustomPersonalitySlot, CharacterRelationship, Faction, SubFaction, HeroFactionMembership } from '../types';
import { Settings, X, Sliders, Plus, Trash2, ShieldCheck, Flame, User, Palette, Crosshair, AlertTriangle, Sparkles, MessageSquare, Heart, ShieldAlert, Cpu, Zap, Volume2, Target, TestTube, Film, Link as LinkIcon, Upload, Type, MoveVertical, Save, Edit3, Bookmark, FilePlus, CheckCircle2, FolderPlus, Users, Download, RefreshCw, Shield, Search, Filter, Layers, Crown, Star, Check, ChevronDown, ChevronUp, Building2, HelpCircle, Copy, FileText, Globe } from 'lucide-react';
import { ultraAudio } from '../utils/audio';
import { HEROINES } from '../data/heroines';
import { DEFAULT_FACTIONS, getHeroFactionMemberships, getSubFactionById, isHeroInFaction, normalizeHeroFactionMemberships, addOrUpdateHeroFactionMembership, removeHeroFromFaction, moveHeroFactionPriority, setHeroFactionAsPrimary, addOrUpdateSubFaction, SUB_FACTION_TYPE_CONFIGS, FACTION_MEMBERSHIP_TITLE_PRESETS, MEMBERSHIP_TYPE_CONFIGS, getHeroOriginCountry, isHeroForeignSubordinateInFaction } from '../data/factions';
import { PERSONALITY_DEFINITIONS, getVoiceLinesForPersonality, applyPersonalityToHero, PersonalityDefinition, loadPresetPersonalitiesFromStorage, savePresetPersonalitiesToStorage, loadCustomPersonalitySlotsFromStorage, saveCustomPersonalitySlotsToStorage, DEFAULT_CUSTOM_PERSONALITY_SLOTS, getAllAvailablePersonalities } from '../data/personalities';
import { resizeImageFile } from '../utils/imageUtils';
import { readMediaFile } from '../utils/mediaUtils';
import { queueServerSave } from '../services/storageSync';
import { downloadCharacterCardFile } from '../utils/cardUtils';
import { PortraitMediaDisplay } from './PortraitMediaDisplay';
import { AppearanceEditor } from './AppearanceEditor';
import { FactionManagerTab } from './FactionManagerTab';
import { WebSearchConfigEditor } from './WebSearchConfigEditor';
import { DebouncedInput, DebouncedPromptTextarea } from './DebouncedPromptTextarea';

interface CustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customSettings: CustomSettings;
  onChangeSettings: (newSettings: CustomSettings) => void;
  heroines: Ultrawoman[];
  factions?: Faction[];
  onUpdateFactions?: (factions: Faction[]) => void;
  selectedHero: Ultrawoman;
  onSelectHero: (hero: Ultrawoman) => void;
  onUpdateHero: (updatedHero: Ultrawoman) => void;
  onUpdateAllHeroes?: (updatedHeroines: Ultrawoman[]) => void;
  onAddHero: () => void;
  onDeleteHero: (heroId: string) => void;
  onRestoreDefaultHeroines?: () => void;
  partDamage: Record<BodyPartId, number>;
  onUpdatePartDamage: (partId: BodyPartId, value: number) => void;
}

const BODY_PART_LABELS: Record<BodyPartId, string> = {
  head: '头部 / 冰斧 / 王冠',
  timer: '魔能值 / 能量中枢',
  chest: '胸甲 / 锁骨光脉',
  leftArm: '左臂 / 光线手套',
  rightArm: '右臂 / 光线组合端',
  torso: '腰腹 / 柔弱枢纽',
  legs: '双腿 / 高跟战靴',
};

const VOICE_LINE_CATEGORIES: { id: keyof UltrawomanVoiceLines; label: string; icon: string }[] = [
  { id: 'greeting', label: '开场/登场台词', icon: '✨' },
  { id: 'hitSmall', label: '轻微受击反应', icon: '⚡' },
  { id: 'hitHeavy', label: '重创惨叫/受击', icon: '💥' },
  { id: 'hitWeakPoint', label: '弱点中枢击中', icon: '★' },
  { id: 'hitSensitivePoint', label: '敏感区刺激/发情', icon: '♥' },
  { id: 'timerLow', label: '能量低', icon: '🚨' },
  { id: 'touchReaction', label: '触手/工具爱抚反应', icon: '🐙' },
  { id: 'hypnosisReaction', label: '脑波催眠/真言暗示', icon: '🌀' },
  { id: 'envDamageReaction', label: '罐内酸液/电场痛击', icon: '🧪' },
  { id: 'defiant', label: '誓死顽抗台词', icon: '⚔️' },
  { id: 'wavering', label: '意志动摇台词', icon: '💔' },
  { id: 'broken', label: '彻底屈服/归顺台词', icon: '⛓️' },
];

interface VoiceLineItemProps {
  initialValue: string;
  index: number;
  onCommit: (val: string) => void;
  onDelete: () => void;
}

const VoiceLineItem: React.FC<VoiceLineItemProps> = React.memo(({
  initialValue,
  index,
  onCommit,
  onDelete,
}) => {
  const [text, setText] = useState(initialValue);
  const isTypingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isTypingRef.current) {
      setText(initialValue);
    }
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    isTypingRef.current = true;
    setText(nextVal);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onCommit(nextVal);
    }, 150);
  };

  const handleBlur = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isTypingRef.current = false;
    onCommit(text);
  };

  return (
    <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded border border-zinc-800 hover:border-purple-500/40 transition-colors">
      <span className="text-[10px] text-zinc-500 font-mono w-5 text-right shrink-0">{index + 1}.</span>
      <input
        type="text"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 focus:border-purple-500 outline-none"
      />
      <button
        type="button"
        onClick={onDelete}
        className="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
        title="删除此条台词"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});

// Preset character-to-character relationship templates (stored in localStorage with fallback)
const DEFAULT_PRESET_RELATIONSHIPS: any[] = [];

const STAT_PRESETS: any[] = [];

const WEAKNESS_PRESETS: any[] = [];

export const CustomizerModal: React.FC<CustomizerModalProps> = ({
  isOpen,
  onClose,
  customSettings,
  onChangeSettings,
  heroines,
  factions = DEFAULT_FACTIONS,
  onUpdateFactions,
  selectedHero: propSelectedHero,
  onSelectHero,
  onUpdateHero,
  onUpdateAllHeroes,
  onAddHero,
  onDeleteHero,
  onRestoreDefaultHeroines,
  partDamage,
  onUpdatePartDamage,
}) => {
  // Local active editing hero state to prevent typing lag and decouple modal typing from global App re-renders
  const [selectedHero, setSelectedHero] = useState<Ultrawoman>(propSelectedHero);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync selectedHero whenever propSelectedHero changes or modal opens
  useEffect(() => {
    setSelectedHero(propSelectedHero);
  }, [propSelectedHero.id, propSelectedHero.webSearchEnabled, propSelectedHero.searchEngine, propSelectedHero.searchKeywords, propSelectedHero.searchMaxResults, isOpen]);

  // Synchronize draft hero updates with parent onUpdateHero (debounced for typing/sliders, immediate for action clicks)
  const commitHero = useCallback(
    (hero: Ultrawoman, immediate: boolean = false) => {
      setSelectedHero(hero);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (immediate) {
        onUpdateHero(hero);
      } else {
        debounceTimerRef.current = setTimeout(() => {
          onUpdateHero(hero);
        }, 150);
      }
    },
    [onUpdateHero]
  );

  const handleModalClose = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      onUpdateHero(selectedHero);
    }
    onClose();
  }, [selectedHero, onUpdateHero, onClose]);

  const [activeTab, setActiveTab] = useState<'system' | 'heroine' | 'factions' | 'envWeakness' | 'personality' | 'heroRelationships'>('heroine');
  const [editingPartId, setEditingPartId] = useState<string>('timer');
  const [selectedVoiceCategory, setSelectedVoiceCategory] = useState<keyof UltrawomanVoiceLines>('hitSmall');
  const [newLineText, setNewLineText] = useState<string>('');
  const [newTriggerInputs, setNewTriggerInputs] = useState<Record<string, string>>({});
  const [newEnvWeaknessInputs, setNewEnvWeaknessInputs] = useState<Record<string, string>>({});
  const [heroActionToast, setHeroActionToast] = useState<string | null>(null);

  // Quick Action Handlers for Hero Customization
  const handleCloneHero = () => {
    ultraAudio.playUiClick();
    const newId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cloned: Ultrawoman = {
      ...JSON.parse(JSON.stringify(selectedHero)),
      id: newId,
      name: `${selectedHero.name} (副本)`,
      customPortrait: selectedHero.customPortrait,
    };
    const updatedHeroines = [...heroines, cloned];
    if (onUpdateAllHeroes) {
      onUpdateAllHeroes(updatedHeroines);
    }
    onSelectHero(cloned);
    setHeroActionToast(`已成功克隆角色「${cloned.name}」新槽位！`);
    setTimeout(() => setHeroActionToast(null), 3000);
  };

  const handleCopyHeroJson = () => {
    ultraAudio.playUiClick();
    const jsonStr = JSON.stringify(selectedHero, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setHeroActionToast(`已成功复制「${selectedHero.name}」配置 JSON 到剪贴板！`);
      setTimeout(() => setHeroActionToast(null), 3000);
    }).catch(() => {
      setHeroActionToast('复制失败，请检查浏览器权限');
      setTimeout(() => setHeroActionToast(null), 3000);
    });
  };

  const handleExportHeroCard = () => {
    ultraAudio.playUiClick();
    downloadCharacterCardFile(selectedHero, {
      format: 'ultra_v3',
      includePortrait: true,
      allFactions: factions,
    });
    setHeroActionToast(`已开始导出「${selectedHero.name}」角色卡 (.json)！`);
    setTimeout(() => setHeroActionToast(null), 3000);
  };

  // Character-to-Character custom relationship state
  const [relTargetHeroId, setRelTargetHeroId] = useState<string>('');
  const [relTypeInput, setRelTypeInput] = useState<string>('');
  const [relDescInput, setRelDescInput] = useState<string>('');
  const [relToneInput, setRelToneInput] = useState<string>('');
  const [relBiSync, setRelBiSync] = useState<boolean>(true);
  const [editingRelTargetId, setEditingRelTargetId] = useState<string | null>(null);

  const [customRelPresets, setCustomRelPresets] = useState<{ id: string; title: string; type: string; desc: string; tone: string }[]>(() => {
    try {
      const saved = localStorage.getItem('ultra_custom_hero_relationship_presets_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_e) {}
    return DEFAULT_PRESET_RELATIONSHIPS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('ultra_custom_hero_relationship_presets_v1', JSON.stringify(customRelPresets));
      queueServerSave({ ultra_custom_hero_relationship_presets_v1: customRelPresets });
    } catch (_e) {}
  }, [customRelPresets]);

  // Target hero slot filter & categorization state
  const [heroSlotFactionFilter, setHeroSlotFactionFilter] = useState<string>('all');
  const [heroSlotSubFactionFilter, setHeroSlotSubFactionFilter] = useState<string>('all');
  const [heroSlotTypeFilter, setHeroSlotTypeFilter] = useState<'all' | 'preset' | 'custom'>('all');
  const [heroSlotSearch, setHeroSlotSearch] = useState<string>('');

  const isHeroUnassigned = (hero: Ultrawoman, factionList: Faction[]) => {
    if (!hero.factionId || hero.factionId.trim() === '' || hero.factionId === 'unassigned') return true;
    return !factionList.some((f) => f.id === hero.factionId);
  };

  const filteredSlotHeroes = useMemo(() => {
    return heroines.filter((h) => {
      // 1. Faction Filter
      if (heroSlotFactionFilter !== 'all') {
        if (heroSlotFactionFilter === 'unassigned') {
          if (!isHeroUnassigned(h, factions)) return false;
        } else {
          if (!isHeroInFaction(h, heroSlotFactionFilter, factions)) return false;
        }
      }

      // 2. Sub-Faction Filter
      if (heroSlotSubFactionFilter !== 'all') {
        const mems = getHeroFactionMemberships(h, factions);
        if (!mems.some((m) => m.subFactionId === heroSlotSubFactionFilter)) return false;
      }

      // 3. Type Filter (Preset vs Custom/Imported)
      if (heroSlotTypeFilter === 'preset' && h.id.startsWith('custom_')) return false;
      if (heroSlotTypeFilter === 'custom' && !h.id.startsWith('custom_')) return false;

      // 4. Search Query
      if (heroSlotSearch.trim()) {
        const q = heroSlotSearch.toLowerCase();
        const matchName = h.name.toLowerCase().includes(q);
        const matchTitle = h.title && h.title.toLowerCase().includes(q);
        const matchPlanet = h.homePlanet && h.homePlanet.toLowerCase().includes(q);
        const matchRace = h.race && h.race.toLowerCase().includes(q);
        if (!matchName && !matchTitle && !matchPlanet && !matchRace) return false;
      }

      return true;
    });
  }, [heroines, heroSlotFactionFilter, heroSlotSubFactionFilter, heroSlotTypeFilter, heroSlotSearch, factions]);

  // Import / Export state for Character Relationships
  const [isRelImportModalOpen, setIsRelImportModalOpen] = useState(false);
  const [relImportJsonText, setRelImportJsonText] = useState('');
  const [relImportError, setRelImportError] = useState<string | null>(null);
  const [relImportSuccess, setRelImportSuccess] = useState<string | null>(null);
  const [relCopiedNotice, setRelCopiedNotice] = useState(false);

  // New Custom Preset Modal
  const [isAddingRelPreset, setIsAddingRelPreset] = useState(false);
  const [newPresetTitle, setNewPresetTitle] = useState('');
  const [newPresetType, setNewPresetType] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [newPresetTone, setNewPresetTone] = useState('');

  const otherHeroes = heroines.filter((h) => h.id !== selectedHero.id);

  // Auto-sync relTargetHeroId when selectedHero or otherHeroes changes
  useEffect(() => {
    if (otherHeroes.length > 0) {
      if (!relTargetHeroId || !otherHeroes.some((h) => h.id === relTargetHeroId)) {
        setRelTargetHeroId(otherHeroes[0].id);
      }
    } else {
      setRelTargetHeroId('');
    }
  }, [selectedHero.id, heroines]);

  // System preset personalities state & handlers (supports deletion and restoring)
  const [presetPersonalities, setPresetPersonalities] = useState<PersonalityDefinition[]>(() => {
    return loadPresetPersonalitiesFromStorage();
  });

  useEffect(() => {
    savePresetPersonalitiesToStorage(presetPersonalities);
  }, [presetPersonalities]);

  const handleDeletePresetPersonality = (id: PersonalityPreset, name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    ultraAudio.playUiClick();
    if (window.confirm(`确定要从系统预设库中删除预设性格【${name}】吗？`)) {
      setPresetPersonalities((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleRestoreDefaultPresetPersonalities = () => {
    ultraAudio.playUiClick();
    if (window.confirm('确定要恢复所有系统默认预设性格吗？（已删除的预设性格将被重新恢复）')) {
      setPresetPersonalities(Object.values(PERSONALITY_DEFINITIONS));
    }
  };

  // Custom personality slots state & handlers
  const [customPersonalitySlots, setCustomPersonalitySlots] = useState<CustomPersonalitySlot[]>(() => {
    try {
      const saved = localStorage.getItem('ultra_custom_personality_slots_v1');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load custom personality slots:', e);
    }
    return DEFAULT_CUSTOM_PERSONALITY_SLOTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('ultra_custom_personality_slots_v1', JSON.stringify(customPersonalitySlots));
      queueServerSave({ ultra_custom_personality_slots_v1: customPersonalitySlots });
    } catch (e) {
      console.warn('Failed to save custom personality slots:', e);
    }
  }, [customPersonalitySlots]);

  const [isSlotFormOpen, setIsSlotFormOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotNameInput, setSlotNameInput] = useState('');
  const [slotIconInput, setSlotIconInput] = useState('✨');
  const [slotDescInput, setSlotDescInput] = useState('');
  const [slotToneInput, setSlotToneInput] = useState('');
  const [slotPromptInput, setSlotPromptInput] = useState('');
  const [slotTagsInput, setSlotTagsInput] = useState('');

  const handleApplyCustomSlot = (slot: CustomPersonalitySlot) => {
    ultraAudio.playUiClick();
    commitHero({
      ...selectedHero,
      personality: slot.id,
      personalityCustomName: slot.name,
      personalityTone: slot.tone || '',
      personalityCustomPrompt: slot.prompt || '',
      personalityCustomTags: slot.tags ? [...slot.tags] : [],
    }, true);
  };

  const handleSaveCurrentAsSlot = () => {
    ultraAudio.playUiClick();
    const title = selectedHero.personalityCustomName || `${selectedHero.name}专属性格`;
    const tags = selectedHero.personalityCustomTags && selectedHero.personalityCustomTags.length > 0
      ? [...selectedHero.personalityCustomTags]
      : ['自定义性格', '专属Prompt'];

    const newSlot: CustomPersonalitySlot = {
      id: `custom_slot_${Date.now()}`,
      name: title,
      icon: '✨',
      description: `基于角色【${selectedHero.name}】当前自定义设定的性格槽位`,
      tags,
      tone: selectedHero.personalityTone || '',
      prompt: selectedHero.personalityCustomPrompt || '',
      createdAt: Date.now(),
    };

    setCustomPersonalitySlots((prev) => [newSlot, ...prev]);
    handleApplyCustomSlot(newSlot);
  };

  const handleOpenNewSlotForm = () => {
    ultraAudio.playUiClick();
    setEditingSlotId(null);
    setSlotNameInput('');
    setSlotIconInput('👑');
    setSlotDescInput('');
    setSlotToneInput(selectedHero.personalityTone || '');
    setSlotPromptInput(selectedHero.personalityCustomPrompt || '');
    setSlotTagsInput(selectedHero.personalityCustomTags?.join('，') || '');
    setIsSlotFormOpen(true);
  };

  const handleOpenEditSlotForm = (slot: CustomPersonalitySlot) => {
    ultraAudio.playUiClick();
    setEditingSlotId(slot.id);
    setSlotNameInput(slot.name);
    setSlotIconInput(slot.icon || '✨');
    setSlotDescInput(slot.description || '');
    setSlotToneInput(slot.tone || '');
    setSlotPromptInput(slot.prompt || '');
    setSlotTagsInput(slot.tags?.join('，') || '');
    setIsSlotFormOpen(true);
  };

  const handleSaveSlotForm = () => {
    if (!slotNameInput.trim()) return;
    ultraAudio.playUiClick();

    const tagsArr = slotTagsInput
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingSlotId) {
      setCustomPersonalitySlots((prev) =>
        prev.map((s) => {
          if (s.id === editingSlotId) {
            const updated = {
              ...s,
              name: slotNameInput.trim(),
              icon: slotIconInput || '✨',
              description: slotDescInput.trim(),
              tone: slotToneInput.trim(),
              prompt: slotPromptInput.trim(),
              tags: tagsArr,
            };
            if (selectedHero.personality === s.id) {
              handleApplyCustomSlot(updated);
            }
            return updated;
          }
          return s;
        })
      );
    } else {
      const newSlot: CustomPersonalitySlot = {
        id: `custom_slot_${Date.now()}`,
        name: slotNameInput.trim(),
        icon: slotIconInput || '✨',
        description: slotDescInput.trim() || '自定义性格槽位预设',
        tags: tagsArr,
        tone: slotToneInput.trim(),
        prompt: slotPromptInput.trim(),
        createdAt: Date.now(),
      };
      setCustomPersonalitySlots((prev) => [newSlot, ...prev]);
      handleApplyCustomSlot(newSlot);
    }

    setIsSlotFormOpen(false);
  };

  const handleDeleteCustomSlot = (slotId: string, slotName: string) => {
    ultraAudio.playUiClick();
    if (window.confirm(`确定要删除自定义性格槽位【${slotName}】吗？`)) {
      setCustomPersonalitySlots((prev) => prev.filter((s) => s.id !== slotId));
    }
  };

  const handleExportPersonalitySlots = () => {
    ultraAudio.playUiClick();
    const dataStr = JSON.stringify(customPersonalitySlots, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ultrawoman_personality_library_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPersonalitySlots = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    ultraAudio.playUiClick();
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomPersonalitySlots(parsed);
          alert(`成功导入 ${parsed.length} 个性格预设槽位！`);
        } else {
          alert('导入失败：格式不匹配，须为性格槽位 JSON 数组。');
        }
      } catch (err) {
        alert('解析 JSON 发生错误！');
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreDefaultPersonalitySlots = () => {
    if (window.confirm('确定恢复默认内置性格预设库槽位吗？这将会用默认槽位恢复当前的性格预设列表。')) {
      ultraAudio.playUiClick();
      setCustomPersonalitySlots(DEFAULT_CUSTOM_PERSONALITY_SLOTS);
    }
  };

  // Sub-faction inline custom creation & Multi-membership state
  const [isCreatingInlineSubFaction, setIsCreatingInlineSubFaction] = useState(false);
  const [inlineSubFactionName, setInlineSubFactionName] = useState('');
  const [inlineSubFactionCode, setInlineSubFactionCode] = useState('');
  const [inlineSubFactionLeader, setInlineSubFactionLeader] = useState('');
  const [inlineSubFactionType, setInlineSubFactionType] = useState<NonNullable<SubFaction['type']>>('military');
  const [inlineSubFactionDesc, setInlineSubFactionDesc] = useState('');

  // Secondary multi-faction membership addition
  const [isAddingSecondaryMembership, setIsAddingSecondaryMembership] = useState(false);
  const [secondaryFactionId, setSecondaryFactionId] = useState<string>('');
  const [secondarySubFactionId, setSecondarySubFactionId] = useState<string>('none');
  const [secondaryRole, setSecondaryRole] = useState<string>('特勤干员');
  const [secondaryTitle, setSecondaryTitle] = useState<string>('他国从属干员');
  const [secondaryNotes, setSecondaryNotes] = useState<string>('');
  const [secondaryMembershipType, setSecondaryMembershipType] = useState<string>('foreign_subordinate');
  const [secondaryOriginCountry, setSecondaryOriginCountry] = useState<string>('');
  const [secondaryAffiliationNature, setSecondaryAffiliationNature] = useState<string>('跨国派驻从属');
  const [secondarySubFactionOnly, setSecondarySubFactionOnly] = useState<boolean>(false);

  const handleCreateInlineSubFactionForCurrentHero = (targetFactionId: string) => {
    if (!inlineSubFactionName.trim()) {
      alert('请输入从属编制名称！');
      return;
    }
    ultraAudio.playUiClick();
    const newSub: SubFaction = {
      id: `sub_${Date.now()}`,
      name: inlineSubFactionName.trim(),
      code: inlineSubFactionCode.trim() || undefined,
      leader: inlineSubFactionLeader.trim() || selectedHero.name,
      type: inlineSubFactionType,
      description: inlineSubFactionDesc.trim() || undefined,
    };

    const updatedFactions = addOrUpdateSubFaction(targetFactionId, newSub, factions);
    if (onUpdateFactions) {
      onUpdateFactions(updatedFactions);
    }

    // Assign current heroine to this newly created sub-faction
    const updatedHero = addOrUpdateHeroFactionMembership(
      selectedHero,
      {
        factionId: targetFactionId,
        subFactionId: newSub.id,
        subFactionName: newSub.name,
        role: selectedHero.factionRole || '特勤指挥官',
        title: '核心主属',
        membershipType: 'core',
        originCountry: selectedHero.nativeCountry || selectedHero.homePlanet,
      },
      undefined,
      1,
      '核心主属',
      undefined,
      updatedFactions,
      newSub.id,
      newSub.name,
      'core',
      selectedHero.nativeCountry || selectedHero.homePlanet
    );

    commitHero(updatedHero, true);

    // Reset and close form
    setIsCreatingInlineSubFaction(false);
    setInlineSubFactionName('');
    setInlineSubFactionCode('');
    setInlineSubFactionLeader('');
    setInlineSubFactionDesc('');
  };

  const handleAddSecondaryMembership = () => {
    if (!secondaryFactionId || secondaryFactionId === 'unassigned') {
      alert('请选择要从属/兼任的势力阵营！');
      return;
    }
    ultraAudio.playUiClick();
    const targetFac = factions.find((f) => f.id === secondaryFactionId);
    const subObj = secondarySubFactionId !== 'none' ? targetFac?.subFactions?.find((s) => s.id === secondarySubFactionId) : undefined;
    const origin = secondaryOriginCountry.trim() || selectedHero.nativeCountry || (selectedHero.factionMemberships?.[0] ? factions.find((f) => f.id === selectedHero.factionMemberships?.[0]?.factionId)?.name : selectedHero.homePlanet) || '地球';
    const isSubOnly = Boolean(secondarySubFactionOnly || secondaryMembershipType === 'sub_unit_only');
    const effectiveType = secondaryMembershipType || (isSubOnly ? 'sub_unit_only' : 'foreign_subordinate');

    const updatedHero = addOrUpdateHeroFactionMembership(
      selectedHero,
      {
        factionId: secondaryFactionId,
        subFactionId: secondarySubFactionId !== 'none' ? secondarySubFactionId : undefined,
        subFactionName: subObj?.name,
        role: secondaryRole.trim() || (isSubOnly ? '编制专员' : '兼任从属特员'),
        title: secondaryTitle.trim() || (isSubOnly ? '从属编制干员' : '他国从属干员'),
        customNotes: secondaryNotes.trim() || undefined,
        membershipType: effectiveType,
        originCountry: origin,
        affiliationNature: secondaryAffiliationNature.trim() || (isSubOnly ? '独立从属编制' : undefined),
        subFactionOnly: isSubOnly,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      factions,
      secondarySubFactionId !== 'none' ? secondarySubFactionId : undefined,
      subObj?.name,
      effectiveType,
      origin,
      secondaryAffiliationNature.trim() || (isSubOnly ? '独立从属编制' : undefined),
      isSubOnly
    );

    commitHero(updatedHero, true);
    setIsAddingSecondaryMembership(false);
    setSecondaryFactionId('');
    setSecondarySubFactionId('none');
    setSecondaryRole('特勤干员');
    setSecondaryTitle('他国从属干员');
    setSecondaryNotes('');
    setSecondaryMembershipType('foreign_subordinate');
    setSecondaryOriginCountry('');
    setSecondaryAffiliationNature('跨国派驻从属');
    setSecondarySubFactionOnly(false);
  };

  const handleRemoveMembership = (facId: string) => {
    ultraAudio.playUiClick();
    const updatedHero = removeHeroFromFaction(selectedHero, facId, factions);
    commitHero(updatedHero, true);
  };

  const handlePromoteMembership = (facId: string) => {
    ultraAudio.playUiClick();
    const updatedHero = setHeroFactionAsPrimary(selectedHero, facId, factions);
    commitHero(updatedHero, true);
  };

  // Environmental weaknesses handlers
  const envWeaknesses = selectedHero.envWeaknesses || [];

  const handleAddEnvWeakness = () => {
    const newEw: EnvironmentWeakness = {
      id: `env_${Date.now()}`,
      name: `自定义环境弱点 ${envWeaknesses.length + 1}`,
      envTheme: 'acid',
      targetPartId: Object.keys(selectedHero.bodyParts)[0] || 'timer',
      weaponCategory: 'any',
      weaponType: 'any',
      damageMultiplier: 1.5,
      lines: ['在这种极端环境要素下被击中……战甲几乎融化撕裂了呀！'],
      enabled: true,
    };
    commitHero({
      ...selectedHero,
      envWeaknesses: [...envWeaknesses, newEw],
    }, true);
  };

  const handleUpdateEnvWeakness = (id: string, updatedFields: Partial<EnvironmentWeakness>) => {
    const updated = envWeaknesses.map((ew) => (ew.id === id ? { ...ew, ...updatedFields } : ew));
    commitHero({
      ...selectedHero,
      envWeaknesses: updated,
    }, false);
  };

  const handleDeleteEnvWeakness = (id: string) => {
    const updated = envWeaknesses.filter((ew) => ew.id !== id);
    commitHero({
      ...selectedHero,
      envWeaknesses: updated,
    }, true);
  };

  const handleAddLineToEnvWeakness = (id: string, text: string) => {
    if (!text.trim()) return;
    const updated = envWeaknesses.map((ew) => {
      if (ew.id === id) {
        return { ...ew, lines: [...ew.lines, text.trim()] };
      }
      return ew;
    });
    commitHero({
      ...selectedHero,
      envWeaknesses: updated,
    }, true);
    setNewEnvWeaknessInputs((prev) => ({ ...prev, [id]: '' }));
  };

  const handleDeleteLineFromEnvWeakness = (id: string, lineIndex: number) => {
    const updated = envWeaknesses.map((ew) => {
      if (ew.id === id) {
        return { ...ew, lines: ew.lines.filter((_, i) => i !== lineIndex) };
      }
      return ew;
    });
    commitHero({
      ...selectedHero,
      envWeaknesses: updated,
    }, true);
  };

  const handleRestoreDefaultEnvWeaknesses = () => {
    const defaultHero = HEROINES.find((h) => h.id === selectedHero.id);
    if (defaultHero && defaultHero.envWeaknesses) {
      commitHero({
        ...selectedHero,
        envWeaknesses: [...defaultHero.envWeaknesses],
      }, true);
    }
  };

  // Custom voice triggers handlers
  const triggers = selectedHero.customVoiceTriggers || [];

  const handleAddCustomTrigger = () => {
    const newTrig: CustomVoiceTrigger = {
      id: `trig_${Date.now()}`,
      name: `自定义触发规则 ${triggers.length + 1}`,
      conditionType: 'bodyPart',
      targetPartId: Object.keys(selectedHero.bodyParts)[0] || 'timer',
      minDamage: 20,
      statType: 'hp',
      statThreshold: 30,
      statComparison: 'lessThan',
      lines: ['哼！攻击这里……别以为这样就能让我屈服！'],
      enabled: true,
    };
    commitHero({
      ...selectedHero,
      customVoiceTriggers: [...triggers, newTrig],
    }, true);
  };

  const handleUpdateTrigger = (triggerId: string, updatedFields: Partial<CustomVoiceTrigger>) => {
    const updated = triggers.map((t) => (t.id === triggerId ? { ...t, ...updatedFields } : t));
    commitHero({
      ...selectedHero,
      customVoiceTriggers: updated,
    }, false);
  };

  const handleDeleteTrigger = (triggerId: string) => {
    const updated = triggers.filter((t) => t.id !== triggerId);
    commitHero({
      ...selectedHero,
      customVoiceTriggers: updated,
    }, true);
  };

  const handleAddLineToTrigger = (triggerId: string, text: string) => {
    if (!text.trim()) return;
    const updated = triggers.map((t) => {
      if (t.id === triggerId) {
        return { ...t, lines: [...t.lines, text.trim()] };
      }
      return t;
    });
    commitHero({
      ...selectedHero,
      customVoiceTriggers: updated,
    }, true);
  };

  const handleUpdateTriggerLine = (triggerId: string, index: number, newText: string) => {
    const updated = triggers.map((t) => {
      if (t.id === triggerId) {
        const lines = [...t.lines];
        lines[index] = newText;
        return { ...t, lines };
      }
      return t;
    });
    commitHero({
      ...selectedHero,
      customVoiceTriggers: updated,
    }, false);
  };

  const handleDeleteLineFromTrigger = (triggerId: string, index: number) => {
    const updated = triggers.map((t) => {
      if (t.id === triggerId) {
        return { ...t, lines: t.lines.filter((_, i) => i !== index) };
      }
      return t;
    });
    commitHero({
      ...selectedHero,
      customVoiceTriggers: updated,
    }, true);
  };

  // Ensure active editing part ID exists in current hero's bodyParts
  const partKeys = Object.keys(selectedHero.bodyParts);
  const currentEditingPartId = selectedHero.bodyParts[editingPartId] ? editingPartId : partKeys[0] || 'timer';

  const handleHeroFieldChange = (field: keyof Ultrawoman, value: any) => {
    const updated = { ...selectedHero, [field]: value };
    commitHero(updated, false);
  };

  const handleColorChange = (colorKey: keyof Ultrawoman['colorTheme'], value: string) => {
    const updated = {
      ...selectedHero,
      colorTheme: {
        ...selectedHero.colorTheme,
        [colorKey]: value,
      },
    };
    commitHero(updated, false);
  };

  const handleBodyPartChange = (partId: string, field: keyof BodyPartConfig, value: any) => {
    const currentPart = selectedHero.bodyParts[partId] || {
      id: partId,
      name: BODY_PART_LABELS[partId] || partId,
      maxHealth: 100,
      currentHealth: 100,
      exposure: 0,
      weaknessMultiplier: 1.0,
      description: '',
    };

    const updated = {
      ...selectedHero,
      bodyParts: {
        ...selectedHero.bodyParts,
        [partId]: {
          ...currentPart,
          [field]: value,
        },
      },
    };
    commitHero(updated, false);
  };

  const handleAddBodyPart = () => {
    const customCount = Object.keys(selectedHero.bodyParts).filter(k => k.startsWith('part_custom_')).length + 1;
    const newPartId = `part_custom_${Date.now()}`;
    const newPartName = `自定义受击部位 ${customCount}`;
    const newPartConfig: BodyPartConfig = {
      id: newPartId,
      name: newPartName,
      maxHealth: 100,
      currentHealth: 100,
      exposure: 0,
      weaknessMultiplier: 1.5,
      description: '用户自定义新增的身体受击敏锐区域/战术神经节',
    };

    const updated = {
      ...selectedHero,
      bodyParts: {
        ...selectedHero.bodyParts,
        [newPartId]: newPartConfig,
      },
    };
    commitHero(updated, true);
    setEditingPartId(newPartId);
  };

  const handleDeleteBodyPart = (partIdToDelete: string) => {
    if (partKeys.length <= 1) {
      alert('至少需要保留一个部位！');
      return;
    }

    const newBodyParts = { ...selectedHero.bodyParts };
    delete newBodyParts[partIdToDelete];

    const remainingKeys = Object.keys(newBodyParts);
    let newWeakPart = selectedHero.weakPart;
    if (selectedHero.weakPart === partIdToDelete) {
      newWeakPart = remainingKeys[0];
    }

    const updated = {
      ...selectedHero,
      weakPart: newWeakPart,
      bodyParts: newBodyParts,
    };

    commitHero(updated, true);
    if (editingPartId === partIdToDelete) {
      setEditingPartId(remainingKeys[0]);
    }
  };

  const handleSelectPresetRel = (preset: { type: string; desc: string; tone: string }) => {
    ultraAudio.playUiClick();
    setRelTypeInput(preset.type);
    setRelDescInput(preset.desc);
    setRelToneInput(preset.tone);
  };

  const handleSaveCustomRelPreset = () => {
    if (!newPresetTitle.trim() || !newPresetType.trim()) return;
    ultraAudio.playUiClick();
    const newPreset = {
      id: 'rel_preset_' + Date.now(),
      title: newPresetTitle.trim(),
      type: newPresetType.trim(),
      desc: newPresetDesc.trim(),
      tone: newPresetTone.trim(),
    };
    setCustomRelPresets((prev) => [...prev, newPreset]);
    setIsAddingRelPreset(false);
    setNewPresetTitle('');
    setNewPresetType('');
    setNewPresetDesc('');
    setNewPresetTone('');
  };

  const handleDeleteRelPreset = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    ultraAudio.playUiClick();
    setCustomRelPresets((prev) => prev.filter((p) => p.id !== presetId));
  };

  const handleSaveRelationship = () => {
    const targetId = relTargetHeroId || (otherHeroes[0] ? otherHeroes[0].id : '');
    if (!targetId || !relTypeInput.trim() || targetId === selectedHero.id) return;
    ultraAudio.playUiClick();

    const targetHero = heroines.find((h) => h.id === targetId);
    const targetName = targetHero ? targetHero.name : '未知角色';

    // 1. Prepare updated source hero relationships
    let currentRels = selectedHero.heroRelationships ? [...selectedHero.heroRelationships] : [];

    // If we were editing and the target hero changed, remove the old relation entry
    if (editingRelTargetId && editingRelTargetId !== targetId) {
      currentRels = currentRels.filter((r) => r.targetHeroId !== editingRelTargetId);
    }

    const existingIdx = currentRels.findIndex((r) => r.targetHeroId === targetId);
    const newRel: CharacterRelationship = {
      targetHeroId: targetId,
      targetHeroName: targetName,
      relationType: relTypeInput.trim(),
      description: relDescInput.trim(),
      attitudeTone: relToneInput.trim(),
    };

    if (existingIdx >= 0) {
      currentRels[existingIdx] = newRel;
    } else {
      currentRels.push(newRel);
    }

    const updatedSelectedHero: Ultrawoman = {
      ...selectedHero,
      heroRelationships: currentRels,
    };

    // 2. Prepare updated all heroines list atomically
    let newHeroinesList = heroines.map((h) => (h.id === selectedHero.id ? updatedSelectedHero : h));

    // 3. Bi-directional sync
    if (relBiSync && targetHero) {
      const targetRels = targetHero.heroRelationships ? [...targetHero.heroRelationships] : [];
      const reverseIdx = targetRels.findIndex((r) => r.targetHeroId === selectedHero.id);
      const reverseRel: CharacterRelationship = {
        targetHeroId: selectedHero.id,
        targetHeroName: selectedHero.name,
        relationType: relTypeInput.trim(),
        description: relDescInput.trim() ? `与【${selectedHero.name}】: ${relDescInput.trim()}` : '',
        attitudeTone: relToneInput.trim(),
      };

      if (reverseIdx >= 0) {
        targetRels[reverseIdx] = reverseRel;
      } else {
        targetRels.push(reverseRel);
      }

      const updatedTargetHero: Ultrawoman = {
        ...targetHero,
        heroRelationships: targetRels,
      };

      newHeroinesList = newHeroinesList.map((h) => (h.id === targetHero.id ? updatedTargetHero : h));
    }

    // Clean up old reverse relation if editing changed the target
    if (editingRelTargetId && editingRelTargetId !== targetId && relBiSync) {
      const oldTarget = heroines.find((h) => h.id === editingRelTargetId);
      if (oldTarget && oldTarget.heroRelationships) {
        const cleanedOldTargetRels = oldTarget.heroRelationships.filter((r) => r.targetHeroId !== selectedHero.id);
        newHeroinesList = newHeroinesList.map((h) => (h.id === oldTarget.id ? { ...oldTarget, heroRelationships: cleanedOldTargetRels } : h));
      }
    }

    // Commit atomic state update
    if (onUpdateAllHeroes) {
      onUpdateAllHeroes(newHeroinesList);
    } else {
      onUpdateHero(updatedSelectedHero);
    }

    setEditingRelTargetId(null);
    setRelTypeInput('');
    setRelDescInput('');
    setRelToneInput('');
  };

  const handleEditRelationship = (rel: CharacterRelationship) => {
    ultraAudio.playUiClick();
    setRelTargetHeroId(rel.targetHeroId);
    setRelTypeInput(rel.relationType);
    setRelDescInput(rel.description || '');
    setRelToneInput(rel.attitudeTone || '');
    setEditingRelTargetId(rel.targetHeroId);
  };

  const handleDeleteRelationship = (targetHeroIdToDelete: string, syncDeleteReverse = true) => {
    ultraAudio.playUiClick();
    const currentRels = selectedHero.heroRelationships ? [...selectedHero.heroRelationships] : [];
    const updatedRels = currentRels.filter((r) => r.targetHeroId !== targetHeroIdToDelete);
    const updatedSelectedHero: Ultrawoman = {
      ...selectedHero,
      heroRelationships: updatedRels,
    };

    let newHeroinesList = heroines.map((h) => (h.id === selectedHero.id ? updatedSelectedHero : h));

    if (syncDeleteReverse) {
      const targetH = heroines.find((h) => h.id === targetHeroIdToDelete);
      if (targetH && targetH.heroRelationships) {
        const cleanedTargetRels = targetH.heroRelationships.filter((r) => r.targetHeroId !== selectedHero.id);
        const updatedTargetHero: Ultrawoman = {
          ...targetH,
          heroRelationships: cleanedTargetRels,
        };
        newHeroinesList = newHeroinesList.map((h) => (h.id === targetH.id ? updatedTargetHero : h));
      }
    }

    if (onUpdateAllHeroes) {
      onUpdateAllHeroes(newHeroinesList);
    } else {
      onUpdateHero(updatedSelectedHero);
    }

    if (editingRelTargetId === targetHeroIdToDelete) {
      setEditingRelTargetId(null);
      setRelTypeInput('');
      setRelDescInput('');
      setRelToneInput('');
    }
  };

  // Export character relationships to JSON
  const handleExportHeroRelationships = () => {
    ultraAudio.playUiClick();
    const pkg = {
      version: '1.0',
      type: 'hero_relationships_package',
      exportedAt: new Date().toISOString(),
      heroId: selectedHero.id,
      heroName: selectedHero.name,
      count: selectedHero.heroRelationships?.length || 0,
      relationships: selectedHero.heroRelationships || [],
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `character_relationships_${selectedHero.name}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyHeroRelationshipsJson = () => {
    ultraAudio.playUiClick();
    const pkg = {
      version: '1.0',
      type: 'hero_relationships_package',
      exportedAt: new Date().toISOString(),
      heroId: selectedHero.id,
      heroName: selectedHero.name,
      count: selectedHero.heroRelationships?.length || 0,
      relationships: selectedHero.heroRelationships || [],
    };
    navigator.clipboard.writeText(JSON.stringify(pkg, null, 2));
    setRelCopiedNotice(true);
    setTimeout(() => setRelCopiedNotice(false), 2000);
  };

  const handleImportHeroRelationships = () => {
    if (!relImportJsonText.trim()) return;
    ultraAudio.playUiClick();
    try {
      const parsed = JSON.parse(relImportJsonText.trim());
      let listToImport: CharacterRelationship[] = [];
      if (Array.isArray(parsed)) {
        listToImport = parsed;
      } else if (parsed && Array.isArray(parsed.relationships)) {
        listToImport = parsed.relationships;
      } else if (parsed && Array.isArray(parsed.heroRelationships)) {
        listToImport = parsed.heroRelationships;
      } else if (parsed && parsed.targetHeroId && parsed.relationType) {
        listToImport = [parsed];
      }

      if (listToImport.length === 0) {
        setRelImportError('未能识别有效的角色人际关系数据，请检查 JSON 格式！');
        return;
      }

      const sanitized: CharacterRelationship[] = listToImport
        .filter((r) => r && r.relationType)
        .map((r, idx) => {
          const fallbackTarget = otherHeroes[idx % (otherHeroes.length || 1)]?.id || 'unknown';
          return {
            targetHeroId: r.targetHeroId || fallbackTarget,
            targetHeroName: r.targetHeroName || otherHeroes.find((h) => h.id === r.targetHeroId)?.name || '角色',
            relationType: String(r.relationType).trim(),
            description: r.description ? String(r.description).trim() : '',
            attitudeTone: r.attitudeTone ? String(r.attitudeTone).trim() : '',
          };
        });

      const current = selectedHero.heroRelationships ? [...selectedHero.heroRelationships] : [];
      const relMap = new Map<string, CharacterRelationship>();
      current.forEach((r) => relMap.set(r.targetHeroId, r));
      sanitized.forEach((r) => relMap.set(r.targetHeroId, r));

      const updatedSelectedHero: Ultrawoman = {
        ...selectedHero,
        heroRelationships: Array.from(relMap.values()),
      };

      const newHeroinesList = heroines.map((h) => (h.id === selectedHero.id ? updatedSelectedHero : h));
      if (onUpdateAllHeroes) {
        onUpdateAllHeroes(newHeroinesList);
      } else {
        onUpdateHero(updatedSelectedHero);
      }

      setRelImportSuccess(`成功导入 ${sanitized.length} 条角色关系纽带！`);
      setTimeout(() => {
        setIsRelImportModalOpen(false);
        setRelImportJsonText('');
        setRelImportError(null);
        setRelImportSuccess(null);
      }, 1000);
    } catch (e: any) {
      setRelImportError(`JSON 解析失败: ${e.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 font-mono">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-4xl text-zinc-100 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3 bg-zinc-950/60">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold tracking-wider text-blue-400 uppercase text-glow-blue">
              战术评估定制与参数配置中心
            </h2>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-1.5 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs overflow-x-auto">
            <button
              onClick={() => {
                ultraAudio.playUiClick();
                setActiveTab('heroine');
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all whitespace-nowrap ${
                activeTab === 'heroine'
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>弱点与打击区域</span>
            </button>

            <button
              onClick={() => {
                ultraAudio.playUiClick();
                setActiveTab('envWeakness');
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all whitespace-nowrap ${
                activeTab === 'envWeakness'
                  ? 'bg-amber-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>⚡ 环境弱点联动</span>
            </button>

            <button
              onClick={() => {
                ultraAudio.playUiClick();
                setActiveTab('personality');
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all whitespace-nowrap ${
                activeTab === 'personality'
                  ? 'bg-purple-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>🎭 性格与台词库</span>
            </button>

            <button
              onClick={() => {
                ultraAudio.playUiClick();
                setActiveTab('factions');
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all whitespace-nowrap ${
                activeTab === 'factions'
                  ? 'bg-amber-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-amber-300" />
              <span>🚩 阵营与势力关系</span>
            </button>

            <button
              onClick={() => {
                ultraAudio.playUiClick();
                setActiveTab('heroRelationships');
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all whitespace-nowrap ${
                activeTab === 'heroRelationships'
                  ? 'bg-pink-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-pink-300" />
              <span>👥 角色间关系纽带</span>
            </button>

            <button
              onClick={() => {
                ultraAudio.playUiClick();
                setActiveTab('system');
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-all whitespace-nowrap ${
                activeTab === 'system'
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>环境物理与受损微调</span>
            </button>
          </div>

          <button
            onClick={() => {
              ultraAudio.playUiClick();
              handleModalClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
          {activeTab === 'heroine' && (
            <div className="space-y-6">
              {/* Heroine Roster Selector & Slot Action Bar */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3.5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                      选择目标角色槽位
                    </span>
                    <span className="text-[11px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
                      共 {heroines.length} 位在役角色 · 当前编辑: <strong className="text-zinc-100">{selectedHero.name}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCloneHero}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-500/60 text-indigo-300 hover:bg-indigo-900 transition-all text-xs font-bold cursor-pointer"
                      title="快速克隆复制当前角色的所有属性、设定与台词，新建一个独立副本"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>克隆当前角色</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportHeroCard}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-950/80 border border-sky-500/60 text-sky-300 hover:bg-sky-900 transition-all text-xs font-bold cursor-pointer"
                      title="将当前角色导出为标准角色卡 JSON 文件"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>导出角色卡</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyHeroJson}
                      className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-all text-xs cursor-pointer"
                      title="复制当前角色的完整 JSON 配置文本"
                    >
                      <FileText className="w-3.5 h-3.5 text-zinc-400" />
                      <span>复制JSON</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        onAddHero();
                      }}
                      className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900 transition-all text-xs font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新增角色槽位</span>
                    </button>

                    {onRestoreDefaultHeroines && (
                      <button
                        type="button"
                        onClick={() => {
                          ultraAudio.playUiClick();
                          onRestoreDefaultHeroines();
                        }}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-all text-xs cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                        <span>恢复预设主角色</span>
                      </button>
                    )}

                    {heroines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          ultraAudio.playUiClick();
                          onDeleteHero(selectedHero.id);
                        }}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-800/80 text-rose-300 hover:bg-rose-900 transition-all text-xs font-bold cursor-pointer"
                        title={`删除角色槽位「${selectedHero.name}」`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>删除当前「{selectedHero.name.split(' ')[0]}」</span>
                      </button>
                    )}
                  </div>
                </div>

                {heroActionToast && (
                  <div className="bg-blue-950/90 border border-blue-500/70 text-blue-200 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between shadow-md">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      <span>{heroActionToast}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setHeroActionToast(null)}
                      className="text-blue-400 hover:text-white text-xs ml-2 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Categorization & Faction Filter Bar */}
                <div className="space-y-2.5 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800/60">
                  {/* Faction Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs">
                    <span className="text-[11px] font-bold text-zinc-500 shrink-0 flex items-center gap-1 mr-1">
                      <Shield className="w-3.5 h-3.5 text-amber-400/80" />
                      <span>阵营分类:</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        setHeroSlotFactionFilter('all');
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                        heroSlotFactionFilter === 'all'
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      全部阵营 ({heroines.length})
                    </button>

                    {factions.map((f) => {
                      const count = heroines.filter((h) => h.factionId === f.id).length;
                      const isSelected = heroSlotFactionFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            ultraAudio.playUiClick();
                            setHeroSlotFactionFilter(f.id);
                          }}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? 'bg-amber-950/80 text-amber-300 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                              : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <span>{f.shortName || f.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-950 text-zinc-400">
                            {count}
                          </span>
                        </button>
                      );
                    })}

                    {/* Unassigned Faction Chip */}
                    {(() => {
                      const unassignedCount = heroines.filter((h) => isHeroUnassigned(h, factions)).length;
                      const isSelected = heroSlotFactionFilter === 'unassigned';
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            ultraAudio.playUiClick();
                            setHeroSlotFactionFilter('unassigned');
                            setHeroSlotSubFactionFilter('all');
                          }}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? 'bg-purple-950/80 text-purple-300 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                              : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <span>未指定阵营</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-950 text-purple-400 font-bold">
                            {unassignedCount}
                          </span>
                        </button>
                      );
                    })()}
                  </div>

                  {/* Sub-Faction Branch Filter Bar */}
                  {(() => {
                    const activeFaction = factions.find((f) => f.id === heroSlotFactionFilter);
                    const availableSubFactions = activeFaction
                      ? activeFaction.subFactions || []
                      : heroSlotFactionFilter === 'all'
                      ? factions.flatMap((f) => f.subFactions || [])
                      : [];

                    if (availableSubFactions.length === 0) return null;

                    return (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs pt-1 border-t border-zinc-800/40">
                        <span className="text-[11px] font-bold text-sky-400 shrink-0 flex items-center gap-1 mr-1">
                          <Layers className="w-3 h-3 text-sky-400" />
                          <span>从属编制:</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            ultraAudio.playUiClick();
                            setHeroSlotSubFactionFilter('all');
                          }}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all shrink-0 cursor-pointer border ${
                            heroSlotSubFactionFilter === 'all'
                              ? 'bg-sky-600 text-white border-sky-400 shadow-sm'
                              : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                          }`}
                        >
                          全部编制
                        </button>

                        {availableSubFactions.map((sf) => {
                          const isSelected = heroSlotSubFactionFilter === sf.id;
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
                                setHeroSlotSubFactionFilter(sf.id);
                              }}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 border ${
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

                  {/* Secondary Filter: Preset/Custom & Quick Search Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-800/60">
                    <div className="flex items-center space-x-1 text-xs">
                      <span className="text-[11px] text-zinc-500 font-bold mr-1">类型来源:</span>
                      <button
                        type="button"
                        onClick={() => setHeroSlotTypeFilter('all')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                          heroSlotTypeFilter === 'all'
                            ? 'bg-zinc-800 text-zinc-100 border border-zinc-600'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        全部
                      </button>
                      <button
                        type="button"
                        onClick={() => setHeroSlotTypeFilter('preset')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                          heroSlotTypeFilter === 'preset'
                            ? 'bg-zinc-800 text-blue-300 border border-blue-500/50'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        官方预设
                      </button>
                      <button
                        type="button"
                        onClick={() => setHeroSlotTypeFilter('custom')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                          heroSlotTypeFilter === 'custom'
                            ? 'bg-zinc-800 text-emerald-300 border border-emerald-500/50'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        自定义/导入
                      </button>
                    </div>

                    {/* Quick Search */}
                    <div className="relative flex-1 sm:w-48 sm:flex-initial">
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={heroSlotSearch}
                        onChange={(e) => setHeroSlotSearch(e.target.value)}
                        placeholder="快速搜索槽位角色..."
                        className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg pl-8 pr-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Hero Selector Chips */}
                {filteredSlotHeroes.length === 0 ? (
                  <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800 text-center space-y-1">
                    <p className="text-xs text-zinc-400">当前分类与搜索条件下未找到匹配的角色槽位</p>
                    <button
                      type="button"
                      onClick={() => {
                        setHeroSlotFactionFilter('all');
                        setHeroSlotSubFactionFilter('all');
                        setHeroSlotTypeFilter('all');
                        setHeroSlotSearch('');
                      }}
                      className="text-[11px] text-blue-400 hover:text-blue-300 underline cursor-pointer"
                    >
                      重置所有分类筛选
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {filteredSlotHeroes.map((h) => {
                      const isSelected = h.id === selectedHero.id;
                      const heroMems = getHeroFactionMemberships(h, factions);
                      const primMem = heroMems[0];
                      const heroFaction = primMem ? factions.find((f) => f.id === primMem.factionId) : undefined;
                      const heroSub = primMem?.subFactionId ? getSubFactionById(factions, primMem.subFactionId) : undefined;
                      const heroSubName = primMem?.subFactionName || heroSub?.name;
                      const isUnassigned = isHeroUnassigned(h, factions);

                      return (
                        <div
                          key={h.id}
                          className={`group flex items-center rounded-lg text-xs font-bold transition-all border ${
                            isSelected
                              ? 'bg-blue-500/20 border-blue-500 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/50'
                              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          <button
                            onClick={() => {
                              ultraAudio.playUiClick();
                              onSelectHero(h);
                            }}
                            className="flex items-center space-x-2 px-3 py-1.5 cursor-pointer"
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: h.colorTheme?.primary || '#3b82f6' }}
                            />
                            <span>{h.name}</span>

                            {/* Faction & Sub-Faction Badges on Chip */}
                            {heroFaction ? (
                              <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-700/40 text-amber-300 shrink-0">
                                {heroFaction.shortName || heroFaction.name}
                                {heroSubName ? ` · ${heroSubName}` : ''}
                              </span>
                            ) : isUnassigned ? (
                              <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-zinc-950 border border-zinc-700 text-zinc-400 shrink-0">
                                自由
                              </span>
                            ) : null}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Character Base Attributes & Faction Assignment */}
              <div className="space-y-4">
                <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800/80 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <span>角色基础档案设定</span>
                    </h3>
                  </div>

                  {/* Faction, Sub-Faction, and Multi-Membership Customization for Hero */}
                  <div className="bg-zinc-900/80 p-3 rounded-xl border border-amber-900/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-amber-300 font-bold text-xs flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-amber-400" />
                          <span>组织阵营与从属战术编制归属</span>
                        </label>
                        {selectedHero.factionId && selectedHero.factionId !== 'unassigned' && (
                          <button
                            type="button"
                            onClick={() => {
                              ultraAudio.playUiClick();
                              setIsCreatingInlineSubFaction(!isCreatingInlineSubFaction);
                            }}
                            className="text-[11px] px-2 py-0.5 rounded bg-sky-950/80 border border-sky-600/50 text-sky-300 hover:bg-sky-900/80 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{isCreatingInlineSubFaction ? '收起新建' : '自定义新建从属编制'}</span>
                          </button>
                        )}
                      </div>

                      {/* Primary Faction & Sub-Faction Selectors */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1 flex items-center gap-1">
                            <span>主属组织阵营</span>
                          </label>
                          <select
                            value={selectedHero.factionId || 'unassigned'}
                            onChange={(e) => {
                              const newFacId = e.target.value;
                              const fac = factions.find((f) => f.id === newFacId);
                              const updatedHero = normalizeHeroFactionMemberships({
                                ...selectedHero,
                                factionId: newFacId === 'unassigned' ? undefined : newFacId,
                                subFactionId: undefined,
                                subFactionName: undefined,
                              }, factions);

                              onUpdateHero(updatedHero);
                            }}
                            className="w-full bg-zinc-950 border border-amber-500/40 rounded px-2.5 py-1.5 text-amber-200 text-xs focus:border-amber-400 outline-none cursor-pointer"
                          >
                            <option value="unassigned">未指定 / 自由独立势力</option>
                            {factions.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name} ({f.shortName || f.name})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1 flex items-center gap-1">
                            <Layers className="w-3 h-3 text-sky-400" />
                            <span>从属分支机构 / 战术编制</span>
                          </label>
                          {(() => {
                            const curFac = factions.find((f) => f.id === selectedHero.factionId);
                            const subList = curFac ? curFac.subFactions || [] : [];
                            return (
                              <div className="space-y-1">
                                <select
                                  disabled={!curFac || subList.length === 0}
                                  value={selectedHero.subFactionId || 'none'}
                                  onChange={(e) => {
                                    const newSubId = e.target.value;
                                    const sub = subList.find((s) => s.id === newSubId);
                                    const updatedHero = normalizeHeroFactionMemberships({
                                      ...selectedHero,
                                      subFactionId: newSubId === 'none' ? undefined : newSubId,
                                      subFactionName: sub ? sub.name : undefined,
                                      subFactionOnly: newSubId === 'none' ? false : selectedHero.subFactionOnly,
                                    }, factions);

                                    onUpdateHero(updatedHero);
                                  }}
                                  className="w-full bg-zinc-950 border border-sky-500/40 rounded px-2.5 py-1.5 text-sky-200 text-xs focus:border-sky-400 outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <option value="none">
                                    {!curFac ? '需先选定所属阵营' : subList.length === 0 ? '该阵营暂无下属编制' : '直属主部 / 无特定下属编制'}
                                  </option>
                                  {subList.map((sf) => {
                                    const conf = SUB_FACTION_TYPE_CONFIGS[sf.type || 'military'] || SUB_FACTION_TYPE_CONFIGS.custom;
                                    return (
                                      <option key={sf.id} value={sf.id}>
                                        {conf.icon} {sf.name} {sf.code ? `[${sf.code}]` : ''} ({conf.label})
                                      </option>
                                    );
                                  })}
                                </select>

                                {selectedHero.subFactionId && (
                                  <label className="flex items-center gap-1.5 pt-1 text-[11px] text-teal-300 font-bold cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(selectedHero.subFactionOnly)}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        const updatedHero = addOrUpdateHeroFactionMembership(
                                          selectedHero,
                                          {
                                            factionId: selectedHero.factionId!,
                                            subFactionId: selectedHero.subFactionId,
                                            subFactionName: selectedHero.subFactionName,
                                            subFactionOnly: checked,
                                            membershipType: checked ? 'sub_unit_only' : 'core',
                                            title: checked ? '从属编制干员' : '核心主属',
                                          },
                                          undefined,
                                          1,
                                          checked ? '从属编制干员' : '核心主属',
                                          undefined,
                                          factions,
                                          selectedHero.subFactionId,
                                          selectedHero.subFactionName,
                                          checked ? 'sub_unit_only' : 'core',
                                          undefined,
                                          checked ? '独立从属编制' : undefined,
                                          checked
                                        );
                                        onUpdateHero(updatedHero);
                                      }}
                                      className="accent-teal-400 rounded cursor-pointer"
                                    />
                                    <span>🛡️ 仅从属于该下属战术编制 (不直接作为大阵营直属本部成员)</span>
                                  </label>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Role & Title customization within Faction/Sub-Faction */}
                      {selectedHero.factionId && selectedHero.factionId !== 'unassigned' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          <div>
                            <label className="block text-[11px] text-zinc-400 mb-1">
                              <span>在编制中的军阶 / 职位角色</span>
                            </label>
                            <input
                              type="text"
                              value={selectedHero.factionRole || ''}
                              placeholder="例如: 裁决分队长 / 首席王牌 / 实验体"
                              onChange={(e) => {
                                const newRole = e.target.value;
                                const updatedHero = addOrUpdateHeroFactionMembership(
                                  selectedHero,
                                  {
                                    factionId: selectedHero.factionId!,
                                    subFactionId: selectedHero.subFactionId,
                                    subFactionName: selectedHero.subFactionName,
                                    role: newRole,
                                  },
                                  undefined,
                                  1,
                                  undefined,
                                  undefined,
                                  factions
                                );
                                onUpdateHero(updatedHero);
                              }}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs focus:border-amber-400 outline-none"
                            />
                            <div className="flex flex-wrap gap-1 mt-1">
                              {['先锋指挥官', '特勤分队长', '王牌机师', '首席研究员', '暗部特工', '受控实验体', '见习干员'].map((roleTag) => (
                                <button
                                  key={roleTag}
                                  type="button"
                                  onClick={() => {
                                    ultraAudio.playUiClick();
                                    const updatedHero = addOrUpdateHeroFactionMembership(
                                      selectedHero,
                                      {
                                        factionId: selectedHero.factionId!,
                                        subFactionId: selectedHero.subFactionId,
                                        subFactionName: selectedHero.subFactionName,
                                        role: roleTag,
                                      },
                                      undefined,
                                      1,
                                      undefined,
                                      undefined,
                                      factions
                                    );
                                    onUpdateHero(updatedHero);
                                  }}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                                >
                                  {roleTag}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] text-zinc-400 mb-1">
                              <span>身份定位 / 隶属关系属性</span>
                            </label>
                            {(() => {
                              const curMems = getHeroFactionMemberships(selectedHero, factions);
                              const prim = curMems[0];
                              const curTitle = prim?.title || '主属阵营';
                              return (
                                <>
                                  <input
                                    type="text"
                                    value={curTitle}
                                    placeholder="例如: 主属阵营 / 潜伏卧底 / 双重身份"
                                    onChange={(e) => {
                                      const newTitle = e.target.value;
                                      const updatedHero = addOrUpdateHeroFactionMembership(
                                        selectedHero,
                                        {
                                          factionId: selectedHero.factionId!,
                                          subFactionId: selectedHero.subFactionId,
                                          subFactionName: selectedHero.subFactionName,
                                          title: newTitle,
                                        },
                                        undefined,
                                        1,
                                        newTitle,
                                        undefined,
                                        factions
                                      );
                                      onUpdateHero(updatedHero);
                                    }}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs focus:border-amber-400 outline-none"
                                  />
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {['主属阵营', '核心主官', '兼任职务', '双重身份', '潜伏卧底', '战略同盟', '客座顾问'].map((titleTag) => (
                                      <button
                                        key={titleTag}
                                        type="button"
                                        onClick={() => {
                                          ultraAudio.playUiClick();
                                          const updatedHero = addOrUpdateHeroFactionMembership(
                                            selectedHero,
                                            {
                                              factionId: selectedHero.factionId!,
                                              subFactionId: selectedHero.subFactionId,
                                              subFactionName: selectedHero.subFactionName,
                                              title: titleTag,
                                            },
                                            undefined,
                                            1,
                                            titleTag,
                                            undefined,
                                            factions
                                          );
                                          onUpdateHero(updatedHero);
                                        }}
                                        className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                                      >
                                        {titleTag}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Inline Create Sub-Faction Drawer Form */}
                      {isCreatingInlineSubFaction && selectedHero.factionId && selectedHero.factionId !== 'unassigned' && (
                        <div className="p-3 bg-zinc-950/90 rounded-lg border border-sky-600/50 space-y-2.5 animate-fadeIn">
                          <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                            <span className="text-xs font-bold text-sky-300 flex items-center gap-1">
                              <Plus className="w-3.5 h-3.5 text-sky-400" />
                              <span>
                                为阵营【{factions.find((f) => f.id === selectedHero.factionId)?.name}】创建新从属编制
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsCreatingInlineSubFaction(false)}
                              className="text-zinc-500 hover:text-zinc-300 text-xs"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] text-zinc-400 mb-0.5">编制名称 *</label>
                              <input
                                type="text"
                                value={inlineSubFactionName}
                                onChange={(e) => setInlineSubFactionName(e.target.value)}
                                placeholder="例如: 漆黑暗影搜查大队 / 第七实验所"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:border-sky-400 outline-none text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-zinc-400 mb-0.5">战术代号</label>
                              <input
                                type="text"
                                value={inlineSubFactionCode}
                                onChange={(e) => setInlineSubFactionCode(e.target.value)}
                                placeholder="如: SHADOW-07"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:border-sky-400 outline-none text-xs font-mono"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="block text-[11px] text-zinc-400 mb-0.5">编制类型</label>
                              <select
                                value={inlineSubFactionType}
                                onChange={(e) => setInlineSubFactionType(e.target.value as any)}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:border-sky-400 outline-none text-xs cursor-pointer"
                              >
                                {Object.entries(SUB_FACTION_TYPE_CONFIGS).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v.icon} {v.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] text-zinc-400 mb-0.5">编制主官 / 负责人</label>
                              <input
                                type="text"
                                value={inlineSubFactionLeader}
                                onChange={(e) => setInlineSubFactionLeader(e.target.value)}
                                placeholder={`默认为当前角色 (${selectedHero.name})`}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:border-sky-400 outline-none text-xs"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] text-zinc-400 mb-0.5">编制职能与任务描述</label>
                            <input
                              type="text"
                              value={inlineSubFactionDesc}
                              onChange={(e) => setInlineSubFactionDesc(e.target.value)}
                              placeholder="描述该分支机构的特定战术职权、科研领域或特殊戒备任务"
                              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:border-sky-400 outline-none text-xs"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setIsCreatingInlineSubFaction(false)}
                              className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCreateInlineSubFactionForCurrentHero(selectedHero.factionId!)}
                              className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>保存并立即加入此编制</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Multi-Faction & Dual-Identity Memberships List */}
                      {(() => {
                        const allMems = getHeroFactionMemberships(selectedHero, factions);
                        const secondaryMems = allMems.slice(1);
                        return (
                          <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-400 font-bold flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-indigo-400" />
                                <span>多重从属组织与跨国兼任身份 ({allMems.length} 处归属)</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  ultraAudio.playUiClick();
                                  setIsAddingSecondaryMembership(!isAddingSecondaryMembership);
                                  if (!isAddingSecondaryMembership && !secondaryOriginCountry) {
                                    setSecondaryOriginCountry(selectedHero.nativeCountry || selectedHero.homePlanet || '地球');
                                  }
                                }}
                                className="text-[11px] text-indigo-300 hover:text-indigo-200 flex items-center gap-0.5 cursor-pointer underline"
                              >
                                <Plus className="w-3 h-3" />
                                <span>{isAddingSecondaryMembership ? '取消新增' : '添加他国从属 / 兼任派遣编制'}</span>
                              </button>
                            </div>

                            {/* Secondary memberships cards */}
                            {secondaryMems.length > 0 && (
                              <div className="space-y-1.5">
                                {secondaryMems.map((mem, idx) => {
                                  const fac = factions.find((f) => f.id === mem.factionId);
                                  const sub = mem.subFactionId ? getSubFactionById(fac, mem.subFactionId, factions) : undefined;
                                  const typeConf = MEMBERSHIP_TYPE_CONFIGS[mem.membershipType || 'foreign_subordinate'] || MEMBERSHIP_TYPE_CONFIGS.foreign_subordinate;
                                  const origin = mem.originCountry || selectedHero.nativeCountry || selectedHero.homePlanet;

                                  return (
                                    <div
                                      key={mem.factionId}
                                      className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-800 text-xs gap-2"
                                    >
                                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-700/50 text-indigo-300 font-bold">
                                          第 {idx + 2} 顺位
                                        </span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${typeConf.badge} flex items-center gap-0.5`}>
                                          <span>{typeConf.icon}</span>
                                          <span>{typeConf.shortLabel}</span>
                                        </span>
                                        <span className="font-bold text-amber-300">
                                          {fac?.name || mem.factionId}
                                        </span>
                                        {sub && (
                                          <span className="px-1.5 py-0.2 rounded bg-sky-950/80 border border-sky-700/50 text-sky-300 text-[10px]">
                                            🏛️ {sub.name}
                                          </span>
                                        )}
                                        <span className="text-zinc-300 text-[11px]">
                                          职务: <strong className="text-zinc-100">{mem.role}</strong>
                                        </span>
                                        {mem.title && (
                                          <span className="text-zinc-400 text-[10px]">
                                            定位: <span className="text-zinc-200">{mem.title}</span>
                                          </span>
                                        )}
                                        {origin && (
                                          <span className="px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-700 text-cyan-300 text-[10px] flex items-center gap-0.5">
                                            <Globe className="w-2.5 h-2.5" />
                                            <span>母国: {origin}</span>
                                          </span>
                                        )}
                                        {mem.affiliationNature && (
                                          <span className="text-purple-300 text-[10px]">
                                            ({mem.affiliationNature})
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                                        <button
                                          type="button"
                                          title="提升为此角色的首要主属阵营"
                                          onClick={() => handlePromoteMembership(mem.factionId)}
                                          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-amber-900/60 hover:text-amber-200 text-zinc-300 text-[10px] transition-colors cursor-pointer"
                                        >
                                          设为主属
                                        </button>
                                        <button
                                          type="button"
                                          title="移除此从属/兼任身份"
                                          onClick={() => handleRemoveMembership(mem.factionId)}
                                          className="p-1 rounded bg-zinc-800 hover:bg-rose-950/80 hover:text-rose-300 text-zinc-400 transition-colors cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Add Secondary Membership Form */}
                            {isAddingSecondaryMembership && (
                              <div className="p-3 bg-zinc-950/95 rounded-lg border border-indigo-600/60 space-y-2.5 text-xs shadow-lg">
                                <div className="flex items-center justify-between">
                                  <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>新增他国从属 / 跨国派遣 / 兼任编制身份</span>
                                  </div>
                                  <span className="text-[10px] text-zinc-400">支持录入跨国从属、外交使节或外邦雇佣</span>
                                </div>

                                {/* Preset Selection Buttons */}
                                <div className="space-y-1">
                                  <span className="text-[10px] text-zinc-400 font-bold">快捷预设从属性质:</span>
                                  <div className="flex flex-wrap gap-1">
                                    {[
                                      { label: '🛡️ 独立从属编制 (非直属)', type: 'sub_unit_only', title: '从属编制干员', role: '下属战术干员', nature: '仅从属于独立从属编制 (不加入大阵营直属体系)' },
                                      { label: '🌐 他国从属干员', type: 'foreign_subordinate', title: '他国从属干员', role: '外派特勤干员', nature: '跨国派驻从属' },
                                      { label: '🏛️ 附属邦国派遣', type: 'vassal_delegate', title: '附属国派遣从属', role: '朝贡/协约特派员', nature: '属邦例行派遣' },
                                      { label: '⚔️ 外邦受聘雇佣', type: 'mercenary', title: '外邦受聘雇佣', role: '高阶雇佣战术专家', nature: '契约雇佣效力' },
                                      { label: '✨ 客座顾问外援', type: 'guest', title: '客座流亡外援', role: '客座特聘技术顾问', nature: '客座学术与技术支援' },
                                      { label: '🕊️ 跨国外交联络', type: 'liaison', title: '跨国外交联络使', role: '常驻使节兼联络长', nature: '官方外交驻留' },
                                      { label: '🕵️ 异邦潜伏卧底', type: 'undercover', title: '异邦潜伏卧底', role: '暗影潜伏谍报员', nature: '绝密渗透' },
                                    ].map((preset) => (
                                      <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => {
                                          ultraAudio.playUiClick();
                                          setSecondaryMembershipType(preset.type);
                                          setSecondaryTitle(preset.title);
                                          setSecondaryRole(preset.role);
                                          setSecondaryAffiliationNature(preset.nature);
                                          setSecondarySubFactionOnly(preset.type === 'sub_unit_only');
                                        }}
                                        className="px-2 py-0.5 rounded text-[10px] bg-zinc-900 hover:bg-indigo-950/80 border border-zinc-700 hover:border-indigo-500/50 text-zinc-300 hover:text-indigo-200 transition-colors cursor-pointer"
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[11px] text-zinc-400 mb-0.5">选择从属/兼任目标势力 <span className="text-rose-400">*</span></label>
                                    <select
                                      value={secondaryFactionId}
                                      onChange={(e) => {
                                        setSecondaryFactionId(e.target.value);
                                        setSecondarySubFactionId('none');
                                      }}
                                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs focus:border-indigo-400 outline-none cursor-pointer"
                                    >
                                      <option value="">-- 请选择目标势力阵营 --</option>
                                      {factions
                                        .filter((f) => !allMems.some((m) => m.factionId === f.id))
                                        .map((f) => (
                                          <option key={f.id} value={f.id}>
                                            {f.name}
                                          </option>
                                        ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[11px] text-zinc-400 mb-0.5">选择从属战术编制</label>
                                    {(() => {
                                      const secFac = factions.find((f) => f.id === secondaryFactionId);
                                      const secSubs = secFac?.subFactions || [];
                                      return (
                                        <select
                                          disabled={!secFac || secSubs.length === 0}
                                          value={secondarySubFactionId}
                                          onChange={(e) => setSecondarySubFactionId(e.target.value)}
                                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs focus:border-indigo-400 outline-none cursor-pointer disabled:opacity-40"
                                        >
                                          <option value="none">
                                            {!secFac ? '请先选择阵营' : secSubs.length === 0 ? '该势力暂无下属编制' : '直属/无特定下属编制'}
                                          </option>
                                          {secSubs.map((sf) => (
                                            <option key={sf.id} value={sf.id}>
                                              {sf.name}
                                            </option>
                                          ))}
                                        </select>
                                      );
                                    })()}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <div>
                                    <label className="block text-[11px] text-zinc-400 mb-0.5">从属类型分类</label>
                                    <select
                                      value={secondaryMembershipType}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setSecondaryMembershipType(val);
                                        if (val === 'sub_unit_only') {
                                          setSecondarySubFactionOnly(true);
                                        }
                                      }}
                                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs focus:border-indigo-400 outline-none cursor-pointer"
                                    >
                                      {Object.entries(MEMBERSHIP_TYPE_CONFIGS).map(([k, v]) => (
                                        <option key={k} value={k}>
                                          {v.icon} {v.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[11px] text-zinc-400 mb-0.5">担任职务/职称</label>
                                    <input
                                      type="text"
                                      value={secondaryRole}
                                      onChange={(e) => setSecondaryRole(e.target.value)}
                                      placeholder="例如: 特派指挥官 / 战术顾问"
                                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs focus:border-indigo-400 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] text-zinc-400 mb-0.5">角色原生母国/属地</label>
                                    <input
                                      type="text"
                                      value={secondaryOriginCountry}
                                      onChange={(e) => setSecondaryOriginCountry(e.target.value)}
                                      placeholder={`默认为: ${selectedHero.nativeCountry || selectedHero.homePlanet || '地球'}`}
                                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-cyan-300 text-xs focus:border-indigo-400 outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[11px] text-zinc-400 mb-0.5">身份定位标签</label>
                                    <input
                                      type="text"
                                      value={secondaryTitle}
                                      onChange={(e) => setSecondaryTitle(e.target.value)}
                                      placeholder="例如: 他国从属干员 / 附属国派驻"
                                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs focus:border-indigo-400 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] text-zinc-400 mb-0.5">从属性质与协同说明</label>
                                    <input
                                      type="text"
                                      value={secondaryAffiliationNature}
                                      onChange={(e) => setSecondaryAffiliationNature(e.target.value)}
                                      placeholder="例如: 依照双边条约跨国驻留从属 / 契约雇佣"
                                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs focus:border-indigo-400 outline-none"
                                    />
                                  </div>
                                </div>

                                <label className="flex items-center gap-2 pt-1 text-xs text-teal-300 font-bold cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(secondarySubFactionOnly || secondaryMembershipType === 'sub_unit_only')}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setSecondarySubFactionOnly(checked);
                                      if (checked) {
                                        setSecondaryMembershipType('sub_unit_only');
                                        if (!secondaryAffiliationNature || secondaryAffiliationNature === '跨国派驻从属') {
                                          setSecondaryAffiliationNature('仅从属于独立从属编制 (不加入大阵营直属体系)');
                                        }
                                      } else {
                                        if (secondaryMembershipType === 'sub_unit_only') {
                                          setSecondaryMembershipType('foreign_subordinate');
                                        }
                                      }
                                    }}
                                    className="accent-teal-400 rounded cursor-pointer"
                                  />
                                  <span>🛡️ 仅加入该下属编制 (保持原生母国阵营，不直接加入目标势力直属本部)</span>
                                </label>

                                <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800">
                                  <button
                                    type="button"
                                    onClick={() => setIsAddingSecondaryMembership(false)}
                                    className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                                  >
                                    取消
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleAddSecondaryMembership}
                                    className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>确认录入此从属/兼任编制</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Physical Specs & Native Country Origin */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-zinc-400 mb-1">身高</label>
                        <input
                          type="text"
                          value={selectedHero.height}
                          onChange={(e) => handleHeroFieldChange('height', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-400 mb-1">体重</label>
                        <input
                          type="text"
                          value={selectedHero.weight}
                          onChange={(e) => handleHeroFieldChange('weight', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-400 mb-1">出身地 / 母星</label>
                        <input
                          type="text"
                          value={selectedHero.homePlanet}
                          onChange={(e) => handleHeroFieldChange('homePlanet', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-cyan-300 font-bold mb-1 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-cyan-400" />
                          <span>母国 / 原生属地</span>
                        </label>
                        <input
                          type="text"
                          value={selectedHero.nativeCountry || ''}
                          onChange={(e) => handleHeroFieldChange('nativeCountry', e.target.value)}
                          placeholder="例如: 我的阵营 / 地球"
                          className="w-full bg-zinc-900 border border-cyan-700/60 rounded px-2 py-1 text-cyan-200 focus:border-cyan-400 outline-none text-xs"
                        />
                      </div>
                    </div>

                    {/* Quick Native Country Preset Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      <span className="text-zinc-500 font-bold shrink-0">快捷设定母国:</span>
                      {[
                        '地球·圣殿领',
                        '泛银河机巧联邦',
                        '深渊暗影王庭',
                        '地球防卫本部',
                        '阿布索留特王国',
                        '原初幻界圣域',
                        '自由星区',
                      ].map((country) => (
                        <button
                          key={country}
                          type="button"
                          onClick={() => {
                            ultraAudio.playUiClick();
                            handleHeroFieldChange('nativeCountry', country);
                          }}
                          className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-cyan-950/80 border border-zinc-800 hover:border-cyan-600/50 text-zinc-400 hover:text-cyan-300 transition-colors cursor-pointer"
                        >
                          {country}
                        </button>
                      ))}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-zinc-300 font-bold">角色背景设定与故事描述 (`description`)</label>
                        <span className="text-[10px] text-zinc-400">已扩大槽位，可详细书写出身背景、能力起源、遭遇战史与特殊弱点机制</span>
                      </div>
                      <textarea
                        rows={7}
                        value={selectedHero.description}
                        onChange={(e) => handleHeroFieldChange('description', e.target.value)}
                        placeholder="在此详细编写该角色的出生起源、性格特质、技能机制、特殊遭遇战史以及核心软肋设定..."
                        className="w-full min-h-[160px] bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-100 focus:border-purple-500 outline-none resize-y leading-relaxed shadow-inner"
                      />
                    </div>
                  </div>
                </div>

                {/* Character Personality & AI Mindset Universal Preset Selector */}
                <div className="bg-zinc-950/90 p-4 rounded-xl border border-purple-900/50 space-y-3.5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span>角色性格预设与 AI 心智设定 (Personality & Mindset)</span>
                        <span className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-700 px-2 py-0.5 rounded-full font-mono">
                          全角色通用可选
                        </span>
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          ultraAudio.playUiClick();
                          setActiveTab('personality');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-purple-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                        title="跳转到性格与台词完整库以深度编辑或新建自定义性格"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>打开性格详细台词库</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          ultraAudio.playUiClick();
                          const curName = selectedHero.personalityCustomName || selectedHero.personality || '自定义性格';
                          const newSlot: CustomPersonalitySlot = {
                            id: `custom_slot_${Date.now()}`,
                            name: `${curName} (通用)`,
                            icon: '💎',
                            description: selectedHero.description?.slice(0, 50) || '从角色中提取的通用性格',
                            tags: selectedHero.personalityCustomTags || ['通用性格'],
                            tone: selectedHero.personalityTone || '',
                            prompt: selectedHero.personalityCustomPrompt || selectedHero.customPrompt || '',
                            createdAt: Date.now(),
                          };
                          setCustomPersonalitySlots((prev) => [newSlot, ...prev]);
                          alert(`已成功将【${selectedHero.name}】的当前性格保存为全角色通用的自定义性格槽位【${newSlot.name}】！可在任意角色中自由选用。`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                        title="将当前角色的性格与 Prompt 保存为全角色通用的自定义槽位"
                      >
                        <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                        <span>存为通用槽位</span>
                      </button>
                    </div>
                  </div>

                  {/* Current Hero Active Personality Info */}
                  <div className="p-3 bg-zinc-900/80 rounded-lg border border-purple-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-zinc-400">当前【{selectedHero.name}】已激活的心智性格:</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-950 border border-purple-500/60 text-purple-200 font-bold text-xs flex items-center gap-1">
                          <span>✨</span>
                          <span>{selectedHero.personalityCustomName || selectedHero.personality || '未设定性格'}</span>
                        </span>
                        {selectedHero.personalityTone && (
                          <span className="text-zinc-400 text-[11px] truncate max-w-[260px]">
                            口吻: <strong className="text-zinc-200">{selectedHero.personalityTone}</strong>
                          </span>
                        )}
                      </div>
                      {selectedHero.personalityCustomTags && selectedHero.personalityCustomTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {selectedHero.personalityCustomTags.map((t, idx) => (
                            <span key={idx} className="px-1.5 py-0.2 rounded bg-purple-950/60 border border-purple-500/30 text-purple-300 text-[10px]">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick Dropdown Select */}
                    <div className="flex items-center gap-2">
                      <label className="text-zinc-400 text-xs shrink-0 font-bold">快捷切换:</label>
                      <select
                        value={selectedHero.personality || 'tsundere'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          ultraAudio.playUiClick();
                          const updated = applyPersonalityToHero(selectedHero, val, customPersonalitySlots);
                          onUpdateHero(updated);
                        }}
                        className="bg-zinc-900 border border-purple-500/50 rounded-lg px-2.5 py-1.5 text-xs text-purple-200 focus:border-purple-400 outline-none cursor-pointer"
                      >
                        <optgroup label="👑 系统内置通用性格预设">
                          {presetPersonalities.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.icon || '✨'} {p.name} - {p.tags.slice(0, 2).join('/')}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="💎 全角色通用自定义性格槽位">
                          {customPersonalitySlots.map((slot) => (
                            <option key={slot.id} value={slot.id}>
                              {slot.icon || '💎'} {slot.name} - {slot.tags.slice(0, 2).join('/')}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {/* Quick Select Preset/Slot Buttons Grid */}
                  <div className="space-y-2">
                    <div className="text-[11px] text-zinc-400 flex flex-wrap items-center justify-between gap-1">
                      <span>点击下方任意预设或通用自定义槽位，一键赋予【{selectedHero.name}】:</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`确定要将【${selectedHero.name}】当前的性格预设【${selectedHero.personalityCustomName || selectedHero.personality || '未设定性格'}】一键同步给全员 ${heroines.length} 位在役角色吗？`)) {
                            ultraAudio.playUiClick();
                            const curPresetId = selectedHero.personality || 'tsundere';
                            const newList = heroines.map((h) => applyPersonalityToHero(h, curPresetId, customPersonalitySlots));
                            newList.forEach((h) => onUpdateHero(h));
                            alert(`已成功将性格【${selectedHero.personalityCustomName || selectedHero.personality}】同步至全员角色！`);
                          }
                        }}
                        className="text-[10px] text-purple-300 hover:text-purple-200 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>🌐 一键同步当前性格给全员角色 ({heroines.length})</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                      {/* Universal Custom Slots */}
                      {customPersonalitySlots.map((slot) => {
                        const isCurrent = (selectedHero.personality === slot.id) || (selectedHero.personalityCustomName === slot.name);
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => {
                              ultraAudio.playUiClick();
                              const updated = applyPersonalityToHero(selectedHero, slot.id, customPersonalitySlots);
                              onUpdateHero(updated);
                            }}
                            className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              isCurrent
                                ? 'bg-purple-950/80 border-purple-400 text-purple-100 shadow-[0_0_10px_rgba(168,85,247,0.3)] ring-1 ring-purple-400'
                                : 'bg-zinc-900/70 hover:bg-zinc-800/90 border-zinc-800 text-zinc-300 hover:border-purple-500/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-bold text-xs truncate flex items-center gap-1">
                                <span>{slot.icon || '💎'}</span>
                                <span className="truncate">{slot.name}</span>
                              </span>
                              <span className="text-[8px] px-1 py-0.2 rounded bg-amber-950/60 text-amber-300 font-mono shrink-0">
                                通用自定义
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 line-clamp-1 leading-tight">
                              {slot.description || slot.tone}
                            </p>
                          </button>
                        );
                      })}

                      {/* System Presets */}
                      {presetPersonalities.map((preset) => {
                        const isCurrent = (selectedHero.personality === preset.id) || (!selectedHero.personality && preset.id === 'tsundere');
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              ultraAudio.playUiClick();
                              const updated = applyPersonalityToHero(selectedHero, preset.id, customPersonalitySlots);
                              onUpdateHero(updated);
                            }}
                            className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              isCurrent
                                ? 'bg-purple-950/80 border-purple-400 text-purple-100 shadow-[0_0_10px_rgba(168,85,247,0.3)] ring-1 ring-purple-400'
                                : 'bg-zinc-900/70 hover:bg-zinc-800/90 border-zinc-800 text-zinc-300 hover:border-purple-500/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-bold text-xs truncate flex items-center gap-1">
                                <span>{preset.icon || '✨'}</span>
                                <span className="truncate">{preset.name}</span>
                              </span>
                              <span className="text-[8px] px-1 py-0.2 rounded bg-purple-950/60 text-purple-300 font-mono shrink-0">
                                系统预设
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 line-clamp-1 leading-tight">
                              {preset.description || preset.tags.slice(0, 2).join('·')}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Primary Weakness & Tactical Properties */}
                <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>核心弱点与战术属性配置</span>
                    </h3>
                    <span className="text-[10px] text-zinc-400">
                      支持一键套用战术职业模板与弱点灵感
                    </span>
                  </div>

                  {/* Tactical Archetype Presets */}
                  <div className="space-y-1.5 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                    <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>快捷战术原型属性模版 (一键调整HP/能量/意志/恢复):</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {STAT_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            ultraAudio.playUiClick();
                            onUpdateHero({
                              ...selectedHero,
                              defaultStats: {
                                ...selectedHero.defaultStats,
                                ...preset.stats,
                              },
                              energyRegenRate: preset.regen,
                            });
                            setHeroActionToast(`已套用「${preset.name}」基础战术原型属性！`);
                            setTimeout(() => setHeroActionToast(null), 2500);
                          }}
                          className="p-2 rounded-lg bg-zinc-950 hover:bg-zinc-800/90 border border-zinc-800 hover:border-amber-500/50 text-left transition-all cursor-pointer group"
                        >
                          <div className="font-bold text-zinc-200 text-xs group-hover:text-amber-300 transition-colors">
                            {preset.name}
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5 leading-tight">
                            {preset.desc}
                          </div>
                          <div className="mt-1.5 text-[9px] font-mono text-cyan-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                            HP:{preset.stats.hp} · EN:{preset.stats.energy} · 恢复:{preset.regen}/s
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Primary Weak Part Dropdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-amber-300 font-bold mb-1">主要命门/弱点部位 (`weakPart`)</label>
                        <select
                          value={selectedHero.weakPart}
                          onChange={(e) => handleHeroFieldChange('weakPart', e.target.value)}
                          className="w-full bg-zinc-900 border border-amber-500/50 rounded px-2.5 py-1.5 text-amber-300 font-bold focus:border-amber-400 outline-none cursor-pointer"
                        >
                          {Object.entries(selectedHero.bodyParts).map(([pId, conf]) => (
                            <option key={pId} value={pId}>
                              {conf.name || BODY_PART_LABELS[pId] || pId}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-fuchsia-300 font-bold mb-1">自定义敏感/发情部位 (`sensitivePart`)</label>
                        <select
                          value={selectedHero.sensitivePart || 'torso'}
                          onChange={(e) => handleHeroFieldChange('sensitivePart', e.target.value)}
                          className="w-full bg-zinc-900 border border-fuchsia-500/50 rounded px-2.5 py-1.5 text-fuchsia-300 font-bold focus:border-fuchsia-400 outline-none cursor-pointer"
                        >
                          {Object.entries(selectedHero.bodyParts).map(([pId, conf]) => (
                            <option key={pId} value={pId}>
                              {conf.name || BODY_PART_LABELS[pId] || pId}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Weakness Text & Suggestions */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-zinc-300 font-bold">弱点战术特征描述 (`weakness`)</label>
                        <span className="text-[10px] text-zinc-500">点击下方常用设定快速填入或补充</span>
                      </div>
                      <input
                        type="text"
                        value={selectedHero.weakness}
                        onChange={(e) => handleHeroFieldChange('weakness', e.target.value)}
                        placeholder="例如：受击后引发全身剧烈痉挛、光能外泄..."
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 focus:border-blue-500 outline-none"
                      />

                      <div className="flex flex-wrap gap-1 items-center pt-1">
                        <span className="text-[10px] text-zinc-500 mr-0.5">常用弱点灵感:</span>
                        {WEAKNESS_PRESETS.map((wp) => (
                          <button
                            key={wp}
                            type="button"
                            onClick={() => {
                              ultraAudio.playUiClick();
                              handleHeroFieldChange('weakness', wp);
                            }}
                            className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-300 border border-zinc-800 transition-colors cursor-pointer max-w-[240px] truncate"
                            title={wp}
                          >
                            + {wp}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Energy Recovery Rate */}
                    <div className="bg-zinc-900/90 p-2.5 rounded border border-blue-900/50 flex flex-col space-y-1">
                      <div className="flex items-center justify-between font-bold text-blue-300">
                        <span className="flex items-center space-x-1">
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                          <span>自然光能慢速恢复速率 (`energyRegenRate`)</span>
                        </span>
                        <span className="text-cyan-300 font-mono">
                          {(selectedHero.energyRegenRate ?? 0.5).toFixed(1)}% / 秒
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <input
                          type="range"
                          min="0.0"
                          max="3.0"
                          step="0.1"
                          value={selectedHero.energyRegenRate ?? 0.5}
                          onChange={(e) => handleHeroFieldChange('energyRegenRate', parseFloat(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0.0"
                          max="10.0"
                          step="0.1"
                          value={selectedHero.energyRegenRate ?? 0.5}
                          onChange={(e) => handleHeroFieldChange('energyRegenRate', parseFloat(e.target.value) || 0)}
                          className="w-16 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-center text-cyan-300 font-mono text-xs"
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        生命未归零时能量将以此速率缓慢恢复。能量归零休克后需恢复超过 10% 才会复苏！
                      </span>
                    </div>

                    {/* 2D Portrait / GIF / Video Artwork Upload */}
                    <div className="space-y-2.5 border-t border-zinc-800 pt-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-purple-300 flex items-center space-x-1">
                          <Film className="w-3.5 h-3.5 text-cyan-400" />
                          <span>巨幅 2D / GIF / 视频立绘槽位</span>
                        </span>
                        <div className="flex items-center space-x-2">
                          <label className="px-2.5 py-1 rounded bg-gradient-to-r from-purple-900 to-indigo-900 border border-purple-500/80 text-purple-100 hover:from-purple-800 hover:to-indigo-800 transition-all text-xs font-bold cursor-pointer flex items-center space-x-1 shadow-sm">
                            <Upload className="w-3.5 h-3.5 text-purple-300" />
                            <span>上传 GIF/视频/图片</span>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const res = await readMediaFile(file, 'portraits', selectedHero.id);
                                    const mediaPath = res.localUrl || res.dataUrl;
                                    handleHeroFieldChange('customPortrait', mediaPath);
                                  } catch (err) {
                                    console.error('Failed to process custom portrait media:', err);
                                  }
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Direct URL Link Input Box */}
                      <div className="flex items-center space-x-2">
                        <div className="relative flex-1">
                          <LinkIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            placeholder="或在此粘贴外部网络 GIF / MP4 视频 / 图片链接 (https://...)"
                            value={selectedHero.customPortrait?.startsWith('data:') ? '' : selectedHero.customPortrait || ''}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              handleHeroFieldChange('customPortrait', val || undefined);
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>

                      {selectedHero.customPortrait ? (
                        <div className="relative w-full max-w-sm h-64 sm:h-72 rounded-xl border-2 border-purple-500/60 overflow-hidden bg-zinc-950 p-1.5 group flex flex-col items-center justify-center">
                          <PortraitMediaDisplay
                            src={selectedHero.customPortrait}
                            alt={selectedHero.name}
                            fitMode="contain"
                            isMuted={true}
                            showMediaBadge={true}
                          />
                          <button
                            onClick={() => handleHeroFieldChange('customPortrait', undefined)}
                            className="absolute top-2 right-2 px-2 py-1 rounded bg-rose-950/90 border border-rose-600 text-rose-200 text-xs font-bold opacity-80 hover:opacity-100 transition-opacity cursor-pointer shadow-lg z-20"
                            title="清除自定义立绘"
                          >
                            🗑️ 清除立绘
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-zinc-500 italic leading-relaxed">
                          ✨ 现已全面升级！不仅支持高清 PNG/JPG 图像，还完美支持 <strong className="text-amber-300 font-bold">GIF 动态图</strong>、<strong className="text-cyan-300 font-bold">MP4 / WebM 视频循环立绘</strong> 以及网络直链，自适应任意画幅比例！
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Per-Character Web Search & Knowledge Grounding */}
                <WebSearchConfigEditor
                  hero={selectedHero}
                  onUpdateHero={(updated) => commitHero(updated, true)}
                />

                {/* Detailed Appearance, Race & Biological Traits, and Faction Affiliation Editor */}
              <AppearanceEditor
                hero={selectedHero}
                onUpdateHero={(updated) => commitHero(updated, true)}
                factions={factions}
              />

              {/* Fully Customizable Stat Limits & Initial Attributes */}
              <div className="bg-zinc-950/90 p-4 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between border-b border-zinc-800/80 pb-2 gap-2">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span>完全自定义数值上限与初始属性控制 (HP/能量/意志/信任值/羞耻/欲望)</span>
                  </h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        ultraAudio.playUiClick();
                        onUpdateHero({ ...selectedHero });
                      }}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-300 transition-all text-xs font-bold shadow-[0_0_8px_rgba(16,185,129,0.25)] cursor-pointer"
                      title="保存此处修改的初始属性与最大上限为角色的重置预设。当前正在进行的对局数值保持不变，需在右上角/设置中点击【一键重置】后生效。"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>💾 保存为重置预设（重置后生效）</span>
                    </button>
                    <span className="text-[10px] text-zinc-400 hidden sm:inline">设置任意上限 (10~9999)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  {/* HP Capacity & Initial */}
                  <div className="bg-zinc-900 p-2.5 rounded-lg border border-rose-900/60 space-y-1.5">
                    <div className="text-[11px] font-bold text-rose-300">❤️ 生命耐久度 (HP)</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">最大上限:</span>
                      <input
                        type="number"
                        min="10"
                        max="9999"
                        value={selectedHero.defaultStats.maxHp ?? 100}
                        onChange={(e) => {
                          const maxHpVal = Math.max(10, parseInt(e.target.value) || 100);
                          handleHeroFieldChange('defaultStats', {
                            ...selectedHero.defaultStats,
                            maxHp: maxHpVal,
                            hp: Math.min(selectedHero.defaultStats.hp, maxHpVal),
                          });
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-rose-300 font-mono font-bold text-xs text-center"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">初始属性:</span>
                      <input
                        type="number"
                        min="0"
                        max={selectedHero.defaultStats.maxHp ?? 100}
                        value={selectedHero.defaultStats.hp}
                        onChange={(e) => {
                          const hpVal = Math.max(0, parseInt(e.target.value) || 0);
                          handleHeroFieldChange('defaultStats', {
                            ...selectedHero.defaultStats,
                            hp: hpVal,
                          });
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-rose-200 font-mono text-xs text-center"
                      />
                    </div>
                    <p className="text-[9px] text-zinc-400 pt-1 border-t border-zinc-800 leading-tight">
                      【HP效用】受击扣除。低于30%触发暴衣战损视效，归零休克无法受击。
                    </p>
                  </div>

                  {/* Energy Capacity & Initial */}
                  <div className="bg-zinc-900 p-2.5 rounded-lg border border-cyan-900/60 space-y-1.5">
                    <div className="text-[11px] font-bold text-cyan-300">⚡ 魔能值/能量中枢</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">最大上限:</span>
                      <input
                        type="number"
                        min="10"
                        max="9999"
                        value={selectedHero.defaultStats.maxEnergy ?? 100}
                        onChange={(e) => {
                          const maxVal = Math.max(10, parseInt(e.target.value) || 100);
                          handleHeroFieldChange('defaultStats', {
                            ...selectedHero.defaultStats,
                            maxEnergy: maxVal,
                            energy: Math.min(selectedHero.defaultStats.energy, maxVal),
                          });
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-cyan-300 font-mono font-bold text-xs text-center"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">初始属性:</span>
                      <input
                        type="number"
                        min="0"
                        max={selectedHero.defaultStats.maxEnergy ?? 100}
                        value={selectedHero.defaultStats.energy}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          handleHeroFieldChange('defaultStats', {
                            ...selectedHero.defaultStats,
                            energy: val,
                          });
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-cyan-200 font-mono text-xs text-center"
                      />
                    </div>
                    <p className="text-[9px] text-zinc-400 pt-1 border-t border-zinc-800 leading-tight">
                      【能量效用】护盾吸收率。高于50%减免75%伤害，归0%休克破甲。
                    </p>
                  </div>

                  {/* Morale Capacity & Initial */}
                  <div className="bg-zinc-900 p-2.5 rounded-lg border border-purple-900/60 space-y-1.5">
                    <div className="text-[11px] font-bold text-purple-300">🧠 意志防线 (精神力)</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">最大上限:</span>
                      <input
                        type="number"
                        min="10"
                        max="9999"
                        value={selectedHero.defaultStats.maxMorale ?? 100}
                        onChange={(e) => {
                          const maxVal = Math.max(10, parseInt(e.target.value) || 100);
                          handleHeroFieldChange('defaultStats', {
                            ...selectedHero.defaultStats,
                            maxMorale: maxVal,
                            morale: Math.min(selectedHero.defaultStats.morale, maxVal),
                          });
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-purple-300 font-mono font-bold text-xs text-center"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">初始属性:</span>
                      <input
                        type="number"
                        min="0"
                        max={selectedHero.defaultStats.maxMorale ?? 100}
                        value={selectedHero.defaultStats.morale}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          handleHeroFieldChange('defaultStats', {
                            ...selectedHero.defaultStats,
                            morale: val,
                          });
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-purple-200 font-mono text-xs text-center"
                      />
                    </div>
                    <p className="text-[9px] text-zinc-400 pt-1 border-t border-zinc-800 leading-tight">
                      【意志效用】抵抗审讯信念。降低产生心理动摇，低于20触发绝望求饶台词。
                    </p>
                  </div>

                  {/* Obedience Capacity & Initial */}
                  <div className="bg-zinc-900 p-2.5 rounded-lg border border-emerald-900/60 space-y-1.5">
                    <div className="text-[11px] font-bold text-emerald-300">⛓️ 信任值 / 归顺度</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">最大上限:</span>
                      <input
                        type="number"
                        min="10"
                        max="9999"
                        value={selectedHero.defaultStats.maxObedience ?? 100}
                        onChange={(e) => {
                          const maxVal = Math.max(10, parseInt(e.target.value) || 100);
                          handleHeroFieldChange('defaultStats', {
                            ...selectedHero.defaultStats,
                            maxObedience: maxVal,
                            obedience: Math.min(selectedHero.defaultStats.obedience, maxVal),
                          });
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-emerald-300 font-mono font-bold text-xs text-center"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">初始属性:</span>
                      <input
                        type="number"
                        min="0"
                        max={selectedHero.defaultStats.maxObedience ?? 100}
                        value={selectedHero.defaultStats.obedience}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          handleHeroFieldChange('defaultStats', {
                            ...selectedHero.defaultStats,
                            obedience: val,
                          });
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-emerald-200 font-mono text-xs text-center"
                      />
                    </div>
                    <p className="text-[9px] text-zinc-400 pt-1 border-t border-zinc-800 leading-tight">
                      【信任效用】对互动与指令的信任归顺程度。70%以上解锁顺从与高信任等深入剧情。
                    </p>
                  </div>

                  {/* Shame Capacity & Initial */}
                  <div className="bg-zinc-900 p-2.5 rounded-lg border border-amber-900/60 space-y-1.5">
                    <div className="text-[11px] font-bold text-amber-300">😳 羞耻心理破绽</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">最大上限:</span>
                      <input
                        type="number"
                        min="10"
                        max="9999"
                        value={selectedHero.defaultStats.maxShame ?? 100}
                        onChange={(e) => {
                          const maxVal = Math.max(10, parseInt(e.target.value) || 100);
                          handleHeroFieldChange('defaultStats', {
                            ...selectedHero.defaultStats,
                            maxShame: maxVal,
                            shame: Math.min(selectedHero.defaultStats.shame, maxVal),
                          });
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-amber-300 font-mono font-bold text-xs text-center"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">初始属性:</span>
                      <input
                        type="number"
                        min="0"
                        max={selectedHero.defaultStats.maxShame ?? 100}
                        value={selectedHero.defaultStats.shame}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          handleHeroFieldChange('defaultStats', {
                            ...selectedHero.defaultStats,
                            shame: val,
                          });
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-amber-200 font-mono text-xs text-center"
                      />
                    </div>
                    <p className="text-[9px] text-zinc-400 pt-1 border-t border-zinc-800 leading-tight">
                      【羞耻效用】暴露与受打击下的窘迫程度。提升使喘息与动容气场更热烈。
                    </p>
                  </div>

                  {/* Lust Capacity & Initial */}
                  <div className="bg-zinc-900 p-2.5 rounded-lg border border-pink-900/60 space-y-1.5">
                    <div className="text-[11px] font-bold text-pink-300">🔥 色情欲望诱发</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">最大上限:</span>
                      <input
                        type="number"
                        min="10"
                        max="9999"
                        value={selectedHero.defaultStats.maxLust ?? 100}
                        onChange={(e) => {
                          const maxVal = Math.max(10, parseInt(e.target.value) || 100);
                          handleHeroFieldChange('defaultStats', {
                            ...selectedHero.defaultStats,
                            maxLust: maxVal,
                            lust: Math.min(selectedHero.defaultStats.lust ?? 10, maxVal),
                          });
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-pink-300 font-mono font-bold text-xs text-center"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">初始属性:</span>
                      <input
                        type="number"
                        min="0"
                        max={selectedHero.defaultStats.maxLust ?? 100}
                        value={selectedHero.defaultStats.lust ?? 10}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          handleHeroFieldChange('defaultStats', {
                            ...selectedHero.defaultStats,
                            lust: val,
                          });
                        }}
                        className="w-20 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-pink-200 font-mono text-xs text-center"
                      />
                    </div>
                    <p className="text-[9px] text-zinc-400 pt-1 border-t border-zinc-800 leading-tight">
                      【欲望效用】反映生理发情敏感度。数值越高放大后续触碰与打击的加成倍率。
                    </p>
                  </div>
                </div>
              </div>

              {/* Body Parts / Hit Areas Detailed Editor */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-2 gap-2">
                  <h3 className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Crosshair className="w-4 h-4 text-blue-400" />
                    <span>受损/作用部位阵列 ({partKeys.length} 个区域 · {selectedHero.name})</span>
                  </h3>
                  <button
                    onClick={() => {
                      ultraAudio.playUiClick();
                      handleAddBodyPart();
                    }}
                    className="flex items-center space-x-1 px-3 py-1 rounded bg-blue-950 border border-blue-500/50 text-blue-300 hover:bg-blue-900 transition-all text-xs font-bold shadow-[0_0_8px_rgba(59,130,246,0.2)]"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-400" />
                    <span>+ 新增自定义受击/攻击部位</span>
                  </button>
                </div>

                {/* Body Part Selector Tabs */}
                <div className="flex flex-wrap gap-1.5">
                  {partKeys.map((pId) => {
                    const isEditing = currentEditingPartId === pId;
                    const isPrimaryWeak = selectedHero.weakPart === pId;
                    const conf = selectedHero.bodyParts[pId];
                    const displayName = conf?.name ? conf.name.split(' ')[0] : (BODY_PART_LABELS[pId] || pId).split(' ')[0];
                    const isCustom = pId.startsWith('part_custom_');

                    return (
                      <button
                        key={pId}
                        onClick={() => {
                          ultraAudio.playUiClick();
                          setEditingPartId(pId);
                        }}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          isEditing
                            ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]'
                            : isPrimaryWeak
                            ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <span>{displayName}</span>
                        {isCustom && <span className="text-[9px] px-1 bg-blue-950 text-blue-300 rounded border border-blue-800">自定义</span>}
                        {isPrimaryWeak && <span className="text-[10px] text-amber-400">★弱点</span>}
                        {conf?.weaknessMultiplier && conf.weaknessMultiplier > 1.2 && (
                          <span className="text-[10px] text-rose-400">{conf.weaknessMultiplier}x</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Body Part Form */}
                {currentEditingPartId && selectedHero.bodyParts[currentEditingPartId] && (
                  <div className="bg-zinc-900/90 p-3.5 rounded-lg border border-zinc-800 space-y-3 text-xs mt-2">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="font-bold text-blue-300 flex items-center space-x-2">
                        <span>正在微调部位参数: {selectedHero.bodyParts[currentEditingPartId]?.name || currentEditingPartId}</span>
                        {selectedHero.weakPart === currentEditingPartId ? (
                          <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500/50 text-amber-300 text-[10px] font-bold">
                            当前主弱点部位
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              ultraAudio.playUiClick();
                              handleHeroFieldChange('weakPart', currentEditingPartId);
                            }}
                            className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-amber-300 hover:border-amber-500/50 text-[10px] transition-all"
                          >
                            设为主命门/弱点
                          </button>
                        )}
                      </span>

                      {partKeys.length > 1 && (
                        <button
                          onClick={() => {
                            ultraAudio.playUiClick();
                            handleDeleteBodyPart(currentEditingPartId);
                          }}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-950/80 border border-rose-800/80 text-rose-300 hover:bg-rose-900 transition-all text-xs cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>删除此攻击部位</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-zinc-400 mb-1">部位显示名称</label>
                        <input
                          type="text"
                          value={selectedHero.bodyParts[currentEditingPartId]?.name || ''}
                          onChange={(e) => handleBodyPartChange(currentEditingPartId, 'name', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-zinc-100 focus:border-blue-500 outline-none font-bold"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-zinc-400 mb-1">
                          <span>部位打击敏锐度/伤害倍率 (`weaknessMultiplier`)</span>
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              value={selectedHero.bodyParts[currentEditingPartId]?.weaknessMultiplier || 1.0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 0) {
                                  handleBodyPartChange(currentEditingPartId, 'weaknessMultiplier', val);
                                }
                              }}
                              className="w-16 bg-zinc-900 border border-amber-500/50 rounded px-1.5 py-0.5 text-xs text-amber-400 font-bold text-right focus:outline-none"
                            />
                            <span className="text-amber-400 text-xs font-bold">x</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max={Math.max(10, (selectedHero.bodyParts[currentEditingPartId]?.weaknessMultiplier || 1.0) > 8 ? Math.ceil((selectedHero.bodyParts[currentEditingPartId]?.weaknessMultiplier || 1.0) * 1.5) : 10)}
                          step="0.1"
                          value={selectedHero.bodyParts[currentEditingPartId]?.weaknessMultiplier || 1.0}
                          onChange={(e) =>
                            handleBodyPartChange(currentEditingPartId, 'weaknessMultiplier', parseFloat(e.target.value))
                          }
                          className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded mt-1 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1">部位受损与解剖结构描述</label>
                      <input
                        type="text"
                        value={selectedHero.bodyParts[currentEditingPartId]?.description || ''}
                        onChange={(e) => handleBodyPartChange(currentEditingPartId, 'description', e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-zinc-100 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'personality' && (
            <div className="space-y-6">
              {/* Target Character Quick Switcher Ribbon */}
              <div className="bg-zinc-950 p-3.5 rounded-xl border border-purple-900/50 space-y-2.5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-purple-300">
                      正在配置性格的目标角色 (Target Heroine):
                    </span>
                    <span className="text-[11px] text-zinc-300 bg-purple-950/80 border border-purple-500/40 px-2 py-0.5 rounded-full font-mono">
                      当前: <strong className="text-purple-200">{selectedHero.name}</strong> · 当前心智: <strong className="text-amber-300">{selectedHero.personalityCustomName || selectedHero.personality || '未设定性格'}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    点击下方任意角色头像可实时切换配置目标，所有系统与通用自定义性格均支持自由赋予任意角色
                  </span>
                </div>

                {/* Horizontal Hero Selector Ribbon */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
                  {heroines.map((hero) => {
                    const isTarget = hero.id === selectedHero.id;
                    return (
                      <button
                        key={hero.id}
                        type="button"
                        onClick={() => {
                          ultraAudio.playUiClick();
                          onSelectHero(hero);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
                          isTarget
                            ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                            : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full overflow-hidden border border-white/20 shrink-0 bg-black/60">
                          {hero.customPortrait ? (
                            <img src={hero.customPortrait} alt={hero.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[9px] bg-purple-900 text-white">
                              {hero.name[0]}
                            </div>
                          )}
                        </div>
                        <span className="truncate max-w-[90px]">{hero.name}</span>
                        <span className="text-[9px] opacity-75 font-mono px-1 py-0.2 rounded bg-black/30">
                          {hero.personalityCustomName || hero.personality || '傲娇'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Built-in Preset Universal Selection */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>系统通用性格预设库 (System Universal Personality Presets)</span>
                      <span className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-700 px-2 py-0.5 rounded-full font-mono">
                        {presetPersonalities.length} 套可用 Preset
                      </span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRestoreDefaultPresetPersonalities}
                      className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                      title="重置恢复所有系统默认预设性格"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>恢复默认预设性格</span>
                    </button>

                    <span className="text-[11px] text-zinc-400">
                      当前生效: <strong className="text-purple-400">{selectedHero.personalityCustomName || selectedHero.personality || '未设定性格'}</strong>
                    </span>
                  </div>
                </div>

                {presetPersonalities.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500 space-y-2">
                    <p className="text-xs">系统预设性格库已被清空</p>
                    <button
                      type="button"
                      onClick={handleRestoreDefaultPresetPersonalities}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded bg-amber-600/30 text-amber-300 border border-amber-500/50 text-xs font-bold hover:bg-amber-600/50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>一键恢复全部预设性格</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {presetPersonalities.map((def) => {
                      const isSelected = (selectedHero.personality || 'tsundere') === def.id;

                      return (
                        <div
                          key={def.id}
                          className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-2.5 ${
                            isSelected
                              ? 'bg-purple-950/70 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                              : 'bg-zinc-900/80 border-zinc-800'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-zinc-100 flex items-center space-x-1.5">
                                <span>{def.icon}</span>
                                <span>{def.name}</span>
                              </span>
                              <div className="flex items-center space-x-1.5">
                                {isSelected && (
                                  <span className="text-[10px] bg-purple-500 text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>生效中</span>
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => handleDeletePresetPersonality(def.id, def.name, e)}
                                  className="p-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-500 hover:text-rose-400 hover:border-rose-500/50 transition-colors cursor-pointer"
                                  title={`删除预设性格【${def.name}】`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-[11px] text-zinc-300 leading-relaxed bg-zinc-950/50 p-2 rounded border border-zinc-800/40 break-words">
                              {def.description}
                            </p>
                            {def.tone && (
                              <p className="text-[10px] text-amber-300/90 break-words">
                                🗣️ 口吻: {def.tone}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1">
                              {def.tags.map((tag) => (
                                <span key={tag} className="text-[9px] bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-300">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  ultraAudio.playUiClick();
                                  const updated = applyPersonalityToHero(selectedHero, def.id, customPersonalitySlots);
                                  onUpdateHero(updated);
                                }}
                                className={`py-1 px-1.5 rounded text-[10px] font-bold transition-all text-center cursor-pointer ${
                                  isSelected ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' : 'bg-purple-600 hover:bg-purple-500 text-white'
                                }`}
                                title={`套用到当前选择的角色【${selectedHero.name}】`}
                              >
                                套用给【{selectedHero.name}】
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`确定要将预设性格【${def.name}】一键赋予角色库全员 ${heroines.length} 位英雄吗？`)) {
                                    ultraAudio.playUiClick();
                                    const newList = heroines.map((h) => applyPersonalityToHero(h, def.id, customPersonalitySlots));
                                    if (onUpdateAllHeroes) onUpdateAllHeroes(newList);
                                    else newList.forEach((h) => onUpdateHero(h));
                                    alert(`已成功将预设【${def.name}】套用给全部 ${heroines.length} 位在役角色！`);
                                  }
                                }}
                                className="py-1 px-1.5 rounded text-[10px] font-bold bg-zinc-800 hover:bg-amber-900/60 text-amber-200 border border-zinc-700 transition-all text-center cursor-pointer"
                                title="一键套用到角色库全员英雄"
                              >
                                库全员 ({heroines.length})
                              </button>
                            </div>

                            {/* Specific Hero Selector Dropdown */}
                            <div className="flex items-center gap-1">
                              <select
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  const targetHero = heroines.find((h) => h.id === e.target.value);
                                  if (targetHero) {
                                    ultraAudio.playUiClick();
                                    const updated = applyPersonalityToHero(targetHero, def.id, customPersonalitySlots);
                                    onUpdateHero(updated);
                                    alert(`已将性格预设【${def.name}】赋予【${targetHero.name}】！`);
                                  }
                                  e.target.value = '';
                                }}
                                defaultValue=""
                                className="w-full py-1 px-1.5 rounded text-[10px] bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-purple-500/50 outline-none cursor-pointer"
                              >
                                <option value="" disabled>👉 赋予指定角色...</option>
                                {heroines.map((h) => (
                                  <option key={h.id} value={h.id}>
                                    赋予: {h.name} (当前: {h.personalityCustomName || h.personality || '傲娇'})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Custom Personality Slots Universal Collection Manager */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-purple-900/70 space-y-4 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <Bookmark className="w-4 h-4 text-purple-400 animate-pulse" />
                    <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>💎 通用自定义性格槽位库 (Universal Saved Custom Slots)</span>
                      <span className="text-[10px] text-zinc-400 bg-purple-950/80 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                        已存 {customPersonalitySlots.length} 个通用槽位
                      </span>
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleExportPersonalitySlots}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="导出备份自定义性格预设库 JSON"
                    >
                      <Download className="w-3.5 h-3.5 text-purple-400" />
                      <span>导出库</span>
                    </button>

                    <label
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="导入性格槽位预设 JSON"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-400" />
                      <span>导入库</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportPersonalitySlots}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleRestoreDefaultPersonalitySlots}
                      className="px-2 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="重置恢复默认性格槽位"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveCurrentAsSlot}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 text-xs font-bold transition-all cursor-pointer"
                      title="将当前角色的自定义性格参数保存为一个新通用槽位"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>存当前为新槽位</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenNewSlotForm}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-[0_0_12px_rgba(168,85,247,0.4)] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新建性格槽位</span>
                    </button>
                  </div>
                </div>

                {/* Inline Slot Creator / Editor Form */}
                {isSlotFormOpen && (
                  <div className="bg-zinc-900/90 border border-purple-500/60 rounded-xl p-4 space-y-3.5 animate-fade-in shadow-lg">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <h4 className="text-xs font-bold text-purple-300 flex items-center space-x-1.5">
                        <FolderPlus className="w-4 h-4 text-purple-400" />
                        <span>{editingSlotId ? '编辑通用自定义性格槽位' : '创建新通用自定义性格槽位'}</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setIsSlotFormOpen(false)}
                        className="text-zinc-500 hover:text-zinc-300 text-xs p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-[11px] font-bold text-zinc-300">槽位性格名称 / 称号:</label>
                        <input
                          type="text"
                          value={slotNameInput}
                          onChange={(e) => setSlotNameInput(e.target.value)}
                          placeholder="例如: 冷酷、温柔、傲娇..."
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-purple-200 focus:border-purple-500 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-zinc-300">图标 / Emoji:</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={slotIconInput}
                            onChange={(e) => setSlotIconInput(e.target.value)}
                            className="w-16 bg-zinc-950 border border-zinc-700 rounded text-center py-1 text-xs text-zinc-100 focus:border-purple-500 outline-none"
                          />
                          <div className="flex gap-1 overflow-x-auto text-xs">
                            {['👑', '🖤', '🌸', '❄️', '⚡', '⚔️', '⛓️', '🔥', '💎', '💋', '😶'].map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => setSlotIconInput(e)}
                                className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 hover:border-purple-500 hover:text-white"
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-300">性格简述 / 设定说明:</label>
                      <input
                        type="text"
                        value={slotDescInput}
                        onChange={(e) => setSlotDescInput(e.target.value)}
                        placeholder="描述该性格在审讯、遭受攻击或日常互动中的反差和心理特征..."
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 focus:border-purple-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-amber-300">专属口吻与语气癖好 (Tone):</label>
                        <input
                          type="text"
                          value={slotToneInput}
                          onChange={(e) => setSlotToneInput(e.target.value)}
                          placeholder="例如: 第一人称‘本宫’，说话带有急促喘息与断续娇嗔..."
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-amber-200 focus:border-purple-500 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-blue-300">性格标签 (逗号分割):</label>
                        <input
                          type="text"
                          value={slotTagsInput}
                          onChange={(e) => setSlotTagsInput(e.target.value)}
                          placeholder="嘴硬, 高傲, 容易害羞, 服从底线..."
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 focus:border-purple-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-purple-300">核心 AI 指导 Prompt 指令 (Prompt Directive):</label>
                      <textarea
                        rows={2}
                        value={slotPromptInput}
                        onChange={(e) => setSlotPromptInput(e.target.value)}
                        placeholder="输入发送给 Gemini AI 模型的性格指导 Prompt..."
                        className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-zinc-100 focus:border-purple-500 outline-none font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsSlotFormOpen(false)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSlotForm}
                        disabled={!slotNameInput.trim()}
                        className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-1"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{editingSlotId ? '更新保存槽位' : '存入槽位库'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Grid of Saved Custom Personality Slots */}
                {customPersonalitySlots.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500 space-y-2">
                    <p className="text-xs">暂无已保存的自定义性格槽位</p>
                    <button
                      type="button"
                      onClick={handleOpenNewSlotForm}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded bg-purple-600/30 text-purple-300 border border-purple-500/50 text-xs font-bold hover:bg-purple-600/50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新建第一个性格槽位</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {customPersonalitySlots.map((slot) => {
                      const isApplied = selectedHero.personality === slot.id || selectedHero.personalityCustomName === slot.name;

                      return (
                        <div
                          key={slot.id}
                          className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-2.5 ${
                            isApplied
                              ? 'bg-purple-950/70 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-1 ring-purple-500/50'
                              : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-purple-200 flex items-center space-x-1.5">
                                <span>{slot.icon || '✨'}</span>
                                <span>{slot.name}</span>
                              </span>
                              {isApplied && (
                                <span className="text-[10px] bg-purple-500 text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>生效中</span>
                                </span>
                              )}
                            </div>

                            {slot.description && (
                              <p className="text-[11px] text-zinc-300 leading-relaxed bg-zinc-950/50 p-2 rounded border border-zinc-800/40 break-words">
                                {slot.description}
                              </p>
                            )}

                            {slot.tone && (
                              <p className="text-[10px] text-amber-300/90 break-words">
                                🗣️ 口吻: {slot.tone}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-1">
                              {slot.tags?.map((tag) => (
                                <span key={tag} className="text-[9px] bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 text-purple-300">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  ultraAudio.playUiClick();
                                  const updated = applyPersonalityToHero(selectedHero, slot.id, customPersonalitySlots);
                                  onUpdateHero(updated);
                                }}
                                className={`py-1 px-1.5 rounded text-[10px] font-bold transition-all text-center cursor-pointer ${
                                  isApplied ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50' : 'bg-purple-600 hover:bg-purple-500 text-white'
                                }`}
                                title={`套用到当前选择的角色【${selectedHero.name}】`}
                              >
                                套用给【{selectedHero.name}】
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`确定要将通用自定义性格【${slot.name}】一键赋予角色库全员 ${heroines.length} 位英雄吗？`)) {
                                    ultraAudio.playUiClick();
                                    const newList = heroines.map((h) => applyPersonalityToHero(h, slot.id, customPersonalitySlots));
                                    if (onUpdateAllHeroes) onUpdateAllHeroes(newList);
                                    else newList.forEach((h) => onUpdateHero(h));
                                    alert(`已成功将通用自定义性格【${slot.name}】套用给全部 ${heroines.length} 位在役角色！`);
                                  }
                                }}
                                className="py-1 px-1.5 rounded text-[10px] font-bold bg-zinc-800 hover:bg-amber-900/60 text-amber-200 border border-zinc-700 transition-all text-center cursor-pointer"
                                title="一键套用到角色库全员"
                              >
                                库全员 ({heroines.length})
                              </button>
                            </div>

                            {/* Specific Hero Selector Dropdown */}
                            <div className="flex items-center gap-1">
                              <select
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  const targetHero = heroines.find((h) => h.id === e.target.value);
                                  if (targetHero) {
                                    ultraAudio.playUiClick();
                                    const updated = applyPersonalityToHero(targetHero, slot.id, customPersonalitySlots);
                                    onUpdateHero(updated);
                                    alert(`已将通用自定义性格【${slot.name}】赋予【${targetHero.name}】！`);
                                  }
                                  e.target.value = '';
                                }}
                                defaultValue=""
                                className="w-full py-1 px-1.5 rounded text-[10px] bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-purple-500/50 outline-none cursor-pointer"
                              >
                                <option value="" disabled>👉 赋予指定角色...</option>
                                {heroines.map((h) => (
                                  <option key={h.id} value={h.id}>
                                    赋予: {h.name} (当前: {h.personalityCustomName || h.personality || '傲娇'})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center justify-end gap-1.5 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditSlotForm(slot)}
                                className="flex-1 py-1 px-2 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-purple-300 hover:border-purple-500/50 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>编辑槽位</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteCustomSlot(slot.id, slot.name)}
                                className="py-1 px-2 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/50 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Live Character Personality Customizer */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-purple-900/60 space-y-4 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-2.5 gap-2">
                  <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>🤖 当前角色性格直通微调 (Live Customizer: {selectedHero.name})</span>
                  </h4>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        const newList = heroines.map((h) => ({
                          ...h,
                          personalityCustomName: selectedHero.personalityCustomName,
                          personalityTone: selectedHero.personalityTone,
                          personalityCustomPrompt: selectedHero.personalityCustomPrompt,
                          personalityCustomTags: selectedHero.personalityCustomTags ? [...selectedHero.personalityCustomTags] : [],
                        }));
                        if (onUpdateAllHeroes) onUpdateAllHeroes(newList);
                        else newList.forEach((h) => onUpdateHero(h));
                      }}
                      className="px-2.5 py-1 rounded bg-purple-950 border border-purple-700/60 text-purple-200 text-[10px] font-bold hover:bg-purple-900/80 cursor-pointer transition-all"
                      title="将当前角色的性格名字、Tone、Prompt 与标签同步覆盖至全员角色"
                    >
                      同步至全部成员
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        const newList = heroines.map((h) => ({
                          ...h,
                          personalityCustomName: selectedHero.personalityCustomName,
                          personalityTone: selectedHero.personalityTone,
                          personalityCustomPrompt: selectedHero.personalityCustomPrompt,
                          personalityCustomTags: selectedHero.personalityCustomTags ? [...selectedHero.personalityCustomTags] : [],
                        }));
                        if (onUpdateAllHeroes) onUpdateAllHeroes(newList);
                        else newList.forEach((h) => onUpdateHero(h));
                      }}
                      className="px-2.5 py-1 rounded bg-amber-950 border border-amber-700/60 text-amber-200 text-[10px] font-bold hover:bg-amber-900/80 cursor-pointer transition-all"
                      title="将当前角色的性格设置同步覆盖至角色库全员"
                    >
                      同步至角色库全员
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveCurrentAsSlot}
                      className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/40 px-2.5 py-1 rounded font-mono font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3 h-3" />
                      <span>存为通用槽位</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Custom Personality Title / Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-300 flex items-center space-x-1">
                      <span>✨ 自定义性格称号 / 类型名称:</span>
                    </label>
                    <DebouncedInput
                      value={selectedHero.personalityCustomName || ''}
                      onChange={(val) => {
                        commitHero({ ...selectedHero, personalityCustomName: val }, false);
                      }}
                      placeholder="如: 傲娇神圣侍卫、外冷内热受虐狂姬、堕落审判官..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-purple-200 focus:border-purple-500 outline-none"
                    />
                    <p className="text-[10px] text-zinc-500">此名称将作为 API 聊天的核心人设头衔显示并注入 Prompt。</p>
                  </div>

                  {/* Speech Tone & Mannerisms */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-300 flex items-center space-x-1">
                      <span>🗣️ 专属口吻习惯与发声癖好:</span>
                    </label>
                    <DebouncedInput
                      value={selectedHero.personalityTone || ''}
                      onChange={(val) => {
                        commitHero({ ...selectedHero, personalityTone: val }, false);
                      }}
                      placeholder="如: 第一人称‘本宫’/‘老娘’，说话带有急促喘息、不甘的娇嗔与轻微发抖..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-amber-200 focus:border-purple-500 outline-none"
                    />
                    <p className="text-[10px] text-zinc-500">指导 AI 模型在对话响应时采用的专属语气、语气词与标点习惯。</p>
                  </div>
                </div>

                {/* Core Personality AI System Guidance Prompt */}
                <div className="space-y-1 pt-1">
                  <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                    <span className="flex items-center space-x-1 text-blue-300 font-bold">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                      <span>🎯 核心·完全自定义性格人设 AI 指导 Prompt (Prompt Directive):</span>
                    </span>
                    <span className="text-[10px] text-zinc-400">100% 深度影响 API 聊天与实时审讯交互</span>
                  </label>
                  <DebouncedPromptTextarea
                    rows={3}
                    value={selectedHero.personalityCustomPrompt || ''}
                    onChange={(val) => {
                      commitHero({ ...selectedHero, personalityCustomPrompt: val }, false);
                    }}
                    placeholder="输入详细的性格心理与行为Prompt，例如：
‘面对敌人时表现得高傲绝不认输，自尊心极强；受强烈刺激或弱点受创时会发出不甘的低吟喘息；在服从度或色情度高时嘴硬但身体诚实，称对方为【支配者大人】；在审讯对讲中表达出纠结、自尊崩解与依恋的复杂心态...’"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 outline-none font-mono leading-relaxed"
                  />
                  <p className="text-[10px] text-zinc-500 leading-normal">
                    💡 提示：此处填写的完全自定义性格 Prompt 将实时同步传递至后台 Gemini API 聊天 / 审讯响应模型，使 AI 聊天完美还原你设定的角色性格与心理防线变化！
                  </p>
                </div>
              </div>

              {/* Custom Tags & General Personality Settings */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center space-x-2">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                  <span>个性标签与设定关键词 (逗号分割)</span>
                </h4>
                <div className="flex gap-2">
                  <DebouncedInput
                    value={selectedHero.personalityCustomTags?.join('，') || ''}
                    onChange={(val) => {
                      const tags = val.split(/[,，]/).map(t => t.trim()).filter(Boolean);
                      commitHero({ ...selectedHero, personalityCustomTags: tags }, false);
                    }}
                    placeholder="输入个性标签，如：嘴硬、口嫌体正直、高傲、容易害羞..."
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-100 focus:border-purple-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      const presetLines = getVoiceLinesForPersonality(selectedHero.personality || 'tsundere');
                      commitHero({ ...selectedHero, voiceLines: presetLines }, true);
                    }}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded text-xs font-bold cursor-pointer transition-all"
                  >
                    恢复当前性格预设台词
                  </button>
                </div>
              </div>

              {/* Combat Sound Effect & Audio Pitch Settings */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center space-x-2">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>🔊 战术打击音效与频率调校 (Combat Impact SFX Engine)</span>
                  </h4>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-bold">
                    纯物理打击/能量打击音效模式
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Voice Pitch Control */}
                  <div>
                    <div className="flex justify-between text-xs text-zinc-300 mb-1">
                      <span>战术打击谐振频率/音高 multiplier:</span>
                      <strong className="text-amber-400 font-mono">{(selectedHero.voicePitch || 1.0).toFixed(2)}x</strong>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-zinc-500">沉重(重型)</span>
                      <input
                        type="range"
                        min="0.7"
                        max="1.5"
                        step="0.05"
                        value={selectedHero.voicePitch || 1.0}
                        onChange={(e) => {
                          const pitch = parseFloat(e.target.value);
                          onUpdateHero({ ...selectedHero, voicePitch: pitch });
                        }}
                        className="flex-1 accent-amber-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                      />
                      <span className="text-[10px] text-zinc-500">清脆(轻型)</span>
                    </div>
                  </div>

                  {/* Test SFX Button */}
                  <div className="flex items-end space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        ultraAudio.playImpactSFX();
                      }}
                      className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(245,158,11,0.3)] cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>💥 试听重型战术物理打击音效</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        ultraAudio.playLaserSFX();
                      }}
                      className="px-2.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-300 rounded-lg text-xs font-bold transition-all border border-zinc-700 cursor-pointer"
                      title="试听光束音效"
                    >
                      ⚡ 试听光束
                    </button>
                  </div>
                </div>
              </div>

              {/* Detailed Voice Lines Category & Custom Editor */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                  <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>特定战术反应与角色独家台词编辑库</span>
                  </h4>
                  <span className="text-[11px] text-zinc-500">
                    为不同受击/审讯场景定制专属高能台词
                  </span>
                </div>

                {/* Voice Line Category Filter Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {VOICE_LINE_CATEGORIES.map((cat) => {
                    const isCurrentCat = selectedVoiceCategory === cat.id;
                    const linesCount = selectedHero.voiceLines[cat.id]?.length || 0;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          ultraAudio.playUiClick();
                          setSelectedVoiceCategory(cat.id);
                        }}
                        className={`p-2 rounded border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                          isCurrentCat
                            ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'
                        }`}
                      >
                        <span className="flex items-center space-x-1.5 truncate">
                          <span>{cat.icon}</span>
                          <span className="truncate">{cat.label}</span>
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isCurrentCat ? 'bg-purple-800 text-purple-200' : 'bg-zinc-950 text-zinc-500'}`}>
                          {linesCount}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Voice Lines List for Selected Category */}
                <div className="space-y-3 pt-2 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center space-x-1.5">
                      <span>{VOICE_LINE_CATEGORIES.find(c => c.id === selectedVoiceCategory)?.icon}</span>
                      <span>分类「{VOICE_LINE_CATEGORIES.find(c => c.id === selectedVoiceCategory)?.label}」列表:</span>
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      提示: 点击可直接编辑修改具体文本台词
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                    {(selectedHero.voiceLines[selectedVoiceCategory] || []).map((line, idx) => (
                      <VoiceLineItem
                        key={`${selectedVoiceCategory}_${idx}`}
                        initialValue={line}
                        index={idx}
                        onCommit={(newVal) => {
                          const currentLines = selectedHero.voiceLines[selectedVoiceCategory] || [];
                          if (currentLines[idx] === newVal) return;
                          const catList = [...currentLines];
                          catList[idx] = newVal;
                          commitHero({
                            ...selectedHero,
                            voiceLines: {
                              ...selectedHero.voiceLines,
                              [selectedVoiceCategory]: catList,
                            },
                          }, false);
                        }}
                        onDelete={() => {
                          ultraAudio.playUiClick();
                          const catList = (selectedHero.voiceLines[selectedVoiceCategory] || []).filter((_, i) => i !== idx);
                          commitHero({
                            ...selectedHero,
                            voiceLines: {
                              ...selectedHero.voiceLines,
                              [selectedVoiceCategory]: catList,
                            },
                          }, true);
                        }}
                      />
                    ))}

                    {(!selectedHero.voiceLines[selectedVoiceCategory] || selectedHero.voiceLines[selectedVoiceCategory]?.length === 0) && (
                      <div className="text-center py-4 text-xs text-zinc-500 italic">
                        当前分类下暂无台词，请在下方添加自定义台词。
                      </div>
                    )}
                  </div>

                  {/* Add New Line Form */}
                  <div className="flex gap-2 pt-2 border-t border-zinc-800">
                    <input
                      type="text"
                      value={newLineText}
                      onChange={(e) => setNewLineText(e.target.value)}
                      placeholder={`输入新增的「${VOICE_LINE_CATEGORIES.find(c => c.id === selectedVoiceCategory)?.label}」台词...`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newLineText.trim()) {
                          ultraAudio.playUiClick();
                          const existing = selectedHero.voiceLines[selectedVoiceCategory] || [];
                          commitHero({
                            ...selectedHero,
                            voiceLines: {
                              ...selectedHero.voiceLines,
                              [selectedVoiceCategory]: [...existing, newLineText.trim()],
                            },
                          }, true);
                          setNewLineText('');
                        }
                      }}
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-100 focus:border-purple-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newLineText.trim()) return;
                        ultraAudio.playUiClick();
                        const existing = selectedHero.voiceLines[selectedVoiceCategory] || [];
                        commitHero({
                          ...selectedHero,
                          voiceLines: {
                            ...selectedHero.voiceLines,
                            [selectedVoiceCategory]: [...existing, newLineText.trim()],
                          },
                        }, true);
                        setNewLineText('');
                      }}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold cursor-pointer transition-all shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新增台词</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Custom Voice Trigger Keyword Settings (自定义语音触发关键词与战术条件库) */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-2.5 gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center space-x-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>⚡ 自定义语音触发关键词 & 战术条件库 ({selectedHero.name})</span>
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      设定攻击特定受击部位或达到高额伤害/属性阈值时的专属触发词与反馈，极度贴合个性特征
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      handleAddCustomTrigger();
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ 新增语音触发规则</span>
                  </button>
                </div>

                {/* Triggers Cards List */}
                <div className="space-y-4">
                  {triggers.length === 0 ? (
                    <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-lg p-6 text-center space-y-2">
                      <Zap className="w-8 h-8 text-zinc-600 mx-auto" />
                      <p className="text-xs text-zinc-400 font-bold">暂无自定义语音触发关键词规则</p>
                      <p className="text-[11px] text-zinc-500">
                        点击上方“新增语音触发规则”按钮，可为特定攻击部位或暴击伤害设置定制化的性格语音触发词！
                      </p>
                    </div>
                  ) : (
                    triggers.map((trig, trigIdx) => {
                      const inputVal = newTriggerInputs[trig.id] || '';

                      return (
                        <div
                          key={trig.id}
                          className={`p-3.5 rounded-xl border transition-all space-y-3 ${
                            trig.enabled
                              ? 'bg-zinc-900/90 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
                              : 'bg-zinc-950 border-zinc-800/80 opacity-60'
                          }`}
                        >
                          {/* Rule Header Row */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                            <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
                              <button
                                type="button"
                                onClick={() => {
                                  ultraAudio.playUiClick();
                                  handleUpdateTrigger(trig.id, { enabled: !trig.enabled });
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  trig.enabled
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                                }`}
                              >
                                {trig.enabled ? '🟢 已激活' : '⚪ 已停用'}
                              </button>

                              <span className="text-xs text-zinc-500 font-mono">#{trigIdx + 1}</span>

                              <input
                                type="text"
                                value={trig.name}
                                onChange={(e) => handleUpdateTrigger(trig.id, { name: e.target.value })}
                                placeholder="输入触发规则名称 (例如: 魔能值受击反应)..."
                                className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-xs text-amber-200 font-bold focus:border-amber-400 outline-none"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                ultraAudio.playUiClick();
                                handleDeleteTrigger(trig.id);
                              }}
                              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-950/80 border border-rose-800 text-rose-300 hover:bg-rose-900 transition-all text-xs cursor-pointer"
                              title="删除此规则"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>删除规则</span>
                            </button>
                          </div>

                          {/* Condition Configuration Bar */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800/80 text-xs">
                            {/* Condition Type Selector */}
                            <div>
                              <label className="block text-[11px] text-zinc-400 mb-1 font-bold">
                                触发条件类型 (`conditionType`)
                              </label>
                              <select
                                value={trig.conditionType}
                                onChange={(e) =>
                                  handleUpdateTrigger(trig.id, {
                                    conditionType: e.target.value as TriggerConditionType,
                                  })
                                }
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 font-bold focus:border-amber-400 outline-none cursor-pointer"
                              >
                                <option value="bodyPart">🎯 特定攻击部位 (Body Part)</option>
                                <option value="damageThreshold">💥 伤害数值阈值 (Damage Threshold)</option>
                                <option value="statThreshold">📊 状态属性逻辑 (Stat Threshold)</option>
                              </select>
                            </div>

                            {/* Conditional Settings Fields */}
                            {trig.conditionType === 'bodyPart' && (
                              <div className="sm:col-span-2">
                                <label className="block text-[11px] text-blue-300 mb-1 font-bold">
                                  选择特定受击部位 (`targetPartId`)
                                </label>
                                <select
                                  value={trig.targetPartId || Object.keys(selectedHero.bodyParts)[0]}
                                  onChange={(e) => handleUpdateTrigger(trig.id, { targetPartId: e.target.value })}
                                  className="w-full bg-zinc-900 border border-blue-500/50 rounded px-2 py-1 text-blue-200 font-bold focus:border-blue-400 outline-none cursor-pointer"
                                >
                                  {Object.entries(selectedHero.bodyParts).map(([pId, conf]) => (
                                    <option key={pId} value={pId}>
                                      {conf.name || BODY_PART_LABELS[pId] || pId}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {trig.conditionType === 'damageThreshold' && (
                              <div className="sm:col-span-2">
                                <div className="flex justify-between text-[11px] text-rose-300 mb-1 font-bold">
                                  <span>触发最小伤害阈值 (`minDamage`)</span>
                                  <span className="text-amber-400">≥ {trig.minDamage || 20} HP</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="range"
                                    min="5"
                                    max="50"
                                    step="1"
                                    value={trig.minDamage || 20}
                                    onChange={(e) =>
                                      handleUpdateTrigger(trig.id, { minDamage: parseInt(e.target.value) })
                                    }
                                    className="flex-1 accent-rose-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                                  />
                                  <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={trig.minDamage || 20}
                                    onChange={(e) =>
                                      handleUpdateTrigger(trig.id, { minDamage: parseInt(e.target.value) || 1 })
                                    }
                                    className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-center text-xs text-rose-300 font-bold"
                                  />
                                </div>
                              </div>
                            )}

                            {trig.conditionType === 'statThreshold' && (
                              <div className="sm:col-span-2 grid grid-cols-3 gap-1.5">
                                <div>
                                  <label className="block text-[10px] text-zinc-400 mb-1">关联属性</label>
                                  <select
                                    value={trig.statType || 'hp'}
                                    onChange={(e) => handleUpdateTrigger(trig.id, { statType: e.target.value as any })}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-zinc-200"
                                  >
                                    <option value="hp">生命值 (HP)</option>
                                    <option value="energy">魔能值 (Energy)</option>
                                    <option value="morale">意志力 (Morale)</option>
                                    <option value="shame">羞耻度 (Shame)</option>
                                    <option value="obedience">信任值 (Trust/Obedience)</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] text-zinc-400 mb-1">比较判定</label>
                                  <select
                                    value={trig.statComparison || 'lessThan'}
                                    onChange={(e) => handleUpdateTrigger(trig.id, { statComparison: e.target.value as any })}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-zinc-200"
                                  >
                                    <option value="lessThan">≤ 低于阈值</option>
                                    <option value="greaterThan">≥ 高于阈值</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] text-zinc-400 mb-1">数值 (%)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={trig.statThreshold ?? 30}
                                    onChange={(e) => handleUpdateTrigger(trig.id, { statThreshold: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-zinc-200 font-bold"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Trigger Lines / Keyword Phrases List */}
                          <div className="space-y-2 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800">
                            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                              <span>触发文本 / 关键词台词库 ({trig.lines.length} 条):</span>
                              <span className="text-[10px] text-zinc-500 font-normal">
                                触发时将从中随机或匹配生成反馈台词
                              </span>
                            </div>

                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                              {trig.lines.map((line, lineIdx) => (
                                <div key={lineIdx} className="flex items-center gap-2 bg-zinc-900 p-1.5 rounded border border-zinc-800">
                                  <span className="text-[10px] text-amber-400/80 font-mono w-4 text-right">
                                    {lineIdx + 1}.
                                  </span>
                                  <input
                                    type="text"
                                    value={line}
                                    onChange={(e) => handleUpdateTriggerLine(trig.id, lineIdx, e.target.value)}
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-400 outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      ultraAudio.playUiClick();
                                      handleDeleteLineFromTrigger(trig.id, lineIdx);
                                    }}
                                    className="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                                    title="删除此条关键词台词"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}

                              {trig.lines.length === 0 && (
                                <div className="text-center py-2 text-xs text-zinc-500 italic">
                                  暂无触发台词，请在下方添加。
                                </div>
                              )}
                            </div>

                            {/* Add Line Input Form */}
                            <div className="flex gap-2 pt-1.5 border-t border-zinc-800">
                              <input
                                type="text"
                                value={inputVal}
                                onChange={(e) =>
                                  setNewTriggerInputs((prev) => ({ ...prev, [trig.id]: e.target.value }))
                                }
                                placeholder="输入符合性格设定的专属触发关键词台词..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && inputVal.trim()) {
                                    ultraAudio.playUiClick();
                                    handleAddLineToTrigger(trig.id, inputVal);
                                    setNewTriggerInputs((prev) => ({ ...prev, [trig.id]: '' }));
                                  }
                                }}
                                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-100 focus:border-amber-400 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (!inputVal.trim()) return;
                                  ultraAudio.playUiClick();
                                  handleAddLineToTrigger(trig.id, inputVal);
                                  setNewTriggerInputs((prev) => ({ ...prev, [trig.id]: '' }));
                                }}
                                className="flex items-center space-x-1 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold cursor-pointer transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>添加台词</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'factions' && (
            <FactionManagerTab
              factions={factions}
              onUpdateFactions={onUpdateFactions || (() => {})}
              heroines={heroines}
              onUpdateHero={onUpdateHero}
              onUpdateAllHeroes={onUpdateAllHeroes}
            />
          )}

          {activeTab === 'envWeakness' && (
            <div className="space-y-4">
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-3 gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center space-x-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>⚡ 可自定义环境弱点 & 战术联动配置 ({selectedHero.name})</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      配置不同环境主题（如强酸蚀刻、高温熔岩、极寒冰冻等）下的特定部位受击弱点与倍率。被攻击对应弱点时，角色会触发专属战术台词！
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        handleRestoreDefaultEnvWeaknesses();
                      }}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold cursor-pointer transition-all border border-zinc-700"
                    >
                      恢复角色初始环境弱点
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        handleAddEnvWeakness();
                      }}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ 新增环境弱点规则</span>
                    </button>
                  </div>
                </div>

                {/* Env Weaknesses List */}
                <div className="space-y-4">
                  {envWeaknesses.length === 0 ? (
                    <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-lg p-6 text-center space-y-2">
                      <TestTube className="w-8 h-8 text-zinc-600 mx-auto" />
                      <p className="text-xs text-zinc-400 font-bold">暂未设置环境弱点联动规则</p>
                      <p className="text-[11px] text-zinc-500">
                        点击上方“新增环境弱点规则”按钮，即可为特定环境（如强酸、冰冻、高温）设置部位受击弱点与专属娇嗔台词！
                      </p>
                    </div>
                  ) : (
                    envWeaknesses.map((ew, ewIdx) => {
                      const inputVal = newEnvWeaknessInputs[ew.id] || '';

                      return (
                        <div
                          key={ew.id}
                          className={`p-4 rounded-xl border transition-all space-y-3 ${
                            ew.enabled
                              ? 'bg-zinc-900/90 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                              : 'bg-zinc-950 border-zinc-800/80 opacity-60'
                          }`}
                        >
                          {/* Header Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                            <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
                              <button
                                type="button"
                                onClick={() => {
                                  ultraAudio.playUiClick();
                                  handleUpdateEnvWeakness(ew.id, { enabled: !ew.enabled });
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  ew.enabled
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                                }`}
                              >
                                {ew.enabled ? '🟢 已激活' : '⚪ 已停用'}
                              </button>

                              <span className="text-xs text-zinc-500 font-mono">#{ewIdx + 1}</span>

                              <input
                                type="text"
                                value={ew.name}
                                onChange={(e) => handleUpdateEnvWeakness(ew.id, { name: e.target.value })}
                                placeholder="输入环境弱点名称 (例如: 强酸致蚀软化)..."
                                className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-xs text-amber-200 font-bold focus:border-amber-400 outline-none"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                ultraAudio.playUiClick();
                                handleDeleteEnvWeakness(ew.id);
                              }}
                              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-950/80 border border-rose-800 text-rose-300 hover:bg-rose-900 transition-all text-xs cursor-pointer"
                              title="删除此规则"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>删除</span>
                            </button>
                          </div>

                          {/* Trigger Criteria Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-zinc-950/80 p-3 rounded-lg border border-zinc-800 text-xs">
                            {/* Environment Theme */}
                            <div>
                              <label className="block text-[10px] text-zinc-400 mb-1">触发生效环境</label>
                              <select
                                value={ew.envTheme || 'acid'}
                                onChange={(e) =>
                                  handleUpdateEnvWeakness(ew.id, { envTheme: e.target.value as EnvironmentTheme })
                                }
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-amber-300 font-bold"
                              >
                                <option value="any">🌐 任意环境主题</option>
                                <option value="acid">🧪 强酸侵蚀 (Acid Bath)</option>
                                <option value="lava">🔥 炽热熔岩 (Lava Foundry)</option>
                                <option value="cryo">❄️ 极寒冰冻 (Cryo Freeze)</option>
                                <option value="glass">💎 强化琉璃 (Glass Sanctum)</option>
                                <option value="metal">⚙️ 赛博金属 (Cyber Metal)</option>
                                <option value="plasma">⚡ 离子等离子 (Plasma Grid)</option>
                                <option value="void">🌌 暗物质虚空 (Void Realm)</option>
                              </select>
                            </div>

                            {/* Target Body Part */}
                            <div>
                              <label className="block text-[10px] text-zinc-400 mb-1">脆弱受击部位</label>
                              <select
                                value={ew.targetPartId || 'any'}
                                onChange={(e) => handleUpdateEnvWeakness(ew.id, { targetPartId: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-blue-300 font-bold"
                              >
                                <option value="any">🎯 任意部位</option>
                                {Object.entries(selectedHero.bodyParts).map(([pId, pCfg]) => (
                                  <option key={pId} value={pId}>
                                    {pCfg.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Weapon Category */}
                            <div>
                              <label className="block text-[10px] text-zinc-400 mb-1">联动武器分类</label>
                              <select
                                value={ew.weaponCategory || 'any'}
                                onChange={(e) => handleUpdateEnvWeakness(ew.id, { weaponCategory: e.target.value as any })}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
                              >
                                <option value="any">⚔️ 任意分类</option>
                                <option value="attack">⚔️ 高能攻击</option>
                                <option value="touch">♥ 敏感触碰</option>
                                <option value="hypnosis">🌀 催眠真言</option>
                                <option value="restraint">⛓️ 反重力束缚</option>
                                <option value="drain">⚡ 光能抽离</option>
                              </select>
                            </div>

                            {/* Damage Multiplier */}
                            <div>
                              <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1">
                                <span>伤害叠加倍率</span>
                                <div className="flex items-center space-x-1">
                                  <input
                                    type="number"
                                    min="0.1"
                                    step="any"
                                    value={ew.damageMultiplier || 1.5}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      if (!isNaN(val) && val >= 0) {
                                        handleUpdateEnvWeakness(ew.id, { damageMultiplier: val });
                                      }
                                    }}
                                    className="w-14 bg-zinc-900 border border-amber-500/50 rounded px-1 py-0.5 text-[11px] text-amber-400 font-bold text-right focus:outline-none"
                                  />
                                  <span className="text-amber-400 text-xs font-bold">x</span>
                                </div>
                              </div>
                              <input
                                type="range"
                                min="0.1"
                                max={Math.max(10, (ew.damageMultiplier || 1.5) > 8 ? Math.ceil((ew.damageMultiplier || 1.5) * 1.5) : 10)}
                                step="0.1"
                                value={ew.damageMultiplier || 1.5}
                                onChange={(e) =>
                                  handleUpdateEnvWeakness(ew.id, { damageMultiplier: parseFloat(e.target.value) })
                                }
                                className="w-full accent-amber-500 h-2 bg-zinc-800 rounded cursor-pointer mt-1"
                              />
                            </div>
                          </div>

                          {/* Specific Reaction Voice Lines List */}
                          <div className="space-y-2 pt-1">
                            <label className="block text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center space-x-1">
                              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                              <span>触发环境弱点时的专属语音/娇嗔反应台词库 ({ew.lines.length}条)</span>
                            </label>

                            <div className="space-y-1.5 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 max-h-40 overflow-y-auto">
                              {ew.lines.map((line, lineIdx) => (
                                <div key={lineIdx} className="flex items-center space-x-2">
                                  <span className="text-[10px] text-zinc-600 font-mono">{lineIdx + 1}.</span>
                                  <input
                                    type="text"
                                    value={line}
                                    onChange={(e) => {
                                      const newLines = [...ew.lines];
                                      newLines[lineIdx] = e.target.value;
                                      handleUpdateEnvWeakness(ew.id, { lines: newLines });
                                    }}
                                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-400 outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      ultraAudio.playUiClick();
                                      handleDeleteLineFromEnvWeakness(ew.id, lineIdx);
                                    }}
                                    className="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                                    title="删除此条台词"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}

                              {ew.lines.length === 0 && (
                                <div className="text-center py-2 text-xs text-zinc-500 italic">
                                  暂无触发台词，请在下方添加。
                                </div>
                              )}
                            </div>

                            {/* Add Line Input */}
                            <div className="flex gap-2 pt-1 border-t border-zinc-800">
                              <input
                                type="text"
                                value={inputVal}
                                onChange={(e) =>
                                  setNewEnvWeaknessInputs((prev) => ({ ...prev, [ew.id]: e.target.value }))
                                }
                                placeholder="输入命中此环境弱点时的专属语音台词..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && inputVal.trim()) {
                                    ultraAudio.playUiClick();
                                    handleAddLineToEnvWeakness(ew.id, inputVal);
                                  }
                                }}
                                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-100 focus:border-amber-400 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (!inputVal.trim()) return;
                                  ultraAudio.playUiClick();
                                  handleAddLineToEnvWeakness(ew.id, inputVal);
                                }}
                                className="flex items-center space-x-1 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold cursor-pointer transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>添加台词</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'heroRelationships' && (
            <div className="space-y-6">
              {/* Header Info Banner */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-pink-900/60 space-y-2.5 shadow-[0_0_20px_rgba(236,72,153,0.15)]">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2 flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-pink-400 animate-pulse" />
                    <h3 className="text-xs font-bold text-pink-300 uppercase tracking-wider">
                      👥 自定义角色间人际关系与社会纽带 ({selectedHero.name})
                    </h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-zinc-400 bg-pink-950/80 border border-pink-500/30 px-2 py-0.5 rounded-full">
                      已建立 {selectedHero.heroRelationships?.length || 0} 条角色纽带
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsRelImportModalOpen(true)}
                      className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-pink-500/40 text-[11px] text-pink-300 font-bold flex items-center space-x-1 transition-all cursor-pointer"
                      title="导入角色关系卡"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>导入关系卡</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportHeroRelationships}
                      className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-pink-500/40 text-[11px] text-pink-300 font-bold flex items-center space-x-1 transition-all cursor-pointer"
                      title="导出关系卡 JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>导出关系卡</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyHeroRelationshipsJson}
                      className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-300 hover:text-white flex items-center space-x-1 transition-all cursor-pointer"
                      title="复制关系卡数据"
                    >
                      <span>{relCopiedNotice ? '✅ 已复制' : '📋 复制JSON'}</span>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  你可以为【<strong className="text-pink-300">{selectedHero.name}</strong>】自由自定义与列表中其他角色之间的社会关系（例如：生死战友、宿敌对手、保护者与被保护者、崇拜的前辈等）。
                  系统绝不预设任何死板固定的关系，完全由你在创建/修改角色时自主设定，并实时同步给后台 AI 提示词引擎！
                </p>
              </div>

              {otherHeroes.length === 0 ? (
                <div className="bg-zinc-950 p-8 rounded-xl border border-zinc-800 text-center space-y-3">
                  <Users className="w-10 h-10 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400">
                    目前战术小队中只有【<strong>{selectedHero.name}</strong>】1 位角色，无法建立角色对角色的人际关系。
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    💡 请在主界面的【管理与角色选择】功能中点击“添加自定义角色”新建新角色后，再返回此页面为角色之间建立丰富的感情羁绊！
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Create / Edit Relationship Form */}
                  <div className="bg-zinc-950 p-4 rounded-xl border border-pink-500/40 space-y-4 shadow-lg">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <h4 className="text-xs font-bold text-pink-300 flex items-center space-x-1.5">
                        <FolderPlus className="w-4 h-4 text-pink-400" />
                        <span>{editingRelTargetId ? '编辑对特定角色的关系设定' : '建立/添加对其他角色的新关系纽带'}</span>
                      </h4>
                      {editingRelTargetId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRelTargetId(null);
                            setRelTypeInput('');
                            setRelDescInput('');
                            setRelToneInput('');
                          }}
                          className="text-[10px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                        >
                          取消编辑
                        </button>
                      )}
                    </div>

                    {/* Quick Preset Buttons & Custom Preset Manager */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-zinc-300 flex items-center space-x-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>快捷填入关系分类与预设模板:</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsAddingRelPreset(true)}
                          className="text-[10px] text-pink-400 hover:text-pink-300 flex items-center space-x-1 cursor-pointer font-bold"
                        >
                          <Plus className="w-3 h-3" />
                          <span>新增自定义关系模板</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {customRelPresets.map((preset) => (
                          <div key={preset.id || preset.title} className="group relative inline-flex items-center">
                            <button
                              type="button"
                              onClick={() => handleSelectPresetRel(preset)}
                              className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 hover:border-pink-500/70 hover:bg-pink-950/40 text-[11px] text-zinc-200 hover:text-pink-300 transition-all cursor-pointer"
                            >
                              {preset.title}
                            </button>
                            {customRelPresets.length > 3 && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteRelPreset(preset.id, e)}
                                className="hidden group-hover:flex items-center justify-center absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-600 text-white text-[9px] cursor-pointer"
                                title="删除该模板"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Add Custom Preset Inline Form */}
                    {isAddingRelPreset && (
                      <div className="bg-zinc-900 p-3 rounded-lg border border-pink-500/40 space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between text-xs font-bold text-pink-300">
                          <span>✨ 新建自定义人际关系分类模板</span>
                          <button
                            type="button"
                            onClick={() => setIsAddingRelPreset(false)}
                            className="text-zinc-400 hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={newPresetTitle}
                            onChange={(e) => setNewPresetTitle(e.target.value)}
                            placeholder="模板按钮标签 (如: 💖 灵魂契约)"
                            className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-pink-500 outline-none"
                          />
                          <input
                            type="text"
                            value={newPresetType}
                            onChange={(e) => setNewPresetType(e.target.value)}
                            placeholder="关系名称/类型 (如: 灵魂契约伴侣)"
                            className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-pink-500 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={newPresetDesc}
                            onChange={(e) => setNewPresetDesc(e.target.value)}
                            placeholder="渊源背景说明 (如: 灵魂相连，生死契阔...)"
                            className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-pink-500 outline-none"
                          />
                          <input
                            type="text"
                            value={newPresetTone}
                            onChange={(e) => setNewPresetTone(e.target.value)}
                            placeholder="互动态度语气 (如: 极度依恋，深情呼唤...)"
                            className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-pink-500 outline-none"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAddingRelPreset(false)}
                            className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 cursor-pointer"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveCustomRelPreset}
                            disabled={!newPresetTitle.trim() || !newPresetType.trim()}
                            className="px-3 py-1 rounded bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                          >
                            保存模板
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Target Hero Selector */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-300">1. 选择关联的目标角色:</label>
                        <select
                          value={relTargetHeroId || (otherHeroes[0] ? otherHeroes[0].id : '')}
                          onChange={(e) => setRelTargetHeroId(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-pink-300 font-bold focus:border-pink-500 outline-none cursor-pointer"
                        >
                          {factions.map((f) => {
                            const factionHeroes = otherHeroes.filter((oh) => oh.factionId === f.id);
                            if (factionHeroes.length === 0) return null;
                            return (
                              <optgroup key={f.id} label={`【${f.name}】`}>
                                {factionHeroes.map((oh) => (
                                  <option key={oh.id} value={oh.id}>
                                    {oh.name} ({oh.title || oh.factionRole || '在役角色'})
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}

                          {/* Unassigned Heroes Optgroup */}
                          {(() => {
                            const unassigned = otherHeroes.filter((oh) => isHeroUnassigned(oh, factions));
                            if (unassigned.length === 0) return null;
                            return (
                              <optgroup label="【未指定阵营 · 自由游侠】">
                                {unassigned.map((oh) => (
                                  <option key={oh.id} value={oh.id}>
                                    {oh.name} ({oh.title || '独立角色'})
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })()}
                        </select>
                      </div>

                      {/* Relationship Type Name */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-pink-300">2. 关系定位/称号称呼:</label>
                        <input
                          type="text"
                          value={relTypeInput}
                          onChange={(e) => setRelTypeInput(e.target.value)}
                          placeholder="如: 生死战友、宿敌对手、保护者与被保护者、秘密羁绊..."
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-100 focus:border-pink-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Relationship Background Description */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-300">3. 关系背景渊源与深层故事 (Background):</label>
                        <input
                          type="text"
                          value={relDescInput}
                          onChange={(e) => setRelDescInput(e.target.value)}
                          placeholder="如: 曾一起在仙女座会战中并肩作战，救过对方一命，相互信任托付后背..."
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 focus:border-pink-500 outline-none"
                        />
                      </div>

                      {/* Interaction Attitude & Tone */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-amber-300">4. 面对该角色时的语气口吻与态度 (Attitude):</label>
                        <input
                          type="text"
                          value={relToneInput}
                          onChange={(e) => setRelToneInput(e.target.value)}
                          placeholder="如: 关切护短，表面嘴硬打趣，目睹对方受创会极为暴怒关心..."
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-amber-200 focus:border-pink-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                      <label className="flex items-center space-x-2 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={relBiSync}
                          onChange={(e) => setRelBiSync(e.target.checked)}
                          className="accent-pink-500 w-3.5 h-3.5 rounded cursor-pointer"
                        />
                        <span>同时为目标角色自动创建/更新反向对应的关系纽带 (双向同步)</span>
                      </label>

                      <button
                        type="button"
                        onClick={handleSaveRelationship}
                        disabled={!relTypeInput.trim()}
                        className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-[0_0_12px_rgba(236,72,153,0.4)] cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{editingRelTargetId ? '更新关系设定' : '保存角色关系纽带'}</span>
                      </button>
                    </div>
                  </div>

                  {/* List of Existing Defined Relationships */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center space-x-2">
                      <Bookmark className="w-4 h-4 text-pink-400" />
                      <span>【{selectedHero.name}】已建立的角色人际关系列表</span>
                    </h4>

                    {(!selectedHero.heroRelationships || selectedHero.heroRelationships.length === 0) ? (
                      <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-800 text-center text-zinc-500 text-xs">
                        暂未定义任何角色间的关系纽带。请在上方选择目标角色并输入关系定位后点击“保存角色关系纽带”。
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedHero.heroRelationships.map((rel) => {
                          const targetHero = heroines.find((h) => h.id === rel.targetHeroId);
                          const targetName = targetHero ? targetHero.name : rel.targetHeroName || rel.targetHeroId;

                          return (
                            <div
                              key={rel.targetHeroId}
                              className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 hover:border-pink-500/50 transition-all space-y-2"
                            >
                              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-bold text-zinc-200">
                                    【{selectedHero.name}】 ➔ 【<span className="text-pink-300">{targetName}</span>】
                                  </span>
                                  <span className="text-[10px] bg-pink-950/80 text-pink-300 border border-pink-500/40 px-2 py-0.5 rounded font-bold">
                                    {rel.relationType}
                                  </span>
                                </div>

                                <div className="flex items-center space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditRelationship(rel)}
                                    className="p-1 rounded bg-zinc-900 text-zinc-400 hover:text-pink-300 hover:border-pink-500/50 cursor-pointer text-xs"
                                    title="编辑"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRelationship(rel.targetHeroId, true)}
                                    className="p-1 rounded bg-zinc-900 text-zinc-400 hover:text-rose-400 cursor-pointer text-xs"
                                    title="删除 (同时双向清理)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {rel.description && (
                                <p className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
                                  📖 背景渊源: {rel.description}
                                </p>
                              )}

                              {rel.attitudeTone && (
                                <p className="text-[10px] text-amber-300/90 font-mono">
                                  🗣️ 互动态度口吻: {rel.attitudeTone}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Import Modal for Hero Relationships */}
              {isRelImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                  <div className="bg-zinc-950 border border-pink-500/50 rounded-xl max-w-lg w-full p-4 space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <div className="flex items-center space-x-2 text-pink-300 font-bold text-sm">
                        <Upload className="w-4 h-4 text-pink-400" />
                        <span>📥 导入角色人际关系卡 (JSON)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRelImportModalOpen(false);
                          setRelImportError(null);
                          setRelImportSuccess(null);
                        }}
                        className="text-zinc-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-zinc-400">
                      请将导出的角色关系卡 JSON 数据粘贴在下方，或者上传对应的 <code>.json</code> 文件：
                    </p>

                    <textarea
                      value={relImportJsonText}
                      onChange={(e) => {
                        setRelImportJsonText(e.target.value);
                        setRelImportError(null);
                      }}
                      placeholder='{\n  "version": "1.0",\n  "relationships": [\n    {\n      "targetHeroId": "...",\n      "relationType": "生死战友",\n      "description": "...",\n      "attitudeTone": "..."\n    }\n  ]\n}'
                      rows={6}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-200 font-mono focus:border-pink-500 outline-none"
                    />

                    <div className="flex items-center justify-between">
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const content = ev.target?.result as string;
                              setRelImportJsonText(content);
                            };
                            reader.readAsText(file);
                          }
                        }}
                        className="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                      />
                    </div>

                    {relImportError && (
                      <div className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-800/60 flex items-center space-x-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{relImportError}</span>
                      </div>
                    )}

                    {relImportSuccess && (
                      <div className="text-xs text-emerald-400 bg-emerald-950/40 p-2 rounded border border-emerald-800/60 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{relImportSuccess}</span>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setIsRelImportModalOpen(false)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 cursor-pointer"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleImportHeroRelationships}
                        disabled={!relImportJsonText.trim()}
                        className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                      >
                        确认导入
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-4">
              {/* Global Parameter Controls */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">环境物理与武器倍率参数</h3>

                {/* Weakness Sensitivity */}
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>弱点打击敏感度全局倍率</span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={customSettings.weaknessMultiplier}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            onChangeSettings({
                              ...customSettings,
                              weaknessMultiplier: val,
                            });
                          }
                        }}
                        className="w-16 bg-zinc-900 border border-amber-500/50 rounded px-1.5 py-0.5 text-xs text-amber-400 font-bold text-right focus:outline-none"
                      />
                      <span className="text-amber-400">x</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max={Math.max(10, customSettings.weaknessMultiplier > 8 ? Math.ceil(customSettings.weaknessMultiplier * 1.5) : 10)}
                    step="0.1"
                    value={customSettings.weaknessMultiplier}
                    onChange={(e) =>
                      onChangeSettings({
                        ...customSettings,
                        weaknessMultiplier: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                  />
                </div>

                {/* Sensitive Area Multiplier */}
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>发情敏感调校效果倍率 (羞耻度/信任值增长)</span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={customSettings.sensitiveMultiplier || 2.5}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            onChangeSettings({
                              ...customSettings,
                              sensitiveMultiplier: val,
                            });
                          }
                        }}
                        className="w-16 bg-zinc-900 border border-fuchsia-500/50 rounded px-1.5 py-0.5 text-xs text-fuchsia-400 font-bold text-right focus:outline-none"
                      />
                      <span className="text-fuchsia-400">x</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max={Math.max(10, (customSettings.sensitiveMultiplier || 2.5) > 8 ? Math.ceil((customSettings.sensitiveMultiplier || 2.5) * 1.5) : 10)}
                    step="0.1"
                    value={customSettings.sensitiveMultiplier || 2.5}
                    onChange={(e) =>
                      onChangeSettings({
                        ...customSettings,
                        sensitiveMultiplier: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-fuchsia-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                  />
                </div>

                {/* Physics Shake Force */}
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>物理受击震动与后坐力程度</span>
                    <span className="text-rose-400">{customSettings.physicsShakeForce}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.25"
                    value={customSettings.physicsShakeForce}
                    onChange={(e) =>
                      onChangeSettings({
                        ...customSettings,
                        physicsShakeForce: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-rose-500 h-1.5 bg-zinc-800 rounded"
                  />
                </div>

                {/* Dialogue Font Size Customization */}
                <div className="bg-zinc-950 p-3 rounded-xl border border-purple-900/50 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="flex items-center space-x-1.5 text-purple-300">
                      <Type className="w-4 h-4 text-purple-400" />
                      <span>对话与终端字体大小自定义 (Dialogue Font Size)</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-950 border border-purple-500/50 text-purple-200 font-mono text-xs">
                      {customSettings.dialogueFontSize || 14}px
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      min="11"
                      max="24"
                      step="1"
                      value={customSettings.dialogueFontSize || 14}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        localStorage.setItem('ultrawoman_dialogue_font_size', String(val));
                        onChangeSettings({
                          ...customSettings,
                          dialogueFontSize: val,
                        });
                      }}
                      className="flex-1 accent-purple-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-zinc-500 font-bold">快速字号预设:</span>
                    {[
                      { label: '小 (12px)', val: 12 },
                      { label: '标准 (14px)', val: 14 },
                      { label: '大 (16px)', val: 16 },
                      { label: '特大 (18px)', val: 18 },
                      { label: '巨型 (20px)', val: 20 },
                      { label: '超巨型 (22px)', val: 22 },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => {
                          ultraAudio.playUiClick();
                          localStorage.setItem('ultrawoman_dialogue_font_size', String(preset.val));
                          onChangeSettings({
                            ...customSettings,
                            dialogueFontSize: preset.val,
                          });
                        }}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                          (customSettings.dialogueFontSize || 14) === preset.val
                            ? 'bg-purple-900 border-purple-400 text-purple-100 font-bold shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-purple-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    💡 提示：修改后，审讯终端、综合对话气泡、状态反馈与质问台词等字号将实时同步更新并保存至浏览器。
                  </p>
                </div>

                {/* Console Height & Width Mode Customization */}
                <div className="bg-zinc-950 p-3 rounded-xl border border-indigo-900/50 space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="flex items-center space-x-1.5 text-indigo-300">
                      <MoveVertical className="w-4 h-4 text-indigo-400" />
                      <span>审讯对话框高度/加长控制 (Console Height)</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-500/50 text-indigo-200 font-mono text-xs">
                      {customSettings.consoleHeight || 650}px
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      min="400"
                      max="1200"
                      step="50"
                      value={customSettings.consoleHeight || 650}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        localStorage.setItem('ultrawoman_console_height', String(val));
                        onChangeSettings({
                          ...customSettings,
                          consoleHeight: val,
                        });
                      }}
                      className="flex-1 accent-indigo-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-zinc-500 font-bold">加长高度预设:</span>
                    {[
                      { label: '标准 (520px)', val: 520 },
                      { label: '加大 (650px)', val: 650 },
                      { label: '长屏 (800px)', val: 800 },
                      { label: '巨幅 (1000px)', val: 1000 },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => {
                          ultraAudio.playUiClick();
                          localStorage.setItem('ultrawoman_console_height', String(preset.val));
                          onChangeSettings({
                            ...customSettings,
                            consoleHeight: preset.val,
                          });
                        }}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                          (customSettings.consoleHeight || 650) === preset.val
                            ? 'bg-indigo-900 border-indigo-400 text-indigo-100 font-bold shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-indigo-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-zinc-800/80 pt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300">对话框拓宽模式 (Console Width Mode):</span>
                    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5 text-xs">
                      {[
                        { label: '7列标准', val: 'normal' },
                        { label: '12列拓宽', val: 'wide' },
                        { label: '沉浸全屏', val: 'full' },
                      ].map((wItem) => (
                        <button
                          key={wItem.val}
                          type="button"
                          onClick={() => {
                            ultraAudio.playUiClick();
                            localStorage.setItem('ultrawoman_console_width_mode', wItem.val);
                            onChangeSettings({
                              ...customSettings,
                              consoleWidthMode: wItem.val as any,
                            });
                          }}
                          className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                            (customSettings.consoleWidthMode || 'normal') === wItem.val
                              ? 'bg-indigo-900 border border-indigo-500/60 text-indigo-100 shadow'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {wItem.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Manual Regional Body Part Health & Damage Recovery Controls */}
              <div className="space-y-3 border-t border-zinc-800 pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>部位损毁度 (Part Damage) 与技能修复控制器 ({selectedHero.name})</span>
                    </h3>
                    <p className="text-[10px] text-zinc-400">💡 提示：现已支持在战斗中使用【治愈/护理类技能】直接对部位进行照射修复；此处亦支持手动调控与一键完全修复/爆破</p>
                  </div>

                  {/* Global One-click Repair Buttons */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        (Object.keys(selectedHero.bodyParts) as BodyPartId[]).forEach((pId) => {
                          onUpdatePartDamage(pId, 0);
                        });
                      }}
                      className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-950 border border-emerald-500/80 text-emerald-200 hover:bg-emerald-900 transition-all cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.3)] flex items-center space-x-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                      <span>💚 一键完全修复所有部位 (0%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        (Object.keys(selectedHero.bodyParts) as BodyPartId[]).forEach((pId) => {
                          onUpdatePartDamage(pId, 100);
                        });
                      }}
                      className="px-2 py-1 rounded text-xs font-bold bg-rose-950 border border-rose-800 text-rose-300 hover:bg-rose-900 transition-all cursor-pointer"
                    >
                      <span>💥 全爆破 (100%)</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(Object.entries(selectedHero.bodyParts) as [BodyPartId, BodyPartConfig][]).map(([pId, conf]) => {
                    const val = partDamage[pId] || 0;
                    return (
                      <div key={pId} className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-zinc-200">{(conf?.name || pId).split(' ')[0]}</span>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] text-zinc-500 font-normal">损毁度:</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={Math.round(val)}
                              onChange={(e) => {
                                const newV = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                                onUpdatePartDamage(pId, newV);
                              }}
                              className="w-14 bg-black border border-zinc-700 rounded px-1.5 py-0.5 text-right font-mono text-xs text-amber-300"
                            />
                            <span className="text-amber-400 font-bold">%</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={val}
                            onChange={(e) => onUpdatePartDamage(pId, parseFloat(e.target.value))}
                            className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                          />
                        </div>

                        {/* Quick Repair & Delta Adjust Buttons */}
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-zinc-900">
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                ultraAudio.playUiClick();
                                onUpdatePartDamage(pId, Math.max(0, val - 25));
                              }}
                              className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900 cursor-pointer"
                              title="恢复25%损毁度"
                            >
                              修复 -25%
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                ultraAudio.playUiClick();
                                onUpdatePartDamage(pId, Math.max(0, val - 10));
                              }}
                              className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900 cursor-pointer"
                              title="恢复10%损毁度"
                            >
                              修复 -10%
                            </button>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                ultraAudio.playUiClick();
                                onUpdatePartDamage(pId, 0);
                              }}
                              className="px-1.5 py-0.5 rounded bg-blue-950 border border-blue-700 text-blue-200 hover:bg-blue-900 cursor-pointer font-bold"
                              title="完全修复此部位"
                            >
                              归零修复
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                ultraAudio.playUiClick();
                                onUpdatePartDamage(pId, Math.min(100, val + 25));
                              }}
                              className="px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-800/60 text-rose-300 hover:bg-rose-900 cursor-pointer"
                            >
                              +25%损毁
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-3 bg-zinc-950/60">
          <span className="text-[11px] text-zinc-500">
            自定义的英雄与弱点配置将自动保存于本地存储中
          </span>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              handleModalClose();
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-[0_0_12px_rgba(59,130,246,0.4)]"
          >
            确认并保存配置
          </button>
        </div>
      </div>
    </div>
  );
};
