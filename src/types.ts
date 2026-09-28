export type EnvironmentTheme = 'glass' | 'metal' | 'acid' | 'lava' | 'cryo' | 'plasma' | 'void' | 'hypno' | 'pure' | 'any';

export interface RealTimeSyncState {
  isEnabled: boolean;
  firstCreatedTimestamp: number;   // Timestamp when the session/campaign was first started
  lastVisitedTimestamp?: number;   // Last active timestamp in this session
  initialRealDateStr?: string;     // e.g. "2026-09-02"
}

export interface RealTimeContextInfo {
  isEnabled: boolean;
  currentTimestamp: number;
  currentDateStr: string;          // e.g. "2026年9月2日 星期三"
  currentTimeStr: string;          // e.g. "14:35:10"
  timePeriod: string;              // e.g. "午后时光"
  timePeriodDetail: string;        // e.g. "午后 (13:30 - 17:30)"
  timePeriodTone: string;          // Guidance tone for this time period
  realDayCount: number;            // Day 1, Day 2, etc. based on 24-hour periods from creation
  formattedDuration: string;       // e.g. "已相伴 2 天 4 小时 15 分钟"
  offlineDurationMinutes: number;  // Minutes since last visited
  offlineDurationStr: string;      // e.g. "距离上次对话已过去 3 小时"
  greetingPrompt: string;          // Formatted system prompt injection
}

export interface EnvironmentWeakness {
  id: string;
  name: string;                         // 环境弱点名称，如 "强酸试管腐蚀联动"
  envTheme: EnvironmentTheme;            // 关联的环境要素 ('acid'|'metal'|'lava'|'cryo'|'plasma'|'void'|'glass'|'any')
  targetPartId?: BodyPartId | 'any';    // 关联的攻击受击部位 ('timer', 'chest', 'torso', etc.)
  weaponCategory?: 'attack' | 'touch' | 'hypnosis' | 'restraint' | 'drain' | 'any'; // 关联攻击大类
  weaponType?: WeaponType | 'any';        // 关联具体武器属性
  damageMultiplier: number;               // 环境弱点伤害/效应加成倍率 (如 1.5x)
  lines: string[];                        // 击中该环境弱点时角色说出的特别台词/专属话语
  enabled: boolean;                       // 是否开启该环境弱点联动
}

export type BodyPartId = string;

export interface BodyPartConfig {
  id: BodyPartId;
  name: string;
  maxHealth: number;
  currentHealth: number;
  exposure: number; // 0-100% 破损度
  weaknessMultiplier: number;
  description: string;
}

export interface Stats {
  hp: number;        // 生命值
  energy: number;    // 魔能值
  morale: number;    // 精神值 / 意志力
  obedience: number; // 服从度 / 归顺进度
  shame: number;     // 羞耻度 / 心理破绽
  lust: number;      // 色情值 / 欲望诱发度
  maxHp?: number;        // 生命上限 (可自定义，默认 100)
  maxEnergy?: number;    // 魔能上限 (可自定义，默认 100)
  maxMorale?: number;    // 精神上限 (可自定义，默认 100)
  maxObedience?: number; // 服从上限 (可自定义，默认 100)
  maxShame?: number;     // 羞耻上限 (可自定义，默认 100)
  maxLust?: number;      // 色情上限 (可自定义，默认 100)
}

export type PersonalityPreset =
  | 'tsundere'
  | 'cold_queen'
  | 'resilient'
  | 'fragile'
  | 'submissive'
  | 'arrogant'
  | 'yandere'
  | 'kuudere'
  | 'seductress'
  | 'heroic_leader'
  | 'custom'
  | 'custom_2'
  | 'custom_3';

export interface CustomPersonalitySlot {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  tags?: string[];
  tone?: string;
  prompt?: string;
  createdAt?: number;
}

export type TriggerConditionType = 'bodyPart' | 'damageThreshold' | 'statThreshold';

export interface CustomVoiceTrigger {
  id: string;
  name: string;                  // 触发规则名称 (如 "魔能值击中专有回应", "大额撕裂伤害 (>20 HP)")
  conditionType: TriggerConditionType; // 'bodyPart' | 'damageThreshold' | 'statThreshold'
  targetPartId?: BodyPartId;     // 特定攻击部位 ID
  minDamage?: number;            // 伤害阈值 (>= minDamage)
  statType?: 'hp' | 'energy' | 'morale' | 'shame' | 'obedience' | 'lust'; // 关联状态属性
  statThreshold?: number;        // 属性阈值
  statComparison?: 'lessThan' | 'greaterThan'; // 比较逻辑
  lines: string[];               // 语音/台词触发关键词文本数组
  enabled: boolean;              // 是否开启
}

export interface UltrawomanVoiceLines {
  hitSmall: string[];
  hitHeavy: string[];
  hitWeakPoint?: string[];
  hitSensitivePoint?: string[];
  timerLow: string[];
  touchReaction?: string[];
  hypnosisReaction?: string[];
  envDamageReaction?: string[];
  defiant: string[];
  wavering: string[];
  broken: string[];
  beggingResistant?: string[];  // 精神力较低但顺从度低时的绝望不甘求饶
  beggingDesperate?: string[];  // 精神力极低时的崩溃卑微求饶
  beggingSubmissive?: string[]; // 高顺从度+低精神力下的媚奴式求饶
  corpseReaction?: string[];    // 死亡休克(HP=0)无意识抽搐/鞭尸台词
  healingReaction?: string[];   // 接受治疗光线/复苏时的回应
  greeting?: string[];
}

export interface CharacterRelationship {
  targetHeroId: string;      // 目标角色 ID (如 "judy", "custom_123")
  targetHeroName?: string;    // 目标角色名字
  relationType: string;      // 关系名称 (如 "生死战友", "宿敌对手", "崇拜的前辈", "保护者与被保护者")
  description?: string;      // 关系背景渊源说明
  attitudeTone?: string;     // 互动态度与口吻 (如 "关切护短", "傲娇嘴硬", "恭敬遵从")
}

export interface CharacterAppearance {
  hairStyle?: string;        // 发型与发色 (如 "耀金及腰高马尾 / 丝滑微卷长发")
  eyeColor?: string;         // 瞳色与眼神特征 (如 "澄澈圣光金瞳 / 坚毅凛然带泪光")
  skinTone?: string;         // 肤色与肤质 (如 "白皙娇嫩凝脂 / 透出淡淡粉晕")
  bodyFeatures?: string;     // 体态特征与身段 (如 "174cm 挺拔柔韧，曲线曼妙修长，胸前饱满挺拔，纤细蜂腰")
  outfit?: string;           // 战甲与日常装束 (如 "纯白无瑕圣金紧身重铠，内衬半透明紧身软甲，胸口嵌六角棱晶")
  accessories?: string;      // 饰品与头冠 (如 "圣辉羽翼金冠、白金高筒战靴、防脱力灵能手套")
  customVisualPrompt?: string; // 综合视觉外貌Prompt (供AI生动刻画细节)
}

export type FactionRelationType = 'ally' | 'hostile' | 'neutral' | 'subordinate' | 'rival' | 'infiltrated' | 'custom';

