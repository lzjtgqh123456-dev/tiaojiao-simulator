import { Ultrawoman, Stats, RelationshipSlot, ScenarioConfig, AiConfig, AutoReplySuggestion, EnvironmentTheme, DayConfig, getStagePromptRules, getActiveMilestones } from '../types';

export interface QuickEnvAction {
  id: string;
  name: string;
  theme: EnvironmentTheme;
  icon: string;
  description: string;
  badge: string;
  colorClass: string;
  effects: {
    hpDelta?: number;
    energyDelta?: number;
    moraleDelta?: number;
    shameDelta?: number;
    obedienceDelta?: number;
    lustDelta?: number;
  };
  logText: string;
}

export const QUICK_ENV_ACTIONS: QuickEnvAction[] = [
  {
    id: 'overload',
    name: '等离子雷暴过载 (Overload)',
    theme: 'plasma',
    icon: '⚡',
    badge: '高压电击',
    colorClass: 'from-amber-600/30 to-purple-900/40 border-amber-500/60 text-amber-300',
    description: '释放高压交变等离子过载电弧，急剧抽取魔能值与意志。',
    effects: { energyDelta: -8, hpDelta: -3, moraleDelta: -4 },
    logText: '【环境触发·等离子雷暴过载 (Overload)】瞬间释放高频电离电弧，舱内等离子急促轰鸣，魔能值被急剧抽干！',
  },
  {
    id: 'cryo',
    name: '绝对零度结晶 (Cryo Freeze)',
    theme: 'cryo',
    icon: '❄️',
    badge: '极寒霜冻',
    colorClass: 'from-cyan-600/30 to-blue-900/40 border-cyan-400/60 text-cyan-300',
    description: '灌注超低温液态氦霜雾，战甲表面结霜凝固，引发体能冻伤与肢体僵直。',
    effects: { hpDelta: -4, energyDelta: -4, moraleDelta: -2 },
    logText: '【环境触发·绝对零度结晶 (Cryo Freeze)】强效冷凝液充斥收容舱，战甲凝结出大量白霜晶体，体温急剧衰退！',
  },
  {
    id: 'lava',
    name: '红外极温热灼 (Thermal Burn)',
    theme: 'lava',
    icon: '🔥',
    badge: '极温炙烤',
    colorClass: 'from-rose-600/30 to-amber-900/40 border-rose-500/60 text-rose-300',
    description: '开启高能红外聚热矩阵，极温炙烤战甲皮肤，引发剧痛与强烈羞耻感。',
    effects: { hpDelta: -5, shameDelta: 6, lustDelta: 4 },
    logText: '【环境触发·红外极温热灼 (Thermal Burn)】全舱红外聚焦阵列点亮，滚烫热浪席卷战甲，引发皮肤泛红与娇喘！',
  },
  {
    id: 'void',
    name: '暗物质虚空噬能 (Void Drain)',
    theme: 'void',
    icon: '🔮',
    badge: '虚空抽离',
    colorClass: 'from-purple-900/40 to-indigo-950/60 border-purple-500/60 text-purple-300',
    description: '暗能引力漩涡全开，直击能量核心噬取光粒子，摧毁反抗防线并催化顺从。',
    effects: { energyDelta: -10, obedienceDelta: 4, moraleDelta: -5 },
    logText: '【环境触发·暗物质虚空噬能 (Void Drain)】暗影力场席卷收容舱，魔能值粒子被无情剥离抽干，抵抗意志崩解！',
  },
  {
    id: 'gamma',
    name: '伽马电离辐射 (Gamma Radiate)',
    theme: 'metal',
    icon: '☢️',
    badge: '放射电离',
    colorClass: 'from-emerald-600/30 to-zinc-900/60 border-emerald-500/60 text-emerald-300',
    description: '高能电离射线直接穿透皮层组织，造成持续性生物细胞衰竭与精神恐慌。',
    effects: { hpDelta: -4, moraleDelta: -4 },
    logText: '【环境触发·伽马电离辐射 (Gamma Radiate)】高能电离射线穿透防御装甲，放射性警报长鸣，身躯陷入深度衰弱！',
  },
  {
    id: 'solar',
    name: '恒星耀阳灌注 (Solar Infusion)',
    theme: 'glass',
    icon: '☀️',
    badge: '生命充能',
    colorClass: 'from-amber-500/30 to-yellow-900/40 border-yellow-400/60 text-yellow-300',
    description: '模拟等离子耀斑生命光波，温和修复受创身躯与重聚核心光能。',
    effects: { hpDelta: 6, energyDelta: 8, moraleDelta: 4 },
    logText: '【环境触发·恒星耀阳灌注 (Solar Infusion)】金色恒星生命光束温柔倾洒，滋润受创战体，能量核心迅速复苏！',
  },
  {
    id: 'bio_soothe',
    name: '生体赫尔兹安抚 (Bio Soothe)',
    theme: 'glass',
    icon: '🌿',
    badge: '舒缓平复',
    colorClass: 'from-teal-600/30 to-emerald-950/50 border-teal-400/60 text-teal-300',
    description: '生物赫尔兹微频共振波，快速抚慰受刺激神经并抚平屈辱羞耻。',
    effects: { hpDelta: 4, shameDelta: -8, obedienceDelta: -2 },
    logText: '【环境触发·生体赫尔兹安抚 (Bio Soothe)】柔和生物脉冲波拂过神经末梢，疼痛与屈辱感得到显著平复安抚。',
  },
  {
    id: 'acid',
    name: '强酸雾化腐蚀 (Acid Mist)',
    theme: 'acid',
    icon: '🧪',
    badge: '强酸溶蚀',
    colorClass: 'from-lime-600/30 to-emerald-950/50 border-lime-400/60 text-lime-300',
    description: '喷洒高浓度生化酸雾，侵蚀战甲防护层，大幅提升受创易损度。',
    effects: { hpDelta: -5, shameDelta: 5, moraleDelta: -3 },
    logText: '【环境触发·强酸雾化腐蚀 (Acid Mist)】翠绿生化酸雾弥漫舱内，战甲防护涂层嗤嗤溶解，防御防线遭受严重削弱！',
  },
];

