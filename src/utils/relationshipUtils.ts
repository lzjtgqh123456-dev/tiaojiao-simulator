import { RelationshipSlot, RelationshipState, RelationshipCategory, Stats, Ultrawoman, ScenarioConfig } from '../types';
import { DEFAULT_RELATIONSHIP_SLOTS, NEUTRAL_RELATIONSHIP_SLOT } from '../data/relationships';
import { getStatsPayload } from './stats';
import { queueServerSave } from '../services/storageSync';
import { safeLocalStorageSet } from './storageUtils';

export interface CategoryTheme {
  label: string;
  badgeClass: string;
  icon: string;
  borderColor: string;
  bgGradient: string;
}

export function getRelationshipCategoryTheme(category?: RelationshipCategory): CategoryTheme {
  switch (category) {
    case 'pure_love':
      return {
        label: '纯爱 / 伴侣',
        badgeClass: 'bg-rose-950/80 border-rose-500/60 text-rose-300 font-bold',
        icon: '💖',
        borderColor: 'border-rose-500/50',
        bgGradient: 'from-rose-950/40 via-pink-950/30 to-zinc-900/80',
      };
    case 'evil_enslavement':
      return {
        label: '邪恶 / 奴役',
        badgeClass: 'bg-purple-950/80 border-purple-500/60 text-purple-300 font-bold',
        icon: '😈',
        borderColor: 'border-purple-500/50',
        bgGradient: 'from-purple-950/50 via-fuchsia-950/30 to-zinc-900/80',
      };
    case 'hypnotic_dependency':
      return {
        label: '催眠 / 傀儡',
        badgeClass: 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 font-bold',
        icon: '🌀',
        borderColor: 'border-cyan-500/50',
        bgGradient: 'from-cyan-950/50 via-teal-950/30 to-zinc-900/80',
      };
    case 'rivalry':
      return {
        label: '宿敌 / 顽抗',
        badgeClass: 'bg-blue-950/80 border-blue-500/60 text-blue-300 font-bold',
        icon: '⚔️',
        borderColor: 'border-blue-500/50',
        bgGradient: 'from-blue-950/40 via-indigo-950/30 to-zinc-900/80',
      };
    case 'hero_exclusive':
      return {
        label: '人物专属',
        badgeClass: 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 font-bold',
        icon: '👤',
        borderColor: 'border-emerald-500/50',
        bgGradient: 'from-emerald-950/50 via-teal-950/30 to-zinc-900/80',
      };
    case 'faction_exclusive':
      return {
        label: '组织 / 阵营专属',
        badgeClass: 'bg-indigo-950/80 border-indigo-500/60 text-indigo-300 font-bold',
        icon: '🏛️',
        borderColor: 'border-indigo-500/50',
        bgGradient: 'from-indigo-950/50 via-blue-950/30 to-zinc-900/80',
      };
    case 'custom':
    default:
      return {
        label: '自定义槽位',
        badgeClass: 'bg-amber-950/80 border-amber-500/60 text-amber-300 font-bold',
        icon: '✨',
        borderColor: 'border-amber-500/50',
        bgGradient: 'from-amber-950/40 via-yellow-950/30 to-zinc-900/80',
      };
  }
}

export function getDeletedRelationshipSlotIds(): string[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('ultra_deleted_rel_slot_ids_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {}
  return [];
}

export function addDeletedRelationshipSlotId(slotId: string): void {
  if (!slotId) return;
  try {
    const current = getDeletedRelationshipSlotIds();
    if (!current.includes(slotId)) {
      const updated = [...current, slotId];
      if (typeof localStorage !== 'undefined') {
        safeLocalStorageSet('ultra_deleted_rel_slot_ids_v1', updated);
      }
      queueServerSave({ ultra_deleted_rel_slot_ids_v1: updated });
    }
  } catch {}
}

export function removeDeletedRelationshipSlotId(slotId: string): void {
  if (!slotId) return;
  try {
    const current = getDeletedRelationshipSlotIds();
    const updated = current.filter((id) => id !== slotId);
    if (typeof localStorage !== 'undefined') {
      safeLocalStorageSet('ultra_deleted_rel_slot_ids_v1', updated);
    }
    queueServerSave({ ultra_deleted_rel_slot_ids_v1: updated });
  } catch {}
}

export function clearDeletedRelationshipSlotIds(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ultra_deleted_rel_slot_ids_v1');
    }
    queueServerSave({ ultra_deleted_rel_slot_ids_v1: [] });
  } catch {}
}