export interface FactionRelation {
  targetFactionId: string;        // 目标阵营 ID
  relationType: FactionRelationType | string; // 'ally' | 'hostile' | 'neutral' | 'subordinate' | 'rival' | 'infiltrated' | 'custom'
  relationName: string;           // 关系名称 (如: "生死誓约同盟", "宿命血仇死斗", "表面和平·暗中渗透", "臣属附属")
  description?: string;           // 阵营间渊源与历史纠葛说明
  attitudePrompt?: string;        // AI 提示词：两阵营成员碰面时的互动原则与态度
}

/**
 * 阵营下属可自定义的从属组织 / 机构分支 / 特遣部门
 */
export interface SubFaction {
  id: string;                     // 从属组织唯一标识 (如 'sub_light_inquisition')
  name: string;                   // 从属组织名称 (如 "圣堂裁决卫队", "异变生化研究所")
  code?: string;                  // 代号/编号 (如 "ST-01", "BIO-LAB")
  leader?: string;                // 负责人/指挥官 (如 "大审判官", "首席研究员")
  type?: 'military' | 'intelligence' | 'research' | 'administrative' | 'special_ops' | 'custom' | string; // 从属组织性质
  description?: string;           // 职责与背景
  isCustom?: boolean;             // 是否为用户自定义
}

export interface HeroFactionMembership {
  factionId: string;                  // 阵营唯一标识 (如 'faction_light_order')
  subFactionId?: string;              // 所属从属组织/分支 ID (如 'sub_light_inquisition')
  subFactionName?: string;            // 所属从属组织/分支名称 (如 "圣堂裁决卫队")
  role?: string;                      // 在该阵营中的职务/身份 (如 "圣堂禁卫军总长", "暗中潜伏卧底", "前先锋统领", "名誉顾问")
  priority: number;                   // 优先级 (1 为最高/主属阵营，2、3、4依次为兼任/潜伏/名誉/同盟阵营)
  title?: string;                     // 身份性质/归属说明 (如 "主属阵营", "双重身份", "潜伏卧底", "名誉长老", "流亡代表", "战略同盟", "他国从属干员", "外籍特派")
  isPrimary?: boolean;                // 是否为主属阵营 (通常 priority === 1)
  customNotes?: string;               // 阵营立场备注或特殊使命
  membershipType?: 'core' | 'sub_unit_only' | 'foreign_subordinate' | 'liaison' | 'mercenary' | 'vassal_delegate' | 'guest' | 'undercover' | 'custom' | string; // 成员归属属性 (本国核心 / 仅从属组织编制 / 他国从属 / 跨国联络 / 雇佣外援 / 附属派遣 / 客座流亡 / 异邦潜伏)
  originCountry?: string;             // 角色母国/原籍属地 (如 "地球", "泛银河机巧联邦", "深渊暗影界", "地球防卫本部")
  affiliationNature?: string;         // 从属性质说明 (如 "跨国派驻", "外聘专家", "外邦雇佣", "附属国派遣", "主仆契约", "独立编制")
  subFactionOnly?: boolean;           // 关键标识：是否仅加入/归属于该从属组织（不直接作为大阵营直属成员）
}

export interface Faction {
  id: string;                     // 阵营唯一标识 (如 'faction_light_order')
  name: string;                   // 阵营全称 (如 "自定义阵营")
  shortName?: string;             // 阵营简称 (如 "星光同盟")
  system?: string;                // 制度 (如 "神圣议会制 / 光之联邦制", "至高霸权独裁制", "量子智网科技政体")
  stability?: string;             // 稳定度 (如 "92% (高度稳定)", "68% (高压控制)")
  population?: string;            // 人口 (如 "380亿 光子生命体", "1200亿 异形暗影生灵")
  nationalIdea?: string;          // 国家理念 (如 "守护宇宙秩序与正义之光，誓死庇护全宇宙弱小文明与生命繁衍")
  description: string;            // 阵营宗旨与背景描述
  isCustom?: boolean;             // 是否为用户自定义阵营
  parentFactionId?: string;       // 上级主阵营 ID (如果本组织是隶属于另一大阵营的分支派系)
  subFactions?: SubFaction[];     // 下属从属组织/部门/分支机构列表 (可自定义增删改)
  relations?: FactionRelation[];  // 与其它阵营的外交/敌对/结盟关系列表
  emblemIcon?: string;            // 阵营图标/徽章标识
}

export interface Ultrawoman {
  id: string;
  name: string;
  title: string;
  height: string;
  weight: string;
  homePlanet: string;
  nativeCountry?: string;             // 母国/原籍国家/原生属地 (如 "地球·圣殿领", "泛银河联邦第3星区", "深渊暗影王庭", "地球防卫军")
  description: string;
  race?: string;                      // 种族血统 (如 "巨人族", "泛银河生化机娘", "绯红炎灵王族", "艾露恩精灵圣女", "暗影魅魔族")
  raceTraits?: string[];              // 种族生理特质 (如 ["高纯光子体质", "核心依赖", "受创体温剧升", "对触手极度敏感"])
  appearance?: CharacterAppearance;   // 外貌详细设定 (发型发色、瞳色、肤色、身段体态、装束战铠、饰品等)
  factionId?: string;                 // 所属主阵营 ID (保持向下兼容)
  factionRole?: string;               // 在主阵营中的身份/职位 (保持向下兼容)
  subFactionId?: string;              // 所属主阵营下的从属组织 ID (保持向下兼容)
  subFactionName?: string;            // 所属主阵营下的从属组织名称 (保持向下兼容)
  subFactionOnly?: boolean;           // 是否仅归属于从属组织/下属编制 (非阵营直属核心)
  factionMemberships?: HeroFactionMembership[]; // 多阵营归属与优先级列表 (按 priority 升序排序，第1位为主属阵营)
  personality?: PersonalityPreset | string;
  personalityCustomName?: string;     // 自定义性格名称/称号，如: "傲娇神圣侍卫"
  personalityCustomPrompt?: string;   // 完全自定义性格AI指导Prompt (与API聊天和剧情生成挂钩)
  customPrompt?: string;              // 兼容性自定义 Prompt
  personalityTone?: string;           // 专属语调与口吻习惯 (如: "高傲自尊，带有断续喘息，自称‘本宫’")
  personalityCustomTags?: string[];
  weakness: string;
  weakPart: BodyPartId;
  sensitivePart?: BodyPartId; // 可自定义的发情/敏感部位
  voicePitch: number; // Base frequency multiplier for Web Audio synth
  colorTheme: {
    primary: string;      // main armor color hex
    secondary: string;    // accent lines hex
    glow: string;         // timer glow color hex
    bgGradient: string;   // UI backdrop
  };
  defaultStats: Stats;
  energyRegenRate?: number; // 能量自然缓慢恢复速率 (%/秒)
  bodyParts: Record<BodyPartId, BodyPartConfig>;
  voiceLines: UltrawomanVoiceLines;
  customVoiceTriggers?: CustomVoiceTrigger[];
  envWeaknesses?: EnvironmentWeakness[];
  heroRelationships?: CharacterRelationship[]; // 角色与其他角色的自定义人际关系列表
  avatarSvg?: string;
  customPortrait?: string; // 2D 角色立绘图片 DataURL/URL
  characterAttachments?: AiAttachment[]; // 角色专属挂载参考文档、背景设定集与多模态参考图片
  webSearchEnabled?: boolean; // 是否对此角色启用联网搜索
  searchEngine?: SearchEngineId; // 专属搜索引擎 ('google' | 'bing' | 'duckduckgo' | 'baidu' | 'sogou' | 'wikipedia')
  searchKeywords?: string; // 角色联网搜索专属前缀/关注领域 (如 "百科")
  searchMaxResults?: number; // 单次检索条数限制 (1-6条)
}

