import React, { useState } from 'react';
import { Faction, FactionRelation, Ultrawoman, SubFaction } from '../types';
import {
  Shield,
  Plus,
  Trash2,
  Edit3,
  Save,
  RotateCcw,
  Users,
  ArrowRightLeft,
  Landmark,
  Activity,
  Compass,
  FileText,
  Check,
  X,
  Crown,
  ArrowUp,
  ArrowDown,
  Star,
  Layers,
  ChevronDown,
  Target,
  Eye,
  Zap,
  UserPlus,
  Search,
  Grid,
  List,
  Globe,
} from 'lucide-react';
import { ultraAudio } from '../utils/audio';
import {
  DEFAULT_FACTIONS,
  getHeroFactionMemberships,
  addOrUpdateHeroFactionMembership,
  removeHeroFromFaction,
  moveHeroFactionPriority,
  setHeroFactionAsPrimary,
  isHeroInFaction,
  isHeroUnassigned,
  FACTION_MEMBERSHIP_TITLE_PRESETS,
  MEMBERSHIP_TYPE_CONFIGS,
  getHeroOriginCountry,
  isHeroForeignSubordinateInFaction,
  getSubFactionsForFaction,
  addOrUpdateSubFaction,
  deleteSubFaction,
  isHeroInSubFaction,
} from '../data/factions';

interface FactionManagerTabProps {
  factions: Faction[];
  heroines: Ultrawoman[];
  onUpdateFactions: (factions: Faction[]) => void;
  onUpdateHero?: (updatedHero: Ultrawoman) => void;
  onUpdateAllHeroes?: (updatedHeroines: Ultrawoman[]) => void;
}

const SUB_FACTION_TYPE_CONFIGS: Record<
  NonNullable<SubFaction['type']>,
  { label: string; icon: string; color: string }
> = {
  military: {
    label: '武装军事',
    icon: '⚔️',
    color: 'text-amber-300 border-amber-500/40 bg-amber-950/40',
  },
  intelligence: {
    label: '密谍情报',
    icon: '👁️',
    color: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/40',
  },
  research: {
    label: '科研重工',
    icon: '🧪',
    color: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40',
  },
  special_ops: {
    label: '特勤作战',
    icon: '🎯',
    color: 'text-purple-300 border-purple-500/40 bg-purple-950/40',
  },
  administrative: {
    label: '政务行政',
    icon: '🏛️',
    color: 'text-sky-300 border-sky-500/40 bg-sky-950/40',
  },
  custom: {
    label: '特殊编制',
    icon: '✨',
    color: 'text-pink-300 border-pink-500/40 bg-pink-950/40',
  },
};

const RELATION_TYPE_CONFIGS: Record<
  FactionRelation['relationType'],
  { label: string; icon: string; color: string; defaultAttitude: string }
> = {
  ally: {
    label: '同盟 · 生死契约',
    icon: '🤝',
    color: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40',
    defaultAttitude: '视对方为值得完全信赖的盟友与同伴，言语温和真诚、并肩作战，绝不背叛。',
  },
  hostile: {
    label: '敌对 · 宿命死战',
    icon: '⚔️',
    color: 'text-rose-300 border-rose-500/40 bg-rose-950/40',
    defaultAttitude: '视对方为不共戴天的死敌与侵略恶势力！言语充满警惕抗拒与敌意，誓死捍卫阵营尊严！',
  },
  neutral: {
    label: '中立 · 商业往来',
    icon: '⚖️',
    color: 'text-zinc-300 border-zinc-700 bg-zinc-900',
    defaultAttitude: '保持客观中立与礼貌距离，恪守契约协议，互不干涉内政。',
  },
  subordinate: {
    label: '臣属 · 附属护卫',
    icon: '👑',
    color: 'text-amber-300 border-amber-500/40 bg-amber-950/40',
    defaultAttitude: '恪守上下尊卑与宗主指令，言语恭敬严谨，誓死守护宗主阵营。',
  },
  rival: {
    label: '竞争 · 谍战试探',
    icon: '👁️',
    color: 'text-purple-300 border-purple-500/40 bg-purple-950/40',
    defaultAttitude: '暗中较劲比拼，互相提防试探，在言语上针锋相对但保持克制。',
  },
  infiltrated: {
    label: '渗透 · 暗中潜伏',
    icon: '🕵️',
    color: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/40',
    defaultAttitude: '表面顺从合作，实则暗中收集情报、寻找致命弱点与破绽。',
  },
  custom: {
    label: '自定义特殊关系',
    icon: '✨',
    color: 'text-pink-300 border-pink-500/40 bg-pink-950/40',
    defaultAttitude: '遵从自定义关系提示词指导互动。',
  },
};

const ATTITUDE_PRESETS: any[] = [];