export function getGlobalRelationshipSlots(): RelationshipSlot[] {
  const deletedIds = getDeletedRelationshipSlotIds();
  const map = new Map<string, RelationshipSlot>();

  // 1. Initialize with all system default relationship slots (unless explicitly deleted)
  DEFAULT_RELATIONSHIP_SLOTS.forEach((slot) => {
    if (slot && slot.id && !deletedIds.includes(slot.id)) {
      map.set(slot.id, slot);
    }
  });

  // 2. Merge stored user slots from localStorage (overriding defaults with user edits, or adding new user-created slots)
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('ultra_global_relationship_slots_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((s: RelationshipSlot) => {
            if (s && s.id && !deletedIds.includes(s.id)) {
              map.set(s.id, s);
            }
          });
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load global relationship slots:', e);
  }

  const result = Array.from(map.values());
  return result.length > 0 ? result : DEFAULT_RELATIONSHIP_SLOTS;
}

export function saveGlobalRelationshipSlots(slots: RelationshipSlot[]): void {
  try {
    if (typeof localStorage !== 'undefined' && Array.isArray(slots)) {
      const deletedIds = getDeletedRelationshipSlotIds();
      const map = new Map<string, RelationshipSlot>();
      slots.forEach((s) => {
        if (s && s.id && !deletedIds.includes(s.id)) {
          map.set(s.id, s);
        }
      });
      const deduplicated = Array.from(map.values());
      safeLocalStorageSet('ultra_global_relationship_slots_v1', deduplicated);
      queueServerSave({ ultra_global_relationship_slots_v1: deduplicated });
    }
  } catch {}
}

export function getAllRelationshipSlots(relationshipState?: RelationshipState): RelationshipSlot[] {
  const deletedIds = getDeletedRelationshipSlotIds();
  const globalSlots = getGlobalRelationshipSlots();

  // Create a unified slot map initialized with authoritative global slots
  const map = new Map<string, RelationshipSlot>();
  globalSlots.forEach((s) => {
    if (s && s.id && !deletedIds.includes(s.id)) {
      map.set(s.id, s);
    }
  });

  // Check if relationshipState has any extra custom/newly created slots that need to be universally registered
  const stateSlots = [
    ...(relationshipState?.slots || []),
    ...(relationshipState?.customSlots || []),
  ];

  let hasNewSlots = false;
  stateSlots.forEach((s) => {
    if (s && s.id && !deletedIds.includes(s.id)) {
      if (!map.has(s.id)) {
        map.set(s.id, s);
        hasNewSlots = true;
      }
    }
  });

  const unifiedList = Array.from(map.values());
  if (hasNewSlots) {
    saveGlobalRelationshipSlots(unifiedList);
  }

  if (unifiedList.length > 0) {
    return unifiedList;
  }

  const defaultSlots = DEFAULT_RELATIONSHIP_SLOTS.filter((d) => !deletedIds.includes(d.id));
  return defaultSlots.length > 0 ? defaultSlots : DEFAULT_RELATIONSHIP_SLOTS;
}

/**
 * 校验指定关系槽位是否满足当前的属性与天数条件
 */
