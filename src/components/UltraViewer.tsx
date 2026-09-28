import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Ultrawoman, BodyPartId, Stats, AlienWeapon, EnvironmentTheme } from '../types';
import {
  Crosshair,
  Sliders,
  Activity,
  X,
  ShieldAlert,
  Sun,
  Flame,
  Sparkles,
  User,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  Film,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Link as LinkIcon,
  Layout,
  Trash2,
  Upload,
  Layers,
  Heart,
  Eye,
  Loader2,
  Wifi,
  CheckCircle2,
} from 'lucide-react';
import { ultraAudio } from '../utils/audio';
import { resizeImageFile } from '../utils/imageUtils';
import { getMediaType, readMediaFile } from '../utils/mediaUtils';
import { PortraitMediaDisplay } from './PortraitMediaDisplay';

export type LightType =
  | 'standard'        // 标准实验室白光 (无增益/无伤害)
  | 'spotlight'       // 上方高能焦点追踪光 (视角照明)
  | 'gamma'           // ☢️ 伽马电离辐射束 (有害: -1.5 HP/天, -1.0 士气/天)
  | 'plasma_storm'    // ⚡ 高压等离子雷暴光 (有害: -2.5% 能量/天, -1.0 HP/天)
  | 'void_drain'      // 🔮 虚空暗影噬能光 (有害: -3.5% 能量/天, +1.5 服从/天)
  | 'thermal_laser'   // 🔥 极温红外热灼光 (有害: -2.0 HP/天, +1.2 羞耻/天)
  | 'solar_heal'      // ☀️ 恒星太阳圣光 (有益: +2.5 HP/天, +2.0% 能量/天, +1.0 士气/天)
  | 'ultra_recharge'  // ✨ 高纯能量充能束 (有益: +5.0% 能量/天, +2.0 士气/天)
  | 'bio_sooth';      // 🌿 生体赫尔兹舒缓光 (有益: +1.5 HP/天, -3.0 羞耻/天, -2.0 服从/天)

export const LIGHT_TYPES_CONFIG: Record<LightType, {
  name: string;
  category: 'neutral' | 'harmful' | 'beneficial';
  icon: string;
  colorHex: number;
  colorCss: string;
  description: string;
  effectSummary: string;
}> = {
  standard: {
    name: '标准冷白光',
    category: 'neutral',
    icon: '💡',
    colorHex: 0xffffff,
    colorCss: '#ffffff',
    description: '收容胶囊标准的冷白光照，提供清晰的视觉呈现。',
    effectSummary: '安全：视角常态照明',
  },
  spotlight: {
    name: '高空聚焦灯',
    category: 'neutral',
    icon: '🔦',
    colorHex: 0xe0f2fe,
    colorCss: '#e0f2fe',
    description: '集中照射头部与上身的高强度聚集光束。',
    effectSummary: '安全：高光特写打光',
  },
  gamma: {
    name: '伽马电离辐射光',
    category: 'harmful',
    icon: '☢️',
    colorHex: 0x22c55e,
    colorCss: '#22c55e',
    description: '高能伽马电离射线穿透战甲，引发放射性肉体损伤与绝望沉沦。',
    effectSummary: '有害：-1.5 HP/天 | -1.0 士气/天',
  },
  plasma_storm: {
    name: '等离子雷暴光',
    category: 'harmful',
    icon: '⚡',
    colorHex: 0xeab308,
    colorCss: '#eab308',
    description: '高频交变等离子闪烁电场，剧烈过载抽离魔能值。',
    effectSummary: '有害：-2.5% 魔能/天 | -1.0 HP/天',
  },
  void_drain: {
    name: '虚空暗影噬能光',
    category: 'harmful',
    icon: '🔮',
    colorHex: 0xa855f7,
    colorCss: '#a855f7',
    description: '暗物质汲取波束直接抽干高能粒子，摧毁反抗意志并催化臣服。',
    effectSummary: '有害：-3.5% 光能/天 | +1.5 信任/天',
  },
  thermal_laser: {
    name: '红外极温热灼光',
    category: 'harmful',
    icon: '🔥',
    colorHex: 0xf43f5e,
    colorCss: '#f43f5e',
    description: '极高热能光束直接炙烤战甲皮肤，造成灼痛创伤与强烈羞耻。',
    effectSummary: '有害：-2.0 HP/天 | +1.2 羞耻/天',
  },
  solar_heal: {
    name: '恒星太阳耀阳光',
    category: 'beneficial',
    icon: '☀️',
    colorHex: 0xfcb316,
    colorCss: '#fcb316',
    description: '模拟恒星太阳耀斑正能量，滋养修复受创身躯与重振士气。',
    effectSummary: '有益：+2.5 HP/天 | +2% 光能/天 | +1 士气/天',
  },
  ultra_recharge: {
    name: '高纯充能高光',
    category: 'beneficial',
    icon: '✨',
    colorHex: 0x38bdf8,
    colorCss: '#38bdf8',
    description: '注入高纯度等离光能粒子，急速唤醒超人力量。',
    effectSummary: '有益：+5% 光能/天 | +2 士气/天',
  },
  bio_sooth: {
    name: '生体赫尔兹舒缓光',
    category: 'beneficial',
    icon: '🌿',
    colorHex: 0x4ade80,
    colorCss: '#4ade80',
    description: '发射温和生物舒缓波长，安抚受创神经并抑制羞耻臣服。',
    effectSummary: '有益：+1.5 HP/天 | -3 羞耻/天 | -2 信任/天',
  },
};

