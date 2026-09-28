import { Stats, Ultrawoman, AlienWeapon } from '../types';

export function sanitizeHeroForAi(hero: any) {
  if (!hero || typeof hero !== 'object') return hero;
  const { customPortrait, customModel3DUrl, ...rest } = hero;
  return rest;
}

export function getWeaponActionTitle(weapon: AlienWeapon): string {
  if (!weapon) return '折磨打击';
  const cat = weapon.category;
  const type = weapon.type;

  if (cat === 'touch' || type === 'touch' || type === 'sensual' || type === 'erogenous') {
    return '肢体抚摸与生理接触攻伐';
  }
  if (cat === 'hypnosis' || type === 'hypnosis' || type === 'psy' || type === 'mind_erase') {
    return '高频脑波催眠与精神入侵';
  }
  if (cat === 'restraint' || type === 'restraint') {
    return '拘束锁链加压与机械束缚';
  }
  if (cat === 'drain' || type === 'drain') {
    return '高压能量抽拔与吸蚀';
  }
  if (type === 'corrode' || (type as string) === 'acid' || type === 'lava') {
    return '强酸黏液浸蚀与灼热淋洒';
  }
  if (type === 'electric' || type === 'shock' || type === 'plasma') {
    return '狂暴高压电场与等离子烙印';
  }
  if (type === 'frost') {
    return '深冷冰霜冷气包覆';
  }
  if (cat === 'heal' || type === 'heal' || type === 'nanite' || type === 'bliss') {
    return '纳米修复与治愈粒子注入';
  }
  if (type === 'beam') {
    return '高能光束与毁伤光线轰击';
  }
  return '高能折磨与战术打击';
}

export function getWeaponContinuousActionTitle(weapon: AlienWeapon): string {
  if (!weapon) return '持续折磨压制';
  const cat = weapon.category;
  const type = weapon.type;

  if (cat === 'touch' || type === 'touch' || type === 'sensual' || type === 'erogenous') {
    return '按住持续触摸与抓握摸索';
  }
  if (cat === 'hypnosis' || type === 'hypnosis' || type === 'psy' || type === 'mind_erase') {
    return '按住持续高频脑波潜意识催眠';
  }
  if (cat === 'restraint' || type === 'restraint') {
    return '按住持续锁链加压收缩束缚';
  }
  if (cat === 'drain' || type === 'drain') {
    return '按住持续高压抽取与能量吸蚀';
  }
  if (type === 'corrode' || (type as string) === 'acid' || type === 'lava') {
    return '按住持续高压强酸喷淋与腐蚀包覆';
  }
  if (type === 'electric' || type === 'shock' || type === 'plasma') {
    return '按住持续高压电击与等离子狂暴烙烫';
  }
  if (type === 'frost') {
    return '按住持续深冷极寒冻结';
  }
  if (cat === 'heal' || type === 'heal' || type === 'nanite' || type === 'bliss') {
    return '按住持续治愈光波与纳米修复注入';
  }
  return '按住持续高频攻伐压制';
}

export function getStatsPayload(stats: Stats & Record<string, any>, hero?: Ultrawoman) {
  const maxHp = Number(stats?.maxHp) || Number(hero?.defaultStats?.maxHp) || 100;
  const maxEnergy = Number(stats?.maxEnergy) || Number(hero?.defaultStats?.maxEnergy) || 100;
  const maxMorale = Number(stats?.maxMorale) || Number(hero?.defaultStats?.maxMorale) || 100;
  const maxObedience = Number(stats?.maxObedience) || Number(hero?.defaultStats?.maxObedience) || 100;
  const maxShame = Number(stats?.maxShame) || Number(hero?.defaultStats?.maxShame) || 100;
  const maxLust = Number(stats?.maxLust) || Number(hero?.defaultStats?.maxLust) || 100;

  const rawHp = stats?.hp ?? maxHp;
  const rawEnergy = stats?.energy ?? maxEnergy;
  const rawMorale = stats?.morale ?? maxMorale;
  const rawObedience = stats?.obedience ?? 0;
  const rawShame = stats?.shame ?? 0;
  const rawLust = stats?.lust ?? 10;

  const hpPct = Math.max(0, Math.min(100, Math.round((rawHp / maxHp) * 1000) / 10));
  const energyPct = Math.max(0, Math.min(100, Math.round((rawEnergy / maxEnergy) * 1000) / 10));
  const moralePct = Math.max(0, Math.min(100, Math.round((rawMorale / maxMorale) * 1000) / 10));
  const obediencePct = Math.max(0, Math.min(100, Math.round((rawObedience / maxObedience) * 1000) / 10));
  const shamePct = Math.max(0, Math.min(100, Math.round((rawShame / maxShame) * 1000) / 10));
  const lustPct = Math.max(0, Math.min(100, Math.round((rawLust / maxLust) * 1000) / 10));

  return {
    ...stats,
    hp: rawHp,
    energy: rawEnergy,
    morale: rawMorale,
    obedience: rawObedience,
    shame: rawShame,
    lust: rawLust,
    maxHp,
    maxEnergy,
    maxMorale,
    maxObedience,
    maxShame,
    maxLust,
    hpPct,
    energyPct,
    moralePct,
    obediencePct,
    shamePct,
    lustPct,
  };
}
