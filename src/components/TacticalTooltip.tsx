import React, { useState, useRef, useEffect, ReactNode } from 'react';
import {
  AlienWeapon,
  BodyPartConfig,
  BodyPartId,
  Ultrawoman,
  CustomWeaponType,
  DEFAULT_WEAPON_TYPES,
} from '../types';
import {
  Sparkles,
  Target,
  Flame,
  Zap,
  Info,
  ShieldAlert,
  Heart,
  Brain,
  Lock,
  Eye,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface HoverTooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  delay?: number;
  className?: string;
  tooltipClassName?: string;
  disabled?: boolean;
}

export const HoverTooltip: React.FC<HoverTooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 120,
  className = '',
  tooltipClassName = '',
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: string }>({
    top: 0,
    left: 0,
    placement: position,
  });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  const calculatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let chosenPos = position;
    if (position === 'auto') {
      // If trigger is in the bottom half of the screen, show on top; otherwise bottom
      chosenPos = rect.bottom > window.innerHeight - 200 ? 'top' : 'bottom';
    }

    let top = 0;
    let left = 0;

    const tooltipWidth = 320;
    const tooltipHeight = 240;

    if (chosenPos === 'top') {
      top = rect.top + scrollY - 8;
      left = rect.left + scrollX + rect.width / 2;
    } else if (chosenPos === 'bottom') {
      top = rect.bottom + scrollY + 8;
      left = rect.left + scrollX + rect.width / 2;
    } else if (chosenPos === 'left') {
      top = rect.top + scrollY + rect.height / 2;
      left = rect.left + scrollX - 8;
    } else {
      top = rect.top + scrollY + rect.height / 2;
      left = rect.right + scrollX + 8;
    }

    // Viewport boundary protection
    const screenPadding = 12;
    if (left - tooltipWidth / 2 < screenPadding) {
      left = tooltipWidth / 2 + screenPadding;
    } else if (left + tooltipWidth / 2 > window.innerWidth - screenPadding) {
      left = window.innerWidth - tooltipWidth / 2 - screenPadding;
    }

    setCoords({ top, left, placement: chosenPos });
  };

  const handleMouseEnter = () => {
    if (disabled || !content) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      calculatePosition();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`inline-block relative ${className}`}
    >
      {children}

      {isVisible && !disabled && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform:
              coords.placement === 'top'
                ? 'translate(-50%, -100%)'
                : coords.placement === 'bottom'
                ? 'translate(-50%, 0)'
                : coords.placement === 'left'
                ? 'translate(-100%, -50%)'
                : 'translate(0, -50%)',
            zIndex: 99999,
          }}
          className={`pointer-events-none transition-all duration-150 animate-fadeIn ${tooltipClassName}`}
        >
          {content}
        </div>
      )}
    </div>
  );
};

// ==========================================
// Rich Weapon / Attack Tooltip Card Component
// ==========================================
interface WeaponTooltipCardProps {
  weapon: AlienWeapon;
  hero?: Ultrawoman;
  selectedPartId?: BodyPartId;
  intensity?: number;
  totalMultiplier?: number;
  isSelected?: boolean;
  customWeaponTypes?: CustomWeaponType[];
}