export const FactionManagerTab: React.FC<FactionManagerTabProps> = ({
  factions,
  heroines,
  onUpdateFactions,
  onUpdateHero,
  onUpdateAllHeroes,
}) => {
  const [selectedFactionId, setSelectedFactionId] = useState<string>(factions[0]?.id || 'unassigned');
  const [isEditingFaction, setIsEditingFaction] = useState(false);
  const [isCreatingFaction, setIsCreatingFaction] = useState(false);

  // Faction form state (制度，稳定度，人口，国家理念)
  const [factionNameInput, setFactionNameInput] = useState('');
  const [factionShortNameInput, setFactionShortNameInput] = useState('');
  const [factionSystemInput, setFactionSystemInput] = useState('');
  const [factionStabilityInput, setFactionStabilityInput] = useState('');
  const [factionPopulationInput, setFactionPopulationInput] = useState('');
  const [factionNationalIdeaInput, setFactionNationalIdeaInput] = useState('');
  const [factionDescInput, setFactionDescInput] = useState('');

  // Relation form state
  const [relTargetFactionId, setRelTargetFactionId] = useState<string>('');
  const [relTypeInput, setRelTypeInput] = useState<FactionRelation['relationType']>('hostile');
  const [relNameInput, setRelNameInput] = useState('');
  const [relDescInput, setRelDescInput] = useState('');
  const [relAttitudeInput, setRelAttitudeInput] = useState('');
  const [relBiSync, setRelBiSync] = useState(true);
  const [isEditingRelation, setIsEditingRelation] = useState(false);

  // Unassigned hero assign state
  const [assigningHeroId, setAssigningHeroId] = useState<string | null>(null);
  const [targetFactionForHero, setTargetFactionForHero] = useState<string>(factions[0]?.id || '');
  const [targetSubFactionForHero, setTargetSubFactionForHero] = useState<string>('');
  const [targetRoleForHero, setTargetRoleForHero] = useState<string>('特勤干员');
  const [targetTitleForHero, setTargetTitleForHero] = useState<string>('核心主属');

  // Sub-faction form & UI state
  const [isEditingSubFaction, setIsEditingSubFaction] = useState(false);
  const [isCreatingSubFaction, setIsCreatingSubFaction] = useState(false);
  const [editingSubFactionId, setEditingSubFactionId] = useState<string | null>(null);
  const [subFactionNameInput, setSubFactionNameInput] = useState('');
  const [subFactionCodeInput, setSubFactionCodeInput] = useState('');
  const [subFactionLeaderInput, setSubFactionLeaderInput] = useState('');
  const [subFactionTypeInput, setSubFactionTypeInput] = useState<NonNullable<SubFaction['type']>>('military');
  const [subFactionDescInput, setSubFactionDescInput] = useState('');
  const [memberSubFactionFilter, setMemberSubFactionFilter] = useState<string>('all');
  const [memberListViewMode, setMemberListViewMode] = useState<'flat' | 'grouped'>('flat');
  const [assigningSubFactionId, setAssigningSubFactionId] = useState<string | null>(null);
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [assignRoleInput, setAssignRoleInput] = useState('特派干员');

  const unassignedHeroes = heroines.filter((h) => isHeroUnassigned(h, factions));

  const isViewingUnassigned = selectedFactionId === 'unassigned';
  const currentFaction = isViewingUnassigned ? null : (factions.find((f) => f.id === selectedFactionId) || factions[0]);
  const otherFactions = currentFaction ? factions.filter((f) => f.id !== currentFaction?.id) : [];

  // Handler for adding/updating hero membership in a faction
  const handleAssignHeroToFaction = (
    heroId: string,
    factionId: string,
    role?: string,
    title?: string,
    priority?: number,
    subFactionId?: string,
    subFactionName?: string,
    membershipType?: string,
    originCountry?: string,
    affiliationNature?: string,
    subFactionOnly?: boolean
  ) => {
    ultraAudio.playUiClick();
    const heroToUpdate = heroines.find((h) => h.id === heroId);
    if (!heroToUpdate) return;

    if (factionId === 'unassigned' || !factionId) {
      const updatedHero: Ultrawoman = {
        ...heroToUpdate,
        factionId: undefined,
        factionRole: undefined,
        factionMemberships: [],
      };
      if (onUpdateHero) onUpdateHero(updatedHero);
      else if (onUpdateAllHeroes) onUpdateAllHeroes(heroines.map((h) => (h.id === heroId ? updatedHero : h)));
    } else {
      const targetFac = factions.find((f) => f.id === factionId);
      const subObj = subFactionId ? targetFac?.subFactions?.find((s) => s.id === subFactionId) : undefined;
      const effectiveSubName = subFactionName || subObj?.name || undefined;
      const autoOrigin = originCountry || heroToUpdate.nativeCountry || (heroToUpdate.factionMemberships?.[0] ? factions.find((f) => f.id === heroToUpdate.factionMemberships?.[0]?.factionId)?.name : heroToUpdate.homePlanet);

      const isSubOnly = Boolean(subFactionOnly || membershipType === 'sub_unit_only');
      const resolvedType = membershipType || (isSubOnly ? 'sub_unit_only' : priority === 1 ? 'core' : 'foreign_subordinate');
      const resolvedTitle = title?.trim() || (isSubOnly ? '从属编制干员' : priority === 1 ? '核心主属' : '他国从属干员');

      const updatedHero = addOrUpdateHeroFactionMembership(
        heroToUpdate,
        {
          factionId,
          role: role?.trim() || (isSubOnly ? '编制干员' : '战术成员'),
          title: resolvedTitle,
          priority,
          subFactionId: subFactionId || undefined,
          subFactionName: effectiveSubName,
          membershipType: resolvedType,
          originCountry: autoOrigin,
          affiliationNature: affiliationNature || (isSubOnly ? '独立从属编制' : undefined),
          subFactionOnly: isSubOnly,
        },
        undefined,
        priority,
        resolvedTitle,
        undefined,
        factions,
        subFactionId || undefined,
        effectiveSubName,
        resolvedType,
        autoOrigin,
        affiliationNature,
        isSubOnly
      );
      if (onUpdateHero) onUpdateHero(updatedHero);
      else if (onUpdateAllHeroes) onUpdateAllHeroes(heroines.map((h) => (h.id === heroId ? updatedHero : h)));
    }
    setAssigningHeroId(null);
  };

  // Sub-faction handlers
  const handleOpenCreateSubFaction = () => {
    ultraAudio.playUiClick();
    setIsCreatingSubFaction(true);
    setIsEditingSubFaction(false);
    setEditingSubFactionId(null);
    setSubFactionNameInput('');
    setSubFactionCodeInput('');
    setSubFactionLeaderInput('');
    setSubFactionTypeInput('military');
    setSubFactionDescInput('');
  };

  const handleOpenEditSubFaction = (sub: SubFaction) => {
    ultraAudio.playUiClick();
    setIsEditingSubFaction(true);
    setIsCreatingSubFaction(false);
    setEditingSubFactionId(sub.id);
    setSubFactionNameInput(sub.name);
    setSubFactionCodeInput(sub.code || '');
    setSubFactionLeaderInput(sub.leader || '');
    setSubFactionTypeInput(sub.type || 'military');
    setSubFactionDescInput(sub.description || '');
  };

  const handleSaveSubFaction = () => {
    if (!currentFaction || !subFactionNameInput.trim()) return;
    ultraAudio.playUiClick();

    const subId = isCreatingSubFaction ? `sub_${Date.now()}` : (editingSubFactionId || `sub_${Date.now()}`);
    const subToSave: SubFaction = {
      id: subId,
      name: subFactionNameInput.trim(),
      code: subFactionCodeInput.trim() || undefined,
      leader: subFactionLeaderInput.trim() || undefined,
      type: subFactionTypeInput,
      description: subFactionDescInput.trim() || undefined,
    };

    const updatedFactions = addOrUpdateSubFaction(currentFaction.id, subToSave, factions);
    onUpdateFactions(updatedFactions);

    // If edited, also sync hero memberships with new subFactionName
    if (!isCreatingSubFaction && onUpdateAllHeroes) {
      const updatedHeroines = heroines.map((h) => {
        if (!h.factionMemberships) return h;
        const hasSub = h.factionMemberships.some((m) => m.subFactionId === subId);
        if (hasSub) {
          return {
            ...h,
            factionMemberships: h.factionMemberships.map((m) =>
              m.subFactionId === subId ? { ...m, subFactionName: subToSave.name } : m
            ),
          };
        }
        return h;
      });
      onUpdateAllHeroes(updatedHeroines);
    }

    setIsCreatingSubFaction(false);
    setIsEditingSubFaction(false);
    setEditingSubFactionId(null);
  };

  const handleDeleteSubFaction = (subIdToDelete: string) => {
    if (!currentFaction) return;
    ultraAudio.playUiClick();
    const sub = currentFaction.subFactions?.find((s) => s.id === subIdToDelete);
    if (!window.confirm(`确定要删除从属组织【${sub?.name || subIdToDelete}】吗？`)) return;

    const updatedFactions = deleteSubFaction(currentFaction.id, subIdToDelete, factions);
    onUpdateFactions(updatedFactions);

    // Also clear deleted subFactionId from heroes
    if (onUpdateAllHeroes) {
      const updatedHeroines = heroines.map((h) => {
        if (!h.factionMemberships) return h;
        const hasSub = h.factionMemberships.some((m) => m.subFactionId === subIdToDelete);
        if (hasSub) {
          return {
            ...h,
            factionMemberships: h.factionMemberships.map((m) =>
              m.subFactionId === subIdToDelete
                ? { ...m, subFactionId: undefined, subFactionName: undefined }
                : m
            ),
          };
        }
        return h;
      });
      onUpdateAllHeroes(updatedHeroines);
    }
  };

  // Handler for changing hero's sub-faction inside current faction
  const handleUpdateHeroSubFaction = (heroId: string, subFactionId: string) => {
    if (!currentFaction) return;
    ultraAudio.playUiClick();
    const heroToUpdate = heroines.find((h) => h.id === heroId);
    if (!heroToUpdate) return;

    const sub = currentFaction.subFactions?.find((s) => s.id === subFactionId);
    const subName = sub?.name || undefined;

    const memberships = getHeroFactionMemberships(heroToUpdate, factions);
    const currentMem = memberships.find((m) => m.factionId === currentFaction.id);

    const updatedHero = addOrUpdateHeroFactionMembership(heroToUpdate, {
      factionId: currentFaction.id,
      role: currentMem?.role || heroToUpdate.factionRole || '特勤干员',
      title: currentMem?.title || '核心主属',
      priority: currentMem?.priority || 1,
      subFactionId: subFactionId === 'none' ? undefined : (subFactionId || undefined),
      subFactionName: subFactionId === 'none' ? undefined : subName,
    });

    if (onUpdateHero) onUpdateHero(updatedHero);
    else if (onUpdateAllHeroes) onUpdateAllHeroes(heroines.map((h) => (h.id === heroId ? updatedHero : h)));
  };

  // Handler for removing a specific faction from a hero
  const handleRemoveHeroFromFaction = (heroId: string, factionId: string) => {
    ultraAudio.playUiClick();
    const heroToUpdate = heroines.find((h) => h.id === heroId);
    if (!heroToUpdate) return;

    const updatedHero = removeHeroFromFaction(heroToUpdate, factionId);
    if (onUpdateHero) onUpdateHero(updatedHero);
    else if (onUpdateAllHeroes) onUpdateAllHeroes(heroines.map((h) => (h.id === heroId ? updatedHero : h)));
  };

  // Handler for moving priority
  const handleMoveHeroPriority = (heroId: string, factionId: string, direction: 'up' | 'down') => {
    ultraAudio.playUiClick();
    const heroToUpdate = heroines.find((h) => h.id === heroId);
    if (!heroToUpdate) return;

    const updatedHero = moveHeroFactionPriority(heroToUpdate, factionId, direction);
    if (onUpdateHero) onUpdateHero(updatedHero);
    else if (onUpdateAllHeroes) onUpdateAllHeroes(heroines.map((h) => (h.id === heroId ? updatedHero : h)));
  };

  // Handler for setting as primary faction
  const handleSetHeroPrimaryFaction = (heroId: string, factionId: string) => {
    ultraAudio.playUiClick();
    const heroToUpdate = heroines.find((h) => h.id === heroId);
    if (!heroToUpdate) return;

    const updatedHero = setHeroFactionAsPrimary(heroToUpdate, factionId);
    if (onUpdateHero) onUpdateHero(updatedHero);
    else if (onUpdateAllHeroes) onUpdateAllHeroes(heroines.map((h) => (h.id === heroId ? updatedHero : h)));
  };

  // Open Create Faction Form
  const handleOpenCreateFaction = () => {
    ultraAudio.playUiClick();
    setIsCreatingFaction(true);
    setIsEditingFaction(false);
    setFactionNameInput('新建自定义势力');
    setFactionShortNameInput('新势力');
    setFactionSystemInput('神圣君主立宪制 / 议会制');
    setFactionStabilityInput('85% (相对稳定)');
    setFactionPopulationInput('100亿');
    setFactionNationalIdeaInput('守护母星与星区安宁，探索深空宇宙');
    setFactionDescInput('');
  };

  // Open Edit Faction Form
  const handleOpenEditFaction = (f: Faction) => {
    ultraAudio.playUiClick();
    setIsEditingFaction(true);
    setIsCreatingFaction(false);
    setSelectedFactionId(f.id);
    setFactionNameInput(f.name);
    setFactionShortNameInput(f.shortName || f.name);
    setFactionSystemInput(f.system || '');
    setFactionStabilityInput(f.stability || '');
    setFactionPopulationInput(f.population || '');
    setFactionNationalIdeaInput(f.nationalIdea || '');
    setFactionDescInput(f.description || '');
  };

  // Save Faction (Create or Edit)
  const handleSaveFaction = () => {
    if (!factionNameInput.trim()) return;
    ultraAudio.playUiClick();

    if (isCreatingFaction) {
      const newFactionId = `faction_custom_${Date.now()}`;
      const newFaction: Faction = {
        id: newFactionId,
        name: factionNameInput.trim(),
        shortName: factionShortNameInput.trim() || factionNameInput.trim(),
        system: factionSystemInput.trim(),
        stability: factionStabilityInput.trim(),
        population: factionPopulationInput.trim(),
        nationalIdea: factionNationalIdeaInput.trim(),
        description: factionDescInput.trim(),
        isCustom: true,
        relations: [],
      };
      const updatedList = [...factions, newFaction];
      onUpdateFactions(updatedList);
      setSelectedFactionId(newFactionId);
      setIsCreatingFaction(false);
    } else if (isEditingFaction && currentFaction) {
      const updatedList = factions.map((f) => {
        if (f.id === currentFaction.id) {
          return {
            ...f,
            name: factionNameInput.trim(),
            shortName: factionShortNameInput.trim() || factionNameInput.trim(),
            system: factionSystemInput.trim(),
            stability: factionStabilityInput.trim(),
            population: factionPopulationInput.trim(),
            nationalIdea: factionNationalIdeaInput.trim(),
            description: factionDescInput.trim(),
          };
        }
        return f;
      });
      onUpdateFactions(updatedList);
      setIsEditingFaction(false);
    }
  };

  // Delete Faction
  const handleDeleteFaction = (factionIdToDelete: string) => {
    if (factions.length <= 1) {
      alert('至少需要保留一个阵营！');
      return;
    }
    ultraAudio.playUiClick();
    const fToDelete = factions.find((f) => f.id === factionIdToDelete);
    if (!window.confirm(`确定要删除阵营【${fToDelete?.name || factionIdToDelete}】吗？`)) {
      return;
    }

    const updatedList = factions
      .filter((f) => f.id !== factionIdToDelete)
      .map((f) => ({
        ...f,
        relations: f.relations ? f.relations.filter((r) => r.targetFactionId !== factionIdToDelete) : [],
      }));

    onUpdateFactions(updatedList);
    setSelectedFactionId(updatedList[0]?.id || '');
    setIsEditingFaction(false);
    setIsCreatingFaction(false);
  };

  // Reset to default factions
  const handleRestoreDefaults = () => {
    if (window.confirm('确定要重置所有阵营与外交关系为官方默认设定吗？自定义的阵营改动将被覆盖。')) {
      ultraAudio.playUiClick();
      onUpdateFactions(DEFAULT_FACTIONS);
      setSelectedFactionId(DEFAULT_FACTIONS[0]?.id || '');
      setIsEditingFaction(false);
      setIsCreatingFaction(false);
    }
  };

  // Open Edit Relation Form
  const handleOpenEditRelation = (r?: FactionRelation) => {
    ultraAudio.playUiClick();
    setIsEditingRelation(true);
    if (r) {
      setRelTargetFactionId(r.targetFactionId);
      setRelTypeInput(r.relationType);
      setRelNameInput(r.relationName || '');
      setRelDescInput(r.description || '');
      setRelAttitudeInput(r.attitudePrompt || '');
    } else {
      const defaultTarget = otherFactions[0]?.id || '';
      setRelTargetFactionId(defaultTarget);
      setRelTypeInput('hostile');
      setRelNameInput('宿命敌对');
      setRelDescInput('');
      setRelAttitudeInput(RELATION_TYPE_CONFIGS.hostile.defaultAttitude);
    }
  };

  // Save Relation
  const handleSaveRelation = () => {
    if (!currentFaction || !relTargetFactionId) return;
    ultraAudio.playUiClick();

    const targetFaction = factions.find((f) => f.id === relTargetFactionId);
    const newRelation: FactionRelation = {
      targetFactionId: relTargetFactionId,
      relationType: relTypeInput,
      relationName: relNameInput.trim() || RELATION_TYPE_CONFIGS[relTypeInput].label,
      description: relDescInput.trim(),
      attitudePrompt: relAttitudeInput.trim() || RELATION_TYPE_CONFIGS[relTypeInput].defaultAttitude,
    };

    const currentRelations = currentFaction.relations ? [...currentFaction.relations] : [];
    const existingIdx = currentRelations.findIndex((r) => r.targetFactionId === relTargetFactionId);

    if (existingIdx >= 0) {
      currentRelations[existingIdx] = newRelation;
    } else {
      currentRelations.push(newRelation);
    }

    let updatedFactions = factions.map((f) => {
      if (f.id === currentFaction.id) {
        return {
          ...f,
          relations: currentRelations,
        };
      }
      return f;
    });

    // Bi-directional sync
    if (relBiSync && targetFaction) {
      const targetRelations = targetFaction.relations ? [...targetFaction.relations] : [];
      const reverseIdx = targetRelations.findIndex((r) => r.targetFactionId === currentFaction.id);
      const reverseRelation: FactionRelation = {
        targetFactionId: currentFaction.id,
        relationType: relTypeInput,
        relationName: relNameInput.trim() || RELATION_TYPE_CONFIGS[relTypeInput].label,
        description: relDescInput.trim(),
        attitudePrompt: `【对待${currentFaction.name}】：遵从【${newRelation.relationName}】立场，${relAttitudeInput.trim() || RELATION_TYPE_CONFIGS[relTypeInput].defaultAttitude}`,
      };

      if (reverseIdx >= 0) {
        targetRelations[reverseIdx] = reverseRelation;
      } else {
        targetRelations.push(reverseRelation);
      }

      updatedFactions = updatedFactions.map((f) => {
        if (f.id === targetFaction.id) {
          return {
            ...f,
            relations: targetRelations,
          };
        }
        return f;
      });
    }

    onUpdateFactions(updatedFactions);
    setIsEditingRelation(false);
  };

  // Delete Relation
  const handleDeleteRelation = (targetFactionIdToDelete: string) => {
    if (!currentFaction) return;
    ultraAudio.playUiClick();
    const updatedRelations = (currentFaction.relations || []).filter(
      (r) => r.targetFactionId !== targetFactionIdToDelete
    );
    const updatedFactions = factions.map((f) => {
      if (f.id === currentFaction.id) {
        return {
          ...f,
          relations: updatedRelations,
        };
      }
      return f;
    });
    onUpdateFactions(updatedFactions);
  };

  return (
    <div className="space-y-6 font-mono text-zinc-100">
      
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/80 p-4 rounded-xl border border-zinc-800">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-amber-300">
              阵营势力与阵营间外交关系设定系统
            </h2>
            <p className="text-[11px] text-zinc-400">
              自定义宇宙势力阵营（制度、稳定度、人口、国家理念），设定阵营间同盟、敌对与外交关系，AI 对白将精准遵从阵营立场与互动态度！
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenCreateFaction}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>新建势力阵营</span>
          </button>

          <button
            onClick={handleRestoreDefaults}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            title="恢复官方默认 5 大阵营与关系矩阵"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重置默认</span>
          </button>
        </div>
      </div>

      {/* Factions Horizontal Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {factions.map((f) => {
          const isSelected = !isViewingUnassigned && f.id === currentFaction?.id;
          const memberCount = heroines.filter((h) => isHeroInFaction(h, f.id, factions)).length;
          return (
            <button
              key={f.id}
              onClick={() => {
                ultraAudio.playUiClick();
                setSelectedFactionId(f.id);
                setIsEditingFaction(false);
                setIsCreatingFaction(false);
                setIsEditingRelation(false);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
                isSelected
                  ? 'bg-zinc-900 text-amber-300 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/50'
                  : 'bg-zinc-950/80 text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <Shield className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`} />
              <span>{f.name}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-950 border border-zinc-700 text-zinc-400">
                {memberCount} 角色
              </span>
            </button>
          );
        })}

        {/* Unassigned / Freelance Faction Tab */}
        <button
          onClick={() => {
            ultraAudio.playUiClick();
            setSelectedFactionId('unassigned');
            setIsEditingFaction(false);
            setIsCreatingFaction(false);
            setIsEditingRelation(false);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
            isViewingUnassigned
              ? 'bg-zinc-900 text-blue-300 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.25)] ring-1 ring-blue-500/50'
              : 'bg-zinc-950/80 text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <Users className={`w-3.5 h-3.5 ${isViewingUnassigned ? 'text-blue-400' : 'text-zinc-500'}`} />
          <span>未指定阵营 · 自由角色</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-950 border border-zinc-700 text-blue-400 font-bold">
            {unassignedHeroes.length} 位
          </span>
        </button>
      </div>

      {/* Create / Edit Faction Form */}
      {(isCreatingFaction || isEditingFaction) && (
        <div className="bg-zinc-950 p-5 rounded-xl border border-blue-500/50 space-y-4 animate-fade-in shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <h3 className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span>{isCreatingFaction ? '新建自定义阵营势力' : `编辑阵营: 【${currentFaction?.name}】`}</span>
            </h3>
            <button
              onClick={() => {
                setIsCreatingFaction(false);
                setIsEditingFaction(false);
              }}
              className="text-zinc-400 hover:text-zinc-200 text-xs cursor-pointer"
            >
              取消
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-zinc-300 font-bold mb-1">阵营全称</label>
              <input
                type="text"
                value={factionNameInput}
                onChange={(e) => setFactionNameInput(e.target.value)}
                placeholder="例如：我的阵营、敌对阵营..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-bold mb-1">阵营简称 (标签用)</label>
              <input
                type="text"
                value={factionShortNameInput}
                onChange={(e) => setFactionShortNameInput(e.target.value)}
                placeholder="例如：星光同盟、暗影议会..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-zinc-300 font-bold mb-1 flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-amber-400" />
                <span>制度</span>
              </label>
              <input
                type="text"
                value={factionSystemInput}
                onChange={(e) => setFactionSystemInput(e.target.value)}
                placeholder="例如：神圣议会制 / 光之联邦制、至高霸权独裁制..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-bold mb-1 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>稳定度</span>
              </label>
              <input
                type="text"
                value={factionStabilityInput}
                onChange={(e) => setFactionStabilityInput(e.target.value)}
                placeholder="例如：92% (高度稳定)、68% (高压控制)..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-bold mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                <span>人口</span>
              </label>
              <input
                type="text"
                value={factionPopulationInput}
                onChange={(e) => setFactionPopulationInput(e.target.value)}
                placeholder="例如：380亿 光子生命体、1200亿 异形暗影生灵..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-bold mb-1 text-xs flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>国家理念</span>
            </label>
            <input
              type="text"
              value={factionNationalIdeaInput}
              onChange={(e) => setFactionNationalIdeaInput(e.target.value)}
              placeholder="例如：守护宇宙秩序与正义之光，誓死庇护全宇宙弱小文明与生命繁衍..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-bold mb-1 text-xs flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              <span>阵营详细背景、组织架构与宗旨描述 (`description`)</span>
            </label>
            <textarea
              rows={3}
              value={factionDescInput}
              onChange={(e) => setFactionDescInput(e.target.value)}
              placeholder="详细描述该势力的起源历史、势力范围、战术风格与核心目标..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-100 focus:border-blue-500 outline-none resize-y leading-relaxed"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              onClick={() => {
                setIsCreatingFaction(false);
                setIsEditingFaction(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-700 text-xs cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleSaveFaction}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>保存阵营资料</span>
            </button>
          </div>
        </div>
      )}

      {/* UNASSIGNED FACTION PANEL */}
      {isViewingUnassigned && (
        <div className="bg-zinc-950/90 p-5 rounded-2xl border border-zinc-800 space-y-4 shadow-sm animate-fade-in">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800/80 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-blue-400 shadow-inner">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-100">未指定阵营 · 自由游侠 / 独立角色</h3>
                  <span className="text-[10px] text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded-full font-bold">
                    独立状态 ({unassignedHeroes.length} 位)
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  所有导入角色卡或尚未分配固定势力的角色均在此处归档。可在此处为她们快速指派阵营归属与职务。
                </p>
              </div>
            </div>
          </div>

          {/* Unassigned Heroes List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>未指定阵营角色列表 ({unassignedHeroes.length} 位)</span>
              </span>
            </div>

            {unassignedHeroes.length === 0 ? (
              <div className="p-8 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-center space-y-2">
                <Users className="w-8 h-8 mx-auto text-zinc-600" />
                <p className="text-xs text-zinc-400 font-bold">当前没有未指定阵营的角色</p>
                <p className="text-[11px] text-zinc-500">
                  所有在役角色均已分配至特定阵营。当通过角色卡导入新角色时，将默认自动存入此处。
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unassignedHeroes.map((hero) => {
                  const isAssigning = assigningHeroId === hero.id;

                  return (
                    <div
                      key={hero.id}
                      className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start space-x-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-inner"
                          style={{
                            backgroundColor: hero.colorTheme?.primary || '#3b82f6',
                          }}
                        >
                          {hero.name.slice(0, 1)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-zinc-100 truncate">{hero.name}</h4>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
                              {hero.homePlanet ? hero.homePlanet.split(' ')[0] : '未知星球'}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {hero.title || '战术干员'} {hero.race ? `· ${hero.race}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Assignment Form or Button */}
                      {isAssigning ? (
                        <div className="bg-zinc-950 p-2.5 rounded-lg border border-blue-500/50 space-y-2 animate-fade-in text-xs">
                          <div className="text-[11px] font-bold text-blue-300">指派加入阵营与从属组织:</div>
                          {(() => {
                            const chosenFac = factions.find((f) => f.id === targetFactionForHero);
                            const subList = chosenFac?.subFactions || [];
                            return (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[10px] text-zinc-400 mb-0.5">目标阵营</label>
                                  <select
                                    value={targetFactionForHero}
                                    onChange={(e) => {
                                      setTargetFactionForHero(e.target.value);
                                      setTargetSubFactionForHero('');
                                    }}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-1 text-zinc-100 text-xs outline-none"
                                  >
                                    {factions.map((f) => (
                                      <option key={f.id} value={f.id}>
                                        {f.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-zinc-400 mb-0.5">从属分支/编制</label>
                                  <select
                                    value={targetSubFactionForHero}
                                    onChange={(e) => setTargetSubFactionForHero(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-1 text-zinc-100 text-xs outline-none"
                                  >
                                    <option value="">-- 无特定从属编制 --</option>
                                    {subList.map((sf) => (
                                      <option key={sf.id} value={sf.id}>
                                        {sf.name} {sf.code ? `(${sf.code})` : ''}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-zinc-400 mb-0.5">阵营职务身份</label>
                                  <input
                                    type="text"
                                    value={targetRoleForHero}
                                    onChange={(e) => setTargetRoleForHero(e.target.value)}
                                    placeholder="例如: 战术队长 / 圣殿卫士"
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-1 text-zinc-100 text-xs outline-none"
                                  />
                                </div>
                              </div>
                            );
                          })()}
                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              onClick={() => setAssigningHeroId(null)}
                              className="px-2 py-1 rounded bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-[11px]"
                            >
                              取消
                            </button>
                            <button
                              onClick={() =>
                                handleAssignHeroToFaction(
                                  hero.id,
                                  targetFactionForHero,
                                  targetRoleForHero,
                                  '核心主属',
                                  1,
                                  targetSubFactionForHero || undefined
                                )
                              }
                              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow-sm cursor-pointer"
                            >
                              确认指派
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                          <span className="text-[10px] text-zinc-500">当前状态: 自由独立游侠</span>
                          <button
                            onClick={() => {
                              ultraAudio.playUiClick();
                              setAssigningHeroId(hero.id);
                              setTargetFactionForHero(factions[0]?.id || '');
                              setTargetSubFactionForHero('');
                              setTargetRoleForHero(hero.factionRole || '特勤干员');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>指派阵营</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Faction Detail Card */}
      {currentFaction && !isCreatingFaction && !isEditingFaction && (
        <div className="bg-zinc-950/90 p-5 rounded-2xl border border-zinc-800 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800/80 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-amber-400 shadow-inner">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-100">{currentFaction.name}</h3>
                  {currentFaction.shortName && currentFaction.shortName !== currentFaction.name && (
                    <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      简称: {currentFaction.shortName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleOpenEditFaction(currentFaction)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>编辑阵营信息</span>
              </button>

              {factions.length > 1 && (
                <button
                  onClick={() => handleDeleteFaction(currentFaction.id)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/50 text-rose-400 hover:border-rose-500/50 border border-zinc-800 transition-all cursor-pointer"
                  title="删除此阵营"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 4 Core Attributes Grid: 制度，稳定度，人口，国家理念 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 space-y-1">
              <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" />
                <span>制度</span>
              </div>
              <p className="text-xs text-zinc-200 font-medium break-words leading-relaxed">
                {currentFaction.system || '未设定'}
              </p>
            </div>

            <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 space-y-1">
              <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>稳定度</span>
              </div>
              <p className="text-xs text-zinc-200 font-medium break-words leading-relaxed">
                {currentFaction.stability || '未设定'}
              </p>
            </div>

            <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 space-y-1">
              <div className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>人口</span>
              </div>
              <p className="text-xs text-zinc-200 font-medium break-words leading-relaxed">
                {currentFaction.population || '未设定'}
              </p>
            </div>

            <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 space-y-1 sm:col-span-2 lg:col-span-1">
              <div className="text-[11px] font-bold text-indigo-400 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                <span>国家理念</span>
              </div>
              <p className="text-xs text-zinc-200 font-medium break-words leading-relaxed">
                {currentFaction.nationalIdea || '未设定'}
              </p>
            </div>
          </div>

          {/* Detailed Background Description */}
          <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/60 space-y-1.5">
            <div className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>阵营详细背景与宗旨描述</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {currentFaction.description || '暂无阵营详细故事描述。'}
            </p>
          </div>

          {/* SUB-FACTIONS (从属组织 / 下属部门编制) SECTION */}
          <div className="space-y-3 pt-3 border-t border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <h4 className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                  从属组织与下属编制机构 ({currentFaction.subFactions?.length || 0} 个从属部门)
                </h4>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateSubFaction}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新建下属从属组织</span>
              </button>
            </div>

            {/* Sub-Faction Inline Create/Edit Form */}
            {(isCreatingSubFaction || isEditingSubFaction) && (
              <div className="bg-zinc-950 p-4 rounded-xl border border-sky-500/50 space-y-3 animate-fade-in shadow-md">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>{isCreatingSubFaction ? '➕ 新建从属组织' : '✏️ 编辑从属组织'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingSubFaction(false);
                      setIsEditingSubFaction(false);
                    }}
                    className="text-zinc-400 hover:text-zinc-200 text-xs cursor-pointer"
                  >
                    取消
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">
                      从属组织名称 <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={subFactionNameInput}
                      onChange={(e) => setSubFactionNameInput(e.target.value)}
                      placeholder="例如：圣堂裁决卫队、星辉先锋舰队..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 outline-none font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">编制代号/缩写</label>
                    <input
                      type="text"
                      value={subFactionCodeInput}
                      onChange={(e) => setSubFactionCodeInput(e.target.value)}
                      placeholder="例如：ST-GUARD, SV-CRUISER..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 outline-none uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">编制类型</label>
                    <select
                      value={subFactionTypeInput}
                      onChange={(e) => setSubFactionTypeInput(e.target.value as NonNullable<SubFaction['type']>)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 outline-none font-bold cursor-pointer"
                    >
                      {Object.entries(SUB_FACTION_TYPE_CONFIGS).map(([k, conf]) => (
                        <option key={k} value={k}>
                          {conf.icon} {conf.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">主官头衔/领导者</label>
                    <input
                      type="text"
                      value={subFactionLeaderInput}
                      onChange={(e) => setSubFactionLeaderInput(e.target.value)}
                      placeholder="例如：大裁决长、首席战术总监..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-sky-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1 text-xs">
                    从属组织职能定位与编制描述 (`description`)
                  </label>
                  <textarea
                    rows={2}
                    value={subFactionDescInput}
                    onChange={(e) => setSubFactionDescInput(e.target.value)}
                    placeholder="描述该下属部队、部门或机构的特殊使命、技术特长与管辖范围..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100 focus:border-sky-500 outline-none resize-y leading-relaxed"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingSubFaction(false);
                      setIsEditingSubFaction(false);
                    }}
                    className="px-3 py-1 rounded bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-700 text-xs cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSubFaction}
                    className="px-4 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer shadow-sm flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>保存从属组织</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sub-Factions List Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentFaction.subFactions && currentFaction.subFactions.length > 0 ? (
                currentFaction.subFactions.map((sub) => {
                  const typeConf = SUB_FACTION_TYPE_CONFIGS[sub.type || 'military'] || SUB_FACTION_TYPE_CONFIGS.custom;
                  const assignedHeroes = heroines.filter((h) =>
                    isHeroInSubFaction(h, sub.id, factions)
                  );

                  return (
                    <div
                      key={sub.id}
                      className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800 flex flex-col justify-between space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h5 className="text-xs font-bold text-zinc-100 flex items-center gap-1">
                              <span>{sub.name}</span>
                            </h5>
                            {sub.code && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-950 border border-zinc-700 text-zinc-300 font-bold">
                                {sub.code}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.2 rounded border ${typeConf.color}`}>
                              {typeConf.icon} {typeConf.label}
                            </span>
                          </div>

                          {sub.leader && (
                            <p className="text-[10px] text-amber-300/90 flex items-center gap-1">
                              <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>主官: {sub.leader}</span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSubFaction(sub)}
                            className="p-1 rounded bg-zinc-950 text-zinc-400 hover:text-sky-300 border border-zinc-800 cursor-pointer"
                            title="编辑从属组织"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubFaction(sub.id)}
                            className="p-1 rounded bg-zinc-950 text-zinc-400 hover:text-rose-400 border border-zinc-800 cursor-pointer"
                            title="删除从属组织"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {sub.description && (
                        <p className="text-[11px] text-zinc-300 leading-relaxed break-words">
                          {sub.description}
                        </p>
                      )}

                      {/* Assigned Heroes in this Sub-Faction */}
                      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="text-zinc-500 font-bold shrink-0">
                            编制人员 ({assignedHeroes.length} 位):
                          </span>
                          <div className="flex flex-wrap gap-1 items-center">
                            {assignedHeroes.length > 0 ? (
                              assignedHeroes.map((ah) => (
                                <span
                                  key={ah.id}
                                  className="px-1.5 py-0.2 rounded bg-sky-950/80 border border-sky-600/40 text-sky-200 text-[10px] font-bold"
                                >
                                  {ah.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-zinc-600 text-[10px] italic">暂无分配</span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            ultraAudio.playUiClick();
                            setAssigningSubFactionId(sub.id);
                            setAssignSearchQuery('');
                            setAssignRoleInput('特派干员');
                          }}
                          className="px-2 py-0.5 rounded bg-sky-950/90 border border-sky-600/50 text-sky-300 hover:bg-sky-900 hover:text-white transition-colors text-[10px] font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                          title="调派角色加入或移出该从属编制"
                        >
                          <UserPlus className="w-3 h-3 text-sky-400" />
                          <span>调派角色</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 py-4 text-center text-xs text-zinc-500 bg-zinc-900/40 rounded-xl border border-zinc-800/60">
                  暂未设立下属从属组织，点击右上角「新建下属从属组织」为该势力建立军团、部门或战术编制
                </div>
              )}
            </div>
          </div>

          {/* Members of this Faction */}
          <div className="space-y-2.5 pt-3 border-t border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-zinc-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>归属/兼任此阵营的角色 ({heroines.filter((h) => isHeroInFaction(h, currentFaction.id, factions)).length} 位)</span>
              </span>

              <div className="flex items-center gap-2">
                {/* View Mode Toggle: Flat vs Grouped */}
                <div className="flex items-center space-x-1 bg-zinc-900 p-0.5 rounded border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setMemberListViewMode('flat');
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      memberListViewMode === 'flat'
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title="平铺视图"
                  >
                    <Grid className="w-3 h-3" />
                    <span>平铺</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setMemberListViewMode('grouped');
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      memberListViewMode === 'grouped'
                        ? 'bg-sky-900 text-sky-200 border border-sky-700/50 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title="按从属编制分类视图"
                  >
                    <Layers className="w-3 h-3 text-sky-400" />
                    <span>按编制分类</span>
                  </button>
                </div>

                {unassignedHeroes.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-500">吸纳自由角色:</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignHeroToFaction(e.target.value, currentFaction.id, '战术特员', '核心主属', 1);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                      className="bg-zinc-900 border border-zinc-700 text-zinc-300 rounded px-2 py-0.5 text-[11px] outline-none cursor-pointer"
                    >
                      <option value="" disabled>+ 吸纳未指定阵营角色...</option>
                      {unassignedHeroes.map((uh) => (
                        <option key={uh.id} value={uh.id}>
                          {uh.name} ({uh.homePlanet ? uh.homePlanet.split(' ')[0] : '未知'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Sub-Faction Member Filter Chips if Sub-factions exist and in flat mode */}
            {memberListViewMode === 'flat' && currentFaction.subFactions && currentFaction.subFactions.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs">
                <span className="text-[10px] text-zinc-500 font-bold shrink-0">分支筛选:</span>
                <button
                  type="button"
                  onClick={() => setMemberSubFactionFilter('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all shrink-0 cursor-pointer border ${
                    memberSubFactionFilter === 'all'
                      ? 'bg-sky-600 text-white border-sky-400'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                  }`}
                >
                  全部成员
                </button>
                {currentFaction.subFactions.map((sf) => (
                  <button
                    key={sf.id}
                    type="button"
                    onClick={() => setMemberSubFactionFilter(sf.id)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all shrink-0 cursor-pointer border ${
                      memberSubFactionFilter === sf.id
                        ? 'bg-sky-600 text-white border-sky-400'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    {sf.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setMemberSubFactionFilter('unassigned_sub')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all shrink-0 cursor-pointer border ${
                    memberSubFactionFilter === 'unassigned_sub'
                      ? 'bg-sky-600 text-white border-sky-400'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                  }`}
                >
                  未定从属分支
                </button>
              </div>
            )}

            {/* Member List - Grouped vs Flat */}
            {memberListViewMode === 'grouped' ? (
              <div className="space-y-4 pt-1">
                {/* 1. Grouped by Sub-Factions */}
                {(currentFaction.subFactions || []).map((sf) => {
                  const sfConf = SUB_FACTION_TYPE_CONFIGS[sf.type || 'military'] || SUB_FACTION_TYPE_CONFIGS.custom;
                  const sfHeroes = heroines.filter((h) => isHeroInSubFaction(h, sf.id, factions));

                  return (
                    <div key={sf.id} className="bg-zinc-950/70 border border-zinc-800/90 rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded border ${sfConf.color}`}>
                            {sfConf.icon} {sf.name} {sf.code ? `[${sf.code}]` : ''}
                          </span>
                          <span className="text-[11px] text-zinc-400 font-bold">
                            ({sfHeroes.length} 位在编角色)
                          </span>
                          {sf.leader && (
                            <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                              <Crown className="w-3 h-3" />
                              <span>主官: {sf.leader}</span>
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            ultraAudio.playUiClick();
                            setAssigningSubFactionId(sf.id);
                            setAssignSearchQuery('');
                            setAssignRoleInput('特派干员');
                          }}
                          className="px-2 py-0.5 rounded bg-sky-950 border border-sky-600/50 text-sky-300 hover:bg-sky-900 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>调派角色</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {sfHeroes.map((h) => {
                          const memberships = getHeroFactionMemberships(h, factions);
                          const mem = memberships.find((m) => m.factionId === currentFaction.id);
                          const isPrimary = mem?.priority === 1 || memberships[0]?.factionId === currentFaction.id;
                          const typeConf = MEMBERSHIP_TYPE_CONFIGS[mem?.membershipType || (isPrimary ? 'core' : 'foreign_subordinate')] || MEMBERSHIP_TYPE_CONFIGS.foreign_subordinate;
                          const origin = mem?.originCountry || h.nativeCountry || (isPrimary ? undefined : h.homePlanet);

                          return (
                            <div
                              key={h.id}
                              className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 text-xs transition-all ${
                                isPrimary
                                  ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                                  : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: h.colorTheme?.primary || '#3b82f6' }}
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 truncate flex-wrap">
                                      <span className="font-bold text-zinc-100 truncate">{h.name}</span>
                                      {isPrimary ? (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shrink-0 flex items-center gap-0.5">
                                          <Crown className="w-2.5 h-2.5 fill-amber-400" />
                                          <span>主属</span>
                                        </span>
                                      ) : (
                                        <span className={`px-1.5 py-0.2 rounded text-[9px] border font-bold shrink-0 flex items-center gap-0.5 ${typeConf.badge}`}>
                                          <span>{typeConf.icon}</span>
                                          <span>{typeConf.shortLabel}</span>
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-zinc-400 truncate flex items-center gap-1 mt-0.5 flex-wrap">
                                      <span>{mem?.role || h.factionRole || '特勤干员'}</span>
                                      {mem?.title && <span className="text-purple-300">· {mem.title}</span>}
                                      {origin && (
                                        <span className="text-cyan-300 font-mono text-[9px] px-1 py-0.2 bg-zinc-950 rounded border border-zinc-800 flex items-center gap-0.5">
                                          <Globe className="w-2 h-2" />
                                          <span>{origin}</span>
                                        </span>
                                      )}
                                      {mem?.affiliationNature && (
                                        <span className="text-purple-400 text-[9px]">({mem.affiliationNature})</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateHeroSubFaction(h.id, 'none')}
                                    className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-[10px] cursor-pointer"
                                    title="将角色调出该编制（退回直属未定编制）"
                                  >
                                    移出编制
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveHeroFromFaction(h.id, currentFaction.id)}
                                    className="p-1 rounded bg-zinc-950 text-zinc-500 hover:text-rose-400 border border-zinc-800 cursor-pointer"
                                    title={`将「${h.name}」完全移出当前阵营`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Quick Reassign Dropdown */}
                              <div className="pt-1.5 border-t border-zinc-800/60 flex items-center justify-between gap-1 text-[10px]">
                                <span className="text-zinc-500 shrink-0">调转编制:</span>
                                <select
                                  value={sf.id}
                                  onChange={(e) => handleUpdateHeroSubFaction(h.id, e.target.value)}
                                  className="bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 text-[10px] font-bold outline-none flex-1 truncate cursor-pointer"
                                >
                                  <option value="none">-- 调至阵营直属主部 --</option>
                                  {currentFaction.subFactions?.map((otherSf) => (
                                    <option key={otherSf.id} value={otherSf.id}>
                                      {otherSf.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                        {sfHeroes.length === 0 && (
                          <div className="col-span-full py-3 text-center text-xs text-zinc-500 bg-zinc-900/30 rounded-lg border border-zinc-800/40 italic">
                            该编制目前暂未分配角色，可点击右上角「调派角色」快速指派
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* 2. Direct Headquarters / Unassigned Sub-Faction Members */}
                {(() => {
                  const directHeroes = heroines.filter((h) => {
                    if (!isHeroInFaction(h, currentFaction.id, factions)) return false;
                    const memberships = getHeroFactionMemberships(h, factions);
                    const mem = memberships.find((m) => m.factionId === currentFaction.id);
                    return !mem?.subFactionId;
                  });

                  return (
                    <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded border bg-zinc-900 text-zinc-300 border-zinc-700 flex items-center gap-1">
                            <Landmark className="w-3 h-3 text-zinc-400" />
                            <span>阵营直属部 / 未指定下属编制</span>
                          </span>
                          <span className="text-[11px] text-zinc-400 font-bold">
                            ({directHeroes.length} 位角色)
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {directHeroes.map((h) => {
                          const memberships = getHeroFactionMemberships(h, factions);
                          const mem = memberships.find((m) => m.factionId === currentFaction.id);
                          const isPrimary = mem?.priority === 1 || memberships[0]?.factionId === currentFaction.id;
                          const typeConf = MEMBERSHIP_TYPE_CONFIGS[mem?.membershipType || (isPrimary ? 'core' : 'foreign_subordinate')] || MEMBERSHIP_TYPE_CONFIGS.foreign_subordinate;
                          const origin = mem?.originCountry || h.nativeCountry || (isPrimary ? undefined : h.homePlanet);

                          return (
                            <div
                              key={h.id}
                              className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 text-xs transition-all ${
                                isPrimary
                                  ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                                  : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: h.colorTheme?.primary || '#3b82f6' }}
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 truncate flex-wrap">
                                      <span className="font-bold text-zinc-100 truncate">{h.name}</span>
                                      {isPrimary ? (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shrink-0 flex items-center gap-0.5">
                                          <Crown className="w-2.5 h-2.5 fill-amber-400" />
                                          <span>主属</span>
                                        </span>
                                      ) : (
                                        <span className={`px-1.5 py-0.2 rounded text-[9px] border font-bold shrink-0 flex items-center gap-0.5 ${typeConf.badge}`}>
                                          <span>{typeConf.icon}</span>
                                          <span>{typeConf.shortLabel}</span>
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-zinc-400 truncate flex items-center gap-1 mt-0.5 flex-wrap">
                                      <span>{mem?.role || h.factionRole || '特勤干员'}</span>
                                      {mem?.title && <span className="text-purple-300">· {mem.title}</span>}
                                      {origin && (
                                        <span className="text-cyan-300 font-mono text-[9px] px-1 py-0.2 bg-zinc-950 rounded border border-zinc-800 flex items-center gap-0.5">
                                          <Globe className="w-2 h-2" />
                                          <span>{origin}</span>
                                        </span>
                                      )}
                                      {mem?.affiliationNature && (
                                        <span className="text-purple-400 text-[9px]">({mem.affiliationNature})</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {!isPrimary && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetHeroPrimaryFaction(h.id, currentFaction.id)}
                                      className="px-1.5 py-0.5 rounded bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[10px] font-bold cursor-pointer"
                                      title="将此阵营设为主属"
                                    >
                                      设为主属
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveHeroFromFaction(h.id, currentFaction.id)}
                                    className="p-1 rounded bg-zinc-950 text-zinc-500 hover:text-rose-400 border border-zinc-800 cursor-pointer"
                                    title={`将「${h.name}」移出当前阵营`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Assign Sub-Faction dropdown */}
                              {currentFaction.subFactions && currentFaction.subFactions.length > 0 && (
                                <div className="pt-1.5 border-t border-zinc-800/60 flex items-center justify-between gap-1 text-[10px]">
                                  <span className="text-sky-400 font-bold shrink-0">分派从属编制:</span>
                                  <select
                                    value="none"
                                    onChange={(e) => handleUpdateHeroSubFaction(h.id, e.target.value)}
                                    className="bg-zinc-950 border border-sky-600/40 rounded px-1.5 py-0.5 text-sky-200 text-[10px] font-bold outline-none flex-1 truncate cursor-pointer"
                                  >
                                    <option value="none" disabled>+ 选择分派的编制...</option>
                                    {currentFaction.subFactions.map((sf) => (
                                      <option key={sf.id} value={sf.id}>
                                        🏛️ {sf.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {directHeroes.length === 0 && (
                          <div className="col-span-full py-3 text-center text-xs text-zinc-500 bg-zinc-900/30 rounded-lg border border-zinc-800/40 italic">
                            所有在阵营角色均已分配至明确的下属战术编制中
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {heroines
                  .filter((h) => {
                    if (!isHeroInFaction(h, currentFaction.id, factions)) return false;
                    if (memberSubFactionFilter === 'all') return true;
                    if (memberSubFactionFilter === 'unassigned_sub') {
                      const memberships = getHeroFactionMemberships(h, factions);
                      const mem = memberships.find((m) => m.factionId === currentFaction.id);
                      return !mem?.subFactionId;
                    }
                    return isHeroInSubFaction(h, memberSubFactionFilter, factions);
                  })
                  .map((h) => {
                    const memberships = getHeroFactionMemberships(h, factions);
                    const mem = memberships.find((m) => m.factionId === currentFaction.id);
                    const isPrimary = mem?.priority === 1 || memberships[0]?.factionId === currentFaction.id;
                    const typeConf = MEMBERSHIP_TYPE_CONFIGS[mem?.membershipType || (isPrimary ? 'core' : 'foreign_subordinate')] || MEMBERSHIP_TYPE_CONFIGS.foreign_subordinate;
                    const origin = mem?.originCountry || h.nativeCountry || (isPrimary ? undefined : h.homePlanet);
                    const currentSubId = mem?.subFactionId || 'none';

                    return (
                      <div
                        key={h.id}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 text-xs transition-all ${
                          isPrimary
                            ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                            : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: h.colorTheme?.primary || '#3b82f6' }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 truncate flex-wrap">
                                <span className="font-bold text-zinc-100 truncate">{h.name}</span>
                                {isPrimary ? (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shrink-0 flex items-center gap-0.5">
                                    <Crown className="w-2.5 h-2.5 fill-amber-400" />
                                    <span>主属</span>
                                  </span>
                                ) : (
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] border font-bold shrink-0 flex items-center gap-0.5 ${typeConf.badge}`}>
                                    <span>{typeConf.icon}</span>
                                    <span>{typeConf.shortLabel}</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-400 truncate flex items-center gap-1 mt-0.5 flex-wrap">
                                <span>{mem?.role || h.factionRole || '特勤干员'}</span>
                                {mem?.title && (
                                  <span className="text-purple-300">· {mem.title}</span>
                                )}
                                {origin && (
                                  <span className="text-cyan-300 font-mono text-[9px] px-1 py-0.2 bg-zinc-950 rounded border border-zinc-800 flex items-center gap-0.5">
                                    <Globe className="w-2 h-2" />
                                    <span>{origin}</span>
                                  </span>
                                )}
                                {mem?.affiliationNature && (
                                  <span className="text-purple-400 text-[9px]">({mem.affiliationNature})</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {!isPrimary && (
                              <button
                                type="button"
                                onClick={() => handleSetHeroPrimaryFaction(h.id, currentFaction.id)}
                                className="px-1.5 py-0.5 rounded bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[10px] font-bold cursor-pointer"
                                title="将此阵营设为该角色的第一主属阵营"
                              >
                                设为主属
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveHeroFromFaction(h.id, currentFaction.id)}
                              className="p-1 rounded bg-zinc-950 text-zinc-500 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/50 transition-colors cursor-pointer"
                              title={`将「${h.name}」移出当前阵营`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Sub-Faction Assignment Dropdown */}
                        {currentFaction.subFactions && currentFaction.subFactions.length > 0 && (
                          <div className="pt-1.5 border-t border-zinc-800/60 flex items-center justify-between gap-1.5 text-[10px]">
                            <span className="text-zinc-500 font-bold shrink-0 flex items-center gap-0.5">
                              <Layers className="w-3 h-3 text-sky-400" />
                              <span>从属组织:</span>
                            </span>
                            <select
                              value={currentSubId}
                              onChange={(e) => handleUpdateHeroSubFaction(h.id, e.target.value)}
                              className="bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 text-[10px] font-bold outline-none flex-1 truncate cursor-pointer"
                            >
                              <option value="none">-- 未指定从属分支 --</option>
                              {currentFaction.subFactions.map((sf) => (
                                <option key={sf.id} value={sf.id}>
                                  🏛️ {sf.name} {sf.code ? `(${sf.code})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                {heroines.filter((h) => isHeroInFaction(h, currentFaction.id, factions)).length === 0 && (
                  <div className="col-span-full py-4 text-center text-xs text-zinc-500 bg-zinc-900/40 rounded-xl border border-zinc-800/60 italic">
                    暂无角色归属或兼任此阵营（可从上方下拉吸纳，或在角色档案中添加多重阵营归属）
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Inter-Faction Diplomacy & Hostility Management Section */}
          <div className="space-y-4 pt-3 border-t border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  【{currentFaction.shortName || currentFaction.name}】与其他势力的外交关系与对白指导
                </h4>
              </div>

              {otherFactions.length > 0 && (
                <button
                  onClick={() => handleOpenEditRelation()}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加/编辑阵营关系</span>
                </button>
              )}
            </div>

            {/* Relation Editor Modal/Card */}
            {isEditingRelation && (
              <div className="bg-zinc-950 p-4 rounded-xl border border-amber-500/50 space-y-3.5 animate-fade-in shadow-md">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>设置【{currentFaction.shortName || currentFaction.name}】对目标阵营的关系</span>
                  </span>
                  <button
                    onClick={() => setIsEditingRelation(false)}
                    className="text-zinc-400 hover:text-zinc-200 text-xs cursor-pointer"
                  >
                    取消
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">目标阵营势力</label>
                    <select
                      value={relTargetFactionId}
                      onChange={(e) => setRelTargetFactionId(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 font-bold focus:border-amber-500 outline-none cursor-pointer"
                    >
                      {otherFactions.map((of) => (
                        <option key={of.id} value={of.id}>
                          {of.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">关系性质类别</label>
                    <select
                      value={relTypeInput}
                      onChange={(e) => {
                        const newType = e.target.value as FactionRelation['relationType'];
                        setRelTypeInput(newType);
                        if (!relNameInput) {
                          setRelNameInput(RELATION_TYPE_CONFIGS[newType].label);
                        }
                        if (!relAttitudeInput) {
                          setRelAttitudeInput(RELATION_TYPE_CONFIGS[newType].defaultAttitude);
                        }
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 font-bold focus:border-amber-500 outline-none cursor-pointer"
                    >
                      {Object.entries(RELATION_TYPE_CONFIGS).map(([k, conf]) => (
                        <option key={k} value={k}>
                          {conf.icon} {conf.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">关系自定义称号/名目</label>
                    <input
                      type="text"
                      value={relNameInput}
                      onChange={(e) => setRelNameInput(e.target.value)}
                      placeholder="例如：宿命血仇死斗、技术共享盟约..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1 text-xs">
                    关系历史纠葛与背景描述 (`description`)
                  </label>
                  <input
                    type="text"
                    value={relDescInput}
                    onChange={(e) => setRelDescInput(e.target.value)}
                    placeholder="例如：数万年来多次爆发星系级神魔圣战，视深渊侵蚀者为必须净化的恶魔..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                    <label className="block text-amber-300 font-bold text-xs">
                      【绝对核心】AI 对白态度与互动指导 Prompt (`attitudePrompt`)
                    </label>
                    <span className="text-[10px] text-zinc-400">
                      指导 AI 在遇到该阵营角色时的语气、敌视/亲和态度与互动台词
                    </span>
                  </div>

                  {/* Attitude Presets */}
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {ATTITUDE_PRESETS.map((ap) => (
                      <button
                        key={ap.title}
                        onClick={() => {
                          ultraAudio.playUiClick();
                          setRelAttitudeInput(ap.text);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-300 border border-zinc-800 transition-colors cursor-pointer"
                      >
                        {ap.title}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    value={relAttitudeInput}
                    onChange={(e) => setRelAttitudeInput(e.target.value)}
                    placeholder="例如：视对方为侵略恶魔！言语凛然正气、誓死顽抗，坚决不向邪恶屈服..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-100 focus:border-amber-500 outline-none resize-y leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center space-x-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={relBiSync}
                      onChange={(e) => setRelBiSync(e.target.checked)}
                      className="rounded accent-amber-500"
                    />
                    <span>双向同步更新目标阵营的反向关系设定</span>
                  </label>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => setIsEditingRelation(false)}
                      className="px-3 py-1 rounded bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-700 text-xs cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveRelation}
                      className="px-4 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer shadow-sm"
                    >
                      保存关系
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Relations List for current faction */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentFaction.relations && currentFaction.relations.length > 0 ? (
                currentFaction.relations.map((r) => {
                  const targetF = factions.find((f) => f.id === r.targetFactionId);
                  const tName = targetF?.name || r.targetFactionId;
                  const typeConf = RELATION_TYPE_CONFIGS[r.relationType] || RELATION_TYPE_CONFIGS.custom;

                  return (
                    <div
                      key={r.targetFactionId}
                      className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800 flex flex-col justify-between space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <Shield className="w-4 h-4 text-zinc-400" />
                          <div>
                            <h5 className="text-xs font-bold text-zinc-100">对【{tName}】</h5>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.2 rounded border inline-block mt-0.5 ${
                                typeConf.color
                              }`}
                            >
                              {typeConf.icon} {r.relationName || typeConf.label}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleOpenEditRelation(r)}
                            className="p-1 rounded bg-zinc-950 text-zinc-400 hover:text-amber-300 border border-zinc-800 cursor-pointer"
                            title="修改关系设定"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRelation(r.targetFactionId)}
                            className="p-1 rounded bg-zinc-950 text-zinc-400 hover:text-rose-400 border border-zinc-800 cursor-pointer"
                            title="移除此关系"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {r.description && (
                        <p className="text-[11px] text-zinc-300 leading-relaxed break-words">
                          {r.description}
                        </p>
                      )}

                      {r.attitudePrompt && (
                        <div className="bg-zinc-950/80 p-2 rounded border border-zinc-800 text-[10px] text-amber-200/90 leading-relaxed">
                          <strong className="text-amber-400 block mb-0.5">AI 对话指导:</strong>
                          <span>{r.attitudePrompt}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 py-6 text-center text-xs text-zinc-500 bg-zinc-900/40 rounded-xl border border-zinc-800/60">
                  暂未配置与其他势力的外交关系，点击右上角「添加/编辑阵营关系」开启设定
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Assign Heroes to Sub-Faction Modal */}
      {assigningSubFactionId && currentFaction && (() => {
        const sub = currentFaction.subFactions?.find((s) => s.id === assigningSubFactionId);
        if (!sub) return null;
        const subTypeConf = SUB_FACTION_TYPE_CONFIGS[sub.type || 'military'] || SUB_FACTION_TYPE_CONFIGS.custom;
        const assignedHeroes = heroines.filter((h) => isHeroInSubFaction(h, sub.id, factions));

        const filteredAssignList = heroines.filter((h) => {
          if (!assignSearchQuery.trim()) return true;
          const q = assignSearchQuery.toLowerCase();
          return (
            h.name.toLowerCase().includes(q) ||
            (h.homePlanet && h.homePlanet.toLowerCase().includes(q)) ||
            (h.title && h.title.toLowerCase().includes(q))
          );
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in font-mono text-zinc-100">
            <div className="bg-zinc-950 border border-sky-500/50 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[0_0_40px_rgba(56,189,248,0.2)] overflow-hidden">
              {/* Modal Header */}
              <div className="p-4 border-b border-zinc-800 bg-gradient-to-r from-sky-950/80 via-zinc-950 to-indigo-950/80 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-300">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-sky-200 flex items-center gap-1.5">
                      <span>调派角色至从属编制</span>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded border bg-sky-950/60 border-sky-500/40 text-sky-300">
                        {currentFaction.name} · {sub.name}
                      </span>
                    </h3>
                    <p className="text-[10px] text-zinc-400">
                      {subTypeConf.icon} {subTypeConf.label} {sub.code ? `[${sub.code}]` : ''} · 当前在编角色: {assignedHeroes.length} 位
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAssigningSubFactionId(null)}
                  className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search & Quick Role input */}
              <div className="p-3 bg-zinc-900/60 border-b border-zinc-800 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={assignSearchQuery}
                    onChange={(e) => setAssignSearchQuery(e.target.value)}
                    placeholder="搜索角色姓名、称号、星区..."
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-sky-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-zinc-400">入编职位:</span>
                  <input
                    type="text"
                    value={assignRoleInput}
                    onChange={(e) => setAssignRoleInput(e.target.value)}
                    placeholder="例如: 特派干员"
                    className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-sky-200 outline-none"
                  />
                </div>
              </div>

              {/* Heroes List */}
              <div className="p-3 overflow-y-auto space-y-2 flex-1 scrollbar-thin">
                {filteredAssignList.map((h) => {
                  const isInThisSub = isHeroInSubFaction(h, sub.id, factions);
                  const isInThisFac = isHeroInFaction(h, currentFaction.id, factions);
                  const heroMems = getHeroFactionMemberships(h, factions);
                  const primMem = heroMems[0];
                  const heroFac = primMem ? factions.find((f) => f.id === primMem.factionId) : undefined;
                  const currentSubObj = primMem?.subFactionId
                    ? heroFac?.subFactions?.find((s) => s.id === primMem.subFactionId)
                    : undefined;

                  return (
                    <div
                      key={h.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                        isInThisSub
                          ? 'bg-sky-950/40 border-sky-500/50 shadow-sm'
                          : isInThisFac
                          ? 'bg-zinc-900/90 border-zinc-700/80'
                          : 'bg-zinc-900/50 border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: h.colorTheme?.primary || '#3b82f6' }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-zinc-100">{h.name}</span>
                            <span className="text-[10px] text-zinc-400 truncate">
                              ({h.nativeCountry || (h.homePlanet ? h.homePlanet.split(' ')[0] : '未知')})
                            </span>
                            {h.nativeCountry && (
                              <span className="text-cyan-300 font-mono text-[9px] px-1 py-0.2 bg-zinc-950 rounded border border-cyan-800/40 flex items-center gap-0.5">
                                <Globe className="w-2 h-2" />
                                <span>母国: {h.nativeCountry}</span>
                              </span>
                            )}
                            {isInThisSub ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold shrink-0">
                                ✓ 已在编
                              </span>
                            ) : isInThisFac ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shrink-0">
                                归属该阵营但未入此编制
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700 font-medium shrink-0">
                                归属: {heroFac?.shortName || heroFac?.name || '自由角色'}
                              </span>
                            )}
                          </div>
                          {heroFac && (
                            <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                              当前主属: {heroFac.name} {currentSubObj ? `(${currentSubObj.name})` : ''} · {primMem?.role || '成员'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="shrink-0 flex items-center gap-1.5">
                        {isInThisSub ? (
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateHeroSubFaction(h.id, 'none');
                            }}
                            className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-200 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            <span>移出编制</span>
                          </button>
                        ) : isInThisFac ? (
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateHeroSubFaction(h.id, sub.id);
                            }}
                            className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold transition-all shadow cursor-pointer flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>调入此编制</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                handleAssignHeroToFaction(
                                  h.id,
                                  currentFaction.id,
                                  assignRoleInput || '编制专员',
                                  '从属编制干员',
                                  heroMems.length + 1,
                                  sub.id,
                                  sub.name,
                                  'sub_unit_only',
                                  undefined,
                                  '仅从属于该独立从属编制 (非阵营直属本部)',
                                  true
                                );
                              }}
                              className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold transition-all shadow cursor-pointer flex items-center gap-1"
                              title="仅加入此从属编制（保持原生母国/阵营，不直接加入大阵营直属本部体系）"
                            >
                              <Shield className="w-3 h-3" />
                              <span>仅入从属编制</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                handleAssignHeroToFaction(
                                  h.id,
                                  currentFaction.id,
                                  assignRoleInput || '特派从属干员',
                                  '他国从属干员',
                                  heroMems.length + 1,
                                  sub.id,
                                  sub.name,
                                  'foreign_subordinate',
                                  undefined,
                                  '跨国派遣兼任从属',
                                  false
                                );
                              }}
                              className="px-2 py-1 rounded bg-zinc-800 hover:bg-sky-900/80 text-zinc-300 hover:text-sky-200 border border-zinc-700 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                              title="兼任该势力从属成员，并归入该下属战术编制"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>兼任阵营并入编</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-zinc-400">
                  支持快速将角色调派至本编制，或为其他阵营角色添加多重兼任从属
                </span>
                <button
                  type="button"
                  onClick={() => setAssigningSubFactionId(null)}
                  className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold cursor-pointer"
                >
                  完成调派
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
