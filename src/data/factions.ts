import { Faction, FactionRelation, HeroFactionMembership, SubFaction, Ultrawoman } from '../types';
import { queueServerSave } from '../services/storageSync';

export const DEFAULT_FACTIONS: Faction[] = [];

export const FACTION_RELATION_TYPE_LABELS: Record<string, { label: string; icon: string; badge: string }> = {
  ally: { label: '同盟 · 生死契约', icon: '🤝', badge: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40' },
  hostile: { label: '敌对 · 宿命死战', icon: '⚔️', badge: 'text-rose-300 border-rose-500/40 bg-rose-950/40' },
  neutral: { label: '中立 · 贸易往来', icon: '⚖️', badge: 'text-zinc-300 border-zinc-700 bg-zinc-900' },
  subordinate: { label: '臣属 · 奉迎附属', icon: '👑', badge: 'text-amber-300 border-amber-500/40 bg-amber-950/40' },
  rival: { label: '竞争 · 谍战试探', icon: '👁️', badge: 'text-purple-300 border-purple-500/40 bg-purple-950/40' },
  infiltrated: { label: '渗透 · 暗中潜伏', icon: '🕵️', badge: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/40' },
  custom: { label: '自定义关系', icon: '✨', badge: 'text-blue-300 border-blue-500/40 bg-blue-950/40' },
};

export function getFactionById(factionIdOrFactions?: string | Faction[], secondArg?: string | Faction[]): Faction | undefined {
  if (!factionIdOrFactions) return undefined;
  if (Array.isArray(factionIdOrFactions)) {
    const factions = factionIdOrFactions;
    const factionId = typeof secondArg === 'string' ? secondArg : undefined;
    if (!factionId) return undefined;
    return factions.find((f) => f.id === factionId);
  } else {
    const factionId = factionIdOrFactions;
    const factions = Array.isArray(secondArg) ? secondArg : DEFAULT_FACTIONS;
    return factions.find((f) => f.id === factionId);
  }
}

export function getFactionRelation(
  fromFactionId?: string,
  toFactionId?: string,
  factions: Faction[] = DEFAULT_FACTIONS
): FactionRelation | undefined {
  if (!fromFactionId || !toFactionId || fromFactionId === toFactionId) return undefined;
  const fromFaction = getFactionById(fromFactionId, factions);
  if (!fromFaction || !fromFaction.relations) return undefined;
  return fromFaction.relations.find((r) => r.targetFactionId === toFactionId);
}

export function loadFactionsFromStorage(): Faction[] {
  try {
    const saved = localStorage.getItem('ultra_factions_v1');
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // 自动合并/迁移缺少 subFactions 的默认阵营数据
        return parsed.map((fac) => {
          const defaultFac = DEFAULT_FACTIONS.find((df) => df.id === fac.id);
          if (defaultFac) {
            return {
              ...defaultFac,
              ...fac,
              subFactions: fac.subFactions && fac.subFactions.length > 0
                ? fac.subFactions
                : defaultFac.subFactions || [],
            };
          }
          return fac;
        });
      }
    }
  } catch (e) {
    console.warn('Failed to load factions from localStorage:', e);
  }
  return DEFAULT_FACTIONS;
}

export function saveFactionsToStorage(factions: Faction[]): void {
  try {
    localStorage.setItem('ultra_factions_v1', JSON.stringify(factions));
    queueServerSave({ ultra_factions_v1: factions });
  } catch (e) {
    console.warn('Failed to save factions to localStorage:', e);
  }
}

// -------------------------------------------------------------
// Sub-Faction (从属组织 / 下属分支机构) 助手函数
// -------------------------------------------------------------

export const SUB_FACTION_TYPE_CONFIGS: Record<
  NonNullable<SubFaction['type']>,
  { label: string; icon: string; color: string }