export const WeaponTooltipCard: React.FC<WeaponTooltipCardProps> = ({
  weapon,
  hero,
  selectedPartId,
  intensity = 1.0,
  totalMultiplier = 1.0,
  isSelected = false,
  customWeaponTypes = [],
}) => {
  const allKnownTypes = [...DEFAULT_WEAPON_TYPES, ...customWeaponTypes];
  const foundType = allKnownTypes.find((t) => t.id === weapon.type);
  const typeLabel = foundType
    ? `${foundType.icon ? foundType.icon : ''} ${foundType.name}`
    : weapon.type;

  const realDmg =
    weapon.damage > 0
      ? Math.max(0.1, Math.round(weapon.damage * totalMultiplier * 0.6 * 10) / 10)
      : weapon.damage < 0
      ? Math.round(weapon.damage * 10) / 10
      : 0;

  const preferredPartName =
    hero?.bodyParts[weapon.preferredTarget || 'torso']?.name || '全躯干/通用';

  return (
    <div className="w-80 bg-zinc-950/95 backdrop-blur-md rounded-xl border border-blue-500/70 p-3.5 text-zinc-100 shadow-[0_0_25px_rgba(59,130,246,0.4)] text-left font-mono space-y-2.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-2">
        <div className="flex flex-col">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
            <span className="font-bold text-sm text-blue-300 font-sans">{weapon.name}</span>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono mt-0.5">
            分类: <strong className="text-zinc-300">{weapon.category || 'attack'}</strong>
          </span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-950 border border-blue-500/60 text-blue-300">
            {typeLabel}
          </span>
          {isSelected && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/60 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>当前装配中</span>
            </span>
          )}
        </div>
      </div>

      {/* Description / Mechanism */}
      <div className="bg-zinc-900/90 p-2 rounded-lg border border-zinc-800 text-xs text-zinc-200 leading-relaxed font-sans">
        <p className="text-[11px] text-zinc-300">
          <strong className="text-amber-300 font-mono">💡 手段机制: </strong>
          {weapon.description}
        </p>
      </div>

      {/* Real-time Calculation & Attributes Grid */}
      <div className="space-y-1.5 font-mono text-[11px]">
        <div className="flex items-center justify-between text-zinc-300 bg-zinc-900/60 px-2 py-1 rounded border border-zinc-800/80">
          <span className="text-zinc-400">推荐作用部位:</span>
          <strong className="text-amber-300">{preferredPartName}</strong>
        </div>

        {/* Six Parameters Badges */}
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          {/* HP */}
          <div className="bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">生命伤害/恢复</span>
            <strong
              className={
                weapon.damage > 0
                  ? 'text-rose-400'
                  : weapon.damage < 0
                  ? 'text-emerald-400'
                  : 'text-zinc-500'
              }
            >
              {weapon.damage > 0
                ? `-${weapon.damage} HP`
                : weapon.damage < 0
                ? `+${Math.abs(weapon.damage)} HP`
                : '0'}
            </strong>
          </div>

          {/* Energy */}
          <div className="bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">能量抽离/充能</span>
            <strong
              className={
                weapon.energyDrain > 0
                  ? 'text-amber-400'
                  : weapon.energyDrain < 0
                  ? 'text-cyan-400'
                  : 'text-zinc-500'
              }
            >
              {weapon.energyDrain > 0
                ? `-${weapon.energyDrain}%`
                : weapon.energyDrain < 0
                ? `+${Math.abs(weapon.energyDrain)}%`
                : '0%'}
            </strong>
          </div>

          {/* Morale */}
          <div className="bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">精神意志打击</span>
            <strong
              className={
                weapon.moraleDamage > 0
                  ? 'text-purple-400'
                  : weapon.moraleDamage < 0
                  ? 'text-indigo-400'
                  : 'text-zinc-500'
              }
            >
              {weapon.moraleDamage > 0
                ? `-${weapon.moraleDamage}`
                : weapon.moraleDamage < 0
                ? `+${Math.abs(weapon.moraleDamage)}`
                : '0'}
            </strong>
          </div>

          {/* Shame */}
          <div className="bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">羞耻心理破绽</span>
            <strong
              className={
                weapon.shameIncrease > 0
                  ? 'text-fuchsia-400'
                  : weapon.shameIncrease < 0
                  ? 'text-amber-400'
                  : 'text-zinc-500'
              }
            >
              {weapon.shameIncrease > 0
                ? `+${weapon.shameIncrease}`
                : weapon.shameIncrease < 0
                ? `-${Math.abs(weapon.shameIncrease)}`
                : '0'}
            </strong>
          </div>

          {/* Obedience */}
          <div className="bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">顺从信任提升</span>
            <strong
              className={
                weapon.obedienceGain > 0
                  ? 'text-blue-400'
                  : weapon.obedienceGain < 0
                  ? 'text-rose-400'
                  : 'text-zinc-500'
              }
            >
              {weapon.obedienceGain > 0
                ? `+${weapon.obedienceGain}`
                : weapon.obedienceGain < 0
                ? `-${Math.abs(weapon.obedienceGain)}`
                : '0'}
            </strong>
          </div>

          {/* Lust */}
          <div className="bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">欲望敏感刺激</span>
            <strong
              className={
                (weapon.lustChange ?? 5) > 0
                  ? 'text-pink-400'
                  : (weapon.lustChange ?? 5) < 0
                  ? 'text-amber-400'
                  : 'text-zinc-500'
              }
            >
              {(weapon.lustChange ?? 5) > 0
                ? `+${weapon.lustChange ?? 5}`
                : (weapon.lustChange ?? 5) < 0
                ? `${weapon.lustChange ?? 5}`
                : '0'}
            </strong>
          </div>
        </div>

        {/* Active Multiplier Real Calc */}
        <div className="bg-blue-950/40 p-2 rounded-lg border border-blue-500/40 flex items-center justify-between text-[11px]">
          <span className="text-blue-200">
            预估单次实算 (×{totalMultiplier.toFixed(2)}):
          </span>
          <strong
            className={
              realDmg > 0
                ? 'text-rose-400 font-bold'
                : realDmg < 0
                ? 'text-emerald-400 font-bold'
                : 'text-zinc-400'
            }
          >
            {realDmg > 0 ? `-${realDmg} HP 伤害` : realDmg < 0 ? `+${Math.abs(realDmg)} HP 恢复` : '0 HP'}
          </strong>
        </div>
      </div>

      <div className="text-[9px] text-zinc-500 text-center pt-0.5 border-t border-zinc-800/80">
        {isSelected ? '🎯 已装配为当前打入手段' : '👉 点击卡片即可快速装配并切换'}
      </div>
    </div>
  );
};