export function checkSlotConditionMatch(
  slot: RelationshipSlot,
  stats: Stats,
  hero?: Ultrawoman,
  scenarioConfig?: ScenarioConfig,
  dayCount: number = 1
): { matched: boolean; matchScore: number; reason: string } {
  const p = getStatsPayload(stats, hero);
  const cond = slot.conditions || {};
  let matched = true;
  let matchScore = 0;
  const matchReasons: string[] = [];

  // 信任值/服从度判断
  if (cond.minObedience !== undefined) {
    if (p.obediencePct < cond.minObedience) {
      matched = false;
    } else {
      matchScore += (p.obediencePct - cond.minObedience);
      matchReasons.push(`信任值≥${cond.minObedience}% (${p.obediencePct}%)`);
    }
  }
  if (cond.maxObedience !== undefined) {
    if (p.obediencePct > cond.maxObedience) {
      matched = false;
    } else {
      matchScore += (cond.maxObedience - p.obediencePct);
      matchReasons.push(`信任值≤${cond.maxObedience}% (${p.obediencePct}%)`);
    }
  }

  // 欲望沉沦度判断
  if (cond.minLust !== undefined) {
    if (p.lustPct < cond.minLust) {
      matched = false;
    } else {
      matchScore += (p.lustPct - cond.minLust);
      matchReasons.push(`欲望度≥${cond.minLust}% (${p.lustPct}%)`);
    }
  }
  if (cond.maxLust !== undefined) {
    if (p.lustPct > cond.maxLust) {
      matched = false;
    } else {
      matchScore += (cond.maxLust - p.lustPct);
      matchReasons.push(`欲望度≤${cond.maxLust}% (${p.lustPct}%)`);
    }
  }

  // 意志防线判断
  if (cond.minMorale !== undefined) {
    if (p.moralePct < cond.minMorale) {
      matched = false;
    } else {
      matchScore += (p.moralePct - cond.minMorale);
      matchReasons.push(`意志度≥${cond.minMorale}% (${p.moralePct}%)`);
    }
  }
  if (cond.maxMorale !== undefined) {
    if (p.moralePct > cond.maxMorale) {
      matched = false;
    } else {
      matchScore += (cond.maxMorale - p.moralePct);
      matchReasons.push(`意志度≤${cond.maxMorale}% (${p.moralePct}%)`);
    }
  }

  // HP% 判断
  if (cond.minHpPct !== undefined) {
    if (p.hpPct < cond.minHpPct) {
      matched = false;
    } else {
      matchScore += (p.hpPct - cond.minHpPct);
      matchReasons.push(`HP≥${cond.minHpPct}% (${p.hpPct}%)`);
    }
  }
  if (cond.maxHpPct !== undefined) {
    if (p.hpPct > cond.maxHpPct) {
      matched = false;
    } else {
      matchScore += (cond.maxHpPct - p.hpPct);
      matchReasons.push(`HP≤${cond.maxHpPct}% (${p.hpPct}%)`);
    }
  }

  // 天数要求
  if (cond.minDay !== undefined && dayCount < cond.minDay) {
    matched = false;
  }

  // 剧情模式要求
  if (cond.requiredScenarioCategory && cond.requiredScenarioCategory !== 'any') {
    if (scenarioConfig?.category && scenarioConfig.category !== cond.requiredScenarioCategory) {
      matched = false;
    }
  }

  // 专属人物限制判断 (人物专属分类或设置了专属角色)
  if (slot.targetHeroId && slot.targetHeroId !== 'any' && hero?.id) {
    if (hero.id !== slot.targetHeroId) {
      matched = false;
    } else {
      matchScore += 40;
      matchReasons.push(`【${slot.targetHeroName || '专属角色'}】专属契约加成`);
    }
  } else if (slot.category === 'hero_exclusive' && slot.targetHeroName && hero?.name) {
    if (!hero.name.toLowerCase().includes(slot.targetHeroName.toLowerCase())) {
      // If hero name doesn't match and it's strictly exclusive
      if (slot.targetHeroId && slot.targetHeroId !== 'any') {
        matched = false;
      }
    } else {
      matchScore += 30;
      matchReasons.push(`匹配【${slot.targetHeroName}】专属契约`);
    }
  }

  // 专属组织/阵营限制判断 (组织专属分类或设置了目标阵营)
  const targetFaction = slot.targetFactionId || cond.requiredFactionId;
  if (targetFaction && targetFaction !== 'any' && hero) {
    const isPrimaryFaction = hero.factionId === targetFaction;
    const isMemberFaction = hero.factionMemberships?.some((m) => m.factionId === targetFaction);
    const heroHasFaction = isPrimaryFaction || isMemberFaction;

    if (!heroHasFaction) {
      matched = false;
    } else {
      matchScore += 40;
      matchReasons.push(`🏛️ 匹配【${slot.targetFactionName || '特定组织'}】阵营专属归属`);
      
      // Check required role if specified
      const requiredRole = slot.factionRoleRequired || cond.requiredFactionRole;
      if (requiredRole && requiredRole.trim()) {
        const primaryRole = hero.factionRole;
        const matchingMembership = hero.factionMemberships?.find((m) => m.factionId === targetFaction);
        const memberRole = matchingMembership?.role;
        const hasRole = (primaryRole && primaryRole.includes(requiredRole.trim())) ||
                        (memberRole && memberRole.includes(requiredRole.trim()));
        if (!hasRole) {
          matched = false;
        } else {
          matchScore += 15;
          matchReasons.push(`职务符合【${requiredRole}】`);
        }
      }
    }
  } else if (slot.category === 'faction_exclusive' && slot.targetFactionName && hero) {
    // If category is faction_exclusive without direct ID match, try name match
    const primaryNameMatch = hero.factionRole?.includes(slot.targetFactionName);
    const memberNameMatch = hero.factionMemberships?.some((m) => m.customNotes?.includes(slot.targetFactionName!) || m.title?.includes(slot.targetFactionName!));
    if (primaryNameMatch || memberNameMatch) {
      matchScore += 30;
      matchReasons.push(`匹配【${slot.targetFactionName}】组织纽带`);
    }
  }

  return {
    matched,
    matchScore,
    reason: matchReasons.length > 0 ? matchReasons.join('，') : '基础判定满足',
  };
}