export interface QuickDialogueTemplate {
  id: string;
  category: 'defiant' | 'dominant' | 'pure_love' | 'sensory' | 'weakness' | 'silence';
  tag: string;
  icon: string;
  text: string;
  tone: string;
}

export function getQuickDialogueTemplates(
  hero?: Ultrawoman,
  scenarioConfig?: ScenarioConfig,
  activeRelationship?: RelationshipSlot
): QuickDialogueTemplate[] {
  const heroName = hero?.name || '女战士';
  const interrogator = scenarioConfig?.interrogatorIdentity || '审讯官';
  const weakPartName = hero?.bodyParts[hero?.weakPart || 'timer']?.name || '魔能值';
  const sensPartName = hero?.bodyParts[hero?.sensitivePart || 'torso']?.name || '胸口装甲';

  const list: QuickDialogueTemplate[] = [
    {
      id: 'defiant_challenge',
      category: 'defiant',
      tag: '顽抗质问 (Defiant)',
      icon: '⚔️',
      text: `【${interrogator}】眼神冷峻：“你的这身战甲与意志还能支撑多久？落入收容舱中，就不要再抱有任何虚无的幻想了。”`,
      tone: '强硬施压',
    },
    {
      id: 'dominant_command',
      category: 'dominant',
      tag: '支配命令 (Command)',
      icon: '👑',
      text: `【${interrogator}】俯视着你：“认清你的处境，${heroName}。现在端正姿态，向我奉上你最彻底的顺从与秘密。”`,
      tone: '绝对威严',
    },
  ];

  if (activeRelationship?.category === 'pure_love') {
    list.push({
      id: 'affectionate_comfort',
      category: 'pure_love',
      tag: '深情抚慰 (Pure Love)',
      icon: '💞',
      text: `【${interrogator}】轻抚你的脸庞：“${heroName}，累了就靠在我怀里……不论发生什么，我都会守护你的一切。”`,
      tone: '温柔深情',
    });
  } else {
    list.push({
      id: 'mock_pressure',
      category: 'defiant',
      tag: '嘲弄施压 (Pressure)',
      icon: '🔥',
      text: `【${interrogator}】轻蔑一笑：“堂堂光特勤战士，在收容舱内也不过如此，连起码的威风都维持不住了吧？”`,
      tone: '讥讽压制',
    });
  }

  list.push(
    {
      id: 'weakness_lock',
      category: 'weakness',
      tag: '弱点锁定 (Weakness)',
      icon: '🎯',
      text: `【${interrogator}】直视你的【${weakPartName}】：“你的核心命门已经剧烈闪烁了……只要稍加刺激，你的防线就会彻底瓦解吧？”`,
      tone: '精准打击',
    },
    {
      id: 'sensory_tease',
      category: 'sensory',
      tag: '敏感羞耻 (Sensory)',
      icon: '🌸',
      text: `【${interrogator}】视线落在【${sensPartName}】：“身体泛起的红晕与急促的娇喘，已经把你内心的动摇与羞耻出卖得一干二净了。”`,
      tone: '敏感诱导',
    },
    {
      id: 'silence_progress',
      category: 'silence',
      tag: '静观其变 (Silence)',
      icon: '⏩',
      text: `（保持沉默，静观其变，等待剧情进一步自然发展演化……）`,
      tone: '从容观望',
    }
  );

  return list;
}