// ==========================================
// Rich Body Part Status Tooltip Card Component
// ==========================================
interface BodyPartTooltipCardProps {
  partId: BodyPartId;
  config: BodyPartConfig;
  hero: Ultrawoman;
  damagePercent?: number;
  exposurePercent?: number;
  isSelected?: boolean;
}

export const BodyPartTooltipCard: React.FC<BodyPartTooltipCardProps> = ({
  partId,
  config,
  hero,
  damagePercent = 0,
  exposurePercent = 0,
  isSelected = false,
}) => {
  const isWeak = hero.weakPart === partId;
  const isSensitive = hero.sensitivePart === partId;
  const multiplier = config.weaknessMultiplier || 1.0;

  // Damage severity status
  let dmgLevel = '完好无损 (0%)';
  let dmgLevelColor = 'text-emerald-400';
  if (damagePercent >= 80) {
    dmgLevel = '核心破碎·严重破损 (80%+)';
    dmgLevelColor = 'text-rose-500 animate-pulse font-black';
  } else if (damagePercent >= 50) {
    dmgLevel = '深度创伤·装甲剥落 (50%+)';
    dmgLevelColor = 'text-orange-400 font-bold';
  } else if (damagePercent >= 20) {
    dmgLevel = '中度受损·破甲撕裂 (20%+)';
    dmgLevelColor = 'text-amber-400';
  } else if (damagePercent > 0) {
    dmgLevel = '轻微擦伤·表层损伤';
    dmgLevelColor = 'text-yellow-300';
  }

  return (
    <div className="w-80 bg-zinc-950/95 backdrop-blur-md rounded-xl border border-rose-500/70 p-3.5 text-zinc-100 shadow-[0_0_25px_rgba(244,63,94,0.4)] text-left font-mono space-y-2.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-2">
        <div className="flex flex-col">
          <div className="flex items-center space-x-1.5">
            <Target className="w-4 h-4 text-rose-400 animate-pulse shrink-0" />
            <span className="font-bold text-sm text-rose-300 font-sans">{config.name}</span>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono mt-0.5">
            解剖代号: <strong className="text-zinc-300">{partId}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1 justify-end">
          {isWeak && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/80 font-bold animate-pulse">
              ★ 致命弱点
            </span>
          )}
          {isSensitive && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-500/80 font-bold">
              ♥ 发情敏感区
            </span>
          )}
          {isSelected && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/80 font-bold">
              🎯 当前锁定目标
            </span>
          )}
        </div>
      </div>

      {/* Part Anatomy Description */}
      <div className="bg-zinc-900/90 p-2 rounded-lg border border-zinc-800 text-xs text-zinc-200 leading-relaxed font-sans">
        <p className="text-[11px] text-zinc-300">
          <strong className="text-rose-300 font-mono">🩺 解剖结构: </strong>
          {config.description || '该部位重要生理与机能构成区域。'}
        </p>
      </div>

      {/* Damage & Multiplier Metrics */}
      <div className="space-y-1.5 font-mono text-[11px]">
        <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">部位破损状态:</span>
            <span className={dmgLevelColor}>{dmgLevel}</span>
          </div>

          {/* Damage progress bar */}
          <div className="w-full bg-zinc-950 rounded h-1.5 overflow-hidden border border-zinc-800">
            <div
              className="bg-gradient-to-r from-rose-500 to-red-600 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, damagePercent)}%` }}
            />
          </div>
        </div>

        <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">生理变化 / 异化程度:</span>
            <span className="text-purple-300 font-bold">{Math.round(exposurePercent)}%</span>
          </div>

          {/* Exposure progress bar */}
          <div className="w-full bg-zinc-950 rounded h-1.5 overflow-hidden border border-zinc-800">
            <div
              className="bg-gradient-to-r from-purple-500 to-fuchsia-500 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, exposurePercent)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div className="bg-zinc-900/90 p-1.5 rounded border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">部位防御倍率</span>
            <strong className="text-amber-400 font-bold">{multiplier}x</strong>
          </div>
          <div className="bg-zinc-900/90 p-1.5 rounded border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">弱点额外乘区</span>
            <strong className={isWeak ? 'text-rose-400 font-bold' : 'text-zinc-500'}>
              {isWeak ? '生效 (高倍率)' : '无'}
            </strong>
          </div>
        </div>
      </div>

      <div className="text-[9px] text-zinc-500 text-center pt-0.5 border-t border-zinc-800/80">
        {isSelected ? '🎯 武器已瞄准此处打击' : '👉 点击即可将本次手段打击目标锁定在此'}
      </div>
    </div>
  );
};