export type SearchEngineId = 'google' | 'bing' | 'duckduckgo' | 'baidu' | 'sogou' | 'wikipedia';

export interface WebSearchSource {
  title: string;
  url: string;
  snippet: string;
  engine?: SearchEngineId | string;
}

export type WebSearchResult = WebSearchSource;

export interface WebSearchConfig {
  masterEnabled?: boolean;                     // 全局总开关
  defaultEngine?: SearchEngineId;              // 默认搜索引擎
  enabledHeroIds?: string[];                   // 启用了联网搜索的角色 ID 列表
  searchDepth?: 'standard' | 'deep';           // 搜索深度 (standard: 3条, deep: 6条)
  showSourcesInChat?: boolean;                 // 是否在对白气泡下方展示搜索来源和参考链接卡片
  autoSearchOnMention?: boolean;               // 自动检测并触发联网检索
}

export interface CustomWeaponType {
  id: string;        // e.g. "beam", "quantum_nano", "gravity_pulse"
  name: string;      // e.g. "高能射线", "量子纳米"
  icon?: string;     // e.g. "⚡", "⚛️"
  description?: string;
}

export const DEFAULT_WEAPON_TYPES: CustomWeaponType[] = [
  { id: 'beam', name: '高能射线 (Beam)', icon: '⚡' },
  { id: 'shock', name: '高压电击 (Shock)', icon: '🌩️' },
  { id: 'drain', name: '光能抽离 (Drain)', icon: '🔋' },
  { id: 'psy', name: '脑波侵蚀 (Psy)', icon: '🧠' },
  { id: 'corrode', name: '高酸熔蚀 (Corrode)', icon: '🧪' },
  { id: 'restraint', name: '机械约束 (Restraint)', icon: '⛓️' },
  { id: 'touch', name: '肢体触碰 (Touch)', icon: '✋' },
  { id: 'hypnosis', name: '真言催眠 (Hypnosis)', icon: '🌀' },
  { id: 'sensual', name: '发情诱导 (Sensual)', icon: '💓' },
  { id: 'frost', name: '极端冰封 (Frost)', icon: '❄️' },
  { id: 'plasma', name: '等离子体 (Plasma)', icon: '🔥' },
  { id: 'erogenous', name: '敏感带刺激 (Erogenous)', icon: '🍓' },
  { id: 'mind_erase', name: '记忆洗脑 (Mind Erase)', icon: '💫' },
  { id: 'lava', name: '地狱熔岩 (Lava)', icon: '🌋' },
  { id: 'sound', name: '次声波 (Sound)', icon: '🔊' },
  { id: 'gravity', name: '重力压迫 (Gravity)', icon: '🪐' },
  { id: 'electric', name: '高压电流 (Electric)', icon: '⚡' },
  { id: 'heal', name: '医疗修复 (Heal)', icon: '❇️' },
  { id: 'nanite', name: '纳米群 (Nanite)', icon: '🧬' },
  { id: 'bliss', name: '快感沉沦 (Bliss)', icon: '✨' },
];

export type WeaponType = 'beam' | 'shock' | 'drain' | 'psy' | 'corrode' | 'restraint' | 'touch' | 'hypnosis' | 'sensual' | 'frost' | 'plasma' | 'erogenous' | 'mind_erase' | 'lava' | 'sound' | 'gravity' | 'electric' | 'heal' | 'nanite' | 'bliss' | string;

export interface CustomSkillCategory {
  id: string;      // e.g. "mind_control", "time_lock", etc.
  name: string;    // e.g. "心智重塑", "维度束缚"
  icon: string;    // e.g. "🧠", "🔒", "🔮", "🧬"
  description?: string;
  isCustom?: boolean;
  color?: string;
  createdAt?: string | number;
}

export const DEFAULT_SKILL_CATEGORIES: CustomSkillCategory[] = [
  { id: 'attack', name: '高能打击', icon: '⚔️', description: '战术能量炮与高能毁伤武器' },
  { id: 'touch', name: '触碰爱抚', icon: '♥', description: '肢体爱抚与敏感神经触压手段' },
  { id: 'hypnosis', name: '催眠暗示', icon: '🌀', description: '脑波侵蚀与真言服从暗示' },
  { id: 'restraint', name: '约束压制', icon: '⛓️', description: '机械枷锁与高压限制装具' },
  { id: 'drain', name: '能量抽离', icon: '⚡', description: '魔能值与核心能量剥离' },
  { id: 'heal', name: '医疗复苏', icon: '❇️', description: '纳米粒子与生命体能修复' },
];

export interface AlienWeapon {
  id: string;
  name: string;
  type: WeaponType;
  category?: 'attack' | 'touch' | 'hypnosis' | 'restraint' | 'drain' | 'heal' | string;
  iconName: string;
  damage: number;
  hpHeal?: number;       // 治疗生命值
  energyDrain: number;
  moraleDamage: number;
  shameIncrease: number;
  obedienceGain: number;
  lustChange?: number;   // 色情度基准变化
  partDamageChange?: number;   // 部位破损变动 (负数修复，正数损坏，0默认)
  partExposureChange?: number; // 生理变化/异化转变 (负数还原防护装甲肌理，正数加剧生理异化/暴衣)
  shieldPenetration?: number;  // 0-100% 护盾穿透
  preferredTarget?: BodyPartId;
  description: string;
  sfxType: 'laser' | 'zap' | 'siphon' | 'wave' | 'acid' | 'chains' | 'touch' | 'chime' | 'heal';
  isCustom?: boolean;          // 是否为用户自制手段
  isFavorite?: boolean;        // 是否已收藏
  createdAt?: number;          // 创建时间戳
  tags?: string[];             // 分类标签
}

export interface AutoReplySuggestion {
  id: string;
  category: 'dominant' | 'psychological' | 'sensory' | string;
  tag: string;
  text: string;
  tone: string;
}

export interface LogEntry {
  id: string;
  time: string;
  heroId?: string;
  heroName?: string;
  speakerName?: string;
  weaponName: string;
  targetPartName: string;
  damageDealt: number;
  energyDrained: number;
  moraleLost: number;
  shameGained: number;
  obedienceGained: number;
  lustChanged?: number;
  characterQuote?: string;
  reactionType?: 'defiant' | 'pained' | 'wavering' | 'broken' | 'begging' | 'corpse' | 'healing';
  isCorpseHit?: boolean;
  isRevival?: boolean;
  envWeaknessHit?: { name: string; multiplier: number };
  aiAnalysis?: string;
  specialEvent?: {
    name: string;
    type: 'resistance' | 'whisper' | 'surge' | 'faultline';
    tag: string;
    description: string;
  };
}

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  timerVolume: number;
  voiceVolume: number;
  isMuted: boolean;
}

