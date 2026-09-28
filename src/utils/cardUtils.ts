import {
  Ultrawoman,
  CharacterCard,
  CharacterDeckCard,
  WorldViewCard,
  WorldViewSlot,
  JailbreakCard,
  JailbreakPreset,
  AiAttachment,
  Faction,
  BodyPartId,
  BodyPartConfig,
  Stats,
  UltrawomanVoiceLines,
  RelationshipSlot,
} from '../types';

export interface CharacterCardExportOptions {
  format?: 'ultra_v3' | 'tavern_v2';
  includePortrait?: boolean;
  includeAttachments?: boolean;
  includeRelationships?: boolean;
  includeAssociatedRelationships?: boolean;
  allFactions?: Faction[];
  allRelationshipSlots?: RelationshipSlot[];
  author?: string;
  notes?: string;
}

export interface CharacterDeckExportOptions {
  name?: string;
  deckName?: string;
  description?: string;
  deckDescription?: string;
  author?: string;
  includePortraits?: boolean;
  includeAttachments?: boolean;
  includeRelationships?: boolean;
  includeAssociatedRelationships?: boolean;
  allFactions?: Faction[];
  allRelationshipSlots?: RelationshipSlot[];
  tags?: string[];
}

export interface ParsedCharacterCardResult {
  success: boolean;
  hero?: Ultrawoman;
  detectedFormat?:
    | 'ultra_v3'
    | 'ultra_v2'
    | 'ultra_v1'
    | 'ultra_deck_v3'
    | 'tavern_v2'
    | 'tavern_v1'
    | 'raw_hero'
    | 'unknown';
  formatLabel?: string;
  importedFactions?: Faction[];
  customFactions?: Faction[];
  importedRelationships?: RelationshipSlot[];
  associatedRelationshipSlots?: RelationshipSlot[];
  warnings?: string[];
  error?: string;
  isDeckPackage?: boolean;
  deckHeroes?: Ultrawoman[];
  deckName?: string;
  deckMetadata?: {
    name?: string;
    description?: string;
    author?: string;
    totalCount?: number;
  };
  summary?: {
    name: string;
    title?: string;
    race?: string;
    hasPortrait: boolean;
    bodyPartsCount: number;
    voiceLinesCount: number;
    triggersCount: number;
    envWeaknessesCount: number;
    relationshipsCount: number;
    attachmentsCount: number;
    factionsCount: number;
    associatedBondsCount: number;
  };
}

export interface ParsedCharacterDeckResult {
  success: boolean;
  deckName?: string;
  deckDescription?: string;
  author?: string;
  createdAt?: string;
  totalCount: number;
  heroes: Ultrawoman[];
  importedFactions?: Faction[];
  importedRelationships?: RelationshipSlot[];
  error?: string;
}

/**
 * 默认标准 7 部位生理结构模板 (确保导入任何缺失部位的数据卡均能完整补全)
 */
export const DEFAULT_ANATOMY_PARTS: Record<BodyPartId, BodyPartConfig> = {
  head: {
    id: 'head',
    name: '头部 / 冰斧 / 王冠',
    maxHealth: 100,
    currentHealth: 100,
    exposure: 0,
    weaknessMultiplier: 1.0,
    description: '角色的面部、感知晶状体与头部武装，受创时可能引发视听眩晕。',
  },
  timer: {
    id: 'timer',
    name: '魔能值 / 能量中枢',
    maxHealth: 100,
    currentHealth: 100,
    exposure: 0,
    weaknessMultiplier: 2.0,
    description: '核心光子中枢，维持体能运转的关键命脉。受损将造成严重脱力与警报闪烁。',
  },
  chest: {
    id: 'chest',
    name: '胸甲 / 锁骨光脉',
    maxHealth: 100,
    currentHealth: 100,
    exposure: 0,
    weaknessMultiplier: 1.2,
    description: '胸部厚重防护装甲与光流纹路，紧护心肺呼吸枢纽。',
  },
  leftArm: {
    id: 'leftArm',
    name: '左臂 / 光线手套',
    maxHealth: 100,
    currentHealth: 100,
    exposure: 0,
    weaknessMultiplier: 1.0,
    description: '战术护臂与光束发射端。',
  },
  rightArm: {
    id: 'rightArm',
    name: '右臂 / 光线组合端',
    maxHealth: 100,
    currentHealth: 100,
    exposure: 0,
    weaknessMultiplier: 1.0,
    description: '主力近战打击与技能凝聚手臂。',
  },
  torso: {
    id: 'torso',
    name: '腰腹 / 柔弱枢纽',
    maxHealth: 100,
    currentHealth: 100,
    exposure: 0,
    weaknessMultiplier: 1.4,
    description: '柔韧且防御较薄弱的腰腹核心，承受重击或敏感刺激极易动摇心理防线。',
  },
  legs: {
    id: 'legs',
    name: '双腿 / 高跟战靴',
    maxHealth: 100,
    currentHealth: 100,
    exposure: 0,
    weaknessMultiplier: 1.0,
    description: '修长挺拔的战术下肢与装甲靴，提供高速机动与站立支撑。',
  },
};

/**
 * 构造 TavernAI / SillyTavern 专用的 WorldInfo / CharacterBook 词条库
 * 将阵营信息、7部位生理结构、弱点与环境受击反馈、人际关系与多模态设定文档深度整合
 */