export interface CustomLightSource {
  id: string;
  name: string;
  type: LightType;
  colorHex: number;
  intensity: number;
  enabled: boolean;
}

export interface UltraViewerProps {
  hero: Ultrawoman;
  onUpdateHero?: (updated: Ultrawoman) => void;
  stats: Stats;
  partDamage?: Record<BodyPartId, number>;
  partExposure?: Record<BodyPartId, number>;
  selectedPart?: BodyPartId;
  onSelectPart?: (part: BodyPartId) => void;
  onDirectHit?: (part: BodyPartId) => void;
  activeWeapon?: AlienWeapon;
  lastHitPart?: BodyPartId | null;
  hitTimestamp?: number;
  shakeForce?: number;
  isContinuousFiring?: boolean;
  isRecharging?: boolean;
  onApplyLightEffect?: (effect: {
    hpDelta?: number;
    energyDelta?: number;
    moraleDelta?: number;
    shameDelta?: number;
    obedienceDelta?: number;
  }) => void;
  envTheme?: EnvironmentTheme | string;
  onEnvThemeChange?: (theme: EnvironmentTheme | string) => void;
  onEnvDamageRateChange?: (extraDailyHpDamage: number, extraDailyMoraleDamage: number) => void;
  onLightDailyEffectsChange?: (effects: {
    hpDelta: number;
    energyDelta: number;
    moraleDelta: number;
    obedienceDelta: number;
    shameDelta: number;
    descriptions: string[];
  }) => void;
  videoStreamCache?: Record<string, string>;
  activeTeamIds?: string[];
  teamHeroines?: Ultrawoman[];
}

