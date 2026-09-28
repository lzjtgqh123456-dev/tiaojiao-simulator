import { Ultrawoman, AlienWeapon } from '../types';

// 全部角色可自由自定义、修改、删除或重置，不再硬性锁定任何角色
export const PROTECTED_MAIN_HERO_IDS: string[] = [];

// 历史预设角色 ID 清单（用于自动清理历史遗留缓存预设）
// 本仓库不附带任何预设角色，故历史预设 ID 清理表为空。
export const PRESET_HERO_IDS: string[] = [];

/**
 * 创建标准纯净的空白自定义角色槽位模板
 */
export function createBlankHero(id?: string, name?: string): Ultrawoman {
  const newId = id || `custom_hero_${Date.now()}`;
  return {
    id: newId,
    name: name || '自定义角色 1',
    title: '原创战术角色 / 自定义位',
    height: '168cm',
    weight: '52kg',
    homePlanet: '原创次元 / 自定义背景',
    description: '用户建立的自定义角色槽位，支持自由配置外貌、性格、弱点、部位血量、立绘与语音台词。',
    weakness: '核心弱点与敏感部位',
    weakPart: 'timer',
    sensitivePart: 'torso',
    voicePitch: 1.0,
    colorTheme: {
      primary: '#3b82f6',
      secondary: '#e2e8f0',
      glow: '#06b6d4',
      bgGradient: 'from-blue-950/40 via-cyan-950/30 to-slate-950',
    },
    defaultStats: {
      hp: 100,
      energy: 100,
      morale: 100,
      obedience: 0,
      shame: 0,
      lust: 10,
    },
    bodyParts: {
      head: { id: 'head', name: '头部战术面罩 / 精神中枢', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.1, description: '战术面罩与精神中枢。' },
      timer: { id: 'timer', name: '核心灵能晶石 (能量中枢)', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.5, description: '维持生命活动与战斗力的核心能量枢纽。' },
      chest: { id: 'chest', name: '胸前战甲 / 护心甲', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.1, description: '守护核心要害的前胸战甲。' },
      leftArm: { id: 'leftArm', name: '左臂 / 防御手套', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.0, description: '负责格挡防御的左手护臂。' },
      rightArm: { id: 'rightArm', name: '右臂 / 攻击端', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.0, description: '施展战技攻击的主要手臂。' },
      torso: { id: 'torso', name: '腰腹躯干 / 神经回路', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.2, description: '支撑身形运动的柔韧腰腹。' },
      legs: { id: 'legs', name: '腿部战靴 / 机动下肢', maxHealth: 100, currentHealth: 100, exposure: 0, weaknessMultiplier: 1.05, description: '高速移动与跳跃的高筒战靴。' },
    },
    voiceLines: {
      greeting: ['不管你用什么手段，我都绝不会轻易向你屈服！'],
      hitSmall: ['哼……这种程度的冲击，休想动摇我！', '咬紧牙关！'],
      hitHeavy: ['咕呜啊……！能量流失得太快了！', '装甲防御出现破损……可恶！'],
      hitWeakPoint: ['核心弱点……被击中了！身体使不上力气……'],
      hitSensitivePoint: ['呀啊！碰什么地方呢！好下流……', '呜……身体好热……快住手！'],
      timerLow: ['核心能量警报响起了……我还能支撑！', '绝不能在这里倒下……'],
      touchReaction: ['把手拿开！不准碰我的战甲缝隙！'],
      hypnosisReaction: ['邪恶的低语……休想侵蚀我的意志！'],
      envDamageReaction: ['高能环境介质好刺痛！'],
      defiant: ['正义的光芒……永不熄灭！要战便战！'],
      wavering: ['视线……开始模糊了……好难受……'],
      broken: ['任由……大人处置了……我认输……'],
      corpseReaction: ['（目标失去意识陷入休克，身体无力地垂落……）'],
      healingReaction: ['复苏光线……伤口正在愈合……！'],
    },
  };
}

// 移除所有硬编码预设角色，初始角色列表为空数组（完全由用户自由创建与管理）
export const HEROINES: Ultrawoman[] = [];

export const WEAPONS: AlienWeapon[] = [];