> = {
  military: {
    label: '武装军事',
    icon: '⚔️',
    color: 'text-amber-300 border-amber-500/40 bg-amber-950/40',
  },
  intelligence: {
    label: '暗影密谍',
    icon: '👁️',
    color: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/40',
  },
  research: {
    label: '前沿科研',
    icon: '🧬',
    color: 'text-purple-300 border-purple-500/40 bg-purple-950/40',
  },
  special_ops: {
    label: '特遣突击',
    icon: '⚡',
    color: 'text-rose-300 border-rose-500/40 bg-rose-950/40',
  },
  administrative: {
    label: '政务后勤',
    icon: '🏛️',
    color: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40',
  },
  custom: {
    label: '专属定制',
    icon: '✨',
    color: 'text-blue-300 border-blue-500/40 bg-blue-950/40',
  },
};

export const SUB_FACTION_TYPE_PRESETS: { type: string; label: string; icon: string; badge: string }[] = [
  { type: 'military', label: '武装军事部队', icon: '⚔️', badge: 'text-rose-300 border-rose-500/40 bg-rose-950/40' },
  { type: 'intelligence', label: '暗影密谍网络', icon: '👁️', badge: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/40' },
  { type: 'research', label: '前沿科研机构', icon: '🧬', badge: 'text-indigo-300 border-indigo-500/40 bg-indigo-950/40' },
  { type: 'special_ops', label: '特勤行动大队', icon: '⚡', badge: 'text-amber-300 border-amber-500/40 bg-amber-950/40' },
  { type: 'administrative', label: '政务与后勤枢纽', icon: '🏛️', badge: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40' },
  { type: 'custom', label: '专属定制部门', icon: '✨', badge: 'text-purple-300 border-purple-500/40 bg-purple-950/40' },
];

/**
 * 获取指定阵营的所有从属组织/部门列表
 */
export function getSubFactionsForFaction(factionIdOrFaction?: string | Faction, factions: Faction[] = DEFAULT_FACTIONS): SubFaction[] {
  if (!factionIdOrFaction) return [];
  const faction = typeof factionIdOrFaction === 'string' ? getFactionById(factionIdOrFaction, factions) : factionIdOrFaction;
  if (!faction || !Array.isArray(faction.subFactions)) return [];
  return faction.subFactions;
}

/**
 * 获取特定阵营下的特定从属组织 (支持传入阵营ID、单个阵营对象或阵营列表数组)
 */
export function getSubFactionById(
  factionIdOrFactionOrList?: string | Faction | Faction[],
  subFactionId?: string,
  factions: Faction[] = DEFAULT_FACTIONS
): SubFaction | undefined {
  if (!subFactionId) return undefined;
  if (Array.isArray(factionIdOrFactionOrList)) {
    for (const f of factionIdOrFactionOrList) {
      if (Array.isArray(f.subFactions)) {
        const found = f.subFactions.find((s) => s.id === subFactionId);
        if (found) return found;
      }
    }
    return undefined;
  }
  const subFactions = getSubFactionsForFaction(factionIdOrFactionOrList, factions);
  return subFactions.find((sub) => sub.id === subFactionId);
}

/**
 * 添加或更新阵营下的从属组织
 */
export function addOrUpdateSubFaction(
  factionId: string,
  subFaction: SubFaction,
  factions: Faction[] = DEFAULT_FACTIONS
): Faction[] {
  return factions.map((f) => {
    if (f.id !== factionId) return f;
    const currentSubs = f.subFactions ? [...f.subFactions] : [];
    const idx = currentSubs.findIndex((s) => s.id === subFaction.id);
    if (idx >= 0) {
      currentSubs[idx] = { ...currentSubs[idx], ...subFaction };
    } else {
      currentSubs.push(subFaction);
    }
    return {
      ...f,
      subFactions: currentSubs,
    };
  });
}

/**
 * 删除阵营下的从属组织
 */
export function deleteSubFaction(
  factionId: string,
  subFactionId: string,
  factions: Faction[] = DEFAULT_FACTIONS
): Faction[] {
  return factions.map((f) => {
    if (f.id !== factionId) return f;
    const currentSubs = f.subFactions ? [...f.subFactions] : [];
    return {
      ...f,
      subFactions: currentSubs.filter((s) => s.id !== subFactionId),
    };
  });
}

// -------------------------------------------------------------
// Multi-Faction & Priority Helpers (支持角色同时归属于多个阵营并启用优先级)
// -------------------------------------------------------------

export const FACTION_MEMBERSHIP_TITLE_PRESETS: { title: string; desc?: string; type?: string }[] = [
  { title: '主属阵营', desc: '角色的首要忠诚归属势力与本国核心立场', type: 'core' },
  { title: '他国从属干员', desc: '来自其他国家/星球，受聘或协约派驻于该势力的从属成员', type: 'foreign_subordinate' },
  { title: '外籍特派执行官', desc: '来自异国/母星的特遣专员，受权执行特殊跨国军事与战术任务', type: 'foreign_subordinate' },
  { title: '附属邦国派遣员', desc: '从属附庸邦国/下级领地派驻宗主势力的代表与在编战力', type: 'vassal_delegate' },
  { title: '客座技术顾问', desc: '受邀提供科技、灵能、生化或武器战术研发支持的异国专家', type: 'guest' },
  { title: '外邦雇佣兵/游侠', desc: '受雇效力于该势力的外国精锐武装人员，恪守佣兵契约', type: 'mercenary' },
  { title: '流亡异邦皇室/贵族', desc: '母国陷落或政变后客居于此，成为该势力庇护下的从属人员', type: 'guest' },
  { title: '跨国外交联络使', desc: '常驻该阵营的母国外交代表与两方沟通桥梁', type: 'liaison' },
  { title: '异邦卧底/潜伏谍报', desc: '隐瞒真实母国国籍，暗中渗透潜伏于该势力收集情报', type: 'undercover' },
  { title: '外邦归化成员', desc: '原属其他国家，现已宣誓效忠并完成归化登记的从属成员', type: 'core' },
  { title: '双重身份/多重从属', desc: '游走于两个不同阵营，拥有两套完整身份与使命的跨国人员', type: 'foreign_subordinate' },
  { title: '兼任职务', desc: '在友方或同盟势力中担任联络、客座等兼职身份', type: 'liaison' },
  { title: '名誉长老', desc: '受到高度礼遇的名誉高层，不直接参与日常管辖', type: 'guest' },
  { title: '秘密协约方', desc: '因特定契约或利益交换而暂时效力该势力', type: 'mercenary' },
  { title: '前军团长', desc: '曾为该势力效力的高级将领，保留深厚人脉与声望', type: 'core' },
];

export const MEMBERSHIP_TYPE_CONFIGS: Record<
  string,
  { label: string; shortLabel: string; icon: string; badge: string; desc: string }
> = {
  core: {
    label: '本国主属核心',
    shortLabel: '本国核心',
    icon: '👑',
    badge: 'text-amber-300 border-amber-500/40 bg-amber-950/40',
    desc: '角色母国/首要忠诚归属本势力，享有核心本部建制地位',
  },
  sub_unit_only: {
    label: '从属组织编制 (非阵营直属本部)',
    shortLabel: '从属编制',
    icon: '🛡️',
    badge: 'text-teal-300 border-teal-500/40 bg-teal-950/40',
    desc: '仅归属于该从属组织/战术编制（如特遣分队、科研组、外聘营），不直接计入阵营直属本部体系',
  },
  foreign_subordinate: {
    label: '他国从属干员',
    shortLabel: '他国从属',
    icon: '🌐',
    badge: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/40',
    desc: '来自其他国家/星球的从属干员，接受本势力编制管辖与任务调遣',
  },
  liaison: {
    label: '跨国联络代表',
    shortLabel: '跨国联络',
    icon: '🕊️',
    badge: 'text-sky-300 border-sky-500/40 bg-sky-950/40',
    desc: '代表母国常驻于本势力的外交联络官与战略协调人',
  },
  mercenary: {
    label: '外邦受聘雇佣',
    shortLabel: '外邦雇佣',
    icon: '⚔️',
    badge: 'text-orange-300 border-orange-500/40 bg-orange-950/40',
    desc: '受本势力雇佣与重金招募的异国强力战力',
  },
  vassal_delegate: {
    label: '附属国派遣从属',
    shortLabel: '附属派遣',
    icon: '🏛️',
    badge: 'text-purple-300 border-purple-500/40 bg-purple-950/40',
    desc: '从属附庸邦国/属地依照条约派驻至宗主阵营效力的精锐',
  },
  guest: {
    label: '客座流亡外援',
    shortLabel: '客座外援',
    icon: '✨',
    badge: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40',
    desc: '客居于此或受庇护的异国专家、流亡皇族与神职者',
  },
  undercover: {
    label: '异邦潜伏卧底',
    shortLabel: '异邦潜伏',
    icon: '🕵️',
    badge: 'text-rose-300 border-rose-500/40 bg-rose-950/40',
    desc: '真实国籍在其他阵营，隐瞒身份暗中渗透于本势力',
  },
  custom: {
    label: '特殊跨国从属',
    shortLabel: '跨国从属',
    icon: '⚡',
    badge: 'text-blue-300 border-blue-500/40 bg-blue-950/40',
    desc: '自定义的跨国编制、特殊借调或主仆契约关系',
  },
};

/**
 * 获取角色的所有阵营成员身份，按 priority 升序（1 为主阵营，2、3、4 依次次之）排序
 */
export function getHeroFactionMemberships(hero?: Ultrawoman, factions: Faction[] = DEFAULT_FACTIONS): HeroFactionMembership[] {
  if (!hero) return [];

  // 如果已经配置了 factionMemberships 数组
  if (Array.isArray(hero.factionMemberships) && hero.factionMemberships.length > 0) {
    // 过滤掉无效或空 factionId
    const valid = hero.factionMemberships.filter(
      (m) => m && m.factionId && m.factionId.trim() !== '' && m.factionId !== 'unassigned'
    );
    // 按 priority 升序排序 (priority 越小优先级越高，1 为最高)
    const sorted = [...valid].sort((a, b) => (a.priority || 999) - (b.priority || 999));
    // 标记第一位为 isPrimary
    return sorted.map((m, idx) => ({
      ...m,
      priority: idx + 1,
      isPrimary: idx === 0,
      title: m.title || (idx === 0 ? '主属阵营' : '兼任阵营'),
      role: m.role || (idx === 0 ? hero.factionRole || '执行官' : '战术特员'),
    }));
  }

  // 兼容老数据：仅有单一 factionId 时
  if (hero.factionId && hero.factionId.trim() !== '' && hero.factionId !== 'unassigned') {
    return [
      {
        factionId: hero.factionId,
        role: hero.factionRole || '执行官',
        priority: 1,
        isPrimary: true,
        title: '主属阵营',
      },
    ];
  }

  return [];
}

/**
 * 获取角色的主属阵营（第1优先级）
 */
export function getHeroPrimaryFaction(hero?: Ultrawoman, factions: Faction[] = DEFAULT_FACTIONS): {
  faction?: Faction;
  membership?: HeroFactionMembership;
  subFaction?: SubFaction;
} {
  if (!hero) return {};
  const memberships = getHeroFactionMemberships(hero, factions);
  if (memberships.length === 0) return {};
  const primaryMembership = memberships[0];
  const faction = getFactionById(primaryMembership.factionId, factions);
  const subFaction = primaryMembership.subFactionId
    ? getSubFactionById(faction, primaryMembership.subFactionId, factions)
    : undefined;
  return { faction, membership: primaryMembership, subFaction };
}

/**
 * 判断角色是否属于某个阵营（在任何一个优先级中）
 */
export function isHeroInFaction(hero?: Ultrawoman, factionId?: string, factions: Faction[] = DEFAULT_FACTIONS): boolean {
  if (!hero || !factionId || factionId === 'unassigned') return false;
  const memberships = getHeroFactionMemberships(hero, factions);
  return memberships.some((m) => m.factionId === factionId);
}

/**
 * 判断角色是否属于特定从属组织/分支机构
 */
export function isHeroInSubFaction(hero?: Ultrawoman, subFactionId?: string, factions: Faction[] = DEFAULT_FACTIONS): boolean {
  if (!hero || !subFactionId || subFactionId === 'all') return true;
  const memberships = getHeroFactionMemberships(hero, factions);
  return memberships.some((m) => m.subFactionId === subFactionId || hero.subFactionId === subFactionId);
}

/**
 * 判断角色是否为未指定阵营（无任何阵营归属）
 */
export function isHeroUnassigned(hero?: Ultrawoman, factions: Faction[] = DEFAULT_FACTIONS): boolean {
  if (!hero) return true;
  const memberships = getHeroFactionMemberships(hero, factions);
  if (memberships.length === 0) return true;
  // 如果成员列表中所有阵营 ID 均不在现有阵营列表中，也视作未指定
  return !memberships.some((m) => factions.some((f) => f.id === m.factionId));
}

/**
 * 获取角色在特定阵营中的成员信息
 */
export function getHeroMembershipInFaction(hero?: Ultrawoman, factionId?: string, factions: Faction[] = DEFAULT_FACTIONS): HeroFactionMembership | undefined {
  if (!hero || !factionId) return undefined;
  const memberships = getHeroFactionMemberships(hero, factions);
  return memberships.find((m) => m.factionId === factionId);
}

/**
 * 获取角色的原籍母国/原生母邦信息
 */
export function getHeroOriginCountry(hero?: Ultrawoman, factions: Faction[] = DEFAULT_FACTIONS): string {
  if (!hero) return '未知星域';
  if (hero.nativeCountry && hero.nativeCountry.trim()) return hero.nativeCountry.trim();
  const prim = getHeroPrimaryFaction(hero, factions);
  if (prim.faction) return prim.faction.name;
  if (hero.homePlanet && hero.homePlanet.trim()) return hero.homePlanet.trim();
  return '自由星区 / 未知母邦';
}

/**
 * 判断角色在特定阵营中是否为【仅从属组织编制】(不直接加入大阵营直属核心)
 */
export function isHeroSubFactionOnlyInFaction(
  hero?: Ultrawoman,
  factionId?: string,
  factions: Faction[] = DEFAULT_FACTIONS
): boolean {
  if (!hero || !factionId) return false;
  const mem = getHeroMembershipInFaction(hero, factionId, factions);
  if (!mem) return false;
  return Boolean(
    mem.subFactionOnly ||
    mem.membershipType === 'sub_unit_only' ||
    (mem.title && /仅从属|编制干员|编制专员|非直属|独立编制/.test(mem.title)) ||
    (mem.affiliationNature && /独立编制|仅从属/.test(mem.affiliationNature))
  );
}

/**
 * 判断角色是否为该阵营的【直属本部核心成员】（非仅从属编制、非他国从属干员）
 */
export function isHeroDirectFactionMember(
  hero?: Ultrawoman,
  factionId?: string,
  factions: Faction[] = DEFAULT_FACTIONS
): boolean {
  if (!hero || !factionId) return false;
  const mem = getHeroMembershipInFaction(hero, factionId, factions);
  if (!mem) return false;
  if (isHeroSubFactionOnlyInFaction(hero, factionId, factions)) return false;
  if (isHeroForeignSubordinateInFaction(hero, factionId, factions)) return false;
  return true;
}

/**
 * 判断角色在特定阵营中是否为【他国/外籍从属成员】(跨国从属/附属国派驻/外聘特约)
 */
export function isHeroForeignSubordinateInFaction(
  hero?: Ultrawoman,
  factionId?: string,
  factions: Faction[] = DEFAULT_FACTIONS
): boolean {
  if (!hero || !factionId) return false;
  const mem = getHeroMembershipInFaction(hero, factionId, factions);
  if (!mem) return false;

  // 显式指定类型
  if (mem.membershipType && mem.membershipType !== 'core' && mem.membershipType !== 'sub_unit_only') {
    return true;
  }

  // 优先级大于1且主属阵营为其他阵营
  const primaryMem = getHeroFactionMemberships(hero, factions)[0];
  if (primaryMem && primaryMem.factionId !== factionId) {
    return true;
  }

  // 标题包含他国外籍等特征词
  if (mem.title && /他国|外籍|外邦|附属|客座|外援|雇佣|联络|流亡|潜伏|卧底|双重|兼任/.test(mem.title)) {
    return true;
  }

  // 显式指定了与本阵营不同的母国
  const currentFac = getFactionById(factionId, factions);
  if (mem.originCountry && currentFac && !currentFac.name.includes(mem.originCountry) && !mem.originCountry.includes(currentFac.shortName || currentFac.name)) {
    return true;
  }

  return false;
}

/**
 * 获取阵营内所有成员分类统计 (全部/阵营直属本部/仅从属组织编制/他国从属干员)
 */
export function getFactionMembersGrouped(
  heroes: Ultrawoman[],
  factionId: string,
  factions: Faction[] = DEFAULT_FACTIONS
): {
  all: Ultrawoman[];
  coreNative: Ultrawoman[];
  directHq: Ultrawoman[];
  subFactionOnly: Ultrawoman[];
  foreignSubordinate: Ultrawoman[];
} {
  const all = heroes.filter((h) => isHeroInFaction(h, factionId, factions));
  const subFactionOnly = all.filter((h) => isHeroSubFactionOnlyInFaction(h, factionId, factions));
  const foreignSubordinate = all.filter(
    (h) => !isHeroSubFactionOnlyInFaction(h, factionId, factions) && isHeroForeignSubordinateInFaction(h, factionId, factions)
  );
  const directHq = all.filter((h) => isHeroDirectFactionMember(h, factionId, factions));
  const coreNative = directHq;
  return { all, coreNative, directHq, subFactionOnly, foreignSubordinate };
}

/**
 * 规范化并保存角色的多阵营归属列表，同时同步顶级向下兼容字段 factionId, factionRole, subFactionId, subFactionName, subFactionOnly
 */
export function normalizeHeroFactionMemberships(
  hero: Ultrawoman,
  membershipsOrFactions?: HeroFactionMembership[] | Faction[],
  factions: Faction[] = DEFAULT_FACTIONS
): Ultrawoman {
  let targetMemberships: HeroFactionMembership[];
  if (Array.isArray(membershipsOrFactions)) {
    if (membershipsOrFactions.length > 0 && 'name' in membershipsOrFactions[0] && !('factionId' in membershipsOrFactions[0])) {
      targetMemberships = getHeroFactionMemberships(hero, membershipsOrFactions as Faction[]);
    } else {
      targetMemberships = membershipsOrFactions as HeroFactionMembership[];
    }
  } else {
    targetMemberships = getHeroFactionMemberships(hero, factions);
  }

  const cleanMemberships: HeroFactionMembership[] = targetMemberships
    .filter((m) => m && m.factionId && m.factionId.trim() !== '' && m.factionId !== 'unassigned')
    .map((m, idx) => ({
      ...m,
      priority: idx + 1,
      isPrimary: idx === 0,
      title: m.title || (idx === 0 ? (m.subFactionOnly ? '从属编制干员' : '主属阵营') : '他国从属'),
      role: m.role || '特勤干员',
    }));

  const primary = cleanMemberships[0];

  return {
    ...hero,
    factionMemberships: cleanMemberships,
    factionId: primary ? primary.factionId : hero.factionId,
    factionRole: primary ? primary.role : hero.factionRole,
    subFactionId: primary ? primary.subFactionId : hero.subFactionId,
    subFactionName: primary ? primary.subFactionName : hero.subFactionName,
    subFactionOnly: primary ? Boolean(primary.subFactionOnly) : false,
  };
}

/**
 * 向角色添加或更新一个阵营归属
 * 支持传入包含 factionId 的配置对象或传统多参数调用
 */
export function addOrUpdateHeroFactionMembership(
  hero: Ultrawoman,
  membershipOrFactionId: string | (Partial<HeroFactionMembership> & { factionId: string }),
  role?: string,
  priority?: number,
  title?: string,
  customNotes?: string,
  factions: Faction[] = DEFAULT_FACTIONS,
  subFactionId?: string,
  subFactionName?: string,
  membershipType?: string,
  originCountry?: string,
  affiliationNature?: string,
  subFactionOnly?: boolean
): Ultrawoman {
  const factionId = typeof membershipOrFactionId === 'string' ? membershipOrFactionId : membershipOrFactionId.factionId;
  if (!factionId || factionId === 'unassigned') {
    return hero;
  }

  const isObj = typeof membershipOrFactionId === 'object';
  const roleParam = isObj ? membershipOrFactionId.role : role;
  const priorityParam = isObj ? membershipOrFactionId.priority : priority;
  const titleParam = isObj ? membershipOrFactionId.title : title;
  const notesParam = isObj ? membershipOrFactionId.customNotes : customNotes;

  const hasSubFactionId = isObj ? 'subFactionId' in membershipOrFactionId : subFactionId !== undefined;
  const subFactionIdParam = isObj ? membershipOrFactionId.subFactionId : subFactionId;
  const hasSubFactionName = isObj ? 'subFactionName' in membershipOrFactionId : subFactionName !== undefined;
  const subFactionNameParam = isObj ? membershipOrFactionId.subFactionName : subFactionName;

  const membershipTypeParam = isObj ? membershipOrFactionId.membershipType : membershipType;
  const originCountryParam = isObj ? membershipOrFactionId.originCountry : originCountry;
  const affiliationNatureParam = isObj ? membershipOrFactionId.affiliationNature : affiliationNature;
  const subFactionOnlyParam = isObj ? membershipOrFactionId.subFactionOnly : subFactionOnly;

  const currentMemberships = getHeroFactionMemberships(hero, factions);
  const existingIdx = currentMemberships.findIndex((m) => m.factionId === factionId);

  let newMembership: HeroFactionMembership;
  if (existingIdx >= 0) {
    const prev = currentMemberships[existingIdx];
    newMembership = {
      ...prev,
      role: roleParam !== undefined ? roleParam : prev.role,
      title: titleParam !== undefined ? titleParam : prev.title,
      customNotes: notesParam !== undefined ? notesParam : prev.customNotes,
      subFactionId: hasSubFactionId ? subFactionIdParam : prev.subFactionId,
      subFactionName: hasSubFactionName ? subFactionNameParam : prev.subFactionName,
      membershipType: membershipTypeParam !== undefined ? membershipTypeParam : prev.membershipType,
      originCountry: originCountryParam !== undefined ? originCountryParam : prev.originCountry,
      affiliationNature: affiliationNatureParam !== undefined ? affiliationNatureParam : prev.affiliationNature,
      subFactionOnly: subFactionOnlyParam !== undefined ? subFactionOnlyParam : prev.subFactionOnly,
    };
    currentMemberships.splice(existingIdx, 1);
  } else {
    // 自动判定是否为他国从属（如果已有其他主属阵营）
    const isForeign = currentMemberships.length > 0;
    const defaultOrigin = hero.nativeCountry || (currentMemberships[0] ? getFactionById(currentMemberships[0].factionId, factions)?.name : hero.homePlanet);

    const isSubOnly = Boolean(subFactionOnlyParam || membershipTypeParam === 'sub_unit_only');

    newMembership = {
      factionId,
      role: roleParam?.trim() || (isSubOnly ? '编制专员' : isForeign ? '外聘特派员' : '特勤干员'),
      priority: priorityParam || currentMemberships.length + 1,
      title: titleParam || (isSubOnly ? '从属编制干员' : isForeign ? '他国从属干员' : '主属阵营'),
      customNotes: notesParam,
      subFactionId: subFactionIdParam,
      subFactionName: subFactionNameParam,
      membershipType: membershipTypeParam || (isSubOnly ? 'sub_unit_only' : isForeign ? 'foreign_subordinate' : 'core'),
      originCountry: originCountryParam || (isForeign || isSubOnly ? defaultOrigin : undefined),
      affiliationNature: affiliationNatureParam || (isSubOnly ? '独立从属编制' : isForeign ? '跨国派驻从属' : undefined),
      subFactionOnly: isSubOnly,
    };
  }

  // 插入到指定优先级位置
  const targetPriority = priorityParam !== undefined ? Math.max(1, priorityParam) : currentMemberships.length + 1;
  const insertIdx = Math.min(targetPriority - 1, currentMemberships.length);
  currentMemberships.splice(insertIdx, 0, newMembership);

  return normalizeHeroFactionMemberships(hero, currentMemberships, factions);
}

/**
 * 仅将角色加入特定从属组织/下属编制，不直接加入大阵营直属本部体系
 */
export function addHeroToSubFactionOnly(
  hero: Ultrawoman,
  factionId: string,
  subFactionId: string,
  subFactionName?: string,
  role: string = '编制专员',
  factions: Faction[] = DEFAULT_FACTIONS
): Ultrawoman {
  const currentMemberships = getHeroFactionMemberships(hero, factions);
  const isForeign = currentMemberships.length > 0 && currentMemberships[0].factionId !== factionId;
  const defaultOrigin = hero.nativeCountry || (currentMemberships[0] ? getFactionById(currentMemberships[0].factionId, factions)?.name : hero.homePlanet);

  return addOrUpdateHeroFactionMembership(
    hero,
    {
      factionId,
      subFactionId,
      subFactionName,
      role,
      title: '从属编制干员 (非大阵营直属)',
      membershipType: 'sub_unit_only',
      originCountry: defaultOrigin,
      affiliationNature: '独立从属编制',
      subFactionOnly: true,
      priority: currentMemberships.length + 1,
    },
    undefined,
    undefined,
    undefined,
    undefined,
    factions
  );
}

/**
 * 从角色中移除某个阵营归属
 */
export function removeHeroFromFaction(
  hero: Ultrawoman,
  factionId: string,
  factions: Faction[] = DEFAULT_FACTIONS
): Ultrawoman {
  const currentMemberships = getHeroFactionMemberships(hero, factions);
  const filtered = currentMemberships.filter((m) => m.factionId !== factionId);
  return normalizeHeroFactionMemberships(hero, filtered);
}

/**
 * 移动角色阵营优先级 (上移 / 下移)
 */
export function moveHeroFactionPriority(
  hero: Ultrawoman,
  factionId: string,
  direction: 'up' | 'down',
  factions: Faction[] = DEFAULT_FACTIONS
): Ultrawoman {
  const list = [...getHeroFactionMemberships(hero, factions)];
  const idx = list.findIndex((m) => m.factionId === factionId);
  if (idx < 0) return hero;

  if (direction === 'up' && idx > 0) {
    const temp = list[idx];
    list[idx] = list[idx - 1];
    list[idx - 1] = temp;
  } else if (direction === 'down' && idx < list.length - 1) {
    const temp = list[idx];
    list[idx] = list[idx + 1];
    list[idx + 1] = temp;
  }

  return normalizeHeroFactionMemberships(hero, list);
}

/**
 * 将某个阵营直接置顶提升为角色的【第1优先级·主属阵营】
 */
export function setHeroFactionAsPrimary(
  hero: Ultrawoman,
  factionId: string,
  factions: Faction[] = DEFAULT_FACTIONS
): Ultrawoman {
  const list = [...getHeroFactionMemberships(hero, factions)];
  const idx = list.findIndex((m) => m.factionId === factionId);
  if (idx < 0) return hero;

  const [target] = list.splice(idx, 1);
  list.unshift(target);

  return normalizeHeroFactionMemberships(hero, list);
}