export function buildTavernLorebook(
  hero: Ultrawoman,
  allFactions: Faction[] = [],
  relationshipSlots: RelationshipSlot[] = []
): any {
  const entries: any[] = [];
  let entryId = 1;

  // 1. 生理结构与弱点机制 (Anatomy & Vulnerability)
  const partsSummary = Object.entries(hero.bodyParts || DEFAULT_ANATOMY_PARTS)
    .map(
      ([partId, cfg]) =>
        `- 【${cfg.name}】(易伤倍率: ${cfg.weaknessMultiplier}x): ${cfg.description}`
    )
    .join('\n');

  entries.push({
    id: entryId++,
    keys: [hero.name, `${hero.name}的身体`, '弱点部位', '魔能中枢', '胸甲', '腰腹', 'sensitive'],
    secondary_keys: ['受创', '部位', '攻击', '触碰', '破损'],
    comment: `${hero.name} - 生理构造与部位防御机能`,
    content: `【${hero.name} 生理与装甲构造】\n- 致命弱点: ${hero.weakness || '魔能中枢'}\n- 敏感部位: ${hero.sensitivePart ? hero.bodyParts?.[hero.sensitivePart]?.name || hero.sensitivePart : '腰腹柔弱枢纽'}\n- 全部位防御机能概览:\n${partsSummary}`,
    enabled: true,
    insertion_order: 10,
    selective: true,
    constant: false,
    position: 'before_char',
  });

  // 2. 阵营所属与组织层级 (Faction & Organization)
  if (hero.factionId || (hero.factionMemberships && hero.factionMemberships.length > 0)) {
    const primaryFaction = allFactions.find((f) => f.id === hero.factionId);
    const membershipsText = (hero.factionMemberships || [])
      .map((m) => {
        const fac = allFactions.find((f) => f.id === m.factionId);
        const subName = m.subFactionName ? ` (编制: ${m.subFactionName})` : '';
        const originText = m.originCountry ? ` [母国属地: ${m.originCountry}]` : '';
        const natureText = m.affiliationNature ? ` [从属性质: ${m.affiliationNature}]` : '';
        const typeText = m.title ? ` [身份: ${m.title}]` : '';
        return `- 所属组织: ${fac?.name || m.factionId}${subName} | 职务/身份: ${m.role || '特勤干员'}${m.isPrimary ? ' (主属阵营)' : ' (他国从属/兼任)'}${typeText}${originText}${natureText}`;
      })
      .join('\n');

    entries.push({
      id: entryId++,
      keys: [hero.name, `${hero.name}的阵营`, '所属组织', '职务', '阵营', '军衔', '从属', 'faction', '外籍特派', '跨国'],
      secondary_keys: ['背景', '组织', '盟友', '效忠', '外籍', '从属'],
      comment: `${hero.name} - 组织阵营与身份层级`,
      content: `【${hero.name} 组织阵营与身份履历】\n- 母国/原生属地: ${hero.nativeCountry || hero.homePlanet || '未知'}\n- 主阵营: ${primaryFaction?.name || hero.factionId || '无独立主阵营'}\n- 职务职级: ${hero.factionRole || '执行官'}\n${membershipsText ? `\n详细编制与跨国从属履历:\n${membershipsText}` : ''}`,
      enabled: true,
      insertion_order: 20,
      selective: true,
      constant: false,
      position: 'before_char',
    });
  }

  // 3. 环境弱点与受击反应 (Env Weaknesses & Triggers)
  if (hero.envWeaknesses && hero.envWeaknesses.length > 0) {
    const envSummary = hero.envWeaknesses
      .filter((ew) => ew.enabled)
      .map(
        (ew) =>
          `- 【${ew.name}】(环境要素: ${ew.envTheme}, 加成: ${ew.damageMultiplier}x): ${ew.lines.slice(0, 2).join(' / ')}`
      )
      .join('\n');

    entries.push({
      id: entryId++,
      keys: [hero.name, '环境弱点', '强酸', '熔岩', '极寒', '等离子', '虚空', '催眠', '环境损害'],
      secondary_keys: ['舱', '浸泡', '侵蚀', '辐射'],
      comment: `${hero.name} - 环境弱点与特殊环境反应`,
      content: `【${hero.name} 环境弱点与特殊介质受创反应】\n${envSummary}`,
      enabled: true,
      insertion_order: 30,
      selective: true,
      constant: false,
      position: 'after_char',
    });
  }

  // 4. 人际关系与灵魂羁绊 (Relationships & Bonds)
  const heroRels = hero.heroRelationships || [];
  const boundSlots = relationshipSlots.filter(
    (s) => s.targetHeroId === hero.id || (s.targetHeroName && s.targetHeroName === hero.name)
  );

  if (heroRels.length > 0 || boundSlots.length > 0) {
    const relsText = heroRels
      .map(
        (r) =>
          `- 对【${r.targetHeroName || r.targetHeroId}】(关系: ${r.relationType || '同僚'}${r.attitudeTone ? ` / 态度: ${r.attitudeTone}` : ''}): ${r.description || '并肩战斗的同伴。'}`
      )
      .join('\n');

    const slotsText = boundSlots
      .map((s) => `- 专属羁绊契约【${s.title}】: ${s.description} (指导: ${s.stylePrompt})`)
      .join('\n');

    entries.push({
      id: entryId++,
      keys: [hero.name, `${hero.name}的关系`, '人际关系', '羁绊', '契约', '同伴', '契约'],
      secondary_keys: ['同伴', '搭档', '感情', '誓约'],
      comment: `${hero.name} - 人际羁绊与契约状态`,
      content: `【${hero.name} 角色人际关系与专属契约】\n${relsText ? `人物羁绊:\n${relsText}\n` : ''}${slotsText ? `专属契约槽位:\n${slotsText}` : ''}`,
      enabled: true,
      insertion_order: 40,
      selective: true,
      constant: false,
      position: 'after_char',
    });
  }

  // 5. 专属挂载参考设定集与档案文档 (Multi-modal Reference Attachments)
  if (hero.characterAttachments && hero.characterAttachments.length > 0) {
    const docs = hero.characterAttachments.filter(
      (a) => a.type === 'document' && a.enabled && a.content
    );
    docs.forEach((doc) => {
      entries.push({
        id: entryId++,
        keys: [hero.name, doc.name, '档案', '背景设定', '机密资料', '设定文档'],
        secondary_keys: ['资料', '历史', '记载'],
        comment: `${hero.name} - 设定文档 [${doc.name}]`,
        content: `【${hero.name} 专属挂载档案: ${doc.name}】\n${doc.description ? `说明: ${doc.description}\n\n` : ''}${doc.content}`,
        enabled: true,
        insertion_order: 50,
        selective: true,
        constant: false,
        position: 'after_char',
      });
    });
  }

  return {
    name: `${hero.name} 战术全息世界设定集`,
    description: `自动生成的全息角色卡专属 Lorebook，囊括 ${hero.name} 的生理弱点、阵营组织、语音反应与专属羁绊。`,
    scan_depth: 4,
    token_budget: 2048,
    recursive_scanning: true,
    extensions: {},
    entries,
  };
}

/**
 * 完整导出全息角色卡 (支持 Ultra Card v3.0 旗舰格式与 TavernAI V2 深度兼容规范)
 */