export async function fetchAutoReplySuggestions(params: {
  hero: Ultrawoman;
  stats: Stats;
  partDamage?: Record<string, number>;
  partExposure?: Record<string, number>;
  messages?: any[];
  activeRelationship?: RelationshipSlot;
  scenarioConfig?: ScenarioConfig;
  aiConfig?: AiConfig;
  dayCount?: number;
  dayConfig?: DayConfig;
  environmentTheme?: EnvironmentTheme | string;
  /** 在场角色名单（多人同台时用于分清谁是谁，避免建议串角色） */
  presentCharacters?: Array<{ id?: string; name: string; relationshipTitle?: string; personality?: string }>;
  /** “换一批”时把当前已有的建议传过来，避免模型重复输出同样的内容 */
  avoid?: string[];
}): Promise<AutoReplySuggestion[]> {
  try {
    const response = await fetch('/api/suggest-replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.suggestions) && data.suggestions.length >= 3) {
        return data.suggestions;
      }
    }
  } catch (err) {
    console.warn('[AutoReplyService] Server API request failed, using client contextual fallback:', err);
  }

  // Client-side fallback computation based on morale, shame, and relationship
  return computeClientFallbackSuggestions(params);
}

function computeClientFallbackSuggestions(params: {
  hero: Ultrawoman;
  stats: Stats;
  activeRelationship?: RelationshipSlot;
  scenarioConfig?: ScenarioConfig;
  dayCount?: number;
  dayConfig?: DayConfig;
  messages?: any[];
  environmentTheme?: EnvironmentTheme | string;
}): AutoReplySuggestion[] {
  const { hero, stats, activeRelationship: rel, scenarioConfig: sc, dayCount = 1, dayConfig, messages } = params;
  const heroName = hero?.name || '女战士';
  const interrogator = sc?.interrogatorIdentity || '审讯官';
  const weakPartName = hero?.bodyParts[hero?.weakPart || 'timer']?.name || '魔能值';
  const sensPartName = hero?.bodyParts[hero?.sensitivePart || 'torso']?.name || '胸口装甲';
  const relTitle = rel?.title || '尚未确立';

  const maxMorale = stats.maxMorale || 100;
  const maxShame = stats.maxShame || 100;
  const maxEnergy = stats.maxEnergy || 100;
  const moralePct = Math.round((stats.morale / maxMorale) * 100);
  const shamePct = Math.round(((stats.shame ?? 0) / maxShame) * 100);
  const energyPct = Math.round((stats.energy / maxEnergy) * 100);

  // 承接最近对话：取女战士最后一句 + 一个可呼应的关键词（与后端兜底保持一致）
  const list = Array.isArray(messages) ? messages : [];
  let lastHeroLine = '';
  let lastSpeakerClient = '';
  for (let i = list.length - 1; i >= 0; i--) {
    const m: any = list[i];
    if (!m || m.type === 'summary' || m.type === 'system') continue;
    if (m.sender === 'interrogator' || m.sender === 'user' || m.sender === 'player') continue;
    const rawMsg = String(m.text || '').replace(/\s+/g, ' ').trim();
    if (!rawMsg || /^⏳\s*\[/.test(rawMsg)) continue;
    lastHeroLine = rawMsg.slice(0, 160);
    // 多人在场：senderName 可能是"👥 在场小队全员"，此时从消息里解析最后一位发言者
    const who = String(m.senderName || m.heroName || m.speakerName || '').trim();
    if (who && !who.includes('全员') && !who.includes('小队') && who !== heroName) {
      lastSpeakerClient = who;
    } else {
      const markers = Array.from(rawMsg.matchAll(/【([^】]{1,24})】\s*[:：]\s*[“"]/g));
      if (markers.length > 0) {
        const lastName = String(markers[markers.length - 1][1] || '').trim();
        if (lastName && lastName !== heroName) lastSpeakerClient = lastName;
      }
    }
    break;
  }
  const addr = lastSpeakerClient || heroName;
  const echo = (() => {
    if (!lastHeroLine) return '';
    let raw = lastHeroLine.replace(/[（(][^）)]*[）)]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const markers = Array.from(raw.matchAll(/【([^】]{1,24})】\s*[:：]\s*[“"]/g));
    if (markers.length > 0) {
      const lastMarker = markers[markers.length - 1];
      const cutAt = (lastMarker.index || 0) + lastMarker[0].length;
      if (cutAt < raw.length) raw = raw.slice(cutAt);
    }
    const cleaned = raw.replace(/[“”"'【】《》\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    const sentences = cleaned.split(/[。！？!?；;]/).map((x) => x.trim()).filter(Boolean);
    // 取「她这句话的开头句」作为呼应：结尾句常常只是补充或碎念，容易截断得莫名其妙
    const last = sentences.length > 0 ? sentences[0] : cleaned;
    const trimmed = last
      .replace(/^[，。！？、；：…—\-\s]+/, '')
      .replace(/^(?:了|着|过|的|好|吧|呢|吗|啊|呀|哦|喔|嗯|那|这|就|还|又|也|都|是|在)+[，、\s]*/, '')
      .trim();
    return (trimmed || cleaned).slice(-16);
  })();
  const echoRef = echo ? `你刚才说的「${echo}」我听见了。` : '';

  // 场景性质：日常/恋爱场景绝不能再用审讯式施压台词
  const relCat = rel?.category || '';
  const sceneKind = sc?.category === 'interrogation'
    ? 'interrogation'
    : relCat === 'pure_love' ? 'intimate'
      : relCat === 'evil_enslavement' ? 'dominant'
        : relCat === 'hypnotic_dependency' ? 'hypnosis'
          : relCat === 'rivalry' ? 'rivalry'
            : 'story';
  const envRef = sc?.name ? `【${sc.name}】` : '当前的场景';

  const stageRules = getStagePromptRules(dayConfig);
  const matchedStage = stageRules.find((r) => {
    const min = r.minDay || 1;
    const max = r.maxDay;
    return dayCount >= min && (max === null || max === undefined || dayCount <= max);
  });
  const stageName = matchedStage?.name ? `【${matchedStage.name}】` : `【第${dayCount}天】`;
  const activeMilestones = getActiveMilestones(dayConfig, dayCount);
  const milestoneTag = activeMilestones.length > 0 ? ` [🌟 ${activeMilestones[0].name.split(' ')[0]}]` : '';

  const suggestions: AutoReplySuggestion[] = [];
  const push = (category: AutoReplySuggestion['category'], tag: string, text: string, tone: string) => {
    suggestions.push({ id: `opt-${suggestions.length + 1}`, category, tag, text, tone });
  };

  if (sceneKind === 'interrogation') {
    push('dominant', `施压逼问${milestoneTag}`, `（语气一沉，目光压住${addr}）${echoRef}别绕圈子了，把你知道的都交代出来。`, '强硬施压');
    push('psychological', '心理突破', `（俯身逼近，盯着她的眼睛）你的呼吸和眼神已经出卖你了，${addr}。你到底在害怕什么？`, '冷静试探');
    push('sensory', '弱点锁定', `（指尖敲了敲【${weakPartName}】的监测面板）既然你还在逞强，那就从这里开始，一点点撬开你的防线。`, '精准打击');
  } else if (sceneKind === 'intimate') {
    push('dominant', `主动安排${milestoneTag}`, `（自然牵住${addr}的手）${echoRef}在${stageName}就听我的——今天什么都不用想，跟着我走就好。`, '温柔笃定');
    push('psychological', '回应心意', `（放轻声音）${addr}，【${relTitle}】这份心意我都记着。告诉我，你现在最想要的是什么？`, '温柔深情');
    push('sensory', '亲近互动', `（伸手替她理了理耳边的碎发）……先别急着回答，就这样陪我再待一会儿。`, '亲昵自然');
  } else if (sceneKind === 'dominant') {
    push('dominant', `确立主导${milestoneTag}`, `（居高临下看着${addr}）${echoRef}认清自己的位置，接下来该用什么态度回应我，你心里清楚。`, '绝对威严');
    push('psychological', '规训诱导', `（语气放缓）你的犹豫我已经看见了，${addr}。把心里最后那点抗拒说出来，我听着。`, '循循诱导');
    push('sensory', '烙印确认', `（指尖掠过她肩侧的印记）这里会记住你今天的每一个反应……别让我失望。`, '压迫感');
  } else if (sceneKind === 'hypnosis') {
    push('dominant', `潜意指令${milestoneTag}`, `（注视着她的眼睛，语速放慢）${echoRef}${addr}，看着我……把脑海里多余的杂念都放下。`, '催眠沉沦');
    push('psychological', '意识探索', `（轻声）你刚才那句话，是你自己想说，还是我让你说的？再仔细想一想。`, '深入潜意识');
    push('sensory', '感官引导', `（指尖轻触她的太阳穴）数到三，呼吸会变得很轻……很好，就这样跟着我。`, '安抚诱导');
  } else if (sceneKind === 'rivalry') {
    push('dominant', `战意挑衅${milestoneTag}`, `（嘴角扬起）${echoRef}${addr}，光靠嘴硬可赢不了我。让我看看你真正的极限在哪里。`, '孤傲挑衅');
    push('psychological', '直击骄傲', `（收起笑意）你嘴上说着绝不低头，可你的手在抖。承认吧，你已经动摇了。`, '冷静拆穿');
    push('sensory', '逼近对抗', `（向前半步，与她几乎贴面）既然都不肯让——那就用实力说话。`, '压迫对抗');
  } else {
    const mood = moralePct <= 30 ? '（她情绪明显低落，' : energyPct <= 30 ? '（她气息有些不稳，' : '（';
    push('dominant', `主动推进${milestoneTag}`, `${mood}接过她的话）${echoRef}那这件事就这么定了，${envRef}这边交给我来安排。`, '果决自然');
    push('psychological', '倾听追问', `（认真看着她）${addr}，你刚才那句话……是认真的吗？我想听你把后面的话说完。`, '温和专注');
    push('sensory', '环境互动', `（看了看周围，朝${envRef}的方向抬了抬下巴）时间还早，我们再往那边走走？`, '轻松自然');
  }

  return suggestions;
}
