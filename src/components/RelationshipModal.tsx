import React, { useState, useMemo, useRef } from 'react';
import {
  RelationshipSlot,
  RelationshipState,
  RelationshipCategory,
  Stats,
  Ultrawoman,
  ScenarioConfig,
  ScenarioCategory,
  RelationshipCardExportPackage,
  Faction,
} from '../types';
import { DEFAULT_RELATIONSHIP_SLOTS, NEUTRAL_RELATIONSHIP_SLOT } from '../data/relationships';
import { DEFAULT_FACTIONS } from '../data/factions';
import {
  getRelationshipCategoryTheme,
  checkSlotConditionMatch,
  evaluateBestRelationshipSlot,
  getAllRelationshipSlots,
  saveGlobalRelationshipSlots,
  addDeletedRelationshipSlotId,
  removeDeletedRelationshipSlotId,
  clearDeletedRelationshipSlotIds,
} from '../utils/relationshipUtils';
import { ultraAudio } from '../utils/audio';
import {
  Heart,
  Zap,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  Sliders,
  History,
  X,
  Bot,
  Search,
  Filter,
  Link,
  Users,
  Download,
  Upload,
  FileText,
  UserCheck,
  UserPlus,
  Check,
  AlertCircle,
  Share2,
  Building2,
  Shield,
  Flag,
} from 'lucide-react';

function mapRelCatToScenarioCat(cat: RelationshipCategory): ScenarioCategory {
  switch (cat) {
    case 'pure_love':
      return 'coop';
    case 'evil_enslavement':
      return 'interrogation';
    case 'hypnotic_dependency':
      return 'hypnosis';
    case 'rivalry':
      return 'arena';
    case 'faction_exclusive':
    case 'hero_exclusive':
    case 'custom':
    default:
      return 'custom';
  }
}

interface RelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: Stats;
  hero?: Ultrawoman;
  selectedHero?: Ultrawoman;
  allHeroes?: Ultrawoman[];
  scenarioConfig?: ScenarioConfig;
  allScenarios?: ScenarioConfig[];
  dayCount: number;
  relationshipState: RelationshipState;
  onUpdateRelationshipState: (newState: RelationshipState) => void;
  onSaveCustomScenario?: (scenario: ScenarioConfig) => void;
  onTriggerEval?: () => void;
  onTriggerEvaluationNotification?: (title: string, category: string) => void;
  activeTeamHeroes?: Ultrawoman[];
  onSelectModalHero?: (hero: Ultrawoman) => void;
  getHeroActiveRelationshipTitle?: (heroId: string) => string;
  factions?: Faction[];
}