export function exportCharacterCard(
  hero: Ultrawoman,
  options: CharacterCardExportOptions = {}
): CharacterCard {
  const {
    format = 'ultra_v3',
    includePortrait = true,
    includeAttachments = true,
    includeAssociatedRelationships = true,
    allFactions = [],
    allRelationshipSlots = [],
    author = 'Commander',
    notes,
  } = options;

  // 深度复制 hero 结构
  const heroCopy: Ultrawoman = JSON.parse(JSON.stringify(hero));

  if (!includePortrait) {
    heroCopy.customPortrait = undefined;
    heroCopy.avatarSvg = undefined;
  }

  if (!includeAttachments) {
    heroCopy.characterAttachments = [];
  }

  // 整理标签体系
  const tags = Array.from(
    new Set([
      hero.race || '宇宙特勤族',
      hero.title || '战术干员',
      hero.factionRole || '执行官',
      hero.personalityCustomName ||
        (typeof hero.personality === 'string' ? hero.personality : '默认性格'),
      hero.homePlanet || '未知原籍',
      ...(hero.raceTraits || []),
      ...(hero.personalityCustomTags || []),
    ])
  ).filter(Boolean);

  // 收集引用的自定义阵营定义
  let customFactionsIncluded: Faction[] | undefined = undefined;
  if (allFactions && allFactions.length > 0) {
    const referencedFactionIds = new Set<string>();
    if (hero.factionId) referencedFactionIds.add(hero.factionId);
    if (hero.factionMemberships) {
      hero.factionMemberships.forEach((m) => referencedFactionIds.add(m.factionId));
    }
    const matchedCustomFactions = allFactions.filter(
      (f) => referencedFactionIds.has(f.id) && f.isCustom
    );
    if (matchedCustomFactions.length > 0) {
      customFactionsIncluded = matchedCustomFactions;
    }
  }

  // 收集绑定的专属关系契约槽位
  let associatedRelationshipSlots: RelationshipSlot[] | undefined = undefined;
  if (includeAssociatedRelationships && allRelationshipSlots && allRelationshipSlots.length > 0) {
    const matchedSlots = allRelationshipSlots.filter(
      (s) =>
        s.targetHeroId === hero.id ||
        (s.targetHeroName && s.targetHeroName === hero.name)
    );
    if (matchedSlots.length > 0) {
      associatedRelationshipSlots = matchedSlots;
    }
  }

  // 构建 TavernAI V2 兼容数据块
  const appearanceText = [
    hero.appearance?.hairStyle && `发型发色: ${hero.appearance.hairStyle}`,
    hero.appearance?.eyeColor && `瞳色特征: ${hero.appearance.eyeColor}`,
    hero.appearance?.skinTone && `肤色特质: ${hero.appearance.skinTone}`,
    hero.appearance?.bodyFeatures && `身段体态: ${hero.appearance.bodyFeatures}`,
    hero.appearance?.outfit && `装束战甲: ${hero.appearance.outfit}`,
    hero.appearance?.accessories && `随身饰品: ${hero.appearance.accessories}`,
    hero.appearance?.customVisualPrompt &&
      `视觉细节刻画: ${hero.appearance.customVisualPrompt}`,
  ]
    .filter(Boolean)
    .join('\n');

  const voiceSampleGreetings = (hero.voiceLines?.greeting || ['……']).join('\n');
  const voiceSampleDefiant = (hero.voiceLines?.defiant || ['绝不屈服！'])
    .slice(0, 3)
    .join(' / ');
  const voiceSampleHit = (hero.voiceLines?.hitHeavy || ['呃啊啊……'])
    .slice(0, 3)
    .join(' / ');
  const voiceSampleWavering = (hero.voiceLines?.wavering || ['怎么会……'])
    .slice(0, 3)
    .join(' / ');
  const voiceSampleBegging = (hero.voiceLines?.beggingResistant || ['住手……'])
    .slice(0, 2)
    .join(' / ');

  const lorebook = buildTavernLorebook(hero, allFactions, allRelationshipSlots);

  const tavernData = {
    name: hero.name,
    description: `【角色称号】: ${hero.title || '战术特勤干员'}\n【种族血统】: ${hero.race || '宇宙生命体'} (${(hero.raceTraits || []).join('、')})\n【原籍星系】: ${hero.homePlanet || '未知领域'}\n【身高体重】: ${hero.height || '未知'} / ${hero.weight || '未知'}\n\n【外貌与战甲】:\n${appearanceText || '暂无详细外貌说明。'}\n\n【背景身世】:\n${hero.description || '暂无故事背景。'}\n\n【弱点生理】:\n${hero.weakness || '暂无主要弱点。'} (弱点部位: ${hero.weakPart || 'timer'}, 敏感部位: ${hero.sensitivePart || 'torso'})`,
    personality: `性格设定: ${hero.personalityCustomName || hero.personality || '坚毅不屈'}\n语气语调: ${hero.personalityTone || '严肃沉稳'}\n性格标签: ${(hero.personalityCustomTags || []).join(', ')}\n\n行为准则与心理引导:\n${hero.personalityCustomPrompt || hero.customPrompt || '请以真实细腻的战术反应与心理起伏进行回应。'}`,
    scenario: `当前情境处于科幻战术对抗与交互模拟器中。角色身为【${hero.title || hero.name}】，在面对审讯、肢体触碰、能量武器攻击与拘束压制时，产生极其生动的肢体语言、微表情、呼吸紊乱与心理动摇反馈。`,
    first_mes:
      hero.voiceLines?.greeting?.[0] || '……（以警惕而凛然的目光注视着前方）',
    mes_example: `<START>\n<user>: 放弃顽抗吧，你的防线已经瓦解了。\n<char>: ${voiceSampleDefiant}\n\n<START>\n<user>: （施加能量打击与拘束压制）\n<char>: ${voiceSampleHit}\n\n<START>\n<user>: 你的意志似乎动摇了。\n<char>: ${voiceSampleWavering}\n\n<START>\n<user>: 承认失败吧。\n<char>: ${voiceSampleBegging}`,
    creator_notes:
      notes ||
      `由角色战术互动与对抗模拟器导出的全息角色卡 [${hero.name}] (Ultra Card v3.0 旗舰版)`,
    system_prompt: hero.personalityCustomPrompt || hero.customPrompt || '',
    post_history_instructions: `请严格遵守【${hero.name}】的性格语调、弱点机制与受击反应规范，生动刻画其身体受损度、能量消耗与心理状态变化。`,
    alternate_greetings: hero.voiceLines?.greeting?.slice(1) || [],
    character_book: lorebook,
    tags: tags,
    creator: author,
    character_version: '3.0',
    extensions: {
      ultra_hero: heroCopy,
      associated_relationships: associatedRelationshipSlots,
      custom_factions: customFactionsIncluded,
      generator: 'Ultra Tactical Interrogation Simulator v5.0',
    },
  };

  return {
    cardType: 'ultra_character_card',
    version: '3.0',
    createdAt: new Date().toISOString(),
    hero: heroCopy,
    tags,
    notes:
      notes ||
      `由角色战术互动与对抗模拟器导出的全息角色卡 [${hero.name}] (Ultra Card v3.0 旗舰版)`,
    author,
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: tavernData,
    customFactionsIncluded,
    associatedRelationshipSlots,
  };
}