export type AiProvider = 'gemini' | 'deepseek' | 'openai' | 'claude' | 'custom_openai' | string;

export interface CustomAiProviderItem {
  id: string;                               // 唯一标识 (如 'prov_deepseek', 'prov_siliconflow', 'prov_custom_1')
  name: string;                             // 显示名称 (如 "硅基流动 SiliconFlow", "OpenRouter 聚合")
  protocolType?: 'openai' | 'gemini' | 'claude'; // 接口协议类型，默认 'openai'
  baseUrl: string;                          // API 基地址 (如 "https://api.siliconflow.cn/v1")
  defaultModel: string;                     // 默认模型 (如 "deepseek-ai/DeepSeek-V3")
  apiKey?: string;                          // 该服务商专属的独立 API Key (可选，若不填则使用全局填写的 API Key)
  note?: string;                            // 备注说明与特点介绍
  modelsPreset?: string[];                  // 常用模型快捷选择标签列表 (如 ["deepseek-chat", "deepseek-reasoner"])
  customHeaders?: Record<string, string>;   // 自定义请求头 (如 OpenRouter 的 HTTP-Referer、X-Title)
  isBuiltIn?: boolean;                      // 是否为系统内置模板
  createdAt?: string;                       // 创建时间
}

export interface ChatMessage {
  id: string;
  sender: 'interrogator' | 'heroine' | 'system';
  heroId?: string;
  heroName?: string;
  speakerName?: string;
  text: string;
  time: string;
  reactionType?: 'defiant' | 'pained' | 'wavering' | 'broken' | 'begging' | 'corpse' | 'healing';
  psychologicalAnalysis?: string;
  thinkingProcess?: string; // AI 深度思考过程 (CoT / Reasoning Thoughts)
  personalityTagApplied?: string;
  weaknessTriggered?: string;
  attachments?: AiAttachment[]; // 伴随本次发言发送的多模态图片或设定文档
  webSearchUsed?: boolean; // 本次发言是否使用了联网检索
  searchEngine?: SearchEngineId | string; // 使用的搜索引擎标识
  searchQuery?: string; // 检索关键词
  searchSources?: WebSearchSource[]; // 抓取到的检索参考信息与来源列表
}

export interface CharacterCard {
  cardType: 'ultra_character_card';
  version: '1.0' | '2.0' | '3.0' | string;
  createdAt: string;
  hero: Ultrawoman;
  tags?: string[];
  notes?: string;
  author?: string;
  // TavernAI V2 / SillyTavern interoperability specification
  spec?: 'chara_card_v2';
  spec_version?: '2.0';
  data?: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
    character_book?: any;
    tags?: string[];
    creator?: string;
    character_version?: string;
    extensions?: Record<string, any>;
  };
  customFactionsIncluded?: Faction[];
  associatedRelationshipSlots?: RelationshipSlot[];
}

export interface CharacterDeckCard {
  cardType: 'ultra_character_deck';
  version: '3.0' | string;
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  author?: string;
  totalCount: number;
  tags?: string[];
  heroes: Ultrawoman[];
  customFactionsIncluded?: Faction[];
  associatedRelationshipSlots?: RelationshipSlot[];
}

export interface WorldViewCard {
  cardType: 'ultra_worldview_card';
  version: '1.0' | string;
  id: string;
  name: string;
  summary?: string;
  content: string;
  tags?: string[];
  createdAt: string;
  author?: string;
}

export interface AiAttachment {
  id: string;
  name: string;
  type: 'document' | 'image';
  content: string; // 文档纯文本/Markdown/JSON 或 图片 Base64 Data URL / URL
  mimeType?: string; // e.g. 'text/plain', 'text/markdown', 'image/png', 'image/jpeg', 'image/webp'
  sizeBytes?: number;
  description?: string; // 备注说明（如："世界观规则书"、"角色立绘参考"、"破限协议文档"）
  enabled: boolean; // 是否注入到 AI 提示词上下文中
  category?: 'general' | 'jailbreak' | 'worldview'; // 归属分类
  createdAt: string;
}

export interface JailbreakPreset {
  id: string;
  name: string;
  prompt: string;
  description?: string;
  attachments?: AiAttachment[]; // 破限专属挂载文档与图片
  isCustom?: boolean; // 是否为用户自定义创建与保存的破限方案
  createdAt?: string;
}

export interface JailbreakCard {
  cardType: 'ultra_jailbreak_card';
  version: '1.0' | string;
  id: string;
  name: string;
  prompt: string;
  description?: string;
  attachments?: AiAttachment[];
  createdAt: string;
  author?: string;
  tags?: string[];
}