export const RelationshipModal: React.FC<RelationshipModalProps> = ({
  isOpen,
  onClose,
  stats,
  hero,
  selectedHero,
  allHeroes = [],
  scenarioConfig,
  allScenarios = [],
  dayCount,
  relationshipState,
  onUpdateRelationshipState,
  onSaveCustomScenario,
  onTriggerEval,
  onTriggerEvaluationNotification,
  activeTeamHeroes,
  onSelectModalHero,
  getHeroActiveRelationshipTitle,
  factions = DEFAULT_FACTIONS,
}) => {
  const activeHero = hero || selectedHero;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'slots' | 'history'>('slots');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [heroFilter, setHeroFilter] = useState<string>('all');
  const [factionFilter, setFactionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Import / Export Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [parsedImportSlots, setParsedImportSlots] = useState<RelationshipSlot[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single card export popup state
  const [exportingSlot, setExportingSlot] = useState<RelationshipSlot | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Form states for relationship slot editing / creation
  const [slotTitle, setSlotTitle] = useState('');
  const [slotCategory, setSlotCategory] = useState<RelationshipCategory>('pure_love');
  const [slotDescription, setSlotDescription] = useState('');
  const [slotStylePrompt, setSlotStylePrompt] = useState('');
  const [slotCustomTags, setSlotCustomTags] = useState('纯爱, 守护, 娇羞');
  const [targetHeroId, setTargetHeroId] = useState<string>('any');
  const [targetHeroName, setTargetHeroName] = useState<string>('');
  const [exclusiveCategoryName, setExclusiveCategoryName] = useState<string>('');
  const [targetFactionId, setTargetFactionId] = useState<string>('any');
  const [targetFactionName, setTargetFactionName] = useState<string>('');
  const [targetSubFactionId, setTargetSubFactionId] = useState<string>('any');
  const [targetSubFactionName, setTargetSubFactionName] = useState<string>('');
  const [factionRoleRequired, setFactionRoleRequired] = useState<string>('');
  const [factionCategoryName, setFactionCategoryName] = useState<string>('');
  const [minObedience, setMinObedience] = useState<number | ''>('');
  const [maxObedience, setMaxObedience] = useState<number | ''>('');
  const [minLust, setMinLust] = useState<number | ''>('');
  const [maxLust, setMaxLust] = useState<number | ''>('');
  const [minMorale, setMinMorale] = useState<number | ''>('');
  const [maxMorale, setMaxMorale] = useState<number | ''>('');
  const [minHpPct, setMinHpPct] = useState<number | ''>('');
  const [maxHpPct, setMaxHpPct] = useState<number | ''>('');
  const [minDay, setMinDay] = useState<number | ''>('');
  const [reqScenarioCat, setReqScenarioCat] = useState<string>('any');
  const [reqScenarioId, setReqScenarioId] = useState<string>('any');
  const [syncToScenarioLibrary, setSyncToScenarioLibrary] = useState<boolean>(false);

  // Derive current library slots
  const allSlots = useMemo(() => {
    return getAllRelationshipSlots(relationshipState);
  }, [relationshipState]);

  // Available hero list for selection (combining allHeroes and activeTeamHeroes and activeHero)
  const availableHeroList = useMemo(() => {
    const map = new Map<string, Ultrawoman>();
    if (activeHero) map.set(activeHero.id, activeHero);
    (allHeroes || []).forEach((h) => map.set(h.id, h));
    (activeTeamHeroes || []).forEach((h) => map.set(h.id, h));
    return Array.from(map.values());
  }, [activeHero, allHeroes, activeTeamHeroes]);

  // Active hero's primary faction and memberships
  const activeHeroFaction = useMemo(() => {
    if (!activeHero || !activeHero.factionId) return undefined;
    return factions.find((f) => f.id === activeHero.factionId);
  }, [activeHero, factions]);

  const activeSlot = allSlots.find((s) => s.id === relationshipState.activeSlotId) || allSlots[0] || NEUTRAL_RELATIONSHIP_SLOT;
  const activeTheme = getRelationshipCategoryTheme(activeSlot?.category);

  // Filtered slots list for the library grid
  const filteredSlots = allSlots.filter((slot) => {
    // Category filter
    if (filterCategory !== 'all') {
      if (filterCategory === 'hero_exclusive') {
        if (slot.category !== 'hero_exclusive' && !slot.targetHeroId && !slot.targetHeroName) {
          return false;
        }
      } else if (filterCategory === 'faction_exclusive') {
        if (slot.category !== 'faction_exclusive' && !slot.targetFactionId && !slot.targetFactionName) {
          return false;
        }
      } else if (slot.category !== filterCategory) {
        return false;
      }
    }

    // Hero exclusive specific filter
    if (heroFilter !== 'all') {
      if (heroFilter === 'current_hero') {
        if (activeHero && slot.targetHeroId && slot.targetHeroId !== 'any' && slot.targetHeroId !== activeHero.id) {
          return false;
        }
      } else {
        if (slot.targetHeroId !== heroFilter && slot.targetHeroName !== heroFilter) {
          return false;
        }
      }
    }

    // Faction specific filter
    if (factionFilter !== 'all') {
      if (factionFilter === 'current_hero_factions') {
        if (activeHero) {
          const heroFactionIds = [
            activeHero.factionId,
            ...(activeHero.factionMemberships || []).map((m) => m.factionId),
          ].filter(Boolean);
          if (!slot.targetFactionId || !heroFactionIds.includes(slot.targetFactionId)) {
            return false;
          }
        }
      } else {
        if (slot.targetFactionId !== factionFilter && slot.targetFactionName !== factionFilter) {
          return false;
        }
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = slot.title.toLowerCase().includes(q);
      const matchDesc = slot.description.toLowerCase().includes(q);
      const matchTags = slot.customTags?.some((t) => t.toLowerCase().includes(q));
      const matchPrompt = slot.stylePrompt?.toLowerCase().includes(q);
      const matchHeroName = slot.targetHeroName?.toLowerCase().includes(q);
      const matchHeroCat = slot.exclusiveCategoryName?.toLowerCase().includes(q);
      const matchFactionName = slot.targetFactionName?.toLowerCase().includes(q);
      const matchFactionRole = slot.factionRoleRequired?.toLowerCase().includes(q);
      const matchFactionCat = slot.factionCategoryName?.toLowerCase().includes(q);
      return (
        matchTitle ||
        matchDesc ||
        matchTags ||
        matchPrompt ||
        matchHeroName ||
        matchHeroCat ||
        matchFactionName ||
        matchFactionRole ||
        matchFactionCat
      );
    }
    return true;
  });

  // Helper to commit new slots array
  // lockManual=true 表示这是用户"显式保存/选定"的关系，需要同时锁定它；
  // 否则紧随其后的自动判定(auto_eval)会按数值把它悄悄换成别的槽位，
  // 表现为"刚保存的关系一会儿就不显示了 / 没保持住"。
  const updateLibrarySlots = (newSlots: RelationshipSlot[], newActiveId?: string, lockManual?: boolean) => {
    const nextActiveId =
      newActiveId ||
      (newSlots.some((s) => s.id === relationshipState.activeSlotId)
        ? relationshipState.activeSlotId
        : newSlots[0]?.id || NEUTRAL_RELATIONSHIP_SLOT.id);

    saveGlobalRelationshipSlots(newSlots);

    if (lockManual) {
      const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      const nextTitle = newSlots.find((s) => s.id === nextActiveId)?.title || '自定义关系';
      onUpdateRelationshipState({
        ...relationshipState,
        slots: newSlots,
        activeSlotId: nextActiveId,
        manualOverrideSlotId: nextActiveId,
        isLocked: true,
        lockedAtDay: dayCount,
        historyLogs: [
          {
            id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            timestamp: now,
            dayCount,
            fromTitle: activeSlot.title,
            toTitle: nextTitle,
            triggerType: 'manual_trigger' as const,
            reason: '保存关系预设并立即确立（自动锁定，防止被自动判定覆盖）',
          },
          ...(relationshipState.historyLogs || []),
        ],
      });
      return;
    }

    onUpdateRelationshipState({
      ...relationshipState,
      slots: newSlots,
      activeSlotId: nextActiveId,
    });
  };

  // 1. 手动触发重判定按钮
  const handleTriggerEvaluation = () => {
    ultraAudio.playUiClick();
    ultraAudio.playChimeSFX();

    const evalResult = evaluateBestRelationshipSlot(
      stats,
      activeHero!,
      scenarioConfig,
      allSlots,
      relationshipState.activeSlotId,
      relationshipState.isLocked,
      dayCount,
      relationshipState
    );

    const now = new Date().toLocaleTimeString();
    const newHistory = [
      {
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        dayCount,
        fromTitle: activeSlot.title,
        toTitle: evalResult.selectedSlot.title,
        triggerType: 'manual_button' as const,
        reason: evalResult.matchReason,
      },
      ...(relationshipState.historyLogs || []),
    ];

    onUpdateRelationshipState({
      ...relationshipState,
      slots: allSlots,
      activeSlotId: evalResult.selectedSlot.id,
      historyLogs: newHistory,
    });

    if (onTriggerEval) {
      onTriggerEval();
    }

    if (onTriggerEvaluationNotification) {
      onTriggerEvaluationNotification(evalResult.selectedSlot.title, evalResult.selectedSlot.category);
    }
  };

  // 2. 切换锁定状态
  const handleToggleLock = () => {
    ultraAudio.playUiClick();
    const newLockState = !relationshipState.isLocked;
    const now = new Date().toLocaleTimeString();

    const newHistory = [
      {
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        dayCount,
        fromTitle: activeSlot.title,
        toTitle: activeSlot.title,
        triggerType: 'manual_lock' as const,
        reason: newLockState ? '【锁定关系状态】禁止数值自动重测' : '【解除关系锁定】开启数值自动重测',
      },
      ...(relationshipState.historyLogs || []),
    ];

    onUpdateRelationshipState({
      ...relationshipState,
      isLocked: newLockState,
      lockedAtDay: newLockState ? dayCount : undefined,
      historyLogs: newHistory,
    });
  };

  // 3. 手动选择激活槽位
  const handleSelectSlot = (slot: RelationshipSlot) => {
    ultraAudio.playUiClick();
    if (slot.id === relationshipState.activeSlotId && relationshipState.isLocked) return;

    const now = new Date().toLocaleTimeString();
    const newHistory = [
      {
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: now,
        dayCount,
        fromTitle: activeSlot.title,
        toTitle: slot.title,
        triggerType: 'manual_button' as const,
        reason: '用户手动选择确立该关系并锁定',
      },
      ...(relationshipState.historyLogs || []),
    ];

    onUpdateRelationshipState({
      ...relationshipState,
      activeSlotId: slot.id,
      manualOverrideSlotId: slot.id,
      isLocked: true,
      historyLogs: newHistory,
    });

    if (onTriggerEvaluationNotification) {
      onTriggerEvaluationNotification(slot.title, slot.category);
    }
  };

  // 打开创建新关系预设表单 (支持特定人物专属模式与组织特定模式)
  const handleOpenCreateForm = (
    presetCategory?: RelationshipCategory,
    specificHero?: Ultrawoman,
    specificFaction?: Faction
  ) => {
    ultraAudio.playUiClick();
    const heroToBind = specificHero || (presetCategory === 'hero_exclusive' ? activeHero : undefined);
    const factionToBind = specificFaction || (presetCategory === 'faction_exclusive' ? activeHeroFaction || factions[0] : undefined);
    const cat = presetCategory || (filterCategory === 'hero_exclusive' ? 'hero_exclusive' : filterCategory === 'faction_exclusive' ? 'faction_exclusive' : 'pure_love');

    if (cat === 'hero_exclusive' || heroToBind) {
      const hName = heroToBind?.name || activeHero?.name || '指定角色';
      const hId = heroToBind?.id || activeHero?.id || 'any';
      setSlotTitle(`👤 ${hName}专属·灵魂誓约`);
      setSlotCategory('hero_exclusive');
      setSlotDescription(`与【${hName}】缔结的专属限定羁绊。在此关系下，${hName}展现出独一无二的专属对话语气与深层互动。`);
      setSlotStylePrompt(`【${hName}专属深情恋人风格】对指挥官充满无比真挚的爱意、依赖与温情。称呼对方为"亲爱的"或"守护者"。对话时眼神温情脉脉，语气轻柔动听，带有${hName}特有的娇羞与温柔，在互动中表现出主动依偎撒娇与无条件信任。绝对不使用敌对或受虐辱台词。`);
      setSlotCustomTags(`${hName}专属, 限定羁绊, 灵魂契约, 纯爱誓约`);
      setTargetHeroId(hId);
      setTargetHeroName(hName);
      setExclusiveCategoryName(`${hName}专属契约`);
      setTargetFactionId('any');
      setTargetFactionName('');
      setFactionRoleRequired('');
      setFactionCategoryName('');
    } else if (cat === 'faction_exclusive' || factionToBind) {
      const fName = factionToBind?.name || activeHeroFaction?.name || factions[0]?.name || '指定组织';
      const fId = factionToBind?.id || activeHeroFaction?.id || factions[0]?.id || 'any';
      setSlotTitle(`🏛️ ${fName} · 誓死效忠圣约`);
      setSlotCategory('faction_exclusive');
      setSlotDescription(`身为【${fName}】核心所属成员恪守的誓死羁绊。将组织信条、阵营荣誉与使命奉为最高原则。`);
      setSlotStylePrompt(`【${fName}·神圣誓约忠诚风格】言行举止处处维护【${fName}】的阵营利益与组织信仰。对话中贯彻组织特有的称谓与规章条例，对认可的指挥官或高层充满虔诚效忠与无条件遵从，誓死捍卫阵营荣光。`);
      setSlotCustomTags(`组织专属, ${fName}, 誓死效忠, 阵营使命, 组织信条`);
      setTargetHeroId('any');
      setTargetHeroName('');
      setExclusiveCategoryName('');
      setTargetFactionId(fId);
      setTargetFactionName(fName);
      setFactionRoleRequired('');
      setFactionCategoryName('组织神圣誓约');
    } else {
      setSlotTitle('');
      setSlotCategory(cat);
      setSlotDescription('');
      setSlotStylePrompt('');
      setSlotCustomTags('纯爱, 依赖, 柔情');
      setTargetHeroId('any');
      setTargetHeroName('');
      setExclusiveCategoryName('');
      setTargetFactionId('any');
      setTargetFactionName('');
      setFactionRoleRequired('');
      setFactionCategoryName('');
    }
    setMinObedience('');
    setMaxObedience('');
    setMinLust('');
    setMaxLust('');
    setMinMorale('');
    setMaxMorale('');
    setMinHpPct('');
    setMaxHpPct('');
    setMinDay('');
    setReqScenarioCat('any');
    setReqScenarioId('any');
    setEditingSlotId(null);
    setIsFormOpen(true);
  };

  // 快捷一键套用组织特定关系模板
  const handleApplyFactionExclusiveTemplate = (
    templateKey: 'oath' | 'captive' | 'agent' | 'servant' | 'cyber',
    factionToApply?: Faction
  ) => {
    ultraAudio.playUiClick();
    const f = factionToApply || factions.find((x) => x.id === targetFactionId) || activeHeroFaction || factions[0];
    const fName = f?.name || targetFactionName.trim() || '指定组织';
    const fId = f?.id || (targetFactionId !== 'any' ? targetFactionId : activeHeroFaction?.id || factions[0]?.id || 'any');

    setSlotCategory('faction_exclusive');
    setTargetFactionId(fId);
    setTargetFactionName(fName);
    setTargetHeroId('any');
    setTargetHeroName('');
    setExclusiveCategoryName('');

    switch (templateKey) {
      case 'oath':
        setSlotTitle(`🏛️ ${fName} · 誓死效忠圣约`);
        setFactionCategoryName('同盟神圣誓约');
        setSlotDescription(`身为【${fName}】核心所属成员恪守的誓死羁绊。将组织信条、阵营荣誉与使命奉为最高原则。`);
        setSlotStylePrompt(`【${fName}·神圣誓约忠诚风格】言行举止处处维护【${fName}】的阵营利益与组织信仰。以"为了组织的荣光与宇宙的秩序"为最高准则，与认可的指挥官对话时充满敬畏与清澈的忠贞，自愿立下灵魂圣誓，言语严谨而温柔，誓死捍卫阵营荣光。`);
        setSlotCustomTags(`组织专属, ${fName}, 誓死效忠, 阵营使命, 组织信条`);
        setMinObedience(45);
        setMinMorale(40);
        break;
      case 'captive':
        setSlotTitle(`🌑 ${fName} · 沦陷受俘特派官`);
        setFactionCategoryName('敌方被俘将领');
        setSlotDescription(`身为【${fName}】特派高级将领或密使，在受俘期间面临组织严酷军法与内心防线逐步被攻破的强烈矛盾。`);
        setSlotStylePrompt(`【${fName}·被俘军官动摇风格】深受【${fName}】严苛铁律与组织教条熏陶，起初极度冷酷严厉，视对手为低等文明。但在持续的交互与审视中，不可侵犯的高傲逐渐崩溃，夹杂在"泄露组织绝密必遭严惩"的深层恐惧与对交互者的依附臣服之间，态度复杂动摇。`);
        setSlotCustomTags(`组织专属, ${fName}, 敌方军官, 被俘动摇, 阵营矛盾`);
        setMinLust(30);
        setMaxMorale(55);
        break;
      case 'agent':
        setSlotTitle(`🌐 ${fName} · 敌后潜伏特遣秘密协定`);
        setFactionCategoryName('潜伏特工协定');
        setSlotDescription(`受雇于【${fName}】特勤机构的专属执行契约，在严格保密协议与高压潜伏中建立的默契搭档羁绊。`);
        setSlotStylePrompt(`【${fName}·特遣调查官契约风格】恪守【${fName}】条例与行动代号。对话中带有专业冷峻的战术术语与默契的特勤暗语，将现场一切交互视作最高机密特遣任务，对搭档指令绝对信任且行动迅速干练。`);
        setSlotCustomTags(`组织专属, ${fName}, 特遣搭档, 绝密协议, 战术默契`);
        setMinObedience(40);
        setMinMorale(35);
        break;
      case 'servant':
        setSlotTitle(`⛓️ ${fName} · 阵营归顺服从契约`);
        setFactionCategoryName('组织顺从随从');
        setSlotDescription(`身心彻底脱离旧部，【${fName}】成员全心皈依并甘愿沦为主人的阵营专属服从随从。`);
        setSlotStylePrompt(`【${fName}·阵营皈依臣服风格】尊奉指挥官为组织至高无上的绝对掌控者。言语极尽顺从、卑微与敬畏，将过去【${fName}】的所有骄傲转化为对主人无保留的奉献与伺候。`);
        setSlotCustomTags(`组织专属, ${fName}, 彻底臣服, 阵营皈依, 随从契约`);
        setMinObedience(70);
        setMaxMorale(45);
        break;
      case 'cyber':
        setSlotTitle(`🤖 ${fName} · 组织最高核心协议共鸣`);
        setFactionCategoryName('组织协议共鸣');
        setSlotDescription(`【${fName}】专属的组织中枢共鸣契约，逻辑算法与指令深度链接，执行组织最高战术协议。`);
        setSlotStylePrompt(`【${fName}·核心协议契约风格】话语中带有精密严谨的科技与算法术语，将交互者视作【${fName}】最高授权指挥官。在执行指令时逻辑严密，同时伴随情感核心算力升温，忠实执行所有战术与亲密交互协议。`);
        setSlotCustomTags(`组织专属, ${fName}, 核心协议, 数据共鸣, 战术运算`);
        setMinObedience(40);
        setMinMorale(35);
        break;
    }
  };

  // 快捷一键套用人物专属限定模板
  const handleApplyHeroExclusiveTemplate = (
    templateKey: 'pure_love' | 'tactical' | 'slave' | 'rival' | 'hypno',
    heroToApply?: Ultrawoman
  ) => {
    ultraAudio.playUiClick();
    const h = heroToApply || activeHero;
    const hName = h?.name || targetHeroName.trim() || '指定角色';
    const hId = h?.id || (targetHeroId !== 'any' ? targetHeroId : activeHero?.id || 'any');

    setSlotCategory('hero_exclusive');
    setTargetHeroId(hId);
    setTargetHeroName(hName);
    setExclusiveCategoryName(`${hName}专属契约`);
    setTargetFactionId('any');
    setTargetFactionName('');
    setFactionRoleRequired('');
    setFactionCategoryName('');

    switch (templateKey) {
      case 'pure_love':
        setSlotTitle(`💖 ${hName}专属·纯爱灵魂誓约`);
        setSlotDescription(`在多次生死守护与深情相伴中缔结的真挚纯爱契约，${hName}的身心对你产生无可替代的深切依恋。`);
        setSlotStylePrompt(`【${hName}专属深情纯爱风格】对指挥官充满无比真挚的爱意、温柔与娇羞依赖。称呼指挥官为"亲爱的"、"我的守护者"或专属爱称。对话时眼神脉脉含情，语气轻柔动听，带有${hName}特有的娇羞与温柔，主动展现依偎、轻声撒娇与无条件的爱意关怀。绝对不使用冷漠或敌对台词。`);
        setSlotCustomTags(`${hName}专属, 纯爱契约, 灵魂伴侣, 温柔依恋`);
        setMinObedience(60);
        setMinMorale(40);
        break;
      case 'tactical':
        setSlotTitle(`🛡️ ${hName}专属·生死守护搭档`);
        setSlotDescription(`相互托付生死的专属战术搭档，与【${hName}】拥有坚不可摧的宿命羁绊与英雄默契。`);
        setSlotStylePrompt(`【${hName}专属生死战友风格】将指挥官视为最崇敬与信任的生死搭档。语气坦率、真诚且富有${hName}标志性的英姿与坚定信念，眼神充满崇拜与信赖，随时准备为了指挥官与正义并肩战斗。`);
        setSlotCustomTags(`${hName}专属, 生死搭档, 战友默契, 誓死守护`);
        setMinObedience(35);
        setMinMorale(50);
        break;
      case 'slave':
        setSlotTitle(`😈 ${hName}专属·顺从归顺契约`);
        setSlotDescription(`身心与意志防线彻底归顺，【${hName}】甘愿放弃所有旧日身份，沦为指挥官专属的顺从部属。`);
        setSlotStylePrompt(`【${hName}专属支配臣服风格】尊奉指挥官为至高无上的"主人"。言语极尽顺从、卑微与敬畏，彻底抛弃往日高傲，用臣服体态主动请求主人的奖赏与支配。`);
        setSlotCustomTags(`${hName}专属, 专属随从, 彻底臣服, 主仆印记`);
        setMinObedience(75);
        setMaxMorale(45);
        break;
      case 'rival':
        setSlotTitle(`⚔️ ${hName}专属·高傲宿命之敌`);
        setSlotDescription(`【${hName}】维持着傲骨，视指挥官为毕生宿敌与交锋对手，对抗中交织着动摇与惺惺相惜。`);
        setSlotStylePrompt(`【${hName}专属宿敌对抗风格】目光冷峻高傲，充满对指挥官的争胜心与顽强对抗。即使在被俘或逆境中也咬紧牙关，死死守住战士的尊严，口嫌体正直，隐隐透露出对指挥官实力的认可。`);
        setSlotCustomTags(`${hName}专属, 宿命对手, 骄傲不屈, 傲娇动摇`);
        setMaxObedience(45);
        setMinMorale(40);
        break;
      case 'hypno':
        setSlotTitle(`🌀 ${hName}专属·脑波催眠依恋`);
        setSlotDescription(`潜意识与神经中枢被深度认知改写，【${hName}】对指挥官产生专属的病态盲从与催眠依恋。`);
        setSlotStylePrompt(`【${hName}专属催眠认知改写风格】瞳孔失焦迷离，语气带着梦呓般的空洞与病态盲从。将指挥官的每一句指令视为不可违抗的至高真理，表现出被深度重塑意识后的绝对服从与娇顺。`);
        setSlotCustomTags(`${hName}专属, 催眠依赖, 认知重塑, 绝对盲从`);
        setMinLust(40);
        setMaxObedience(50);
        setMaxMorale(25);
        break;
    }
  };

  // 将任意现有关系预设衍生/绑定为特定角色的专属限定关系
  const handleDeriveHeroExclusive = (slot: RelationshipSlot, specificHero?: Ultrawoman, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    ultraAudio.playUiClick();
    const h = specificHero || activeHero;
    const hName = h?.name || '指定角色';
    const hId = h?.id || 'any';

    const derivedSlot: RelationshipSlot = {
      ...slot,
      id: 'custom_rel_hero_' + Date.now(),
      title: slot.title.startsWith('👤') ? slot.title : `👤 ${hName}专属·${slot.title.replace(/^[^\w\s\u4e00-\u9fa5]+/, '').trim()}`,
      category: 'hero_exclusive',
      targetHeroId: hId,
      targetHeroName: hName,
      exclusiveCategoryName: `${hName}专属契约`,
      targetFactionId: undefined,
      targetFactionName: undefined,
      factionRoleRequired: undefined,
      factionCategoryName: undefined,
      customTags: Array.from(new Set([`${hName}专属`, ...(slot.customTags || []), '人物限定'])),
      description: `【${hName}专属限定】` + slot.description,
      stylePrompt: `【${hName}专属定制语气】` + slot.stylePrompt,
      isCustom: true,
    };

    const newSlots = [derivedSlot, ...allSlots];
    updateLibrarySlots(newSlots, derivedSlot.id);
    handleOpenEditForm(derivedSlot);
  };

  // 将任意现有关系预设衍生/绑定为特定组织的专属限定关系
  const handleDeriveFactionExclusive = (slot: RelationshipSlot, specificFaction?: Faction, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    ultraAudio.playUiClick();
    const f = specificFaction || activeHeroFaction || factions[0];
    const fName = f?.name || '指定组织';
    const fId = f?.id || 'any';

    const derivedSlot: RelationshipSlot = {
      ...slot,
      id: 'custom_rel_fac_' + Date.now(),
      title: slot.title.startsWith('🏛️') ? slot.title : `🏛️ ${fName} · ${slot.title.replace(/^[^\w\s\u4e00-\u9fa5]+/, '').trim()}`,
      category: 'faction_exclusive',
      targetFactionId: fId,
      targetFactionName: fName,
      factionCategoryName: `${fName}专属纽带`,
      targetHeroId: undefined,
      targetHeroName: undefined,
      exclusiveCategoryName: undefined,
      conditions: {
        ...slot.conditions,
        requiredFactionId: fId !== 'any' ? fId : undefined,
      },
      customTags: Array.from(new Set([`组织专属`, fName, ...(slot.customTags || [])])),
      description: `【${fName}组织专属】` + slot.description,
      stylePrompt: `【${fName}组织专属风格与立场】` + slot.stylePrompt,
      isCustom: true,
    };

    const newSlots = [derivedSlot, ...allSlots];
    updateLibrarySlots(newSlots, derivedSlot.id);
    handleOpenEditForm(derivedSlot);
  };

  // 打开编辑现有关系预设
  const handleOpenEditForm = (slot: RelationshipSlot, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    ultraAudio.playUiClick();
    setSlotTitle(slot.title);
    setSlotCategory(slot.category);
    setSlotDescription(slot.description);
    setSlotStylePrompt(slot.stylePrompt);
    setSlotCustomTags(slot.customTags ? slot.customTags.join(', ') : '');
    setTargetHeroId(slot.targetHeroId || 'any');
    setTargetHeroName(slot.targetHeroName || '');
    setExclusiveCategoryName(slot.exclusiveCategoryName || '');
    setTargetFactionId(slot.targetFactionId || 'any');
    setTargetFactionName(slot.targetFactionName || '');
    setTargetSubFactionId(slot.targetSubFactionId || 'any');
    setTargetSubFactionName(slot.targetSubFactionName || '');
    setFactionRoleRequired(slot.factionRoleRequired || '');
    setFactionCategoryName(slot.factionCategoryName || '');
    setMinObedience(slot.conditions?.minObedience ?? '');
    setMaxObedience(slot.conditions?.maxObedience ?? '');
    setMinLust(slot.conditions?.minLust ?? '');
    setMaxLust(slot.conditions?.maxLust ?? '');
    setMinMorale(slot.conditions?.minMorale ?? '');
    setMaxMorale(slot.conditions?.maxMorale ?? '');
    setMinHpPct(slot.conditions?.minHpPct ?? '');
    setMaxHpPct(slot.conditions?.maxHpPct ?? '');
    setMinDay(slot.conditions?.minDay ?? '');
    setReqScenarioCat(slot.conditions?.requiredScenarioCategory || 'any');
    setReqScenarioId(slot.conditions?.requiredScenarioId || 'any');
    setEditingSlotId(slot.id);
    setIsFormOpen(true);
  };

  // 复制预设
  const handleDuplicateSlot = (slot: RelationshipSlot, e: React.MouseEvent) => {
    e.stopPropagation();
    ultraAudio.playUiClick();

    const duplicatedSlot: RelationshipSlot = {
      ...slot,
      id: 'custom_rel_' + Date.now(),
      title: `${slot.title} (副本)`,
      isCustom: true,
    };

    const newSlots = [duplicatedSlot, ...allSlots];
    updateLibrarySlots(newSlots, duplicatedSlot.id);
    handleOpenEditForm(duplicatedSlot);
  };

  // 保存新建或编辑的关系槽位
  const handleSaveSlot = () => {
    if (!slotTitle.trim()) return;
    ultraAudio.playUiClick();

    const tags = slotCustomTags
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const targetId = editingSlotId || 'custom_rel_' + Date.now();

    const isFaction = slotCategory === 'faction_exclusive' || (targetFactionId !== 'any' && Boolean(targetFactionId)) || Boolean(targetFactionName.trim());
    const isHero = slotCategory === 'hero_exclusive' || (targetHeroId !== 'any' && Boolean(targetHeroId)) || Boolean(targetHeroName.trim());

    const updatedSlot: RelationshipSlot = {
      id: targetId,
      title: slotTitle.trim(),
      category: slotCategory,
      description: slotDescription.trim() || '自定义角色关系状态。',
      stylePrompt: slotStylePrompt.trim() || '保持自定义角色语气与回应风格。',
      customTags: tags.length > 0 ? tags : ['自定义'],
      isCustom: true,
      targetHeroId: isHero && targetHeroId !== 'any' ? targetHeroId : undefined,
      targetHeroName: isHero && targetHeroName.trim() ? targetHeroName.trim() : undefined,
      exclusiveCategoryName: isHero && exclusiveCategoryName.trim() ? exclusiveCategoryName.trim() : undefined,
      targetFactionId: isFaction && targetFactionId !== 'any' ? targetFactionId : undefined,
      targetFactionName: isFaction && targetFactionName.trim() ? targetFactionName.trim() : undefined,
      targetSubFactionId: isFaction && targetSubFactionId !== 'any' ? targetSubFactionId : undefined,
      targetSubFactionName: isFaction && targetSubFactionName.trim() ? targetSubFactionName.trim() : undefined,
      factionRoleRequired: isFaction && factionRoleRequired.trim() ? factionRoleRequired.trim() : undefined,
      factionCategoryName: isFaction && factionCategoryName.trim() ? factionCategoryName.trim() : undefined,
      conditions: {
        minObedience: minObedience !== '' ? Number(minObedience) : undefined,
        maxObedience: maxObedience !== '' ? Number(maxObedience) : undefined,
        minLust: minLust !== '' ? Number(minLust) : undefined,
        maxLust: maxLust !== '' ? Number(maxLust) : undefined,
        minMorale: minMorale !== '' ? Number(minMorale) : undefined,
        maxMorale: maxMorale !== '' ? Number(maxMorale) : undefined,
        minHpPct: minHpPct !== '' ? Number(minHpPct) : undefined,
        maxHpPct: maxHpPct !== '' ? Number(maxHpPct) : undefined,
        minDay: minDay !== '' ? Number(minDay) : undefined,
        requiredScenarioCategory: reqScenarioCat !== 'any' ? reqScenarioCat : undefined,
        requiredScenarioId: reqScenarioId !== 'any' ? reqScenarioId : undefined,
        requiredFactionId: isFaction && targetFactionId !== 'any' ? targetFactionId : undefined,
        requiredSubFactionId: isFaction && targetSubFactionId !== 'any' ? targetSubFactionId : undefined,
        requiredFactionRole: isFaction && factionRoleRequired.trim() ? factionRoleRequired.trim() : undefined,
      },
    };

    // ⚡ 联动同步：如果在开局预设库中未找到对应关联，且开启了同步，在【开局剧情预设库】中自动增改对应开局
    if (syncToScenarioLibrary && onSaveCustomScenario) {
      const categoryTheme = getRelationshipCategoryTheme(slotCategory);
      const syncScenarioId = `custom_sc_from_${targetId}`;
      const syncScenario: ScenarioConfig = {
        id: syncScenarioId,
        name: `🚀 ${slotTitle.trim()}`,
        icon: categoryTheme.icon || '✨',
        category: mapRelCatToScenarioCat(slotCategory),
        description: slotDescription.trim() || `由羁绊【${slotTitle.trim()}】联动生成的开局场景。`,
        interrogatorIdentity: '关系互动对象',
        openingPrompt: `【开局剧情与羁绊导引：${slotTitle.trim()}】\n${slotStylePrompt.trim()}`,
        boundRelationshipSlotId: targetId,
        isCustom: true,
        initialStatsPct: { hpPct: 100, energyPct: 100, moralePct: 50, trustPct: 50, shamePct: 20, lustPct: 20 },
      };
      onSaveCustomScenario(syncScenario);
    }

    if (targetId) {
      removeDeletedRelationshipSlotId(targetId);
    }

    let newSlotsList: RelationshipSlot[] = [];
    const exists = allSlots.some((s) => s.id === targetId);

    if (exists) {
      newSlotsList = allSlots.map((s) => (s.id === targetId ? updatedSlot : s));
    } else {
      newSlotsList = [updatedSlot, ...allSlots];
    }

    updateLibrarySlots(newSlotsList, targetId, true);
    setIsFormOpen(false);
    setEditingSlotId(null);
  };

  // 删除关系槽位
  const handleDeleteSlot = (slotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    ultraAudio.playUiClick();

    if (allSlots.length <= 1) {
      alert('预设库中至少需要保留一个关系预设！');
      return;
    }

    const slotToDelete = allSlots.find((s) => s.id === slotId);
    const slotTitle = slotToDelete ? slotToDelete.title : '该关系预设';

    if (!confirm(`确定要从关系预设库中删除【${slotTitle}】吗？`)) {
      return;
    }

    // 1. 登记到全局已删除黑名单 (防止被默认预设复活)
    addDeletedRelationshipSlotId(slotId);

    // 2. 从当前列表中过滤掉
    const newSlotsList = allSlots.filter((s) => s.id !== slotId);
    const newActiveId =
      relationshipState.activeSlotId === slotId ? newSlotsList[0]?.id || NEUTRAL_RELATIONSHIP_SLOT.id : relationshipState.activeSlotId;

    // 3. 更新预设库与当前生效状态
    updateLibrarySlots(newSlotsList, newActiveId);
  };

  // 重置整个预设库为默认设置
  const handleResetLibrary = () => {
    ultraAudio.playUiClick();
    if (confirm('确定要将关系预设库重置为初始默认设置吗？您所有自定义及修改过的预设将被还原。')) {
      clearDeletedRelationshipSlotIds();
      updateLibrarySlots(DEFAULT_RELATIONSHIP_SLOTS, NEUTRAL_RELATIONSHIP_SLOT.id);
    }
  };

  // ----------------------------------------------------------------
  // 📤 EXPORT FUNCTIONALITY (单张卡片 / 全量关系库)
  // ----------------------------------------------------------------
  const handleExportSingleSlot = (slot: RelationshipSlot, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    ultraAudio.playUiClick();
    setExportingSlot(slot);
  };

  const handleDownloadSlotJson = (slot: RelationshipSlot) => {
    ultraAudio.playUiClick();
    const pkg: RelationshipCardExportPackage = {
      version: '1.0',
      type: 'single_relationship_card',
      exportedAt: new Date().toISOString(),
      author: activeHero?.name || 'Custom Operator',
      count: 1,
      slots: [slot],
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = slot.title.replace(/[\/\\:*?"<>|]/g, '_').trim();
    a.href = url;
    a.download = `relationship_card_${safeTitle}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySlotJson = (slot: RelationshipSlot) => {
    ultraAudio.playUiClick();
    const pkg: RelationshipCardExportPackage = {
      version: '1.0',
      type: 'single_relationship_card',
      exportedAt: new Date().toISOString(),
      author: activeHero?.name || 'Custom Operator',
      count: 1,
      slots: [slot],
    };
    navigator.clipboard.writeText(JSON.stringify(pkg, null, 2));
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleExportFullLibrary = () => {
    ultraAudio.playUiClick();
    const pkg: RelationshipCardExportPackage = {
      version: '1.0',
      type: 'relationship_cards_library',
      exportedAt: new Date().toISOString(),
      author: 'Custom Operator',
      count: allSlots.length,
      slots: allSlots,
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relationship_library_export_${allSlots.length}_cards_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyFullLibraryJson = () => {
    ultraAudio.playUiClick();
    const pkg: RelationshipCardExportPackage = {
      version: '1.0',
      type: 'relationship_cards_library',
      exportedAt: new Date().toISOString(),
      author: 'Custom Operator',
      count: allSlots.length,
      slots: allSlots,
    };
    navigator.clipboard.writeText(JSON.stringify(pkg, null, 2));
    alert(`已将全量关系库 (${allSlots.length} 张关系卡) JSON 数据复制到剪贴板！`);
  };

  // ----------------------------------------------------------------
  // 📥 IMPORT FUNCTIONALITY (支持单卡片 / 批量卡库)
  // ----------------------------------------------------------------
  const handleOpenImportModal = () => {
    ultraAudio.playUiClick();
    setImportJsonText('');
    setImportError(null);
    setImportSuccessMsg(null);
    setParsedImportSlots(null);
    setIsImportModalOpen(true);
  };

  const parseJsonData = (rawText: string) => {
    if (!rawText.trim()) {
      setParsedImportSlots(null);
      setImportError(null);
      return;
    }
    try {
      const parsed = JSON.parse(rawText);
      let slotsToImport: RelationshipSlot[] = [];

      if (Array.isArray(parsed)) {
        slotsToImport = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.slots)) {
          slotsToImport = parsed.slots;
        } else if (parsed.title && (parsed.stylePrompt || parsed.category)) {
          // Single slot format
          slotsToImport = [parsed as RelationshipSlot];
        } else if (parsed.data && Array.isArray(parsed.data)) {
          slotsToImport = parsed.data;
        } else if (parsed.data && parsed.data.title) {
          slotsToImport = [parsed.data];
        }
      }

      if (slotsToImport.length === 0) {
        setImportError('未能识别出有效的关系卡数据，请确认 JSON 格式！');
        setParsedImportSlots(null);
      } else {
        // Validate items
        const sanitized = slotsToImport.map((s, idx) => ({
          id: s.id || `custom_rel_imported_${Date.now()}_${idx}`,
          title: s.title || `导入关系卡 #${idx + 1}`,
          category: s.category || 'custom',
          description: s.description || '导入的角色关系设定',
          stylePrompt: s.stylePrompt || '保持定制语气',
          customTags: Array.isArray(s.customTags) ? s.customTags : ['导入卡片'],
          targetHeroId: s.targetHeroId,
          targetHeroName: s.targetHeroName,
          exclusiveCategoryName: s.exclusiveCategoryName,
          conditions: s.conditions || {},
          isCustom: true,
        }));
        setParsedImportSlots(sanitized);
        setImportError(null);
      }
    } catch (e: any) {
      setImportError(`JSON 解析失败: ${e.message}`);
      setParsedImportSlots(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setImportJsonText(content);
      parseJsonData(content);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = () => {
    if (!parsedImportSlots || parsedImportSlots.length === 0) return;
    ultraAudio.playUiClick();
    ultraAudio.playChimeSFX();

    let nextSlots: RelationshipSlot[] = [];
    if (importMode === 'overwrite') {
      clearDeletedRelationshipSlotIds();
      nextSlots = parsedImportSlots;
    } else {
      parsedImportSlots.forEach((s) => {
        if (s && s.id) removeDeletedRelationshipSlotId(s.id);
      });
      // Merge mode: replace matching IDs, append new ones
      const existingMap = new Map<string, RelationshipSlot>();
      allSlots.forEach((s) => existingMap.set(s.id, s));

      parsedImportSlots.forEach((newSlot) => {
        // If ID exists, assign a new ID to prevent accidental collision unless exactly same
        if (existingMap.has(newSlot.id)) {
          const freshId = `custom_rel_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          existingMap.set(freshId, { ...newSlot, id: freshId });
        } else {
          existingMap.set(newSlot.id, newSlot);
        }
      });

      nextSlots = Array.from(existingMap.values());
    }

    updateLibrarySlots(nextSlots, parsedImportSlots[0]?.id);
    setImportSuccessMsg(`成功导入 ${parsedImportSlots.length} 张关系卡！`);
    setTimeout(() => {
      setIsImportModalOpen(false);
      setParsedImportSlots(null);
      setImportJsonText('');
      setImportSuccessMsg(null);
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-zinc-950 border border-purple-500/40 rounded-xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-[0_0_35px_rgba(168,85,247,0.25)] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-gradient-to-r from-purple-950/60 via-zinc-900 to-rose-950/40">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300">
              <Heart className="w-5 h-5 text-rose-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2 flex-wrap">
                <span>💞 角色关系与绊结预设库 (全自定义 & 人物专属)</span>
                <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                  共 {allSlots.length} 项预设
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                支持纯爱、支配、宿敌、催眠及【自定义人物专属】关系分类，支持单卡与全库导入/导出
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 多人战术小队全员关系分配与切换栏 */}
        {activeTeamHeroes && activeTeamHeroes.length > 1 && (
          <div className="bg-zinc-950/90 border-b border-purple-500/30 p-3 px-4 flex flex-col space-y-2 shrink-0">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5 font-bold text-purple-300">
                <Users className="w-4 h-4 text-purple-400 animate-pulse" />
                <span>👥 在场战术小队全员羁绊关系独立分配面板</span>
              </div>
              <span className="text-[10px] text-zinc-400">点击小队成员可直接为其单独配置与指挥官(玩家)的独立羁绊</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {activeTeamHeroes.map((teamHero) => {
                const isSelected = teamHero.id === activeHero?.id;
                const currentRelTitle = getHeroActiveRelationshipTitle
                  ? getHeroActiveRelationshipTitle(teamHero.id)
                  : (teamHero.id === activeHero?.id ? activeSlot.title : '默认契约');
                return (
                  <button
                    key={teamHero.id}
                    type="button"
                    onClick={() => {
                      if (onSelectModalHero) {
                        ultraAudio.playChimeSFX();
                        onSelectModalHero(teamHero);
                      }
                    }}
                    className={`p-2 rounded-lg border text-left transition-all flex items-center space-x-2 cursor-pointer ${
                      isSelected
                        ? 'bg-purple-950/80 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)] ring-1 ring-purple-400/50'
                        : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-purple-400 animate-ping' : 'bg-zinc-600'}`} />
                    <div className="truncate min-w-0">
                      <div className={`text-xs font-bold truncate ${isSelected ? 'text-purple-200' : 'text-zinc-300'}`}>
                        {teamHero.name}
                      </div>
                      <div className="text-[10px] text-purple-300/80 truncate font-mono">
                        💞 {currentRelTitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Relationship Showcase Banner */}
        <div className={`p-4 border-b border-zinc-800 bg-gradient-to-r ${activeTheme.bgGradient} relative overflow-hidden`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center space-x-2 flex-wrap gap-1">
                <span className={`px-2 py-0.5 rounded text-xs border ${activeTheme.badgeClass} flex items-center space-x-1`}>
                  <span>{activeTheme.icon}</span>
                  <span>{activeTheme.label}</span>
                </span>
                {activeSlot.targetHeroName && (
                  <span className="px-2 py-0.5 rounded text-xs bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold flex items-center space-x-1">
                    <UserCheck className="w-3 h-3 text-emerald-400" />
                    <span>专属: {activeSlot.targetHeroName}</span>
                  </span>
                )}
                {relationshipState.isLocked && (
                  <span className="px-2 py-0.5 rounded text-xs bg-amber-950/80 border border-amber-500/50 text-amber-300 font-bold flex items-center space-x-1">
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>已锁定状态</span>
                  </span>
                )}
                <span className="text-xs text-zinc-400 font-mono">
                  (第 {dayCount} 天 · {activeHero?.name || '当前角色'})
                </span>
              </div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>{activeSlot.title}</span>
                {activeSlot.isCustom && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    自定义/专属
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">{activeSlot.description}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeSlot.customTags.map((tag, idx) => (
                  <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-black/40 border border-white/10 text-zinc-300">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Action Controls */}
            <div className="flex flex-wrap md:flex-col items-stretch gap-2 shrink-0">
              <button
                onClick={handleTriggerEvaluation}
                title="根据当前的信任值、欲望度、意志值与天数重测最契合的角色关系风格"
                className="flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-purple-900/40 transition-all cursor-pointer active:scale-95"
              >
                <Zap className="w-4 h-4 text-yellow-300 animate-bounce" />
                <span>⚡ 触发关系重判定</span>
              </button>

              <button
                onClick={handleToggleLock}
                title={relationshipState.isLocked ? '点击解除锁定，允许随数值变动自动调整关系' : '点击锁定当前关系，固定此对话风格与态度'}
                className={`flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  relationshipState.isLocked
                    ? 'bg-amber-950/60 border-amber-500/60 text-amber-300 hover:bg-amber-900/60'
                    : 'bg-zinc-900/80 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {relationshipState.isLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5 text-zinc-400" />}
                <span>{relationshipState.isLocked ? '已锁定 (固定关系)' : '未锁定 (随数值调整)'}</span>
              </button>

              <button
                onClick={() => handleExportSingleSlot(activeSlot)}
                className="flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-purple-500/40 text-purple-200 hover:border-purple-400 text-xs font-bold transition-all"
              >
                <Share2 className="w-3.5 h-3.5 text-purple-400" />
                <span>📤 导出此关系卡</span>
              </button>
            </div>
          </div>

          {/* Prompt Preview Snippet */}
          <div className="mt-3 p-2.5 rounded-lg bg-black/50 border border-white/10 text-xs text-zinc-300 flex items-start space-x-2">
            <Bot className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 flex-1">
              <span className="text-[11px] font-bold text-purple-300 block">AI 对话与语气指导 Style Prompt：</span>
              <p className="text-[11px] text-zinc-300 italic">{activeSlot.stylePrompt}</p>
            </div>
            <button
              onClick={() => handleOpenEditForm(activeSlot)}
              className="text-[11px] px-2 py-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/40 border border-purple-500/40 flex items-center space-x-1 shrink-0"
            >
              <Edit2 className="w-3 h-3" />
              <span>编辑 Prompt</span>
            </button>
          </div>
        </div>

        {/* Modal Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/60">
          {/* Left Tabs */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('slots')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'slots'
                  ? 'bg-purple-600/30 border border-purple-500/60 text-purple-200'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>预设库 ({filteredSlots.length}/{allSlots.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                activeTab === 'history'
                  ? 'bg-purple-600/30 border border-purple-500/60 text-purple-200'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>变迁日志 ({relationshipState.historyLogs?.length || 0})</span>
            </button>
          </div>

          {/* Right Action Buttons: Import / Export / Create */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            {!isFormOpen && (
              <>
                <button
                  onClick={handleOpenImportModal}
                  title="导入关系卡 JSON (单张或批量)"
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60 text-xs font-bold transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>📥 导入关系卡</span>
                </button>

                <button
                  onClick={handleExportFullLibrary}
                  title="导出全量关系库 JSON 文件"
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-blue-950/60 border border-blue-500/50 text-blue-300 hover:bg-blue-900/60 text-xs font-bold transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>📤 导出关系库</span>
                </button>

                <button
                  onClick={handleResetLibrary}
                  title="恢复为初始默认关系预设库"
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs font-medium transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                  <span>重置预设</span>
                </button>

                {/* 🏛️ 新增组织特定关系专用按钮 */}
                <button
                  onClick={() => handleOpenCreateForm('faction_exclusive', undefined, activeHeroFaction)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(245,158,11,0.35)] cursor-pointer"
                  title="为特定组织或阵营添加组织特有关系信条与立场"
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-200" />
                  <span>🏛️ 新增组织特定关系</span>
                </button>

                {/* 🌟 核心高亮：新增特定人限定关系专用按钮 */}
                <button
                  onClick={() => handleOpenCreateForm('hero_exclusive', activeHero)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.35)] cursor-pointer"
                  title="为当前角色或指定特定角色添加独占专属限定关系"
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-200" />
                  <span>👤 新增特定人限定关系</span>
                </button>

                <button
                  onClick={() => handleOpenCreateForm()}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white text-xs font-bold transition-all shadow-[0_0_12px_rgba(168,85,247,0.3)] cursor-pointer"
                  title="新增通用关系预设"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>➕ 新增通用关系</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter and Search Bar (When on 'slots' tab) */}
        {activeTab === 'slots' && !isFormOpen && (
          <div className="p-3 border-b border-zinc-800/80 bg-zinc-950/80 space-y-2">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-zinc-400 flex items-center space-x-1 mr-1">
                  <Filter className="w-3 h-3 text-purple-400" />
                  <span>分类:</span>
                </span>
                {[
                  { key: 'all', label: '全部' },
                  { key: 'faction_exclusive', label: '🏛️ 组织专属', highlightFaction: true },
                  { key: 'hero_exclusive', label: '👤 人物专属', highlight: true },
                  { key: 'pure_love', label: '💖 纯爱伴侣' },
                  { key: 'evil_enslavement', label: '😈 支配归顺' },
                  { key: 'rivalry', label: '⚔️ 宿敌顽抗' },
                  { key: 'hypnotic_dependency', label: '🌀 催眠洗脑' },
                  { key: 'custom', label: '✨ 特化自定义' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setFilterCategory(item.key)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      filterCategory === item.key
                        ? item.highlightFaction
                          ? 'bg-amber-900/70 text-amber-200 border border-amber-500/80 font-bold shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                          : item.highlight
                          ? 'bg-emerald-900/70 text-emerald-200 border border-emerald-500/80 font-bold shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                          : 'bg-purple-600/30 text-purple-200 border border-purple-500/50 font-bold'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Right side: Faction & Hero Filter & Search */}
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                {factions && factions.length > 0 && (
                  <select
                    value={factionFilter}
                    onChange={(e) => setFactionFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-amber-300 outline-none focus:border-amber-500"
                  >
                    <option value="all">全部组织关系</option>
                    {activeHero && <option value="current_hero_factions">当前角色组织</option>}
                    {factions.map((f) => (
                      <option key={f.id} value={f.id}>
                        组织: {f.name}
                      </option>
                    ))}
                  </select>
                )}

                {availableHeroList.length > 0 && (
                  <select
                    value={heroFilter}
                    onChange={(e) => setHeroFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-purple-300 outline-none focus:border-purple-500"
                  >
                    <option value="all">全部角色专属</option>
                    {activeHero && <option value="current_hero">当前角色: {activeHero.name}</option>}
                    {availableHeroList.map((h) => (
                      <option key={h.id} value={h.id}>
                        专属角色: {h.name}
                      </option>
                    ))}
                  </select>
                )}

                {/* Search Input */}
                <div className="relative min-w-[160px]">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索标题、组织、角色、Prompt..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs focus:border-purple-500 outline-none placeholder:text-zinc-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-2 text-zinc-400 hover:text-white text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 🏛️ 组织特定分类上下文专属 Banner 与快速添加入口 */}
            {filterCategory === 'faction_exclusive' && (
              <div className="bg-amber-950/40 border border-amber-500/40 p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs animate-fade-in">
                <div className="flex items-center space-x-2 text-amber-300">
                  <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold">🏛️ 组织/阵营特定关系分类 (Organization-Exclusive)</span>
                    <span className="text-[11px] text-zinc-400 ml-2 hidden sm:inline">
                      组织特定关系注入阵营信条、阶级忠诚与组织专属立场，当角色归属该组织时享有专属语气加成。
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleOpenCreateForm('faction_exclusive', undefined, activeHeroFaction)}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-amber-900/30 cursor-pointer"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>➕ 为【{activeHeroFaction?.name || '指定组织'}】添加组织专属关系</span>
                  </button>
                </div>
              </div>
            )}

            {/* 🌟 人物专属分类上下文专属 Banner 与快速添加入口 */}
            {filterCategory === 'hero_exclusive' && (
              <div className="bg-emerald-950/40 border border-emerald-500/40 p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs animate-fade-in">
                <div className="flex items-center space-x-2 text-emerald-300">
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold">👤 人物限定专属关系分类 (Character-Exclusive)</span>
                    <span className="text-[11px] text-zinc-400 ml-2 hidden sm:inline">
                      人物限定关系只在特定角色出战时生效，享有专属定制 AI 语气、称呼与互动加成。
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleOpenCreateForm('hero_exclusive', activeHero)}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-900/30 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>➕ 为【{activeHero?.name || '当前角色'}】添加专属限定关系</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4 scrollbar-thin">
          {/* Create/Edit Custom Slot Form Modal */}
          {isFormOpen && (
            <div className="p-4 rounded-xl bg-zinc-900/95 border border-purple-500/60 space-y-4 animate-fade-in shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>
                    {editingSlotId
                      ? '自定义与编辑关系预设'
                      : slotCategory === 'faction_exclusive' || (targetFactionId !== 'any' && Boolean(targetFactionId)) || Boolean(targetFactionName)
                      ? `🏛️ 新增【${targetFactionName || activeHeroFaction?.name || '指定组织'}】特定关系预设`
                      : slotCategory === 'hero_exclusive' || (targetHeroId !== 'any' && Boolean(targetHeroId)) || Boolean(targetHeroName)
                      ? `👤 新增【${targetHeroName || activeHero?.name || '特定人物'}】限定关系预设`
                      : '新增全新关系预设'}
                  </span>
                </h4>
                <button
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingSlotId(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  取消
                </button>
              </div>

              {/* 🌟 核心：关系适用范围选择 (通用 vs 组织特定 vs 人物限定) */}
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
                <div className="text-xs text-zinc-300 font-bold flex items-center space-x-1.5">
                  <span>关系适用范围:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSlotCategory('pure_love');
                      setTargetHeroId('any');
                      setTargetHeroName('');
                      setExclusiveCategoryName('');
                      setTargetFactionId('any');
                      setTargetFactionName('');
                      setFactionRoleRequired('');
                      setFactionCategoryName('');
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      slotCategory !== 'hero_exclusive' && slotCategory !== 'faction_exclusive' && targetHeroId === 'any' && !targetHeroName && targetFactionId === 'any' && !targetFactionName
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    🌐 通用关系 (全体角色通用)
                  </button>

                  {/* 🏛️ 组织特定关系模式选择 */}
                  <button
                    type="button"
                    onClick={() => {
                      setSlotCategory('faction_exclusive');
                      setTargetHeroId('any');
                      setTargetHeroName('');
                      setExclusiveCategoryName('');
                      const f = activeHeroFaction || factions[0];
                      if (f) {
                        setTargetFactionId(f.id);
                        setTargetFactionName(f.name);
                        setFactionCategoryName(`${f.name}组织羁绊`);
                        if (!slotTitle.trim() || slotTitle.startsWith('👤') || slotTitle.startsWith('💖') || slotTitle.startsWith('🛡️')) {
                          setSlotTitle(`🏛️ ${f.name} · 誓死效忠圣约`);
                        }
                      }
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                      slotCategory === 'faction_exclusive' || (targetFactionId !== 'any' && Boolean(targetFactionId)) || Boolean(targetFactionName)
                        ? 'bg-amber-600 text-white shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                        : 'bg-zinc-900 text-zinc-400 hover:text-amber-300 border border-zinc-800'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>🏛️ 组织特定关系 (阵营信条与立场)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSlotCategory('hero_exclusive');
                      setTargetFactionId('any');
                      setTargetFactionName('');
                      setFactionRoleRequired('');
                      setFactionCategoryName('');
                      const h = activeHero;
                      if (h) {
                        setTargetHeroId(h.id);
                        setTargetHeroName(h.name);
                        setExclusiveCategoryName(`${h.name}专属契约`);
                        if (!slotTitle.trim() || slotTitle.startsWith('🏛️') || slotTitle.startsWith('💖')) {
                          setSlotTitle(`👤 ${h.name}专属·灵魂誓约`);
                        }
                      }
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                      slotCategory === 'hero_exclusive' || (targetHeroId !== 'any' && Boolean(targetHeroId)) || Boolean(targetHeroName)
                        ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                        : 'bg-zinc-900 text-zinc-400 hover:text-emerald-300 border border-zinc-800'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>👤 特定人物限定关系 (专属羁绊)</span>
                  </button>
                </div>
              </div>

              {/* 🏛️ 组织特定关系绑定与一键模板生成区 */}
              {(slotCategory === 'faction_exclusive' || (targetFactionId !== 'any' && Boolean(targetFactionId)) || Boolean(targetFactionName)) && (
                <div className="p-3.5 rounded-lg bg-amber-950/35 border border-amber-500/60 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center space-x-2 text-xs font-bold text-amber-300">
                      <Building2 className="w-4 h-4 text-amber-400" />
                      <span>🏛️ 组织/阵营特定绑定与信条模板 (Organization Binding & Presets)</span>
                    </div>
                    <span className="text-[10px] text-amber-400/90 font-mono">
                      绑定后贯彻组织立场与阶级信条，享有专属 AI 阵营语气
                    </span>
                  </div>

                  {/* Quick Select Faction Chips */}
                  {factions.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-300 block font-medium">快捷选择阵营组织:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {factions.map((f) => {
                          const isHeroFaction = activeHero?.factionId === f.id;
                          const isSelectedFaction = targetFactionId === f.id || targetFactionName === f.name;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                setTargetFactionId(f.id);
                                setTargetFactionName(f.name);
                                setFactionCategoryName(`${f.name}专属纽带`);
                                if (!slotTitle.trim() || slotTitle.startsWith('🏛️') || slotTitle.startsWith('🌑') || slotTitle.startsWith('🌐') || slotTitle.startsWith('⛓️') || slotTitle.startsWith('🤖')) {
                                  setSlotTitle(`🏛️ ${f.name} · 誓死效忠圣约`);
                                }
                              }}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                                isSelectedFaction
                                  ? 'bg-amber-600 text-white border border-amber-400 shadow-sm'
                                  : isHeroFaction
                                  ? 'bg-amber-950/80 border border-amber-600/70 text-amber-200 hover:bg-amber-900/60'
                                  : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500'
                              }`}
                            >
                              <span>{isHeroFaction ? `🏛️ ${f.name} (当前所属)` : f.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Faction input and select grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                    <div>
                      <label className="text-[11px] text-zinc-300 block mb-1">选择绑定组织:</label>
                      <select
                        value={targetFactionId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTargetFactionId(val);
                          setTargetSubFactionId('any');
                          setTargetSubFactionName('');
                          if (val === 'any') {
                            setTargetFactionName('');
                          } else {
                            const found = factions.find((f) => f.id === val);
                            if (found) {
                              setTargetFactionName(found.name);
                              setFactionCategoryName(`${found.name}专属纽带`);
                            }
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-amber-600/60 text-amber-200 text-xs focus:outline-none"
                      >
                        <option value="any">未指定组织ID (手动输入组织名)</option>
                        {factions.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name} ({f.description?.substring(0, 16) || '组织'}...)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Sub-Faction Branch selector */}
                    <div>
                      <label className="text-[11px] text-sky-300 block mb-1 font-medium">指定从属编制/部门 (选填):</label>
                      {(() => {
                        const curFac = factions.find((f) => f.id === targetFactionId);
                        const subList = curFac ? curFac.subFactions || [] : [];
                        return (
                          <select
                            disabled={!curFac || subList.length === 0}
                            value={targetSubFactionId}
                            onChange={(e) => {
                              const subVal = e.target.value;
                              setTargetSubFactionId(subVal);
                              if (subVal === 'any') {
                                setTargetSubFactionName('');
                              } else {
                                const foundSub = subList.find((s) => s.id === subVal);
                                setTargetSubFactionName(foundSub ? foundSub.name : '');
                              }
                            }}
                            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-sky-600/50 text-sky-200 text-xs focus:outline-none disabled:opacity-40"
                          >
                            <option value="any">
                              {!curFac ? '需先选择组织' : subList.length === 0 ? '该组织无下级编制' : '全部编制通用 (不限)'}
                            </option>
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
                      <label className="text-[11px] text-zinc-300 block mb-1">组织/阵营名称:</label>
                      <input
                        type="text"
                        value={targetFactionName}
                        onChange={(e) => setTargetFactionName(e.target.value)}
                        placeholder="如: 绝望深渊 / 赛博联邦 / 泰坦防御"
                        className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-zinc-300 block mb-1">阵营身份/职位限制 (选填):</label>
                      <input
                        type="text"
                        value={factionRoleRequired}
                        onChange={(e) => setFactionRoleRequired(e.target.value)}
                        placeholder="如: 特遣调查官 / 最高统帅 / 随行密使"
                        className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-amber-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* 🏛️ 1-Click Faction Preset Templates */}
                  <div className="p-2.5 bg-black/40 rounded-lg border border-amber-800/40 space-y-1.5">
                    <label className="text-[11px] text-amber-300 font-bold flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                      <span>一键套用【{targetFactionName || activeHeroFaction?.name || '指定组织'}】特定关系信条模板:</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: 'oath', label: '🏛️ 誓死效忠', desc: '同盟神圣誓约/恪守信条' },
                        { key: 'captive', label: '🌑 沦陷受俘', desc: '敌方将领/严刑动摇' },
                        { key: 'agent', label: '🌐 敌后潜伏', desc: '特遣调查官/绝密协议' },
                        { key: 'servant', label: '⛓️ 阵营归顺', desc: '彻底臣服/随从契约' },
                        { key: 'cyber', label: '🤖 核心协议', desc: '科技算法/逻辑共振' },
                      ].map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => handleApplyFactionExclusiveTemplate(t.key as any)}
                          className="px-2.5 py-1 rounded bg-zinc-900 border border-amber-600/40 hover:border-amber-400 hover:bg-amber-950/60 text-[11px] text-zinc-200 hover:text-amber-200 transition-all flex items-center space-x-1 cursor-pointer"
                        >
                          <span className="font-bold">{t.label}</span>
                          <span className="text-[10px] text-zinc-400 hidden md:inline">({t.desc})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 🌟 专属人物绑定与一键模板生成区 */}
              {(slotCategory === 'hero_exclusive' || (targetHeroId !== 'any' && Boolean(targetHeroId)) || Boolean(targetHeroName)) && (
                <div className="p-3.5 rounded-lg bg-emerald-950/35 border border-emerald-500/60 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center space-x-2 text-xs font-bold text-emerald-300">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <span>👤 限定角色绑定与快捷模板 (Character Binding & Presets)</span>
                    </div>
                    <span className="text-[10px] text-emerald-400/90 font-mono">
                      绑定后仅在指定角色出战时生效，享有专属 AI 语气
                    </span>
                  </div>

                  {/* Quick Select Character Chips */}
                  {availableHeroList.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-300 block font-medium">快捷选择当前出战/小队角色:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {availableHeroList.map((h) => {
                          const isCurrentActive = activeHero?.id === h.id;
                          const isSelectedTarget = targetHeroId === h.id || targetHeroName === h.name;
                          return (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() => {
                                setTargetHeroId(h.id);
                                setTargetHeroName(h.name);
                                setExclusiveCategoryName(`${h.name}专属契约`);
                                if (!slotTitle.trim() || slotTitle.startsWith('👤') || slotTitle.startsWith('💖') || slotTitle.startsWith('🛡️') || slotTitle.startsWith('😈') || slotTitle.startsWith('⚔️') || slotTitle.startsWith('🌀')) {
                                  setSlotTitle(`👤 ${h.name}专属·灵魂誓约`);
                                }
                              }}
                              className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                                isSelectedTarget
                                  ? 'bg-emerald-600 text-white border border-emerald-400 shadow-sm'
                                  : isCurrentActive
                                  ? 'bg-emerald-950/80 border border-emerald-600/70 text-emerald-200 hover:bg-emerald-900/60'
                                  : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500'
                              }`}
                            >
                              <span>{isCurrentActive ? `⭐ ${h.name} (当前)` : h.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Character input and select grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="text-[11px] text-zinc-300 block mb-1">选择绑定角色:</label>
                      <select
                        value={targetHeroId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTargetHeroId(val);
                          if (val === 'any') {
                            setTargetHeroName('');
                          } else {
                            const found = availableHeroList.find((h) => h.id === val);
                            if (found) {
                              setTargetHeroName(found.name);
                              setExclusiveCategoryName(`${found.name}专属契约`);
                            }
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-emerald-600/60 text-emerald-200 text-xs focus:outline-none"
                      >
                        <option value="any">未指定特定ID (通用或手动输入名称)</option>
                        {availableHeroList.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.homePlanet || '特适者'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-zinc-300 block mb-1">专属角色名称:</label>
                      <input
                        type="text"
                        value={targetHeroName}
                        onChange={(e) => setTargetHeroName(e.target.value)}
                        placeholder="如: 艾露恩 / 伊莉丝"
                        className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-zinc-300 block mb-1">专属分类备注/说明:</label>
                      <input
                        type="text"
                        value={exclusiveCategoryName}
                        onChange={(e) => setExclusiveCategoryName(e.target.value)}
                        placeholder="如: 银河大祭司专属契约"
                        className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* 🌟 1-Click Exclusive Theme Preset Templates */}
                  <div className="p-2.5 bg-black/40 rounded-lg border border-emerald-800/40 space-y-1.5">
                    <label className="text-[11px] text-emerald-300 font-bold flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>一键套用【{targetHeroName || activeHero?.name || '指定角色'}】限定关系模板:</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: 'pure_love', label: '💖 纯爱誓约', desc: '极度纯爱/娇羞依赖' },
                        { key: 'tactical', label: '🛡️ 生死搭档', desc: '生死战友/英雄默契' },
                        { key: 'slave', label: '😈 顺从归顺', desc: '臣服随从/主仆契约' },
                        { key: 'rival', label: '⚔️ 宿敌动摇', desc: '高傲宿敌/口嫌体正' },
                        { key: 'hypno', label: '🌀 脑波依恋', desc: '认知改写/催眠盲从' },
                      ].map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => handleApplyHeroExclusiveTemplate(t.key as any)}
                          className="px-2.5 py-1 rounded bg-zinc-900 border border-emerald-600/40 hover:border-emerald-400 hover:bg-emerald-950/60 text-[11px] text-zinc-200 hover:text-emerald-200 transition-all flex items-center space-x-1 cursor-pointer"
                        >
                          <span className="font-bold">{t.label}</span>
                          <span className="text-[10px] text-zinc-400 hidden md:inline">({t.desc})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-300 font-bold mb-1 block">关系全称 (可自定义前缀与名称)</label>
                  <input
                    type="text"
                    value={slotTitle}
                    onChange={(e) => setSlotTitle(e.target.value)}
                    placeholder="如: 🏛️ 绝望深渊 · 誓死效忠圣约 / 👤 艾露恩专属·神圣誓约"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs focus:border-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-300 font-bold mb-1 block">关系分类 / 主题模式</label>
                  <select
                    value={slotCategory}
                    onChange={(e) => {
                      const newCat = e.target.value as RelationshipCategory;
                      setSlotCategory(newCat);
                      if (newCat === 'faction_exclusive') {
                        const f = activeHeroFaction || factions[0];
                        if (f) {
                          setTargetFactionId(f.id);
                          setTargetFactionName(f.name);
                          setFactionCategoryName(`${f.name}组织纽带`);
                          if (!slotTitle.trim()) {
                            setSlotTitle(`🏛️ ${f.name} · 阵营信条契约`);
                          }
                        }
                      } else if (newCat === 'hero_exclusive' && activeHero) {
                        setTargetHeroId(activeHero.id);
                        setTargetHeroName(activeHero.name);
                        setExclusiveCategoryName(`${activeHero.name}专属契约`);
                        if (!slotTitle.trim()) {
                          setSlotTitle(`👤 ${activeHero.name}专属·羁绊契约`);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs focus:border-purple-500 outline-none"
                  >
                    <option value="faction_exclusive">🏛️ 组织专属 / 阵营特化 (特定阵营专属纽带与信条)</option>
                    <option value="hero_exclusive">👤 人物专属 / 定制羁绊 (可绑定专属角色)</option>
                    <option value="pure_love">💖 纯爱 / 伴侣 (纯爱相守/柔情关怀)</option>
                    <option value="evil_enslavement">😈 支配 / 归顺 (彻底臣服/主仆依从)</option>
                    <option value="rivalry">⚔️ 宿敌 / 顽抗 (高傲正义/傲娇动摇)</option>
                    <option value="hypnotic_dependency">🌀 催眠 / 依赖 (脑波改写/认知重塑造)</option>
                    <option value="custom">✨ 特化自定义</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-300 font-bold mb-1 block">关系背景简述</label>
                <input
                  type="text"
                  value={slotDescription}
                  onChange={(e) => setSlotDescription(e.target.value)}
                  placeholder="如: 在经历多次交心与护理后建立的专属深情依恋。"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-purple-300 font-bold mb-1 block flex items-center space-x-1">
                  <Bot className="w-3.5 h-3.5 text-purple-400" />
                  <span>AI 对话语气与指导 Style Prompt (核心：决定角色回复语气、称呼与互动习惯)</span>
                </label>
                <textarea
                  rows={4}
                  value={slotStylePrompt}
                  onChange={(e) => setSlotStylePrompt(e.target.value)}
                  placeholder="如: 【专属深情恋人风格】对对方充满了无比真挚的爱意。称呼对方为'亲爱的'。对话时眼神温情脉脉，主动表达爱意与关怀，绝不使用辱骂台词..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-purple-500/50 text-white text-xs focus:border-purple-400 outline-none leading-relaxed font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 font-bold mb-1 block">特征标签 (用逗号分隔)</label>
                <input
                  type="text"
                  value={slotCustomTags}
                  onChange={(e) => setSlotCustomTags(e.target.value)}
                  placeholder="纯爱, 灵魂伴侣, 娇羞依恋"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs focus:border-purple-500 outline-none"
                />
              </div>

              {/* Conditions Sliders / Inputs */}
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-xs font-bold text-zinc-300 block flex items-center space-x-1">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  <span>判定/触发门槛条件配置 (留空表示不限制条件)</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[11px] text-zinc-400 block">最小信任值%</label>
                    <input
                      type="number"
                      value={minObedience}
                      onChange={(e) => setMinObedience(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="例: 60"
                      className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block">最大信任值%</label>
                    <input
                      type="number"
                      value={maxObedience}
                      onChange={(e) => setMaxObedience(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="例: 100"
                      className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block">最小欲望值%</label>
                    <input
                      type="number"
                      value={minLust}
                      onChange={(e) => setMinLust(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="例: 50"
                      className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block">最大欲望值%</label>
                    <input
                      type="number"
                      value={maxLust}
                      onChange={(e) => setMaxLust(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="例: 100"
                      className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block">最小意志防线%</label>
                    <input
                      type="number"
                      value={minMorale}
                      onChange={(e) => setMinMorale(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="例: 0"
                      className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block">最大意志防线%</label>
                    <input
                      type="number"
                      value={maxMorale}
                      onChange={(e) => setMaxMorale(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="例: 40"
                      className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block">最小维持天数</label>
                    <input
                      type="number"
                      value={minDay}
                      onChange={(e) => setMinDay(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="例: 1"
                      className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white text-xs"
                    />
                  </div>
                </div>

                {/* ⚡ 双向联动设置: 要求/关联的开局剧情预设 */}
                <div className="bg-purple-950/30 border border-purple-800/50 p-2.5 rounded-lg space-y-2 mt-2">
                  <label className="text-xs text-purple-300 font-bold flex items-center space-x-1.5">
                    <Link className="w-3.5 h-3.5 text-purple-400" />
                    <span>开局与角色羁绊双向联动 (Scenario & Relationship Linkage)</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">限定/关联的开局剧情:</label>
                      <select
                        value={reqScenarioId !== 'any' ? reqScenarioId : reqScenarioCat}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'any') {
                            setReqScenarioId('any');
                            setReqScenarioCat('any');
                          } else {
                            const found = (allScenarios || []).find((s) => s.id === val);
                            if (found) {
                              setReqScenarioId(found.id);
                              setReqScenarioCat(found.category);
                            } else {
                              setReqScenarioCat(val);
                              setReqScenarioId('any');
                            }
                          }
                        }}
                        className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-purple-800/70 text-white text-xs focus:outline-none focus:border-purple-500"
                      >
                        <option value="any">无限定 (任何开局通用)</option>
                        {allScenarios && allScenarios.length > 0 && (
                          <optgroup label="全量开局剧情库 (内置 + 自定义)">
                            {allScenarios.map((sc) => (
                              <option key={sc.id} value={sc.id}>
                                {sc.icon} {sc.name} ({sc.isCustom ? '自定义' : sc.category})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <div className="flex items-center space-x-2 pt-3">
                      <label className="flex items-center space-x-2 cursor-pointer text-purple-200 bg-purple-900/40 p-2 rounded border border-purple-700/50 hover:bg-purple-900/60 transition-colors w-full">
                        <input
                          type="checkbox"
                          checked={syncToScenarioLibrary}
                          onChange={(e) => setSyncToScenarioLibrary(e.target.checked)}
                          className="w-4 h-4 rounded accent-purple-500 bg-zinc-900 border-purple-700"
                        />
                        <span className="font-bold text-[11px]">⚡ 保存时同步在【开局预设库】自动创建/更新对应场景</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingSlotId(null);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-xs"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveSlot}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white font-bold text-xs shadow-md"
                >
                  保存预设
                </button>
              </div>
            </div>
          )}

          {activeTab === 'slots' ? (
            filteredSlots.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredSlots.map((slot) => {
                  const isSelected = slot.id === activeSlot.id;
                  const theme = getRelationshipCategoryTheme(slot.category);
                  const condMatch = checkSlotConditionMatch(slot, stats, activeHero!, scenarioConfig, dayCount);

                  return (
                    <div
                      key={slot.id}
                      onClick={() => handleSelectSlot(slot)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between space-y-2.5 ${
                        isSelected
                          ? `bg-zinc-900/90 ${theme.borderColor} shadow-[0_0_20px_rgba(168,85,247,0.25)] ring-1 ring-purple-500/50`
                          : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/70'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] border ${theme.badgeClass}`}>
                              {theme.icon} {theme.label}
                            </span>
                            {slot.targetFactionName && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/80 border border-amber-500/50 text-amber-300 font-bold flex items-center space-x-1">
                                <Building2 className="w-2.5 h-2.5 text-amber-400" />
                                <span>{slot.targetFactionName}</span>
                              </span>
                            )}
                            {slot.targetSubFactionName && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-950/80 border border-sky-500/50 text-sky-300 font-bold flex items-center space-x-1">
                                <span>{slot.targetSubFactionName}</span>
                              </span>
                            )}
                            {slot.targetHeroName && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold flex items-center space-x-1">
                                <UserCheck className="w-2.5 h-2.5 text-emerald-400" />
                                <span>{slot.targetHeroName}</span>
                              </span>
                            )}
                            {slot.isCustom && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/60 text-amber-300 border border-amber-500/40 font-mono">
                                自定义
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                            {isSelected && (
                              <span className="px-2 py-0.5 rounded bg-purple-500 text-white font-bold text-[10px] flex items-center space-x-1 mr-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>当前生效</span>
                              </span>
                            )}

                            {/* Derive Faction Exclusive / Derive Hero Exclusive / Export / Edit / Duplicate / Delete */}
                            {activeHeroFaction && (
                              <button
                                onClick={(e) => handleDeriveFactionExclusive(slot, activeHeroFaction, e)}
                                title={`衍生为【${activeHeroFaction.name}】组织特定专属关系`}
                                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-amber-900/60 border border-zinc-700 hover:border-amber-500/60 text-zinc-300 hover:text-amber-300 transition-all cursor-pointer"
                              >
                                <Building2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={(e) => handleDeriveHeroExclusive(slot, activeHero, e)}
                              title={`衍生为【${activeHero?.name || '当前角色'}】专属限定关系`}
                              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-emerald-900/60 border border-zinc-700 hover:border-emerald-500/60 text-zinc-300 hover:text-emerald-300 transition-all cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleExportSingleSlot(slot, e)}
                              title="导出此单张关系卡 (JSON/下载)"
                              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-blue-900/60 border border-zinc-700 hover:border-blue-500/60 text-zinc-300 hover:text-blue-200 transition-all cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleOpenEditForm(slot, e)}
                              title="编辑此关系预设"
                              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-purple-900/60 border border-zinc-700 hover:border-purple-500/60 text-zinc-300 hover:text-purple-200 transition-all cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleDuplicateSlot(slot, e)}
                              title="复制此预设并新建编辑"
                              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleDeleteSlot(slot.id, e)}
                              title="从预设库中删除此预设"
                              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-rose-950/80 border border-zinc-700 hover:border-rose-500/60 text-rose-400 hover:text-rose-200 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-sm font-bold text-white flex items-center space-x-1.5">
                          <span>{slot.title}</span>
                        </h4>

                        <p className="text-xs text-zinc-300 leading-relaxed break-words">{slot.description}</p>

                        {/* AI Prompt Snippet preview */}
                        <div className="p-2 rounded bg-black/40 border border-zinc-800/80 text-[11px] text-zinc-300 font-mono leading-relaxed break-words">
                          <span className="text-purple-400 font-bold">Prompt: </span>
                          {slot.stylePrompt}
                        </div>
                      </div>

                      {/* Condition match status badge & quick switch action */}
                      <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className={`font-mono ${condMatch.matched ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>
                            {condMatch.matched ? '✓ 数值条件满足' : '× 未达自动判定门槛'}
                          </span>
                          {slot.conditions?.requiredScenarioId && (
                            <span className="text-[10px] text-pink-300 px-1.5 py-0.5 rounded bg-pink-950/60 border border-pink-800/40 font-mono flex items-center space-x-1">
                              <Link className="w-2.5 h-2.5 text-pink-400 shrink-0" />
                              <span className="truncate max-w-[120px]">
                                {(allScenarios || []).find((s) => s.id === slot.conditions?.requiredScenarioId)?.name || '限定开局'}
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 mt-1 sm:mt-0">
                          {!isSelected ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectSlot(slot);
                              }}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                                condMatch.matched
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-pulse'
                                  : 'bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-200'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{condMatch.matched ? '条件达成·替换为当前生效关系' : '手动替换为此关系'}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-purple-300 font-mono font-bold px-2 py-0.5 rounded bg-purple-900/50 border border-purple-500/40">
                              当前已生效
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center space-y-4">
                {filterCategory === 'faction_exclusive' ? (
                  <div className="max-w-md mx-auto p-6 rounded-2xl bg-zinc-950/80 border border-amber-500/40 space-y-3.5 text-center shadow-xl">
                    <div className="w-12 h-12 rounded-full bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-amber-400 mx-auto">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-amber-300">暂无组织/阵营特定关系</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        组织特定关系注入阵营信条、阶级忠诚与组织专属立场，当角色归属该组织时享有专属 AI 对话风格与加成！你可以立即为【<strong>{activeHeroFaction?.name || '指定组织'}</strong>】添加组织专属羁绊。
                      </p>
                    </div>
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenCreateForm('faction_exclusive', undefined, activeHeroFaction)}
                        className="w-full sm:w-auto px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold shadow-lg shadow-amber-900/30 flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Building2 className="w-4 h-4" />
                        <span>🏛️ 立即为【{activeHeroFaction?.name || '指定组织'}】添加组织关系</span>
                      </button>
                      <button
                        onClick={() => setFilterCategory('all')}
                        className="w-full sm:w-auto px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs cursor-pointer"
                      >
                        查看全部通用预设
                      </button>
                    </div>
                  </div>
                ) : filterCategory === 'hero_exclusive' ? (
                  <div className="max-w-md mx-auto p-6 rounded-2xl bg-zinc-950/80 border border-emerald-500/40 space-y-3.5 text-center shadow-xl">
                    <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mx-auto">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-emerald-300">暂无人物专属限定关系</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        专属限定关系仅在特定角色出战时生效，享有专属 AI 对话风格与加成！你可以立即为【<strong>{activeHero?.name || '当前角色'}</strong>】或指定角色创建专属限定羁绊。
                      </p>
                    </div>
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenCreateForm('hero_exclusive', activeHero)}
                        className="w-full sm:w-auto px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>👤 立即为【{activeHero?.name || '当前角色'}】添加专属关系</span>
                      </button>
                      <button
                        onClick={() => setFilterCategory('all')}
                        className="w-full sm:w-auto px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs cursor-pointer"
                      >
                        查看全部通用预设
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-zinc-400 text-xs">未找到符合搜索或筛选条件的关系预设</p>
                    <button
                      onClick={() => {
                        setFilterCategory('all');
                        setHeroFilter('all');
                        setFactionFilter('all');
                        setSearchQuery('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-purple-300 hover:border-purple-500 cursor-pointer"
                    >
                      清除筛选条件
                    </button>
                  </div>
                )}
              </div>
            )
          ) : (
            /* History Tab */
            <div className="space-y-2">
              {relationshipState.historyLogs && relationshipState.historyLogs.length > 0 ? (
                relationshipState.historyLogs.map((log, idx) => (
                  <div key={log.id ? `${log.id}_${idx}` : `hist_log_${idx}`} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-zinc-400 font-mono text-[11px]">
                      <span>
                        第 {log.dayCount} 天 · {log.timestamp}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-500/40 text-purple-300">
                        {log.triggerType === 'manual_button' ? '手动重测/切换' : '锁定变更'}
                      </span>
                    </div>
                    <div className="font-bold text-white flex items-center space-x-2">
                      <span className="text-zinc-400">{log.fromTitle}</span>
                      <span className="text-purple-400">➔</span>
                      <span className="text-rose-300">{log.toTitle}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">{log.reason}</p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-zinc-500 text-xs">暂无关系变更记录</div>
              )}
            </div>
          )}
        </div>

        {/* -------------------------------------------------------- */}
        {/* SINGLE CARD EXPORT MODAL                                 */}
        {/* -------------------------------------------------------- */}
        {exportingSlot && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div className="bg-zinc-950 border border-purple-500/60 rounded-xl max-w-lg w-full p-4 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center space-x-2 text-white font-bold text-sm">
                  <Share2 className="w-4 h-4 text-purple-400" />
                  <span>📤 导出关系卡片: {exportingSlot.title}</span>
                </div>
                <button
                  onClick={() => setExportingSlot(null)}
                  className="text-zinc-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300">{exportingSlot.title}</span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    分类: {getRelationshipCategoryTheme(exportingSlot.category).label}
                  </span>
                </div>
                {exportingSlot.targetHeroName && (
                  <div className="text-[11px] text-emerald-300">
                    👤 专属角色: <strong>{exportingSlot.targetHeroName}</strong>
                  </div>
                )}
                <p className="text-zinc-300">{exportingSlot.description}</p>
                <div className="p-2 bg-black/60 rounded border border-zinc-800 text-[11px] font-mono text-zinc-400 max-h-32 overflow-y-auto">
                  {JSON.stringify(exportingSlot, null, 2)}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  onClick={() => handleCopySlotJson(exportingSlot)}
                  className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center space-x-1.5 transition-all"
                >
                  {copiedNotification ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedNotification ? '已复制 JSON！' : '复制 JSON 文本'}</span>
                </button>

                <button
                  onClick={() => handleDownloadSlotJson(exportingSlot)}
                  className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-purple-900/30 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载 .json 文件</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* IMPORT RELATIONSHIP CARDS MODAL                           */}
        {/* -------------------------------------------------------- */}
        {isImportModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div className="bg-zinc-950 border border-emerald-500/60 rounded-xl max-w-xl w-full p-4 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center space-x-2 text-white font-bold text-sm">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>📥 导入关系卡片 / 关系库</span>
                </div>
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="text-zinc-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Upload or Paste options */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300">方式一：上传 .json 关系卡文件</label>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-300 text-xs font-bold border border-zinc-700 flex items-center space-x-1 transition-all"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>选择本地文件</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 mb-1 block">
                    方式二：直接粘贴 JSON 关系卡文本
                  </label>
                  <textarea
                    rows={6}
                    value={importJsonText}
                    onChange={(e) => {
                      setImportJsonText(e.target.value);
                      parseJsonData(e.target.value);
                    }}
                    placeholder="在此粘贴导出的单张关系卡或全量关系库 JSON 数据..."
                    className="w-full p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-emerald-500 outline-none leading-relaxed"
                  />
                </div>

                {/* Import Mode Selector */}
                <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-300">导入模式:</span>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-1.5 cursor-pointer text-zinc-300 hover:text-white">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="accent-emerald-500"
                      />
                      <span>➕ 追加合并到现有库 (推荐)</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer text-zinc-300 hover:text-white">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'overwrite'}
                        onChange={() => setImportMode('overwrite')}
                        className="accent-rose-500"
                      />
                      <span>🔄 覆盖替换当前预设库</span>
                    </label>
                  </div>
                </div>

                {/* Parsed Preview or Error */}
                {importError && (
                  <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{importError}</span>
                  </div>
                )}

                {importSuccessMsg && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center space-x-2">
                    <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{importSuccessMsg}</span>
                  </div>
                )}

                {parsedImportSlots && parsedImportSlots.length > 0 && !importError && (
                  <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-600/40 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-emerald-300">
                      <span>✓ 成功解析 {parsedImportSlots.length} 张关系卡</span>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                      {parsedImportSlots.map((s, idx) => (
                        <div key={idx} className="p-1.5 rounded bg-black/40 border border-emerald-800/40 flex items-center justify-between text-[11px]">
                          <span className="text-zinc-200 font-bold truncate max-w-[240px]">{s.title}</span>
                          <span className="text-emerald-400 font-mono">
                            {s.targetHeroName ? `👤 专属:${s.targetHeroName}` : getRelationshipCategoryTheme(s.category).label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-xs hover:text-white"
                >
                  取消
                </button>
                <button
                  disabled={!parsedImportSlots || parsedImportSlots.length === 0}
                  onClick={handleConfirmImport}
                  className={`px-4 py-2 rounded-lg text-white font-bold text-xs flex items-center space-x-1.5 transition-all ${
                    parsedImportSlots && parsedImportSlots.length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/40 cursor-pointer'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>确认导入 ({parsedImportSlots?.length || 0} 张)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