/**
 * 评估当前最高优先级的关系槽位
 */
export function evaluateBestRelationshipSlot(
  stats: Stats,
  hero?: Ultrawoman,
  scenarioConfig?: ScenarioConfig,
  customSlotsOrAllSlots: RelationshipSlot[] = [],
  activeSlotId?: string,
  isLocked: boolean = false,
  dayCount: number = 1,
  relationshipState?: RelationshipState
): { selectedSlot: RelationshipSlot; isChanged: boolean; matchReason: string } {
  let allSlots: RelationshipSlot[] = [];
  if (relationshipState) {
    allSlots = getAllRelationshipSlots(relationshipState);
  } else if (customSlotsOrAllSlots.length > 0) {
    const containsDefaults = customSlotsOrAllSlots.some((s) => DEFAULT_RELATIONSHIP_SLOTS.some((d) => d.id === s.id));
    if (containsDefaults) {
      allSlots = customSlotsOrAllSlots;
    } else {
      allSlots = [...customSlotsOrAllSlots, ...DEFAULT_RELATIONSHIP_SLOTS];
    }
  } else {
    allSlots = DEFAULT_RELATIONSHIP_SLOTS;
  }

  if (allSlots.length === 0) {
    allSlots = DEFAULT_RELATIONSHIP_SLOTS;
  }
  // A blank install has no relationship slots at all: fall back to the neutral
  // placeholder so downstream code always receives a real object instead of undefined
  // (previously crashed on `fallbackSlot.id`).
  if (allSlots.length === 0) {
    allSlots = [NEUTRAL_RELATIONSHIP_SLOT];
  }

  // 如果处于锁定状态，优先使用已绑定的槽位
  if (isLocked && activeSlotId) {
    const lockedSlot = allSlots.find((s) => s.id === activeSlotId);
    if (lockedSlot) {
      return {
        selectedSlot: lockedSlot,
        isChanged: false,
        matchReason: '【状态已锁定】保持锁定前缔结的关系状态',
      };
    }
  }

  // 计算所有符合条件的槽位
  const candidates: { slot: RelationshipSlot; score: number; reason: string }[] = [];

  for (const slot of allSlots) {
    const res = checkSlotConditionMatch(slot, stats, hero, scenarioConfig, dayCount);
    if (res.matched) {
      // 给自定义/后增槽位以及当前已激活/手动选择的槽位给予权重加成，增加惰性与手动确立稳定性
      let bonus = slot.isCustom ? 20 : 0;
      if (activeSlotId && slot.id === activeSlotId) {
        bonus += 15; // 保持当前活跃羁绊的稳定性
      }
      if (relationshipState?.manualOverrideSlotId && slot.id === relationshipState.manualOverrideSlotId) {
        bonus += 30; // 手动强制切入的关系给予高优先级加成
      }
      candidates.push({
        slot,
        score: res.matchScore + bonus,
        reason: res.reason,
      });
    }
  }

  if (candidates.length > 0) {
    // 按匹配得分倒序
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const isChanged = activeSlotId !== best.slot.id;
    return {
      selectedSlot: best.slot,
      isChanged,
      matchReason: best.reason,
    };
  }

  // Fallback 规则
  const p = getStatsPayload(stats, hero);
  let fallbackSlot: RelationshipSlot;

  if (p.obediencePct >= 50) {
    fallbackSlot = allSlots.find((s) => s.category === 'pure_love') || allSlots[0] || NEUTRAL_RELATIONSHIP_SLOT;
  } else if (p.lustPct >= 50) {
    fallbackSlot = allSlots.find((s) => s.category === 'evil_enslavement' || s.category === 'hypnotic_dependency') || allSlots[0] || NEUTRAL_RELATIONSHIP_SLOT;
  } else {
    fallbackSlot = allSlots.find((s) => s.category === 'rivalry') || allSlots[0] || NEUTRAL_RELATIONSHIP_SLOT;
  }

  return {
    selectedSlot: fallbackSlot,
    isChanged: activeSlotId !== fallbackSlot.id,
    matchReason: '根据综合数值状态保底自动匹配',
  };
}