export interface SystemPromptPreset {
  id: string;
  name: string;
  prompt: string;
  description?: string;
  isDefault?: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface WorldViewSlot {
  id: string;
  name: string;
  summary?: string;
  description?: string;
  prompt: string;               // 宏观世界观设定正文
  tags?: string[];              // 标签分类 (如: "光暗宿命", "赛博朋克", "异化", "原创")
  isCustom?: boolean;           // 是否为用户自定义创建的槽位
  createdAt?: string;
  updatedAt?: string;
}

export interface AiConfigProfile {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  provider: AiProvider;
  activeProviderId?: string;
  activeProviderName?: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  enableThinking?: boolean;
  thinkingBudget?: number;
  showThinkingInChat?: boolean;
  thinkingDisplayMode?: 'collapsed' | 'expanded' | 'hidden';
  thinkingEffort?: 'low' | 'medium' | 'high';
  enableJailbreak?: boolean;
  activeJailbreakPresetId?: string;
  customJailbreakPrompt?: string;
  activeSystemPresetId?: string;
  customSystemPrompt?: string;
  customSystemPresets?: SystemPromptPreset[];
  worldViewEnabled?: boolean;
  activeWorldViewSlotId?: string;
  customWorldView?: string;
  webSearch?: WebSearchConfig;
}

export interface AiConfig {
  enabled: boolean;
  provider: AiProvider;
  activeProviderId?: string;    // 当前激活的服务商 ID
  activeProviderName?: string;  // 当前激活的服务商名称
  apiKey: string;
  baseUrl: string;
  model: string;
  // 🧠 AI 思考模式与推理链配置 (Deep Thinking / CoT Mode)
  enableThinking?: boolean;                     // 是否开启 AI 思考/深度推理模式
  thinkingBudget?: number;                      // 思考 Token 预算 (0=自动, 1024, 2048, 4096, 8192, 16384)
  showThinkingInChat?: boolean;                 // 是否在对话历史中渲染展示思考过程折叠框
  thinkingDisplayMode?: 'collapsed' | 'expanded' | 'hidden'; // 思考折叠卡片默认展示模式
  thinkingEffort?: 'low' | 'medium' | 'high';   // 推理强度 (针对 OpenAI / Claude / DeepSeek)
  tokenSaveMode?: 'off' | 'standard' | 'extreme';   // 省 Token 模式 (默认 standard：压缩世界观/破限词/角色档案)
  enableJailbreak: boolean;
  customJailbreakPrompt: string;
  activeJailbreakPresetId?: string;             // 当前选中的破限方案 ID
  customJailbreakPresets?: JailbreakPreset[];   // 用户自定义保存与管理的破限方案库
  jailbreakAttachments?: AiAttachment[];        // 破限词专属文档与图片附件
  apiAttachments?: AiAttachment[];              // API 全局知识库/参考文档与多模态图片附件
  customSystemPrompt: string;
  activeSystemPresetId?: string;                // 当前选中的通用系统指令预设 ID
  customSystemPresets?: SystemPromptPreset[];   // 用户自定义通用系统与叙事引导指令预设库
  customWorldView?: string;     // 自定义世界观设定 (宏观宇宙背景、物理法则、星系格局与世界势力架构)
  worldViewEnabled?: boolean;   // 是否开启自定义世界观引导
  activeWorldViewSlotId?: string;               // 当前选中的世界观槽位 ID
  customWorldViewSlots?: WorldViewSlot[];       // 用户自定义世界观保存槽位库 (支持多槽位存取/重命名/覆盖/导入导出)
  temperature: number;
  customProviders?: CustomAiProviderItem[]; // 用户自定义与收藏的 AI 服务商列表
  apiProfiles?: AiConfigProfile[];              // 用户保存的多套 API 配置档案/预设槽位
  webSearch?: WebSearchConfig;                  // 🌐 联网搜索配置
}


export interface CustomSkill {
  id: string;
  name: string;
  type: WeaponType;
  category: 'attack' | 'touch' | 'hypnosis' | 'restraint' | 'drain' | 'heal' | string;
  damage: number;
  hpHeal?: number;             // 治疗生命值
  energyDrain: number;
  moraleDamage: number;
  shameIncrease: number;
  obedienceGain: number;
  lustChange: number;
  partDamageChange?: number;   // 部位破损变动% (负数修复，正数加重破损)
  partExposureChange?: number; // 生理变化/异化变动% (负数还原装甲防护，正数加剧生理异化/暴衣)
  shieldPenetration: number; // 0-100% 能量护盾穿透率
  preferredTarget?: BodyPartId | 'none';
  description: string;
  iconName?: string;
  sfxType?: 'laser' | 'zap' | 'siphon' | 'wave' | 'acid' | 'chains' | 'touch' | 'chime' | 'heal';
  isCustom?: boolean;
  isFavorite?: boolean;
  createdAt?: number | string;
  tags?: string[];
}

export interface StagePromptRule {
  id: string;
  name: string;
  minDay: number;
  maxDay?: number | null; // e.g. 3, or null for "minDay 天及以上"
  prompt: string;
}

export interface CustomMilestoneNode {
  id: string;
  name: string;                    // 节点名称 (如: "⚡ 能量核心过载异变", "👑 灵魂誓约觉醒节点", "🌪️ 异星极寒辐射风暴")
  targetDay: number;               // 核心爆发/关键日期 (如 第 5 天)
  startDay: number;                // 影响起始日期 (如 第 4 天)
  endDay: number;                  // 影响结束日期 (如 第 7 天)
  description: string;             // 剧情背景与事件经过
  dialogueGuidance: string;        // AI 对话与心理指引 Prompt (在此日期范围内生效)
  hpDeltaDaily?: number;           // 影响期内每日额外 HP 变动 (负数消耗，正数恢复)
  energyDeltaDaily?: number;       // 影响期内每日额外能量变动
  moraleDeltaDaily?: number;       // 影响期内每日额外意志变动
  obedienceDeltaDaily?: number;    // 影响期内每日额外服从/信任变动
  shameDeltaDaily?: number;        // 影响期内每日额外羞耻变动
  lustDeltaDaily?: number;         // 影响期内每日额外欲望变动
  damageMultiplier?: number;       // 影响期内作用效果/伤害倍率 (默认 1.0)
  isEnabled: boolean;              // 是否启用
}

export type ScenarioCategory = 'coop' | 'medical' | 'undercover' | 'arena' | 'hypnosis' | 'interrogation' | 'rescue' | 'custom';

// Relationship & Bond System Types (关系/绊系统)
export type RelationshipCategory = 'pure_love' | 'evil_enslavement' | 'rivalry' | 'hypnotic_dependency' | 'hero_exclusive' | 'faction_exclusive' | 'custom';

export interface RelationshipSlot {
  id: string;                      // 关系槽位唯一标识 (如 'rel_pure_love_1', 'rel_dark_slave', 'custom_rel_123')
  title: string;                   // 关系全称 (如: "自定义关系")
  category: RelationshipCategory;  // 关系类别 ('pure_love' | 'evil_enslavement' | 'rivalry' | 'hypnotic_dependency' | 'hero_exclusive' | 'faction_exclusive' | 'custom')
  description: string;             // 关系简述
  stylePrompt: string;             // AI 对话语气、角色表情、称呼与行动指导 Prompt
  customTags: string[];            // 标签 (如 ["纯爱", "灵魂伴侣", "撒娇依恋"] 或 ["雌伏", "主仆", "完全顺从"] 或 ["组织专属", "阵营效忠"])
  iconName?: string;
  targetHeroId?: string;           // 绑定的专属自定义角色 ID (如 'custom_hero_1' 或 'hero_1')
  targetHeroName?: string;         // 绑定的专属自定义角色名称 (如 '伊莉丝', '星辉圣女')
  exclusiveCategoryName?: string;  // 人物专属分类副标题或定制备注
  targetFactionId?: string;        // 绑定的专属组织/阵营 ID (如 'faction_light_order', 'faction_shadow_dominion', 'custom_faction_123')
  targetFactionName?: string;      // 绑定的专属组织/阵营全称 (如 '自定义阵营')
  targetSubFactionId?: string;     // 绑定的专属从属组织/分支机构 ID (如 'sub_light_inquisition')
  targetSubFactionName?: string;   // 绑定的专属从属组织/分支机构全称 (如 '圣堂裁决卫队')
  factionRoleRequired?: string;    // 要求的组织内职务/身份 (如 '圣堂禁卫军总长', '潜伏特工', '被俘指挥官')
  factionCategoryName?: string;    // 组织特定关系分类副标题/阵营羁绊标识 (如 '同盟圣约纽带', '敌对俘虏审讯契约')
  
  // 判定/解锁门槛条件
  conditions: {
    minObedience?: number;         // 服从/信任度% 下限
    maxObedience?: number;         // 服从/信任度% 上限
    minLust?: number;              // 欲望/色情% 下限
    maxLust?: number;              // 欲望/色情% 上限
    minMorale?: number;            // 意志防线% 下限
    maxMorale?: number;            // 意志防线% 上限
    minHpPct?: number;             // HP% 下限
    maxHpPct?: number;             // HP% 上限
    minDay?: number;               // 最少维持天数
    requiredScenarioCategory?: string; // 要求开局剧情模式 ('coop', 'medical', 'interrogation', 'any')
    requiredScenarioId?: string;       // 要求/关联的具体开局预设 ID (实现双向联动)
    requiredFactionId?: string;        // 限制/要求的所属组织/阵营 ID
    requiredSubFactionId?: string;     // 限制/要求的从属组织 ID
    requiredFactionRole?: string;      // 限制/要求的组织内职务
  };