/**
 * 触发本地下载单张 JSON 角色卡文件
 */
export function downloadCharacterCardFile(
  hero: Ultrawoman,
  options: CharacterCardExportOptions = {}
) {
  const card = exportCharacterCard(hero, options);
  const jsonStr = JSON.stringify(card, null, 2);
  const cleanName = (hero.name || '角色').replace(
    /[^a-zA-Z0-9\u4e00-\u9fa5]/g,
    '_'
  );
  const formatTag = options.format === 'tavern_v2' ? 'TavernV2' : 'UltraV3';
  const fileName = `CharacterCard_${cleanName}_${formatTag}.json`;

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 完整导出角色名册全量卡包 / 批量卡组 (Ultra Character Deck v3.0)
 */
export function exportCharacterDeck(
  heroes: Ultrawoman[],
  options: CharacterDeckExportOptions = {}
): CharacterDeckCard {
  const {
    name = '宇宙战术干员全息名册卡组',
    description = '包含多名干员的完整全息角色名册包，含全部生理弱点、语音、人际关系与多模态资料。',
    author = 'Commander',
    includePortraits = true,
    includeAttachments = true,
    includeAssociatedRelationships = true,
    allFactions = [],
    allRelationshipSlots = [],
    tags = ['名册包', '全息卡组', '小队集结'],
  } = options;

  const heroesCopy: Ultrawoman[] = JSON.parse(JSON.stringify(heroes)).map(
    (h: Ultrawoman) => {
      if (!includePortraits) {
        h.customPortrait = undefined;
        h.avatarSvg = undefined;
      }
      if (!includeAttachments) {
        h.characterAttachments = [];
      }
      return h;
    }
  );

  // 收集所包含角色引用的所有自定义阵营
  const referencedFactionIds = new Set<string>();
  heroes.forEach((h) => {
    if (h.factionId) referencedFactionIds.add(h.factionId);
    if (h.factionMemberships) {
      h.factionMemberships.forEach((m) => referencedFactionIds.add(m.factionId));
    }
  });

  const matchedCustomFactions = allFactions.filter(
    (f) => referencedFactionIds.has(f.id) && f.isCustom
  );

  // 收集所包含角色关联的所有专属关系契约
  let associatedRelationshipSlots: RelationshipSlot[] | undefined = undefined;
  if (includeAssociatedRelationships && allRelationshipSlots && allRelationshipSlots.length > 0) {
    const heroIdSet = new Set(heroes.map((h) => h.id));
    const heroNameSet = new Set(heroes.map((h) => h.name));
    const matchedSlots = allRelationshipSlots.filter(
      (s) =>
        (s.targetHeroId && heroIdSet.has(s.targetHeroId)) ||
        (s.targetHeroName && heroNameSet.has(s.targetHeroName))
    );
    if (matchedSlots.length > 0) {
      associatedRelationshipSlots = matchedSlots;
    }
  }

  return {
    cardType: 'ultra_character_deck',
    version: '3.0',
    id: `deck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || '战术干员全息卡组',
    description: description.trim(),
    createdAt: new Date().toISOString(),
    author,
    totalCount: heroesCopy.length,
    tags,
    heroes: heroesCopy,
    customFactionsIncluded:
      matchedCustomFactions.length > 0 ? matchedCustomFactions : undefined,
    associatedRelationshipSlots,
  };
}

/**
 * 触发本地下载批量卡组文件
 */
export function downloadCharacterDeckFile(
  heroes: Ultrawoman[],
  options: CharacterDeckExportOptions = {}
) {
  const deck = exportCharacterDeck(heroes, options);
  const jsonStr = JSON.stringify(deck, null, 2);
  const cleanName = (deck.name || 'CharacterDeck').replace(
    /[^a-zA-Z0-9\u4e00-\u9fa5]/g,
    '_'
  );
  const fileName = `CharacterDeck_${cleanName}_${heroes.length}Heroes.json`;

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 智能规范化单个角色对象，确保全部 7 大生理部位、语音、外貌、属性与弱点完整无损
 */
export function normalizeHeroObject(
  rawCandidate: any,
  options?: { forceNewId?: boolean }
): Ultrawoman {
  // 1. 身体部位 Anatomy 规范化 (保证完整 7 个部位，缺失项安全补全)
  const normalizedBodyParts: Record<BodyPartId, BodyPartConfig> = {
    ...DEFAULT_ANATOMY_PARTS,
  };
  if (rawCandidate.bodyParts && typeof rawCandidate.bodyParts === 'object') {
    Object.keys(DEFAULT_ANATOMY_PARTS).forEach((partId) => {
      if (rawCandidate.bodyParts[partId]) {
        const rawPart = rawCandidate.bodyParts[partId];
        normalizedBodyParts[partId] = {
          id: partId,
          name: rawPart.name || DEFAULT_ANATOMY_PARTS[partId].name,
          maxHealth:
            typeof rawPart.maxHealth === 'number' ? rawPart.maxHealth : 100,
          currentHealth:
            typeof rawPart.currentHealth === 'number'
              ? rawPart.currentHealth
              : 100,
          exposure:
            typeof rawPart.exposure === 'number' ? rawPart.exposure : 0,
          weaknessMultiplier:
            typeof rawPart.weaknessMultiplier === 'number'
              ? rawPart.weaknessMultiplier
              : DEFAULT_ANATOMY_PARTS[partId].weaknessMultiplier,
          description:
            rawPart.description || DEFAULT_ANATOMY_PARTS[partId].description,
        };
      }
    });
  }

  // 2. 战术属性 Stats 规范化
  const rawStats = rawCandidate.defaultStats || {};
  const normalizedStats: Stats = {
    hp: typeof rawStats.hp === 'number' ? rawStats.hp : 100,
    energy: typeof rawStats.energy === 'number' ? rawStats.energy : 100,
    morale: typeof rawStats.morale === 'number' ? rawStats.morale : 100,
    shame: typeof rawStats.shame === 'number' ? rawStats.shame : 0,
    obedience: typeof rawStats.obedience === 'number' ? rawStats.obedience : 0,
    lust: typeof rawStats.lust === 'number' ? rawStats.lust : 0,
    maxHp: typeof rawStats.maxHp === 'number' ? rawStats.maxHp : 100,
    maxEnergy:
      typeof rawStats.maxEnergy === 'number' ? rawStats.maxEnergy : 100,
    maxMorale:
      typeof rawStats.maxMorale === 'number' ? rawStats.maxMorale : 100,
    maxShame:
      typeof rawStats.maxShame === 'number' ? rawStats.maxShame : 100,
    maxObedience:
      typeof rawStats.maxObedience === 'number' ? rawStats.maxObedience : 100,
    maxLust:
      typeof rawStats.maxLust === 'number' ? rawStats.maxLust : 100,
  };

  // 3. 语音反应 VoiceLines 规范化 (支持全 17 种场景回应)
  const rawVoice = rawCandidate.voiceLines || {};
  const normalizedVoiceLines: UltrawomanVoiceLines = {
    greeting: Array.isArray(rawVoice.greeting)
      ? rawVoice.greeting
      : rawVoice.greeting
      ? [rawVoice.greeting]
      : ['……（以警惕而凛然的目光注视着前方）'],
    hitSmall: Array.isArray(rawVoice.hitSmall)
      ? rawVoice.hitSmall
      : ['唔……！', '这点冲击还在承受范围内……'],
    hitHeavy: Array.isArray(rawVoice.hitHeavy)
      ? rawVoice.hitHeavy
      : ['呃啊啊——！', '怎么可能……这种破坏力……'],
    hitWeakPoint: Array.isArray(rawVoice.hitWeakPoint)
      ? rawVoice.hitWeakPoint
      : ['呀啊——！中枢……中枢被击中了！'],
    hitSensitivePoint: Array.isArray(rawVoice.hitSensitivePoint)
      ? rawVoice.hitSensitivePoint
      : ['别……别碰那里……！身体在发烫……'],
    timerLow: Array.isArray(rawVoice.timerLow)
      ? rawVoice.timerLow
      : ['能量……正在迅速见底……'],
    touchReaction: Array.isArray(rawVoice.touchReaction)
      ? rawVoice.touchReaction
      : ['放手……！不要用那种方式触碰我……'],
    hypnosisReaction: Array.isArray(rawVoice.hypnosisReaction)
      ? rawVoice.hypnosisReaction
      : ['思维……开始变得迟钝……不……'],
    envDamageReaction: Array.isArray(rawVoice.envDamageReaction)
      ? rawVoice.envDamageReaction
      : ['高能辐射……正在侵蚀装甲肌理……'],
    defiant: Array.isArray(rawVoice.defiant)
      ? rawVoice.defiant
      : ['正义的信念……绝不会在此折断！', '我是不会向你屈服的！'],
    wavering: Array.isArray(rawVoice.wavering)
      ? rawVoice.wavering
      : ['难道……我真的无法战胜你吗……', '身体已经……快要动弹不得了……'],
    broken: Array.isArray(rawVoice.broken)
      ? rawVoice.broken
      : ['已经……无法再支撑下去了……悉听尊便吧……'],
    beggingResistant: Array.isArray(rawVoice.beggingResistant)
      ? rawVoice.beggingResistant
      : ['住手……求你……不要再破坏核心了……'],
    beggingDesperate: Array.isArray(rawVoice.beggingDesperate)
      ? rawVoice.beggingDesperate
      : ['好痛苦……我认输了……饶了我吧……'],
    beggingSubmissive: Array.isArray(rawVoice.beggingSubmissive)
      ? rawVoice.beggingSubmissive
      : ['请支配我……无论什么要求……我都遵从……'],
    corpseReaction: Array.isArray(rawVoice.corpseReaction)
      ? rawVoice.corpseReaction
      : ['（心跳微弱，意识陷入深度停滞与抽搐……）'],
    healingReaction: Array.isArray(rawVoice.healingReaction)
      ? rawVoice.healingReaction
      : ['温暖的光芒……体能正在缓缓复苏……'],
  };

  // 4. 外貌 Appearance 规范化
  const rawApp = rawCandidate.appearance || {};
  const normalizedAppearance = {
    hairStyle: rawApp.hairStyle || undefined,
    eyeColor: rawApp.eyeColor || undefined,
    skinTone: rawApp.skinTone || undefined,
    bodyFeatures: rawApp.bodyFeatures || undefined,
    outfit: rawApp.outfit || undefined,
    accessories: rawApp.accessories || undefined,
    customVisualPrompt: rawApp.customVisualPrompt || undefined,
  };

  // 5. 颜色主题与声调
  const normalizedColorTheme = {
    primary: rawCandidate.colorTheme?.primary || '#8b5cf6',
    secondary: rawCandidate.colorTheme?.secondary || '#ec4899',
    glow: rawCandidate.colorTheme?.glow || '#a855f7',
    bgGradient:
      rawCandidate.colorTheme?.bgGradient ||
      'from-purple-900/30 via-zinc-950 to-blue-900/30',
  };

  // 6. ID 生成策略
  const id = options?.forceNewId
    ? `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    : rawCandidate.id && rawCandidate.id.startsWith('custom_')
    ? rawCandidate.id
    : `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    name: (rawCandidate.name || '未知英雄').trim(),
    title: rawCandidate.title || '战术特勤干员',
    height: rawCandidate.height || '168cm',
    weight: rawCandidate.weight || '52kg',
    homePlanet: rawCandidate.homePlanet || '未知领域',
    description: rawCandidate.description || '暂无故事背景。',
    race: rawCandidate.race || '宇宙特勤族',
    raceTraits: Array.isArray(rawCandidate.raceTraits)
      ? rawCandidate.raceTraits
      : rawCandidate.raceTraits
      ? [rawCandidate.raceTraits]
      : [],
    appearance: normalizedAppearance,
    factionId: rawCandidate.factionId || undefined,
    factionRole: rawCandidate.factionRole || undefined,
    subFactionId: rawCandidate.subFactionId || undefined,
    subFactionName: rawCandidate.subFactionName || undefined,
    factionMemberships: Array.isArray(rawCandidate.factionMemberships)
      ? rawCandidate.factionMemberships
      : undefined,
    personality: rawCandidate.personality || 'resilient',
    personalityCustomName: rawCandidate.personalityCustomName || undefined,
    personalityCustomPrompt: rawCandidate.personalityCustomPrompt || undefined,
    personalityTone: rawCandidate.personalityTone || undefined,
    personalityCustomTags: Array.isArray(rawCandidate.personalityCustomTags)
      ? rawCandidate.personalityCustomTags
      : [],
    customPrompt: rawCandidate.customPrompt || undefined,
    weakness:
      rawCandidate.weakness ||
      '魔能中枢为致命弱点，受到持续破坏将急速瓦解战斗意志。',
    weakPart: rawCandidate.weakPart || 'timer',
    sensitivePart: rawCandidate.sensitivePart || 'torso',
    voicePitch:
      typeof rawCandidate.voicePitch === 'number'
        ? rawCandidate.voicePitch
        : 1.0,
    colorTheme: normalizedColorTheme,
    defaultStats: normalizedStats,
    energyRegenRate:
      typeof rawCandidate.energyRegenRate === 'number'
        ? rawCandidate.energyRegenRate
        : 0.5,
    bodyParts: normalizedBodyParts,
    voiceLines: normalizedVoiceLines,
    customVoiceTriggers: Array.isArray(rawCandidate.customVoiceTriggers)
      ? rawCandidate.customVoiceTriggers
      : [],
    envWeaknesses: Array.isArray(rawCandidate.envWeaknesses)
      ? rawCandidate.envWeaknesses
      : [],
    heroRelationships: Array.isArray(rawCandidate.heroRelationships)
      ? rawCandidate.heroRelationships
      : [],
    characterAttachments: Array.isArray(rawCandidate.characterAttachments)
      ? rawCandidate.characterAttachments
      : [],
    avatarSvg: rawCandidate.avatarSvg,
    customPortrait: rawCandidate.customPortrait,
  };
}

/**
 * 智能解析全格式角色卡 (支持 Ultra Card v3.0/v2.0/v1.0、TavernAI V2/V1、原生角色对象、批量卡组等)
 */
export function parseCharacterCard(
  jsonStr: string,
  options?: { allFactions?: Faction[]; forceNewId?: boolean }
): ParsedCharacterCardResult {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      return { success: false, error: '无效的数据格式，非合法 JSON 对象' };
    }

    let detectedFormat: ParsedCharacterCardResult['detectedFormat'] = 'unknown';
    let formatLabel = '未知数据卡';
    let heroCandidate: any = null;
    let importedFactions: Faction[] = [];
    let importedRelationships: RelationshipSlot[] = [];
    const warnings: string[] = [];
    let isDeckPackage = false;
    let deckHeroes: Ultrawoman[] = [];
    let deckName = '';

    // 格式分支 0: 角色全息名册卡组 (Ultra Character Deck v3.0)
    if (
      data.cardType === 'ultra_character_deck' ||
      (Array.isArray(data.heroes) && data.heroes.length > 0)
    ) {
      detectedFormat = 'ultra_deck_v3';
      formatLabel = `📦 全息名册卡组包 (Ultra Deck v3.0 - 含 ${data.heroes?.length || 0} 位干员)`;
      isDeckPackage = true;
      deckName = data.name || '导入的角色名册包';

      if (Array.isArray(data.customFactionsIncluded)) {
        importedFactions = data.customFactionsIncluded;
      }
      if (Array.isArray(data.associatedRelationshipSlots)) {
        importedRelationships = data.associatedRelationshipSlots;
      }

      deckHeroes = (data.heroes || []).map((rawHero: any) =>
        normalizeHeroObject(rawHero, { forceNewId: options?.forceNewId })
      );

      heroCandidate = deckHeroes[0];
    }
    // 格式分支 1: Ultra Character Card v3.0 / v2.0 / v1.0
    else if (data.cardType === 'ultra_character_card') {
      if (data.version === '3.0') {
        detectedFormat = 'ultra_v3';
        formatLabel = '✨ 全息角色卡 (Ultra Card v3.0 旗舰版)';
      } else if (data.version === '2.0') {
        detectedFormat = 'ultra_v2';
        formatLabel = '💎 角色数据卡 (Ultra Card v2.0)';
      } else {
        detectedFormat = 'ultra_v1';
        formatLabel = '📜 基础角色卡 (Ultra Card v1.0)';
      }

      heroCandidate = data.hero ? { ...data.hero } : null;

      if (Array.isArray(data.customFactionsIncluded)) {
        importedFactions = data.customFactionsIncluded;
      }
      if (Array.isArray(data.associatedRelationshipSlots)) {
        importedRelationships = data.associatedRelationshipSlots;
      }
    }
    // 格式分支 2: TavernAI / SillyTavern Character Card V2
    else if (data.spec === 'chara_card_v2' || (data.data && data.data.name)) {
      detectedFormat = 'tavern_v2';
      formatLabel = '🎭 酒馆 / SillyTavern 兼容角色卡 (v2.0)';

      // 优先查看是否有打包的 ultra_hero 扩展
      if (data.data?.extensions?.ultra_hero) {
        heroCandidate = { ...data.data.extensions.ultra_hero };
        if (Array.isArray(data.data.extensions.custom_factions)) {
          importedFactions = data.data.extensions.custom_factions;
        }
        if (Array.isArray(data.data.extensions.associated_relationships)) {
          importedRelationships = data.data.extensions.associated_relationships;
        }
      } else {
        // 从标准 TavernAI 字段合成角色对象
        const tData = data.data || {};
        heroCandidate = {
          name: tData.name || '导入酒馆角色',
          title: '异界特约角色',
          height: '168cm',
          weight: '52kg',
          homePlanet: '未知星区',
          description: tData.description || '由酒馆角色卡导入的角色。',
          race: '异界生命体',
          raceTraits: Array.isArray(tData.tags) ? tData.tags : [],
          appearance: {
            customVisualPrompt: tData.description || '',
          },
          personalityCustomName: '自定义人设',
          personalityCustomPrompt:
            tData.system_prompt || tData.personality || '',
          personalityTone: '从容自如',
          personalityCustomTags: Array.isArray(tData.tags) ? tData.tags : [],
          weakness: '魔能核心受创与敏感神经刺激。',
          weakPart: 'timer',
          voiceLines: {
            greeting: [
              tData.first_mes,
              ...(tData.alternate_greetings || []),
            ].filter(Boolean),
            hitSmall: ['唔……！', '这点冲击还在承受范围内……'],
            hitHeavy: ['呃啊啊——！', '怎么可能……这种破坏力……'],
            hitWeakPoint: ['呀啊——！中枢……中枢被击中了！'],
            hitSensitivePoint: ['别……别碰那里……！身体在发烫……'],
            timerLow: ['能量……正在迅速见底……'],
            touchReaction: ['放手……！不要用那种方式触碰我……'],
            hypnosisReaction: ['思维……开始变得迟钝……不……'],
            envDamageReaction: ['高能辐射……正在侵蚀装甲肌理……'],
            defiant: [
              '正义的信念……绝不会在此折断！',
              '我是不会向你屈服的！',
            ],
            wavering: [
              '难道……我真的无法战胜你吗……',
              '身体已经……快要动弹不得了……',
            ],
            broken: ['已经……无法再支撑下去了……悉听尊便吧……'],
            beggingResistant: ['住手……求你……不要再破坏核心了……'],
            beggingDesperate: ['好痛苦……我认输了……饶了我吧……'],
            beggingSubmissive: ['请支配我……无论什么要求……我都遵从……'],
            corpseReaction: ['（心跳微弱，意识陷入深度停滞与抽搐……）'],
            healingReaction: ['温暖的光芒……体能正在缓缓复苏……'],
          },
        };
      }
    }
    // 格式分支 3: TavernAI V1
    else if (
      data.name &&
      (data.first_mes || data.personality || data.scenario || data.mes_example)
    ) {
      detectedFormat = 'tavern_v1';
      formatLabel = '📜 经典酒馆角色卡 (TavernAI v1.0)';
      heroCandidate = {
        name: data.name,
        title: '特邀干员',
        height: '168cm',
        weight: '52kg',
        homePlanet: '未知星域',
        description: data.description || '经典酒馆角色。',
        personalityCustomPrompt: data.personality || '',
        voiceLines: {
          greeting: [data.first_mes].filter(Boolean),
          defiant: ['绝不服输！'],
          hitHeavy: ['呃啊——！'],
          wavering: ['怎会如此……'],
          broken: ['认输了……'],
        },
      };
    }
    // 格式分支 4: 直接导出的 Ultrawoman 原生对象
    else if (
      data.name &&
      (data.bodyParts ||
        data.defaultStats ||
        data.voiceLines ||
        data.appearance)
    ) {
      detectedFormat = 'raw_hero';
      formatLabel = '📦 原生英雄干员档案 (Ultrawoman Object)';
      heroCandidate = { ...data };
    } else if (data.hero && data.hero.name) {
      detectedFormat = 'raw_hero';
      formatLabel = '📦 英雄干员对象 (Wrapper)';
      heroCandidate = { ...data.hero };
    }

    if (!heroCandidate || !heroCandidate.name) {
      return {
        success: false,
        error:
          '未识别到有效的角色核心数据，请确认是否为 Ultra 角色卡、名册卡组或 TavernAI 角色卡 JSON！',
      };
    }

    const finalHero = normalizeHeroObject(heroCandidate, {
      forceNewId: options?.forceNewId,
    });

    // 计算统计数据供 UI 预览
    const voiceCount = Object.values(finalHero.voiceLines || {}).reduce(
      (acc, lines) => acc + (Array.isArray(lines) ? lines.length : 0),
      0
    );

    return {
      success: true,
      hero: finalHero,
      detectedFormat,
      formatLabel,
      importedFactions,
      customFactions: importedFactions,
      importedRelationships,
      associatedRelationshipSlots: importedRelationships,
      warnings,
      isDeckPackage,
      deckHeroes: isDeckPackage ? deckHeroes : undefined,
      deckName: isDeckPackage ? deckName : undefined,
      deckMetadata: isDeckPackage
        ? {
            name: deckName,
            description: (data && data.description) || '',
            author: (data && data.author) || '',
            totalCount: deckHeroes.length,
          }
        : undefined,
      summary: {
        name: finalHero.name,
        title: finalHero.title,
        race: finalHero.race,
        hasPortrait: Boolean(finalHero.customPortrait || finalHero.avatarSvg),
        bodyPartsCount: Object.keys(finalHero.bodyParts || {}).length,
        voiceLinesCount: voiceCount,
        triggersCount: finalHero.customVoiceTriggers?.length || 0,
        envWeaknessesCount: finalHero.envWeaknesses?.length || 0,
        relationshipsCount: finalHero.heroRelationships?.length || 0,
        attachmentsCount: finalHero.characterAttachments?.length || 0,
        factionsCount:
          (finalHero.factionMemberships?.length || 0) +
          (finalHero.factionId ? 1 : 0),
        associatedBondsCount: importedRelationships.length,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'JSON 解析失败，请检查文件内容是否合法',
    };
  }
}

/**
 * 导出与解析世界观卡与破限卡工具函数
 */
export function exportWorldViewCard(
  name: string,
  content: string,
  summary?: string
): WorldViewCard {
  return {
    cardType: 'ultra_worldview_card',
    version: '1.0',
    id: `worldview_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || '自定义宇宙世界观',
    summary:
      summary || (content.length > 60 ? content.slice(0, 60) + '...' : content),
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };
}

export function downloadWorldViewCardFile(
  name: string,
  content: string,
  summary?: string
) {
  const card = exportWorldViewCard(name, content, summary);
  const jsonStr = JSON.stringify(card, null, 2);
  const cleanName = (name || '世界观设定').replace(
    /[^a-zA-Z0-9\u4e00-\u9fa5]/g,
    '_'
  );
  const fileName = `WorldViewCard_${cleanName}.json`;

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseWorldViewCard(
  jsonStr: string
): { success: boolean; card?: WorldViewCard; error?: string } {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      return { success: false, error: '无效的数据格式，非合法 JSON 对象' };
    }

    if (
      data.cardType === 'ultra_worldview_card' &&
      (data.content || data.prompt)
    ) {
      const card: WorldViewCard = {
        cardType: 'ultra_worldview_card',
        version: '1.0',
        id: data.id || `worldview_${Date.now()}`,
        name: data.name || '导入的世界观设定',
        summary: data.summary || '',
        content: data.content || data.prompt || '',
        tags: data.tags || [],
        createdAt: data.createdAt || new Date().toISOString(),
        author: data.author,
      };
      return { success: true, card };
    }

    if (
      typeof data.customWorldView === 'string' &&
      data.customWorldView.trim()
    ) {
      return {
        success: true,
        card: exportWorldViewCard('导入的世界观', data.customWorldView),
      };
    }

    if (typeof data.content === 'string' && data.content.trim()) {
      return {
        success: true,
        card: exportWorldViewCard(
          data.name || '导入的世界观',
          data.content,
          data.summary
        ),
      };
    }

    return {
      success: false,
      error: '未识别到世界观设定文本 (缺少 content 或 prompt 字段)',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'JSON 解析失败，请检查文件内容',
    };
  }
}