export const UltraViewer: React.FC<UltraViewerProps> = ({
  hero,
  onUpdateHero,
  stats,
  partDamage = {} as Record<BodyPartId, number>,
  partExposure = {} as Record<BodyPartId, number>,
  selectedPart,
  onSelectPart,
  onDirectHit,
  activeWeapon,
  lastHitPart,
  hitTimestamp,
  shakeForce = 1.0,
  isContinuousFiring = false,
  isRecharging = false,
  onApplyLightEffect,
  envTheme: propEnvTheme,
  onEnvThemeChange,
  onEnvDamageRateChange,
  onLightDailyEffectsChange,
  videoStreamCache,
  activeTeamIds,
  teamHeroines,
}) => {
  // Persistent video/media track redirection & fallback cache
  const resolvedMediaSrc = useMemo(() => {
    // 1. Direct customPortrait on current hero
    if (hero.customPortrait) return hero.customPortrait;
    // 2. Video stream cache for current hero
    if (videoStreamCache && videoStreamCache[hero.id]) return videoStreamCache[hero.id];
    // 3. Synchronous Session & Local storage fast cache for current hero
    try {
      const sess = sessionStorage.getItem(`ultra_video_track_${hero.id}`);
      if (sess) return sess;
      const local = localStorage.getItem(`ultra_video_track_${hero.id}`);
      if (local) return local;
    } catch (e) {}
    // 4. Team heroine persistent fallback if present in active team
    if (teamHeroines && Array.isArray(teamHeroines)) {
      const teamMatch = teamHeroines.find((h) => h.id === hero.id);
      if (teamMatch?.customPortrait) return teamMatch.customPortrait;
    }
    return undefined;
  }, [hero.customPortrait, hero.id, videoStreamCache, teamHeroines]);

  // Video track preloading & storage persistence effect
  useEffect(() => {
    if (resolvedMediaSrc) {
      try {
        sessionStorage.setItem(`ultra_video_track_${hero.id}`, resolvedMediaSrc);
        localStorage.setItem(`ultra_video_track_${hero.id}`, resolvedMediaSrc);
        // Preload video stream buffer in background for smooth instant playback
        if (getMediaType(resolvedMediaSrc) === 'video') {
          const v = document.createElement('video');
          v.src = resolvedMediaSrc;
          v.preload = 'auto';
          v.muted = true;
          v.playsInline = true;
          v.load();
        }
      } catch (e) {}
    }
  }, [resolvedMediaSrc, hero.id]);

  // Preload video tracks for all team members in the background
  useEffect(() => {
    if (activeTeamIds && videoStreamCache) {
      activeTeamIds.forEach((tId) => {
        const trackUrl = videoStreamCache[tId] || (teamHeroines?.find((h) => h.id === tId)?.customPortrait);
        if (trackUrl && getMediaType(trackUrl) === 'video') {
          try {
            const v = document.createElement('video');
            v.src = trackUrl;
            v.preload = 'auto';
            v.muted = true;
            v.playsInline = true;
            v.load();
          } catch (e) {}
        }
      });
    }
  }, [activeTeamIds, videoStreamCache, teamHeroines]);

  // 2D Portrait / GIF / Video Showcase Slot Display & Adjustment Controls
  const [portraitFitMode, setPortraitFitMode] = useState<'contain' | 'cover' | 'fill' | 'scale-down'>('contain');
  const [portraitAspectRatio, setPortraitAspectRatio] = useState<'auto' | '3/4' | '9/16' | '16/9' | '21/9' | '1/1'>('auto');
  const [portraitZoom, setPortraitZoom] = useState<number>(100);
  const [isPortraitLightboxOpen, setIsPortraitLightboxOpen] = useState<boolean>(false);
  const [portraitIsMuted, setPortraitIsMuted] = useState<boolean>(true);
  const [portraitVolume, setPortraitVolume] = useState<number>(0.8);
  const [portraitIsPlaying, setPortraitIsPlaying] = useState<boolean>(true);
  const [portraitPlaybackRate, setPortraitPlaybackRate] = useState<number>(1.0);
  const [isPortraitUrlInputOpen, setIsPortraitUrlInputOpen] = useState<boolean>(false);
  const [portraitNetworkUrlInput, setPortraitNetworkUrlInput] = useState<string>('');
  const [isMediaStageLoading, setIsMediaStageLoading] = useState<boolean>(false);

  // Environmental & Container Settings State
  const [envTheme, setEnvTheme] = useState<EnvironmentTheme | string>(propEnvTheme || 'glass');
  const [showEnvSettings, setShowEnvSettings] = useState(false);
  const [envTab, setEnvTab] = useState<'liquid' | 'light'>('liquid');
  const [turbidity, setTurbidity] = useState<number>(30); // 浊度 0 - 100%
  const [viscosity, setViscosity] = useState<number>(50); // 介质阻尼 0 - 100%

  // Multi-Light Source Controls State
  const [customLights, setCustomLights] = useState<CustomLightSource[]>([
    {
      id: 'light_main',
      name: '顶部聚光灯',
      type: 'spotlight',
      colorHex: 0xe0f2fe,
      intensity: 1.8,
      enabled: true,
    },
    {
      id: 'light_ambient',
      name: '胶囊舱环绕常态光',
      type: 'standard',
      colorHex: 0xffffff,
      intensity: 1.2,
      enabled: true,
    },
  ]);

  const [activeLightId, setActiveLightId] = useState<string>('light_main');

  // Synchronize envTheme if updated from outside
  useEffect(() => {
    if (propEnvTheme && propEnvTheme !== envTheme) {
      setEnvTheme(propEnvTheme);
    }
  }, [propEnvTheme]);

  // Apply Environmental & Lighting daily stats
  useEffect(() => {
    let extraHpDamage = 0;
    let extraMoraleDamage = 0;

    if (envTheme === 'acid') {
      extraHpDamage += 2.0;
      extraMoraleDamage += 1.0;
    } else if (envTheme === 'lava') {
      extraHpDamage += 2.5;
      extraMoraleDamage += 1.5;
    } else if (envTheme === 'cryo') {
      extraHpDamage += 1.0;
      extraMoraleDamage += 2.0;
    } else if (envTheme === 'plasma') {
      extraHpDamage += 1.5;
      extraMoraleDamage += 1.5;
    } else if (envTheme === 'void') {
      extraHpDamage += 1.0;
      extraMoraleDamage += 3.0;
    }

    if (onEnvDamageRateChange) {
      onEnvDamageRateChange(extraHpDamage, extraMoraleDamage);
    }

    // Light daily effects
    let lightHp = 0;
    let lightEnergy = 0;
    let lightMorale = 0;
    let lightObedience = 0;
    let lightShame = 0;

    const lightDescriptions: string[] = [];

    customLights.forEach((light) => {
      if (!light.enabled) return;
      const ratio = light.intensity / 2.0;
      const cfg = LIGHT_TYPES_CONFIG[light.type];
      if (cfg && cfg.effectSummary) {
        lightDescriptions.push(`${cfg.name}(${cfg.effectSummary})`);
      }
      switch (light.type) {
        case 'gamma':
          lightHp -= 1.5 * ratio;
          lightMorale -= 1.0 * ratio;
          break;
        case 'plasma_storm':
          lightEnergy -= 2.5 * ratio;
          lightHp -= 1.0 * ratio;
          break;
        case 'void_drain':
          lightEnergy -= 3.5 * ratio;
          lightObedience += 1.5 * ratio;
          break;
        case 'thermal_laser':
          lightHp -= 2.0 * ratio;
          lightShame += 1.2 * ratio;
          break;
        case 'solar_heal':
          lightHp += 2.5 * ratio;
          lightEnergy += 2.0 * ratio;
          lightMorale += 1.0 * ratio;
          break;
        case 'ultra_recharge':
          lightEnergy += 5.0 * ratio;
          lightMorale += 2.0 * ratio;
          break;
        case 'bio_sooth':
          lightHp += 1.5 * ratio;
          lightShame -= 3.0 * ratio;
          lightObedience -= 2.0 * ratio;
          break;
      }
    });

    if (onLightDailyEffectsChange) {
      onLightDailyEffectsChange({
        hpDelta: lightHp,
        energyDelta: lightEnergy,
        moraleDelta: lightMorale,
        obedienceDelta: lightObedience,
        shameDelta: lightShame,
        descriptions: lightDescriptions,
      });
    }
  }, [envTheme, customLights, onEnvDamageRateChange, onLightDailyEffectsChange]);

  // Hit vibration effect on 2D stage
  const [isHitVibrating, setIsHitVibrating] = useState<boolean>(false);
  useEffect(() => {
    if (hitTimestamp && hitTimestamp > 0) {
      setIsHitVibrating(true);
      const timer = setTimeout(() => setIsHitVibrating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [hitTimestamp]);

  // Body Posture evaluation based on stats
  let postureLabel = '战意昂扬 (Ready)';
  let postureBadgeClass = 'bg-emerald-950 text-emerald-300 border-emerald-500';

  if (stats.hp <= 0 || stats.morale <= 10) {
    postureLabel = '完全瘫软昏厥 (Defeated)';
    postureBadgeClass = 'bg-rose-950 text-rose-300 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]';
  } else if (stats.hp < 25 || stats.energy < 20) {
    postureLabel = '虚弱跪地 (Exhausted)';
    postureBadgeClass = 'bg-amber-950 text-amber-300 border-amber-500';
  } else if (stats.shame > 70 || stats.obedience > 70) {
    postureLabel = '羞怯动摇 (Yielding)';
    postureBadgeClass = 'bg-fuchsia-950 text-fuchsia-300 border-fuchsia-500';
  } else if (stats.hp < 60) {
    postureLabel = '戒备防御 (Defensive)';
    postureBadgeClass = 'bg-blue-950 text-blue-300 border-blue-500';
  }

  return (
    <div
      className={`relative w-full min-h-[600px] lg:min-h-[740px] rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-between p-3.5 shadow-2xl font-mono select-none overflow-hidden transition-transform duration-75 ${
        isHitVibrating ? 'scale-[0.99] translate-y-0.5' : ''
      }`}
    >
      {/* Background Subtle Tech Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:12px_12px] opacity-20 pointer-events-none" />

      {/* Top Header Controls */}
      <div className="w-full flex flex-wrap items-center justify-between z-10 px-1 border-b border-zinc-900 pb-2 gap-2">
        <div className="flex items-center space-x-2">
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${postureBadgeClass}`}>
            {postureLabel}
          </span>
          <span className="text-xs text-zinc-400 font-bold hidden sm:inline">
            【角色立绘】
          </span>
        </div>

        {/* Character Title Badge */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded bg-zinc-900 border border-blue-500/40 text-xs text-blue-300 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>{hero.name}</span>
            <span className="text-zinc-500 font-normal">|</span>
            <span className="text-zinc-400 text-[11px] font-normal">{hero.title}</span>
          </div>
        </div>
      </div>

      {/* Sub-Header: Containment Status Bar & Environment/Light Settings Toggle */}
      <div className="w-full flex items-center justify-between z-10 px-2 py-1.5 border-b border-zinc-900 bg-zinc-950/90 text-[11px] gap-2">
        <div className="flex items-center space-x-1.5 overflow-x-auto text-zinc-400 font-bold scrollbar-none">
          <Activity className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="text-sky-300 shrink-0">试验舱环境:</span>
          <span
            className={`px-2 py-0.5 rounded border text-[10px] shrink-0 ${
              envTheme === 'acid'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                : envTheme === 'metal'
                ? 'bg-rose-950 text-rose-300 border-rose-600'
                : envTheme === 'lava'
                ? 'bg-amber-950 text-amber-300 border-amber-600'
                : envTheme === 'cryo'
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                : envTheme === 'plasma'
                ? 'bg-purple-950 text-purple-300 border-purple-500'
                : envTheme === 'void'
                ? 'bg-indigo-950 text-indigo-300 border-indigo-500'
                : 'bg-zinc-800 text-zinc-200 border-zinc-700'
            }`}
          >
            {envTheme === 'acid'
              ? '☣️ 腐蚀酸液'
              : envTheme === 'metal'
              ? '🏭 重金属牢笼'
              : envTheme === 'lava'
              ? '🔥 熔岩高温'
              : envTheme === 'cryo'
              ? '❄️ 零下极寒'
              : envTheme === 'plasma'
              ? '⚡ 等离子雷暴'
              : envTheme === 'void'
              ? '🔮 虚空暗影'
              : '🧪 高透防爆玻璃'}
          </span>
        </div>

        <button
          onClick={() => {
            ultraAudio.playUiClick();
            setShowEnvSettings((prev) => !prev);
          }}
          className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition-all flex items-center space-x-1 cursor-pointer ${
            showEnvSettings
              ? 'bg-amber-950 text-amber-200 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
              : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white'
          }`}
          title="点击展开收容罐物理介质、浊度与环境光源模拟设置面板"
        >
          <Sliders className="w-3 h-3 text-amber-400" />
          <span>环境介质与光照调节</span>
        </button>
      </div>

      {/* Main 2D Stage Canvas Area */}
      <div className="relative w-full flex-1 flex flex-col items-center justify-center my-2 overflow-hidden rounded-xl border border-zinc-800/80 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 p-2 sm:p-4">
        {/* Environment Theme Atmosphere Overlays */}
        {envTheme === 'acid' && (
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-40 animate-pulse"
            style={{
              background: `radial-gradient(circle at 50% 80%, rgba(34,197,94,${0.3 + (turbidity / 100) * 0.4}) 0%, rgba(20,83,45,0.2) 70%, transparent 100%)`,
              boxShadow: 'inset 0 0 50px rgba(34,197,94,0.4)',
            }}
          />
        )}
        {envTheme === 'lava' && (
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-40 animate-pulse"
            style={{
              background: `radial-gradient(circle at 50% 90%, rgba(245,158,11,${0.35 + (turbidity / 100) * 0.3}) 0%, rgba(180,83,9,0.2) 60%, transparent 100%)`,
              boxShadow: 'inset 0 0 60px rgba(245,158,11,0.5)',
            }}
          />
        )}
        {envTheme === 'cryo' && (
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-40"
            style={{
              background: `radial-gradient(circle at 50% 10%, rgba(186,230,253,0.3) 0%, transparent 80%)`,
              boxShadow: 'inset 0 0 50px rgba(6,182,212,0.4)',
            }}
          />
        )}
        {envTheme === 'plasma' && (
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-40 animate-pulse"
            style={{
              background: `radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.3) 0%, transparent 80%)`,
              boxShadow: 'inset 0 0 50px rgba(168,85,247,0.4)',
            }}
          />
        )}
        {envTheme === 'void' && (
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-50"
            style={{
              background: `radial-gradient(ellipse at 50% 50%, rgba(30,27,75,0.6) 0%, rgba(3,7,18,0.8) 80%, transparent 100%)`,
              boxShadow: 'inset 0 0 60px rgba(99,102,241,0.4)',
            }}
          />
        )}
        {envTheme === 'metal' && (
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-30"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, transparent 2px, transparent 12px)',
              boxShadow: 'inset 0 0 60px rgba(0,0,0,0.85)',
            }}
          />
        )}

        {/* 2D Media Stage Toolbar */}
        <div className="w-full flex flex-wrap items-center justify-between gap-1.5 z-20 bg-zinc-900/90 p-2 rounded-xl border border-zinc-800 shadow-md backdrop-blur-md mb-2">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-amber-300 text-xs">2D / GIF / 视频立绘展示</span>
            {resolvedMediaSrc && (
              <div className="hidden sm:flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 shadow-inner">
                {isMediaStageLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                    <span>视频流重载与缓冲中...</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span className="text-emerald-300 font-bold">流缓冲已就绪</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {resolvedMediaSrc && (
              <>
                {/* Aspect Ratio */}
                <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[10px]">
                  <span className="text-[10px] text-zinc-500 px-1 font-bold flex items-center">
                    <Layout className="w-2.5 h-2.5 mr-0.5" /> 画幅:
                  </span>
                  {[
                    { id: 'auto', label: '自适应' },
                    { id: '3/4', label: '3:4 竖屏' },
                    { id: '9/16', label: '9:16' },
                    { id: '16/9', label: '16:9' },
                    { id: '1/1', label: '1:1' },
                  ].map((ratio) => (
                    <button
                      key={ratio.id}
                      onClick={() => setPortraitAspectRatio(ratio.id as any)}
                      className={`px-1.5 py-0.5 rounded transition-colors ${
                        portraitAspectRatio === ratio.id ? 'bg-indigo-900 text-indigo-200 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>

                {/* Fit Modes */}
                <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[10px]">
                  {[
                    { id: 'contain', label: '适应' },
                    { id: 'cover', label: '填充' },
                    { id: 'scale-down', label: '原始' },
                  ].map((fit) => (
                    <button
                      key={fit.id}
                      onClick={() => setPortraitFitMode(fit.id as any)}
                      className={`px-1.5 py-0.5 rounded transition-colors ${
                        portraitFitMode === fit.id ? 'bg-purple-900 text-purple-200 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {fit.label}
                    </button>
                  ))}
                </div>

                {/* Zoom */}
                <div className="flex items-center space-x-1 bg-zinc-950 px-1.5 py-0.5 rounded-lg border border-zinc-800 text-[10px]">
                  <button
                    onClick={() => setPortraitZoom((z) => Math.max(50, z - 25))}
                    className="p-0.5 hover:text-purple-300 text-zinc-400"
                    title="缩小"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <span className="font-mono text-purple-300 w-7 text-center">{portraitZoom}%</span>
                  <button
                    onClick={() => setPortraitZoom((z) => Math.min(250, z + 25))}
                    className="p-0.5 hover:text-purple-300 text-zinc-400"
                    title="放大"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>

                {/* Fullscreen Lightbox Button */}
                <button
                  onClick={() => setIsPortraitLightboxOpen(true)}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold flex items-center space-x-1"
                  title="全屏放大大屏观赏"
                >
                  <Maximize2 className="w-3 h-3 text-cyan-400" />
                  <span>全屏</span>
                </button>

                {/* Clear Portrait Button */}
                <button
                  onClick={() => {
                    try {
                      sessionStorage.removeItem(`ultra_video_track_${hero.id}`);
                      localStorage.removeItem(`ultra_video_track_${hero.id}`);
                    } catch (e) {}
                    if (onUpdateHero) {
                      onUpdateHero({ ...hero, customPortrait: undefined });
                    }
                  }}
                  className="px-1.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 font-bold flex items-center space-x-1"
                  title="清除自定义立绘/视频"
                >
                  <Trash2 className="w-3 h-3 text-rose-400" />
                </button>
              </>
            )}

            {/* Network URL input button */}
            <button
              onClick={() => setIsPortraitUrlInputOpen(!isPortraitUrlInputOpen)}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border border-cyan-800 font-bold flex items-center space-x-1 transition-all"
              title="填入网络 GIF / 视频 / 图片 URL"
            >
              <LinkIcon className="w-3 h-3 text-cyan-400" />
              <span>网络URL</span>
            </button>

            {/* Local File Upload Button */}
            <label className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-800 via-indigo-800 to-blue-800 hover:from-purple-700 hover:to-blue-700 text-purple-100 border border-purple-500/80 font-bold cursor-pointer flex items-center space-x-1 shadow-md transition-all">
              <Upload className="w-3 h-3 text-purple-200" />
              <span>{resolvedMediaSrc ? '更换立绘/视频' : '上传立绘/GIF/视频'}</span>
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && onUpdateHero) {
                    try {
                      const res = await readMediaFile(file, 'portraits', hero.id);
                      const mediaPath = res.localUrl || res.dataUrl;
                      onUpdateHero({
                        ...hero,
                        customPortrait: mediaPath,
                      });
                    } catch (err) {
                      console.error('Failed to process custom media portrait:', err);
                    }
                  }
                }}
              />
            </label>
          </div>
        </div>

        {/* Quick URL Input Popover Bar */}
        {isPortraitUrlInputOpen && (
          <div className="w-full max-w-2xl bg-zinc-900/95 p-2 rounded-xl border border-cyan-500/50 flex items-center space-x-2 shadow-2xl backdrop-blur-md mb-2 z-20">
            <LinkIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <input
              type="text"
              placeholder="在此粘贴外部网络 GIF / MP4 视频 / 图片链接..."
              value={portraitNetworkUrlInput}
              onChange={(e) => setPortraitNetworkUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && portraitNetworkUrlInput.trim() && onUpdateHero) {
                  onUpdateHero({ ...hero, customPortrait: portraitNetworkUrlInput.trim() });
                  setIsPortraitUrlInputOpen(false);
                  setPortraitNetworkUrlInput('');
                }
              }}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={() => {
                if (portraitNetworkUrlInput.trim() && onUpdateHero) {
                  onUpdateHero({ ...hero, customPortrait: portraitNetworkUrlInput.trim() });
                  setIsPortraitUrlInputOpen(false);
                  setPortraitNetworkUrlInput('');
                }
              }}
              className="px-3 py-1 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-cyan-100 font-bold text-xs border border-cyan-500/60"
            >
              应用
            </button>
          </div>
        )}

        {/* Stage Container */}
        <div
          className={`relative w-full rounded-2xl border-2 overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.3)] flex flex-col items-center justify-between p-3 transition-all ${
            portraitAspectRatio === '3/4'
              ? 'max-w-md h-[560px]'
              : portraitAspectRatio === '9/16'
              ? 'max-w-sm h-[580px]'
              : portraitAspectRatio === '16/9'
              ? 'max-w-4xl h-[420px]'
              : portraitAspectRatio === '21/9'
              ? 'max-w-5xl h-[360px]'
              : portraitAspectRatio === '1/1'
              ? 'max-w-lg h-[480px]'
              : 'w-full h-[520px] sm:h-[600px]'
          }`}
          style={{
            borderColor: hero.colorTheme?.primary || '#3b82f6',
            background: `radial-gradient(circle at 50% 35%, ${hero.colorTheme?.primary}20 0%, rgba(9,9,11,0.98) 85%)`,
          }}
        >
          {resolvedMediaSrc ? (
            <div
              key={`${hero.id}_${resolvedMediaSrc}`}
              className="w-full h-full flex items-center justify-center overflow-hidden relative group transition-all duration-700 ease-out"
            >
              <PortraitMediaDisplay
                src={resolvedMediaSrc}
                alt={hero.name}
                fitMode={portraitFitMode}
                zoom={portraitZoom}
                isMuted={portraitIsMuted}
                volume={portraitVolume}
                isPlaying={portraitIsPlaying}
                playbackRate={portraitPlaybackRate}
                showMediaBadge={true}
                onLoadingChange={setIsMediaStageLoading}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center my-auto p-6 text-center space-y-4 relative w-full h-full">
              <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full border-2 border-blue-400/50 flex items-center justify-center bg-blue-950/40 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                {hero.avatarSvg ? (
                  <div
                    className="w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: hero.avatarSvg }}
                  />
                ) : (
                  <User className="w-24 h-24 text-blue-400 animate-pulse" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-widest">{hero.name}</h3>
                <p className="text-xs sm:text-sm text-blue-300 font-mono">{hero.title}</p>
              </div>
              <p className="text-xs text-zinc-400 max-w-md italic">"{hero.description}"</p>
            </div>
          )}

          {/* Bottom Floating Hero Meta Info Badge */}
          <div className="w-full z-10 bg-zinc-950/90 backdrop-blur-md p-2 rounded-xl border border-zinc-800/80 text-xs flex flex-wrap items-center justify-around gap-2 font-mono text-zinc-300 shadow-xl mt-2">
            <div>
              角色: <strong className="text-white font-bold">{hero.name}</strong>
            </div>
            <div>
              称号: <strong className="text-cyan-300">{hero.title}</strong>
            </div>
            <div>
              身高: <strong className="text-blue-300">{hero.height}</strong>
            </div>
            <div>
              体重: <strong className="text-blue-300">{hero.weight}</strong>
            </div>
            <div>
              出生地: <strong className="text-amber-300">{hero.homePlanet || 'M78星云'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Environmental & Light Source Control Panel Modal/Overlay */}
      {showEnvSettings && (
        <div className="w-full z-20 bg-zinc-900/95 border border-amber-500/40 p-3 flex flex-col space-y-2.5 font-mono text-xs shadow-2xl backdrop-blur-md rounded-b mt-2">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
            <div className="flex items-center space-x-3">
              <span className="font-bold text-amber-300 flex items-center space-x-1.5">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>收容罐环境与独立光源控制中心</span>
              </span>

              <div className="flex items-center space-x-1 bg-zinc-950 p-0.5 rounded border border-zinc-800">
                <button
                  onClick={() => setEnvTab('liquid')}
                  className={`px-2 py-0.5 text-[10px] rounded font-bold transition-all cursor-pointer ${
                    envTab === 'liquid'
                      ? 'bg-amber-950 text-amber-200 border border-amber-500'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  🧪 罐体介质与物理阻尼
                </button>
                <button
                  onClick={() => setEnvTab('light')}
                  className={`px-2 py-0.5 text-[10px] rounded font-bold transition-all cursor-pointer ${
                    envTab === 'light'
                      ? 'bg-amber-950 text-amber-200 border border-amber-500'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  💡 独立光源与有害/有益光照
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowEnvSettings(false)}
              className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* TAB 1: Liquid & Container Environment */}
          {envTab === 'liquid' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Jar Material Theme */}
              <div className="flex flex-col space-y-1 bg-zinc-950/80 p-2 rounded border border-zinc-800">
                <span className="text-[11px] text-zinc-300 font-bold">1. 罐体外观与介质材质</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {[
                    { id: 'glass', label: '🧪 透明玻璃' },
                    { id: 'metal', label: '🏭 冷金属' },
                    { id: 'acid', label: '☣️ 腐蚀绿液' },
                    { id: 'lava', label: '🔥 熔岩高温' },
                    { id: 'cryo', label: '❄️ 零下冰封' },
                    { id: 'plasma', label: '⚡ 等离子紫' },
                    { id: 'void', label: '🔮 虚空暗影' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setEnvTheme(item.id as any);
                        if (onEnvThemeChange) onEnvThemeChange(item.id);
                      }}
                      className={`px-1 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                        envTheme === item.id
                          ? 'bg-amber-950 text-amber-200 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Turbidity & Damping Sliders */}
              <div className="flex flex-col space-y-2 bg-zinc-950/80 p-2 rounded border border-zinc-800">
                <span className="text-[11px] text-zinc-300 font-bold">2. 介质环境浓度与粘稠度</span>
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>介质浊度 / 迷雾浓度:</span>
                    <span className="text-emerald-400 font-bold">{turbidity}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={turbidity}
                    onChange={(e) => setTurbidity(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>流体阻尼系数:</span>
                    <span className="text-cyan-400 font-bold">{viscosity}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={viscosity}
                    onChange={(e) => setViscosity(Number(e.target.value))}
                    className="w-full accent-cyan-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Status Summary */}
              <div className="flex flex-col space-y-1 bg-zinc-950/80 p-2 rounded border border-zinc-800 text-[11px]">
                <span className="text-zinc-300 font-bold">3. 介质持续结算影响</span>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  当前环境处于【
                  <strong className="text-amber-300">
                    {envTheme === 'acid'
                      ? '腐蚀绿液'
                      : envTheme === 'metal'
                      ? '冷金属牢笼'
                      : envTheme === 'lava'
                      ? '熔岩高温'
                      : envTheme === 'cryo'
                      ? '零下极寒'
                      : envTheme === 'plasma'
                      ? '等离子雷暴'
                      : envTheme === 'void'
                      ? '虚空暗影'
                      : '透明玻璃'}
                  </strong>
                  】状态，每日跨天将根据介质对收容角色施加对应的持续生理影响。
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Custom Lighting & Effects */}
          {envTab === 'light' && (
            <div className="flex flex-col space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {(Object.keys(LIGHT_TYPES_CONFIG) as LightType[]).map((typeKey) => {
                  const cfg = LIGHT_TYPES_CONFIG[typeKey];
                  const isEquipped = customLights.some((l) => l.type === typeKey && l.enabled);

                  return (
                    <div
                      key={typeKey}
                      className={`p-2 rounded-lg border flex flex-col justify-between space-y-1.5 transition-all ${
                        isEquipped
                          ? 'bg-zinc-900 border-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                          : 'bg-zinc-950/60 border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-200 flex items-center space-x-1">
                          <span>{cfg.icon}</span>
                          <span>{cfg.name}</span>
                        </span>
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                            cfg.category === 'harmful'
                              ? 'bg-rose-950 text-rose-300'
                              : cfg.category === 'beneficial'
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {cfg.category === 'harmful' ? '有害' : cfg.category === 'beneficial' ? '有益' : '中性'}
                        </span>
                      </div>

                      <p className="text-[10px] text-zinc-400 leading-tight">{cfg.description}</p>
                      <div className="text-[10px] text-amber-300 font-mono font-bold">{cfg.effectSummary}</div>

                      <button
                        onClick={() => {
                          ultraAudio.playUiClick();
                          setCustomLights((prev) => {
                            const exists = prev.find((l) => l.type === typeKey);
                            if (exists) {
                              return prev.map((l) => (l.type === typeKey ? { ...l, enabled: !l.enabled } : l));
                            } else {
                              return [
                                ...prev,
                                {
                                  id: `light_${Date.now()}`,
                                  name: cfg.name,
                                  type: typeKey,
                                  colorHex: cfg.colorHex,
                                  intensity: 1.5,
                                  enabled: true,
                                },
                              ];
                            }
                          });
                        }}
                        className={`w-full py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          isEquipped
                            ? 'bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-500'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        {isEquipped ? '关闭光束' : '启动照射'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {isPortraitLightboxOpen && resolvedMediaSrc && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-4 animate-fadeIn font-mono">
          <div className="w-full flex items-center justify-between z-10 px-4 py-2 border-b border-zinc-800">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>{hero.name} · 全屏巨幕立绘观赏</span>
            </div>
            <button
              onClick={() => setIsPortraitLightboxOpen(false)}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 w-full max-w-6xl flex items-center justify-center p-4 overflow-hidden">
            <PortraitMediaDisplay
              src={resolvedMediaSrc}
              alt={hero.name}
              fitMode="contain"
              zoom={100}
              isMuted={portraitIsMuted}
              volume={portraitVolume}
              isPlaying={portraitIsPlaying}
              playbackRate={portraitPlaybackRate}
              showMediaBadge={true}
            />
          </div>

          <div className="w-full flex items-center justify-center space-x-4 py-2 border-t border-zinc-800 text-xs text-zinc-400">
            <span>点击右上角关闭返回主界面</span>
          </div>
        </div>
      )}
    </div>
  );
};