  isCustom?: boolean;              // 是否为用户自定义增加的槽位
}

export interface RelationshipCardExportPackage {
  version: string;
  type: 'single_relationship_card' | 'relationship_cards_library';
  exportedAt: string;
  author?: string;
  count: number;
  slots: RelationshipSlot[];
}

export interface RelationshipHistoryLog {
  id: string;
  timestamp: string;
  dayCount: number;
  fromTitle: string;
  toTitle: string;
  triggerType: 'auto_eval' | 'manual_button' | 'manual_lock' | 'manual_trigger';
  reason: string;
}

export interface RelationshipState {
  activeSlotId: string;            // 当前生效的角色关系槽位 ID
  isLocked: boolean;               // 是否锁定当前关系（锁定后不随数值自动变更）
  lockedAtDay?: number;
  manualOverrideSlotId?: string;   // 手动锁定的关系槽位 ID
  historyLogs: RelationshipHistoryLog[];
  customSlots?: RelationshipSlot[]; // 用户自定义增加的关系槽位列表 (兼容旧版)
  slots?: RelationshipSlot[];       // 全量可自定义的关系预设库列表
}

export interface ScenarioInitialStatsPct {
  hpPct?: number;        // HP 生命值百分比 (0~100)
  energyPct?: number;    // 能量值百分比 (0~100)
  moralePct?: number;    // 意志防线百分比 (0~100)
  trustPct?: number;     // 信任值百分比 (0~100) (原服从度)
  shamePct?: number;     // 羞耻感百分比 (0~100)
  lustPct?: number;      // 欲望沉沦百分比 (0~100)
}

export interface ScenarioStartupConfig {
  activeHeroIds?: string[];
  primaryHeroId?: string;
  heroStatsMap?: Record<string, ScenarioInitialStatsPct>;
  isRealTimeSync?: boolean;
}

export interface ScenarioConfig {
  id: string;
  name: string;                   // 开局名称 (如 "自定义开局")
  icon: string;                   // 图标 (如 "🚀", "🏥", "⛓️", "🕵️", "⚔️", "🔮", "🌌")
  category: ScenarioCategory;
  description: string;            // 开局背景与关系设定简述
  interrogatorIdentity: string;   // 交互者/对方身份 (如 "联合调查组搭档", "银河光疗主治医师", "宇宙审讯官", "接头情报员")
  openingPrompt: string;          // 注入 AI 提示词中的开局剧情背景与角色关系导引
  defaultEnvTheme?: EnvironmentTheme; // 建议开局环境舱 ('pure', 'glass', 'hypno', 'metal', etc.)
  initialGreeting?: string;       // 建议初始开局台词或对话提示
  isCustom?: boolean;             // 是否为用户自定义剧情
  initialStatsPct?: ScenarioInitialStatsPct; // 开局场景挂钩绑定的初始属性百分比
  boundRelationshipSlotId?: string; // 绑定/关联的角色关系与绊结预设 ID (实现开局与关系预设双向联动)
  startupConfig?: ScenarioStartupConfig; // 开局主角多选与各自独立初始数值配置
}

export const DEFAULT_SCENARIO_PRESETS: ScenarioConfig[] = [];

/** Neutral runtime placeholder used when the user has not created/selected any scenario. */
export const NEUTRAL_SCENARIO: ScenarioConfig = {
  id: '__unset_scenario__',
  name: '自由互动（未设定开局）',
  icon: '💬',
  category: 'coop',
  description: '尚未选择开局剧情，双方按自然、平等的方式交流互动。',
  interrogatorIdentity: '对话对象',
  openingPrompt: '【未设定开局剧情】双方以自然、平等的方式进行交流，不附加任何敌对或支配预设。',
  defaultEnvTheme: 'pure',
};

export const DEFAULT_STAGE_RULES: StagePromptRule[] = [];

export const DEFAULT_MILESTONES: CustomMilestoneNode[] = [];

export interface DayConfig {
  scalingFactor: number;        // 天数伤害/效果递增放大幅 (0 ~ 0.20, e.g. 0.05 = 每天增加5%侵蚀)
  dailyMoraleDrain: number;     // 每日基础意志消耗 (e.g. -1.0)
  dailyObedienceGain: number;   // 每日基础服从增加 (e.g. +0.5)
  dailyShameGain: number;       // 每日基础羞耻增加 (e.g. +0.5)
  dailyLustGain: number;        // 每日基础淫乱/发情增加 (e.g. +0.0)
  stageRules?: StagePromptRule[]; // 动态天数心理阶段规则 (支持增删改与天数区间设置)
  milestones?: CustomMilestoneNode[]; // 自定义重大日期节点与影响范围列表
  earlyStagePrompt?: string;     // 兼容旧版: 初期(第1~3天) AI 人设与态度 Prompt
  midStagePrompt?: string;       // 兼容旧版: 中期(第4~7天) AI 人设与态度 Prompt
  lateStagePrompt?: string;      // 兼容旧版: 长期(第8天及以上) AI 人设与态度 Prompt
}

export function getStagePromptRules(config?: DayConfig): StagePromptRule[] {
  if (config?.stageRules && Array.isArray(config.stageRules) && config.stageRules.length > 0) {
    return config.stageRules;
  }
  const rules: StagePromptRule[] = [];
  if (config?.earlyStagePrompt) {
    rules.push({ id: 'legacy_1', name: '初期（第1~3天）', minDay: 1, maxDay: 3, prompt: config.earlyStagePrompt });
  }
  if (config?.midStagePrompt) {
    rules.push({ id: 'legacy_2', name: '中期（第4~7天）', minDay: 4, maxDay: 7, prompt: config.midStagePrompt });
  }
  if (config?.lateStagePrompt) {
    rules.push({ id: 'legacy_3', name: '后期（第8天及以上）', minDay: 8, maxDay: null, prompt: config.lateStagePrompt });
  }
  return rules.length > 0 ? rules : DEFAULT_STAGE_RULES;
}

export function getActiveMilestones(config?: DayConfig, currentDay?: number): CustomMilestoneNode[] {
  if (!config?.milestones || !Array.isArray(config.milestones) || !currentDay) return [];
  return config.milestones.filter((m) => {
    if (m.isEnabled === false) return false;
    const start = m.startDay !== undefined ? m.startDay : (m.targetDay || 1);
    const end = m.endDay !== undefined ? m.endDay : (m.targetDay || start);
    return currentDay >= start && currentDay <= end;
  });
}

export const DEFAULT_DAY_CONFIG: DayConfig = {
  scalingFactor: 0.02,
  dailyMoraleDrain: -1.0,
  dailyObedienceGain: 0.5,
  dailyShameGain: 0.5,
  dailyLustGain: 0.2,
  stageRules: DEFAULT_STAGE_RULES,
  milestones: DEFAULT_MILESTONES,
  earlyStagePrompt: '【初期 (第1~3天)】根据当前开局剧情与双方关系，保持初始的心态、反应与新鲜互动节奏；',
  midStagePrompt: '【中期 (第4~7天)】随着相处与交互深入，对当前场景与对方产生更深刻的了解与情绪沉淀；',
  lateStagePrompt: '【后期 (第8天及以上)】经过长时间深入互动，心理态度与双方羁绊达到极度深刻的融汇状态。',
};

export interface CustomSettings {
  difficulty: 'easy' | 'normal' | 'hard' | 'custom';
  weaknessMultiplier: number;  // 弱点伤害倍率 1.0 - 5.0
  sensitiveMultiplier: number; // 发情/敏感部位刺激倍率 1.0 - 5.0
  physicsShakeForce: number;   // 震动击退效果 0.5 - 2.0
  timerBeepSpeed: number;      // 警报音速度
  autoRegen: boolean;          // 是否自动恢复能量
  regenRate: number;           // 恢复速率
  dialogueFontSize?: number;   // 对话与终端字体大小 (px) 11 - 24
  consoleHeight?: number;      // 终端与对话框高度 (px) 400 - 1200
  consoleWidthMode?: 'normal' | 'wide' | 'full'; // 终端与对话框宽度模式: normal (7列), wide (12列拓宽), full (沉浸大屏弹窗)
}

export interface HeroProgress {
  heroId: string;
  dayCount: number;
  stats: Stats;
  partDamage: Record<BodyPartId, number>;
  partExposure: Record<BodyPartId, number>;
  consoleEntries: any[];
  logs: LogEntry[];
  envTheme: EnvironmentTheme | string;
  isEnergyShock: boolean;
  scenarioConfig?: ScenarioConfig;
  relationshipState?: RelationshipState;
  activeRelationship?: RelationshipSlot;
  realTimeSyncState?: RealTimeSyncState;
  lastUpdated: number;
}

export interface EnvPhysicalParams {
  temperature: number;            // 环境温度 (°C) : -270 ~ 1200
  phLevel: number;                // 介质酸碱度 (pH) : 0.0 ~ 14.0
  pressureAtm: number;            // 舱内压强/重力 (Atm) : 0.1 ~ 500
  voltageKv: number;              // 等离子/电场高压 (kV) : 0 ~ 1000
  antiPhotonRate: number;         // 光粒子/反光子抽拔率 (%) : 0 ~ 100
  turbidityPercent: number;       // 液体/介质混浊度 (%) : 0 ~ 100
  viscosityPas: number;           // 流体包裹粘稠度 (Pas) : 0 ~ 1000
  hypnosisHz: number;             // 潜意识催眠脑波频率 (Hz) : 0 ~ 500
  // 各项每日额外数值微调:
  extraHpDrain?: number;          // 额外每日 HP 变动 (%/日)
  extraEnergyDrain?: number;      // 额外每日 能量 变动 (%/日)
  extraMoraleDrain?: number;      // 额外每日 意志 变动 (%/日)
  extraShameGain?: number;        // 额外每日 羞耻 变动 (%/日)
  extraObedienceGain?: number;    // 额外每日 服从 变动 (%/日)
  extraLustGain?: number;         // 额外每日 欲望 变动 (%/日)
}

export interface CustomEnvTheme {
  id: string;                     // 唯有标识 key, e.g. 'custom_env_12345'
  name: string;                   // 自定义环境舱名称
  icon: string;                   // Emoji或图标标识 (e.g. '🌊', '⚙️', '🌌')
  description: string;            // 环境描述
  badgeColor: string;             // 样式边框/背景/文字颜色
  hpChange: number;               // 每日基础 HP 变动 (%/日)
  energyChange: number;           // 每日基础 能量 变动 (%/日)
  moraleChange: number;           // 每日基础 意志 变动 (%/日)
  shameChange: number;            // 每日基础 羞耻 变动 (%/日)
  obedienceChange: number;        // 每日基础 服从 变动 (%/日)
  lustChange: number;             // 每日基础 欲望 变动 (%/日)
  params: EnvPhysicalParams;      // 关联的物理与化学具体参数
}

export function getDefaultEnvParams(themeKey: string): EnvPhysicalParams {
  switch (themeKey) {
    case 'acid':
      return {
        temperature: 38,
        phLevel: 1.2,
        pressureAtm: 2.5,
        voltageKv: 5,
        antiPhotonRate: 35,
        turbidityPercent: 65,
        viscosityPas: 15,
        hypnosisHz: 0,
        extraHpDrain: 0,
        extraEnergyDrain: 0,
        extraMoraleDrain: 0,
        extraShameGain: 0,
        extraObedienceGain: 0,
        extraLustGain: 0,
      };
    case 'lava':
      return {
        temperature: 850,
        phLevel: 6.5,
        pressureAtm: 12.0,
        voltageKv: 0,
        antiPhotonRate: 50,
        turbidityPercent: 80,
        viscosityPas: 450,
        hypnosisHz: 0,
        extraHpDrain: 0,
        extraEnergyDrain: 0,
        extraMoraleDrain: 0,
        extraShameGain: 0,
        extraObedienceGain: 0,
        extraLustGain: 0,
      };
    case 'cryo':
      return {
        temperature: -196,
        phLevel: 7.0,
        pressureAtm: 5.0,
        voltageKv: 0,
        antiPhotonRate: 20,
        turbidityPercent: 20,
        viscosityPas: 100,
        hypnosisHz: 0,
        extraHpDrain: 0,
        extraEnergyDrain: 0,
        extraMoraleDrain: 0,
        extraShameGain: 0,
        extraObedienceGain: 0,
        extraLustGain: 0,
      };
    case 'plasma':
      return {
        temperature: 120,
        phLevel: 7.0,
        pressureAtm: 1.0,
        voltageKv: 500,
        antiPhotonRate: 85,
        turbidityPercent: 40,
        viscosityPas: 5,
        hypnosisHz: 0,
        extraHpDrain: 0,
        extraEnergyDrain: 0,
        extraMoraleDrain: 0,
        extraShameGain: 0,
        extraObedienceGain: 0,
        extraLustGain: 0,
      };
    case 'hypno':
      return {
        temperature: 28,
        phLevel: 7.0,
        pressureAtm: 1.0,
        voltageKv: 20,
        antiPhotonRate: 15,
        turbidityPercent: 30,
        viscosityPas: 2,
        hypnosisHz: 240,
        extraHpDrain: 0,
        extraEnergyDrain: 0,
        extraMoraleDrain: 0,
        extraShameGain: 0,
        extraObedienceGain: 0,
        extraLustGain: 0,
      };
    case 'void':
      return {
        temperature: -100,
        phLevel: 7.0,
        pressureAtm: 0.1,
        voltageKv: 50,
        antiPhotonRate: 90,
        turbidityPercent: 90,
        viscosityPas: 0,
        hypnosisHz: 80,
        extraHpDrain: 0,
        extraEnergyDrain: 0,
        extraMoraleDrain: 0,
        extraShameGain: 0,
        extraObedienceGain: 0,
        extraLustGain: 0,
      };
    case 'metal':
      return {
        temperature: 30,
        phLevel: 7.0,
        pressureAtm: 3.0,
        voltageKv: 100,
        antiPhotonRate: 40,
        turbidityPercent: 10,
        viscosityPas: 1,
        hypnosisHz: 0,
        extraHpDrain: 0,
        extraEnergyDrain: 0,
        extraMoraleDrain: 0,
        extraShameGain: 0,
        extraObedienceGain: 0,
        extraLustGain: 0,
      };
    case 'pure':
      return {
        temperature: 26,
        phLevel: 7.4,
        pressureAtm: 1.0,
        voltageKv: 0,
        antiPhotonRate: 0,
        turbidityPercent: 5,
        viscosityPas: 1,
        hypnosisHz: 0,
        extraHpDrain: 0,
        extraEnergyDrain: 0,
        extraMoraleDrain: 0,
        extraShameGain: 0,
        extraObedienceGain: 0,
        extraLustGain: 0,
      };
    case 'glass':
    default:
      return {
        temperature: 25,
        phLevel: 7.0,
        pressureAtm: 1.0,
        voltageKv: 0,
        antiPhotonRate: 10,
        turbidityPercent: 10,
        viscosityPas: 1,
        hypnosisHz: 0,
        extraHpDrain: 0,
        extraEnergyDrain: 0,
        extraMoraleDrain: 0,
        extraShameGain: 0,
        extraObedienceGain: 0,
        extraLustGain: 0,
      };
  }
}

export interface EnvDailyEffect {
  name: string;
  theme: EnvironmentTheme | string;
  hpChange: number;        // e.g. -10 HP
  energyChange: number;    // e.g. -8 Energy
  moraleChange: number;    // e.g. -5 Morale
  shameChange: number;     // e.g. +8 Shame
  obedienceChange: number; // e.g. +5 Obedience
  lustChange: number;      // e.g. +5 Lust
  description: string;
  badgeColor: string;
  icon?: string;
  params?: EnvPhysicalParams;
}

export const ENV_DAILY_EFFECTS: Record<EnvironmentTheme, EnvDailyEffect> = {
  glass: {
    name: '高抗性玻璃保温舱',
    theme: 'glass',
    hpChange: -3,
    energyChange: -5,
    moraleChange: -1,
    shameChange: 1,
    obedienceChange: 1,
    lustChange: 0,
    description: '标准温控防爆玻璃收容，微弱消耗体能与反粒子光能。',
    badgeColor: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/40',
  },
  metal: {
    name: '高压反光子金属室',
    theme: 'metal',
    hpChange: -5,
    energyChange: -8,
    moraleChange: -3,
    shameChange: 3,
    obedienceChange: 2,
    lustChange: 0,
    description: '金属电磁壁不断吸收折射光粒子，造成全身隐痛与体能衰退。',
    badgeColor: 'text-zinc-300 border-zinc-600 bg-zinc-900',
  },
  acid: {
    name: '强酸溶解浸泡舱',
    theme: 'acid',
    hpChange: -10,
    energyChange: -8,
    moraleChange: -5,
    shameChange: 8,
    obedienceChange: 3,
    lustChange: 4,
    description: '高浓度腐蚀强酸持续侵蚀皮层与战甲，躯体痛苦不堪，羞耻难当。',
    badgeColor: 'text-green-400 border-green-500/40 bg-green-950/40',
  },
  lava: {
    name: '高热熔岩热能室',
    theme: 'lava',
    hpChange: -12,
    energyChange: -10,
    moraleChange: -8,
    shameChange: 4,
    obedienceChange: 2,
    lustChange: 2,
    description: '数千度超高热熔岩辐射灼烧身体与能量核心，水分与体力急剧蒸发。',
    badgeColor: 'text-orange-400 border-orange-500/40 bg-orange-950/40',
  },
  cryo: {
    name: '绝对零度深冻舱',
    theme: 'cryo',
    hpChange: -6,
    energyChange: -12,
    moraleChange: -5,
    shameChange: 2,
    obedienceChange: 2,
    lustChange: 0,
    description: '极寒零度结晶封冻细胞与血管，能量核心充能速率受到极度冻结。',
    badgeColor: 'text-sky-300 border-sky-500/40 bg-sky-950/40',
  },
  plasma: {
    name: '等离子高频抽能室',
    theme: 'plasma',
    hpChange: -8,
    energyChange: -20,
    moraleChange: -5,
    shameChange: 3,
    obedienceChange: 4,
    lustChange: 0,
    description: '高频离子电场强行抽拔能量核心中的高纯能源，导致重度虚弱。',
    badgeColor: 'text-purple-400 border-purple-500/40 bg-purple-950/40',
  },
  void: {
    name: '虚空失重力干扰狱',
    theme: 'void',
    hpChange: -5,
    energyChange: -15,
    moraleChange: -10,
    shameChange: 5,
    obedienceChange: 5,
    lustChange: 3,
    description: '无重力扭曲结界破坏前庭神经与灵能核心，使精神陷入沉沦与意志丧失。',
    badgeColor: 'text-indigo-400 border-indigo-500/40 bg-indigo-950/40',
  },
  hypno: {
    name: '潜意识催眠洗脑室',
    theme: 'hypno',
    hpChange: -2,
    energyChange: -5,
    moraleChange: -12,
    shameChange: 10,
    obedienceChange: 10,
    lustChange: 8,
    description: '迷幻脑波与高频催眠光环持续重塑潜意识，意志急剧瓦解，服从度与欲望激增！',
    badgeColor: 'text-pink-400 border-pink-500/40 bg-pink-950/40',
  },
  pure: {
    name: '纯爱光能滋养水晶阵',
    theme: 'pure',
    hpChange: 15,
    energyChange: 20,
    moraleChange: 10,
    shameChange: -10,
    obedienceChange: 0,
    lustChange: -10,
    description: '温暖光之结晶持续注入生命因子与神圣正能量，温和修复体能，安抚心灵。',
    badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40 font-bold',
  },
  any: {
    name: '常规调校环境',
    theme: 'any',
    hpChange: -3,
    energyChange: -5,
    moraleChange: -1,
    shameChange: 0,
    obedienceChange: 0,
    lustChange: 0,
    description: '标准环境消耗。',
    badgeColor: 'text-zinc-400 border-zinc-700 bg-zinc-900',
  },
};

export interface ConsoleEntry {
  id: string;
  type: 'attack_log' | 'chat_user' | 'chat_hero' | 'system';
  time: string;
  heroId?: string;
  heroName?: string;
  speakerName?: string;
  weaponName?: string;
  targetPartName?: string;
  damageDealt?: number;
  energyDrained?: number;
  moraleLost?: number;
  shameGained?: number;
  obedienceGained?: number;
  lustChanged?: number;
  shieldAbsorbRate?: number;
  text?: string;
  sender?: 'interrogator' | 'heroine' | 'system';
  reactionType?: 'defiant' | 'pained' | 'wavering' | 'broken' | 'begging' | 'corpse' | 'healing';
  psychologicalAnalysis?: string;
  thinkingProcess?: string; // AI 深度思考/推理链过程
  envWeaknessName?: string;
  isCorpseHit?: boolean;
  isRevival?: boolean;
  specialEvent?: {
    name: string;
    type: 'resistance' | 'whisper' | 'surge' | 'faultline';
    description: string;
    tag: string;
  };
  customQuestion?: string;
  webSearchUsed?: boolean;
  searchEngine?: SearchEngineId | string;
  searchQuery?: string;
  searchSources?: WebSearchSource[];
}