/**
 * 导出全部自定义世界观保存槽位库备份
 */
export function exportWorldViewSlotsBackup(slots: WorldViewSlot[]) {
  return {
    app: 'Ultrawoman Tokusatsu AI Simulator',
    type: 'custom_worldview_slots_backup',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    count: slots.length,
    slots,
  };
}

export function downloadWorldViewSlotsFile(slots: WorldViewSlot[]) {
  const data = exportWorldViewSlotsBackup(slots);
  const jsonStr = JSON.stringify(data, null, 2);
  const fileName = `WorldViewSlots_Backup_${new Date().toISOString().slice(0, 10)}.json`;

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 解析导入的世界观槽位数据（支持单个世界观卡、槽位备份合集、或槽位 JSON 数组）
 */
export function parseWorldViewSlotsData(jsonStr: string): {
  success: boolean;
  slots?: WorldViewSlot[];
  error?: string;
} {
  try {
    const data = JSON.parse(jsonStr);
    if (!data) {
      return { success: false, error: '空数据' };
    }

    // Case 1: Array of slots
    if (Array.isArray(data)) {
      const validSlots: WorldViewSlot[] = [];
      data.forEach((item, idx) => {
        const prompt = item.prompt || item.content || item.worldView || item.customWorldView;
        if (typeof prompt === 'string' && prompt.trim()) {
          validSlots.push({
            id: item.id || `wv_custom_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            name: item.name || `导入的世界观槽位 ${idx + 1}`,
            summary: item.summary || item.description || '',
            description: item.description || '',
            prompt: prompt.trim(),
            tags: Array.isArray(item.tags) ? item.tags : ['导入槽位'],
            isCustom: true,
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString(),
          });
        }
      });
      if (validSlots.length > 0) {
        return { success: true, slots: validSlots };
      }
      return { success: false, error: 'JSON 数组中未发现有效的世界观设定对象' };
    }

    // Case 2: Backup object with `slots` or `worldViewSlots`
    const list = Array.isArray(data.slots) ? data.slots : (Array.isArray(data.worldViewSlots) ? data.worldViewSlots : null);
    if (list) {
      const validSlots: WorldViewSlot[] = [];
      list.forEach((item: any, idx: number) => {
        const prompt = item.prompt || item.content || item.worldView || item.customWorldView;
        if (typeof prompt === 'string' && prompt.trim()) {
          validSlots.push({
            id: item.id || `wv_custom_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            name: item.name || `导入的世界观槽位 ${idx + 1}`,
            summary: item.summary || item.description || '',
            description: item.description || '',
            prompt: prompt.trim(),
            tags: Array.isArray(item.tags) ? item.tags : ['导入槽位'],
            isCustom: true,
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString(),
          });
        }
      });
      if (validSlots.length > 0) {
        return { success: true, slots: validSlots };
      }
    }

    // Case 3: Single WorldViewCard or single object
    const singleCard = parseWorldViewCard(jsonStr);
    if (singleCard.success && singleCard.card) {
      const card = singleCard.card;
      const slot: WorldViewSlot = {
        id: card.id || `wv_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: card.name || '导入的世界观卡',
        summary: card.summary || '',
        description: '',
        prompt: card.content,
        tags: card.tags || ['世界观卡'],
        isCustom: true,
        createdAt: card.createdAt || new Date().toISOString(),
      };
      return { success: true, slots: [slot] };
    }

    return { success: false, error: singleCard.error || '未能解析世界观槽位数据' };
  } catch (err: any) {
    return { success: false, error: err.message || 'JSON 解析失败' };
  }
}

export function exportJailbreakCard(
  name: string,
  prompt: string,
  description?: string,
  attachments?: AiAttachment[]
): JailbreakCard {
  return {
    cardType: 'ultra_jailbreak_card',
    version: '1.0',
    id: `jailbreak_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || '自定义破限方案',
    prompt: prompt.trim(),
    description: description || '自定义 AI 反拒答与角色扮演破限协议',
    attachments: attachments ? JSON.parse(JSON.stringify(attachments)) : [],
    createdAt: new Date().toISOString(),
  };
}

export function downloadJailbreakCardFile(
  name: string,
  prompt: string,
  description?: string,
  attachments?: AiAttachment[]
) {
  const card = exportJailbreakCard(name, prompt, description, attachments);
  const jsonStr = JSON.stringify(card, null, 2);
  const cleanName = (name || '破限方案').replace(
    /[^a-zA-Z0-9\u4e00-\u9fa5]/g,
    '_'
  );
  const fileName = `JailbreakCard_${cleanName}.json`;

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseJailbreakCard(
  jsonStr: string
): { success: boolean; card?: JailbreakCard; error?: string } {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      return { success: false, error: '无效的数据格式，非合法 JSON 对象' };
    }

    if (
      data.cardType === 'ultra_jailbreak_card' &&
      (data.prompt || data.content)
    ) {
      const card: JailbreakCard = {
        cardType: 'ultra_jailbreak_card',
        version: '1.0',
        id: data.id || `jailbreak_${Date.now()}`,
        name: data.name || '导入的破限方案',
        prompt: data.prompt || data.content || '',
        description: data.description || '',
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
        tags: data.tags || [],
        createdAt: data.createdAt || new Date().toISOString(),
        author: data.author,
      };
      return { success: true, card };
    }

    if (
      typeof data.customJailbreakPrompt === 'string' &&
      data.customJailbreakPrompt.trim()
    ) {
      return {
        success: true,
        card: exportJailbreakCard(
          data.name || '导入的破限方案',
          data.customJailbreakPrompt,
          data.description,
          data.attachments
        ),
      };
    }

    if (typeof data.prompt === 'string' && data.prompt.trim()) {
      return {
        success: true,
        card: exportJailbreakCard(
          data.name || '导入的破限方案',
          data.prompt,
          data.description,
          data.attachments
        ),
      };
    }

    return {
      success: false,
      error:
        '未识别到有效的破限词文本 (缺少 prompt 或 customJailbreakPrompt 字段)',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'JSON 解析失败，请检查文件内容',
    };
  }
}
