import React, { useState, useEffect } from 'react';
import { EnvironmentTheme, ENV_DAILY_EFFECTS, Ultrawoman, DayConfig, Stats, CustomEnvTheme, EnvPhysicalParams, getDefaultEnvParams } from '../types';
import { TestTube, Sliders, Calendar, Zap, Heart, ShieldAlert, Sparkles, Activity, Check, FastForward, Info, Flame, Eye, Droplets, RefreshCw, X, Plus, Trash2, Edit3, Settings2, Thermometer, Shield, Waves, Radio } from 'lucide-react';
import { ultraAudio } from '../utils/audio';

interface EnvironmentPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  envTheme: EnvironmentTheme | string;
  onSelectEnvTheme: (theme: EnvironmentTheme | string) => void;
  dayCount: number;
  onPassDay: () => void;
  selectedHero: Ultrawoman;
  dayConfig: DayConfig;
  stats: Stats;
  customEnvs: CustomEnvTheme[];
  onSaveCustomEnvs: (envs: CustomEnvTheme[]) => void;
  envParamOverrides: Record<string, EnvPhysicalParams>;
  onSaveEnvParamOverride: (themeKey: string, params: EnvPhysicalParams) => void;
}

const BUILTIN_THEME_KEYS: EnvironmentTheme[] = ['glass', 'metal', 'acid', 'lava', 'cryo', 'plasma', 'void', 'hypno', 'pure'];

const BUILTIN_THEME_ICONS: Record<string, string> = {
  glass: '🪟',
  metal: '⚡',
  acid: '🧪',
  lava: '🌋',
  cryo: '❄️',
  plasma: '⚡',
  void: '🌌',
  hypno: '🌀',
  pure: '✨',
  any: '🌐',
};

export const EnvironmentPanelModal: React.FC<EnvironmentPanelModalProps> = ({
  isOpen,
  onClose,
  envTheme,
  onSelectEnvTheme,
  dayCount,
  onPassDay,
  selectedHero,
  dayConfig,
  stats,
  customEnvs,
  onSaveCustomEnvs,
  envParamOverrides,
  onSaveEnvParamOverride,
}) => {
  const [activeTab, setActiveTab] = useState<'envs' | 'physics' | 'predict'>('envs');
  
  // Custom Env Creation / Edit state
  const [isCreatingEnv, setIsCreatingEnv] = useState<boolean>(false);
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);

  // Form states for custom env creation/editing
  const [formName, setFormName] = useState<string>('');
  const [formIcon, setFormIcon] = useState<string>('🧬');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formHp, setFormHp] = useState<number>(-5);
  const [formEnergy, setFormEnergy] = useState<number>(-5);
  const [formMorale, setFormMorale] = useState<number>(-3);
  const [formShame, setFormShame] = useState<number>(3);
  const [formObedience, setFormObedience] = useState<number>(2);
  const [formLust, setFormLust] = useState<number>(2);

  // Current active environment's physical parameters state
  const [localParams, setLocalParams] = useState<EnvPhysicalParams>(() => {
    return envParamOverrides[envTheme] || getDefaultEnvParams(envTheme);
  });

  // Sync localParams when envTheme or envParamOverrides change
  useEffect(() => {
    const currentOverride = envParamOverrides[envTheme];
    if (currentOverride) {
      setLocalParams(currentOverride);
    } else {
      // Find if it's a custom env
      const customMatch = customEnvs.find((c) => c.id === envTheme);
      if (customMatch && customMatch.params) {
        setLocalParams(customMatch.params);
      } else {
        setLocalParams(getDefaultEnvParams(envTheme));
      }
    }
  }, [envTheme, envParamOverrides, customEnvs]);

  // Determine active environment object (builtin or custom)
  const isCustomTheme = !BUILTIN_THEME_KEYS.includes(envTheme as any);
  const customThemeObj = customEnvs.find((c) => c.id === envTheme);

  const currentThemeName = isCustomTheme 
    ? (customThemeObj?.name || '自定义环境舱') 
    : (ENV_DAILY_EFFECTS[envTheme as EnvironmentTheme]?.name || '标准环境');

  const currentThemeIcon = isCustomTheme
    ? (customThemeObj?.icon || '⚙️')
    : (BUILTIN_THEME_ICONS[envTheme] || '🌐');

  const currentThemeDesc = isCustomTheme
    ? (customThemeObj?.description || '用户自建特化收容环境')
    : (ENV_DAILY_EFFECTS[envTheme as EnvironmentTheme]?.description || '');

  // Base daily changes before physical calculations
  const baseHp = isCustomTheme ? (customThemeObj?.hpChange ?? -5) : (ENV_DAILY_EFFECTS[envTheme as EnvironmentTheme]?.hpChange ?? -3);
  const baseEnergy = isCustomTheme ? (customThemeObj?.energyChange ?? -5) : (ENV_DAILY_EFFECTS[envTheme as EnvironmentTheme]?.energyChange ?? -5);
  const baseMorale = isCustomTheme ? (customThemeObj?.moraleChange ?? -3) : (ENV_DAILY_EFFECTS[envTheme as EnvironmentTheme]?.moraleChange ?? -1);
  const baseShame = isCustomTheme ? (customThemeObj?.shameChange ?? 3) : (ENV_DAILY_EFFECTS[envTheme as EnvironmentTheme]?.shameChange ?? 1);
  const baseObedience = isCustomTheme ? (customThemeObj?.obedienceChange ?? 2) : (ENV_DAILY_EFFECTS[envTheme as EnvironmentTheme]?.obedienceChange ?? 1);
  const baseLust = isCustomTheme ? (customThemeObj?.lustChange ?? 2) : (ENV_DAILY_EFFECTS[envTheme as EnvironmentTheme]?.lustChange ?? 0);

  // Calculate day scaling factor
  const scalingFactor = dayConfig.scalingFactor || 0.02;
  const dayMult = 1 + Math.max(0, dayCount - 1) * scalingFactor;

  // Physical parameter bonus calculation:
  // Extreme Temperature (< 0 or > 60°C adds HP/Energy drain)
  let tempHpDrain = 0;
  if (localParams.temperature > 100) tempHpDrain = -Math.min(15, (localParams.temperature - 100) * 0.02);
  else if (localParams.temperature < 0) tempHpDrain = -Math.min(10, Math.abs(localParams.temperature) * 0.03);

  // pH level bonus (pH < 4.0 or pH > 10.0 causes acid/alkali skin damage)
  let phHpDrain = 0;
  if (localParams.phLevel < 4.0) phHpDrain = -Math.min(12, (4.0 - localParams.phLevel) * 2.5);
  else if (localParams.phLevel > 10.0) phHpDrain = -Math.min(10, (localParams.phLevel - 10.0) * 2.0);

  // Voltage / Plasma (kV)
  const voltageHpDrain = -Math.min(15, (localParams.voltageKv / 1000) * 12);
  const voltageEnergyDrain = -Math.min(20, (localParams.voltageKv / 1000) * 15);

  // Anti-photon extraction
  const photonEnergyDrain = -Math.min(15, (localParams.antiPhotonRate / 100) * 12);

  // Hypnosis frequency Hz
  const hypnoMoraleDrain = -Math.min(15, (localParams.hypnosisHz / 500) * 12);
  const hypnoObedienceGain = Math.min(15, (localParams.hypnosisHz / 500) * 10);
  const hypnoLustGain = Math.min(12, (localParams.hypnosisHz / 500) * 8);

  // Net Daily Deltas
  const netHpChange = Math.round((
    (baseHp + tempHpDrain + phHpDrain + voltageHpDrain + (localParams.extraHpDrain || 0)) * dayMult
  ) * 10) / 10;

  const netEnergyChange = Math.round((
    (baseEnergy + voltageEnergyDrain + photonEnergyDrain + (localParams.extraEnergyDrain || 0)) * dayMult
  ) * 10) / 10;

  const netMoraleChange = Math.round((
    (baseMorale + hypnoMoraleDrain + (localParams.extraMoraleDrain || 0) + (dayConfig.dailyMoraleDrain || 0)) * dayMult
  ) * 10) / 10;

  const netShameChange = Math.round((
    (baseShame + (localParams.extraShameGain || 0) + (dayConfig.dailyShameGain || 0)) * dayMult
  ) * 10) / 10;

  const netObedienceChange = Math.round((
    (baseObedience + hypnoObedienceGain + (localParams.extraObedienceGain || 0) + (dayConfig.dailyObedienceGain || 0)) * dayMult
  ) * 10) / 10;

  const netLustChange = Math.round((
    (baseLust + hypnoLustGain + (localParams.extraLustGain || 0) + (dayConfig.dailyLustGain || 0)) * dayMult
  ) * 10) / 10;

  // Heroine active environment weaknesses matched to current theme
  const activeWeaknesses = (selectedHero.envWeaknesses || []).filter((ew) => ew.enabled);
  const matchedWeakness = activeWeaknesses.find(
    (ew) => ew.envTheme === 'any' || ew.envTheme === envTheme
  );

  const handleUpdateParamField = <K extends keyof EnvPhysicalParams>(key: K, value: number) => {
    const updated = { ...localParams, [key]: value };
    setLocalParams(updated);
    onSaveEnvParamOverride(envTheme, updated);
  };

  const handleResetToDefaultParams = () => {
    ultraAudio.playUiClick();
    const def = getDefaultEnvParams(envTheme);
    setLocalParams(def);
    onSaveEnvParamOverride(envTheme, def);
  };

  const handleSelectTheme = (themeKey: string) => {
    ultraAudio.playUiClick();
    onSelectEnvTheme(themeKey);
  };

  // Save new or edited custom environment
  const handleSaveCustomEnv = () => {
    if (!formName.trim()) return;
    ultraAudio.playUiClick();

    if (editingEnvId) {
      // Edit existing
      const updatedList = customEnvs.map((c) => {
        if (c.id === editingEnvId) {
          return {
            ...c,
            name: formName,
            icon: formIcon || '🧬',
            description: formDesc || '用户自定义特化收容环境',
            hpChange: formHp,
            energyChange: formEnergy,
            moraleChange: formMorale,
            shameChange: formShame,
            obedienceChange: formObedience,
            lustChange: formLust,
          };
        }
        return c;
      });
      onSaveCustomEnvs(updatedList);
      setEditingEnvId(null);
    } else {
      // Create new
      const newId = `custom_env_${Date.now()}`;
      const newEnv: CustomEnvTheme = {
        id: newId,
        name: formName,
        icon: formIcon || '🧬',
        description: formDesc || '用户自定义特化收容环境',
        badgeColor: 'text-purple-300 border-purple-500/40 bg-purple-950/40',
        hpChange: formHp,
        energyChange: formEnergy,
        moraleChange: formMorale,
        shameChange: formShame,
        obedienceChange: formObedience,
        lustChange: formLust,
        params: getDefaultEnvParams('glass'),
      };
      const updatedList = [...customEnvs, newEnv];
      onSaveCustomEnvs(updatedList);
      onSelectEnvTheme(newId);
    }

    setIsCreatingEnv(false);
    setFormName('');
    setFormDesc('');
  };

  const handleStartEditCustomEnv = (c: CustomEnvTheme, e: React.MouseEvent) => {
    e.stopPropagation();
    ultraAudio.playUiClick();
    setEditingEnvId(c.id);
    setFormName(c.name);
    setFormIcon(c.icon);
    setFormDesc(c.description);
    setFormHp(c.hpChange);
    setFormEnergy(c.energyChange);
    setFormMorale(c.moraleChange);
    setFormShame(c.shameChange);
    setFormObedience(c.obedienceChange);
    setFormLust(c.lustChange);
    setIsCreatingEnv(true);
  };

  const handleDeleteCustomEnv = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    ultraAudio.playUiClick();
    const filtered = customEnvs.filter((c) => c.id !== id);
    onSaveCustomEnvs(filtered);
    if (envTheme === id) {
      onSelectEnvTheme('glass');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-zinc-950 border border-cyan-500/40 rounded-2xl max-w-5xl w-full text-zinc-100 shadow-[0_0_60px_rgba(6,182,212,0.3)] flex flex-col max-h-[94vh] overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <TestTube className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold font-mono text-cyan-300 uppercase tracking-wider">
                  收容环境舱与物理/化学参数微调控制台
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  第 {dayCount} 天 (膨胀系数: {dayMult.toFixed(2)}x)
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                可自由新建自定义收容舱环境，并精准调校温度、pH值、压强、高压电场等全部物理化学细节
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 pt-3 bg-zinc-950 border-b border-zinc-800/80 flex items-center space-x-2 shrink-0 overflow-x-auto scrollbar-none font-mono text-xs">
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('envs');
            }}
            className={`px-4 py-2.5 rounded-t-xl font-bold flex items-center space-x-2 transition-all cursor-pointer border-t border-x ${
              activeTab === 'envs'
                ? 'bg-zinc-900 border-cyan-500/50 text-cyan-300 shadow-[0_-4px_12px_rgba(6,182,212,0.15)]'
                : 'bg-zinc-950 border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>环境选择与自定义创建 ({BUILTIN_THEME_KEYS.length + customEnvs.length})</span>
          </button>

          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('physics');
            }}
            className={`px-4 py-2.5 rounded-t-xl font-bold flex items-center space-x-2 transition-all cursor-pointer border-t border-x ${
              activeTab === 'physics'
                ? 'bg-zinc-900 border-cyan-500/50 text-cyan-300 shadow-[0_-4px_12px_rgba(6,182,212,0.15)]'
                : 'bg-zinc-950 border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>物理/化学具体参数微调</span>
          </button>

          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setActiveTab('predict');
            }}
            className={`px-4 py-2.5 rounded-t-xl font-bold flex items-center space-x-2 transition-all cursor-pointer border-t border-x ${
              activeTab === 'predict'
                ? 'bg-zinc-900 border-cyan-500/50 text-cyan-300 shadow-[0_-4px_12px_rgba(6,182,212,0.15)]'
                : 'bg-zinc-950 border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-4 h-4 text-rose-400" />
            <span>跨夜预测与弱点联动</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 scrollbar-thin text-xs font-mono">
          {/* TAB 1: ENVIRONMENT SELECTION & CUSTOM CREATION */}
          {activeTab === 'envs' && (
            <div className="space-y-6">
              {/* Header & Add Button */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <span>收容舱主环境主题列表 (点击切换挂载)</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    当前正在生效的环境: <strong className="text-cyan-300">{currentThemeIcon} {currentThemeName}</strong>
                  </p>
                </div>

                <button
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setEditingEnvId(null);
                    setFormName('');
                    setFormIcon('🧬');
                    setFormDesc('');
                    setFormHp(-5);
                    setFormEnergy(-5);
                    setFormMorale(-3);
                    setFormShame(3);
                    setFormObedience(2);
                    setFormLust(2);
                    setIsCreatingEnv(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-bold flex items-center space-x-2 cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.2)] transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>＋ 新增自定义环境舱</span>
                </button>
              </div>

              {/* Custom Creation Form Modal/Card */}
              {isCreatingEnv && (
                <div className="p-4 rounded-xl bg-zinc-900 border border-cyan-500/50 shadow-xl space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <h4 className="font-bold text-cyan-300 flex items-center gap-2">
                      <Edit3 className="w-4 h-4" />
                      <span>{editingEnvId ? '修改自定义环境舱' : '创建全新自定义特化收容舱'}</span>
                    </h4>
                    <button
                      onClick={() => setIsCreatingEnv(false)}
                      className="text-zinc-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1 font-bold">环境舱名称</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="例如: 反重力黏液触手室"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100 text-xs focus:border-cyan-400 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1 font-bold">图标 (Emoji或符号)</label>
                      <input
                        type="text"
                        value={formIcon}
                        onChange={(e) => setFormIcon(e.target.value)}
                        placeholder="例如: 🌊"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100 text-xs focus:border-cyan-400 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1 font-bold">环境特征简述</label>
                      <input
                        type="text"
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        placeholder="简单说明环境作用机制..."
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100 text-xs focus:border-cyan-400 outline-none"
                      />
                    </div>
                  </div>

                  {/* Stat Change Controls */}
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-2 font-bold">每日跨夜基准属性影响变动 (%/日)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block mb-1">HP 变动</span>
                        <input
                          type="number"
                          value={formHp}
                          onChange={(e) => setFormHp(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-rose-300 font-bold"
                        />
                      </div>

                      <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block mb-1">能量 变动</span>
                        <input
                          type="number"
                          value={formEnergy}
                          onChange={(e) => setFormEnergy(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-cyan-300 font-bold"
                        />
                      </div>

                      <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block mb-1">意志 变动</span>
                        <input
                          type="number"
                          value={formMorale}
                          onChange={(e) => setFormMorale(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-indigo-300 font-bold"
                        />
                      </div>

                      <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block mb-1">羞耻 变动</span>
                        <input
                          type="number"
                          value={formShame}
                          onChange={(e) => setFormShame(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-fuchsia-300 font-bold"
                        />
                      </div>

                      <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block mb-1">信任 变动</span>
                        <input
                          type="number"
                          value={formObedience}
                          onChange={(e) => setFormObedience(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-purple-300 font-bold"
                        />
                      </div>

                      <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block mb-1">欲望 变动</span>
                        <input
                          type="number"
                          value={formLust}
                          onChange={(e) => setFormLust(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-rose-400 font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setIsCreatingEnv(false)}
                      className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveCustomEnv}
                      className="px-4 py-1.5 rounded bg-cyan-500 text-zinc-950 font-bold hover:bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                    >
                      保存该环境舱
                    </button>
                  </div>
                </div>
              )}

              {/* Built-in Environments */}
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">预设 9 大战术环境舱</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {BUILTIN_THEME_KEYS.map((t) => {
                    const eff = ENV_DAILY_EFFECTS[t];
                    const isSelected = envTheme === t;
                    const icon = BUILTIN_THEME_ICONS[t];

                    return (
                      <button
                        key={t}
                        onClick={() => handleSelectTheme(t)}
                        className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer relative ${
                          isSelected
                            ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/50'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-2 right-2 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                          </span>
                        )}
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-lg">{icon}</span>
                            <span className="font-bold text-xs text-zinc-100">{eff.name}</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 leading-relaxed mb-2 break-words">
                            {eff.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-zinc-800/80 text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded border ${
                            eff.hpChange < 0 ? 'bg-rose-950/60 border-rose-500/40 text-rose-300' : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                          }`}>
                            HP: {eff.hpChange >= 0 ? '+' : ''}{eff.hpChange}%
                          </span>
                          <span className={`px-1.5 py-0.5 rounded border ${
                            eff.energyChange < 0 ? 'bg-amber-950/60 border-amber-500/40 text-amber-300' : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                          }`}>
                            能量: {eff.energyChange >= 0 ? '+' : ''}{eff.energyChange}%
                          </span>
                          <span className="px-1.5 py-0.5 rounded border bg-purple-950/60 border-purple-500/40 text-purple-300">
                            服从: +{eff.obedienceChange}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* User Custom Environments */}
              {customEnvs.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>用户自定义特化环境舱 ({customEnvs.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {customEnvs.map((c) => {
                      const isSelected = envTheme === c.id;

                      return (
                        <div
                          key={c.id}
                          onClick={() => handleSelectTheme(c.id)}
                          className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer relative ${
                            isSelected
                              ? 'bg-purple-950/70 border-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] ring-1 ring-purple-400/50'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-2 right-2 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                            </span>
                          )}

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{c.icon}</span>
                                <span className="font-bold text-xs text-purple-200">{c.name}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={(e) => handleStartEditCustomEnv(c, e)}
                                  className="p-1 hover:text-cyan-300 text-zinc-400 rounded hover:bg-zinc-800"
                                  title="修改"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteCustomEnv(c.id, e)}
                                  className="p-1 hover:text-rose-400 text-zinc-400 rounded hover:bg-zinc-800"
                                  title="删除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-[10px] text-zinc-400 leading-relaxed mb-2 break-words">
                              {c.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-zinc-800/80 text-[10px]">
                            <span className={`px-1.5 py-0.5 rounded border ${
                              c.hpChange < 0 ? 'bg-rose-950/60 border-rose-500/40 text-rose-300' : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                            }`}>
                              HP: {c.hpChange >= 0 ? '+' : ''}{c.hpChange}%
                            </span>
                            <span className={`px-1.5 py-0.5 rounded border ${
                              c.energyChange < 0 ? 'bg-amber-950/60 border-amber-500/40 text-amber-300' : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                            }`}>
                              能量: {c.energyChange >= 0 ? '+' : ''}{c.energyChange}%
                            </span>
                            <span className="px-1.5 py-0.5 rounded border bg-purple-950/60 border-purple-500/40 text-purple-300">
                              服从: +{c.obedienceChange}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PHYSICAL & CHEMICAL PARAMETERS TUNING */}
          {activeTab === 'physics' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-zinc-900/90 p-3.5 rounded-xl border border-zinc-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{currentThemeIcon}</span>
                    <h3 className="text-sm font-bold text-cyan-300">
                      当前正在微调的环境舱: 【{currentThemeName}】
                    </h3>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    调整该舱内的具体物理/化学参数（如极高/低温、酸碱pH值、等离子电场、混浊度与每日加成微调）
                  </p>
                </div>

                <button
                  onClick={handleResetToDefaultParams}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center space-x-1.5 text-[11px] transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>恢复该环境默认参数</span>
                </button>
              </div>

              {/* 8 Main Physical & Chemical Sliders */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-5">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Thermometer className="w-4 h-4" />
                  <span>核心物理 / 化学详细参数</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Temperature Slider */}
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                        🌡️ 环境温度 (°C)
                      </span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          value={localParams.temperature}
                          onChange={(e) => handleUpdateParamField('temperature', parseFloat(e.target.value) || 0)}
                          className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-right font-mono text-xs text-amber-300 font-bold"
                        />
                        <span className="text-zinc-400 text-[10px]">°C</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-270"
                      max="1200"
                      step="5"
                      value={localParams.temperature}
                      onChange={(e) => handleUpdateParamField('temperature', parseFloat(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>绝对零度 (-270°C)</span>
                      <span>常温 (25°C)</span>
                      <span>熔岩 (850°C+)</span>
                    </div>
                  </div>

                  {/* 2. pH Level Slider */}
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                        🧪 介质酸碱度 (pH值)
                      </span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="0.1"
                          value={localParams.phLevel}
                          onChange={(e) => handleUpdateParamField('phLevel', parseFloat(e.target.value) || 7)}
                          className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-right font-mono text-xs text-emerald-300 font-bold"
                        />
                        <span className="text-zinc-400 text-[10px]">pH</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="14.0"
                      step="0.1"
                      value={localParams.phLevel}
                      onChange={(e) => handleUpdateParamField('phLevel', parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>强酸 (0.0)</span>
                      <span>中性 (7.0)</span>
                      <span>强碱 (14.0)</span>
                    </div>
                  </div>

                  {/* 3. Pressure Atm Slider */}
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                        ⚖️ 舱内压强/重力 (Atm)
                      </span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="0.5"
                          value={localParams.pressureAtm}
                          onChange={(e) => handleUpdateParamField('pressureAtm', parseFloat(e.target.value) || 1)}
                          className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-right font-mono text-xs text-cyan-300 font-bold"
                        />
                        <span className="text-zinc-400 text-[10px]">Atm</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="500.0"
                      step="0.5"
                      value={localParams.pressureAtm}
                      onChange={(e) => handleUpdateParamField('pressureAtm', parseFloat(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>真空 (0.1 Atm)</span>
                      <span>标准 (1.0 Atm)</span>
                      <span>高水压 (500 Atm)</span>
                    </div>
                  </div>

                  {/* 4. Voltage kV Slider */}
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                        ⚡ 等离子/电场高压 (kV)
                      </span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          value={localParams.voltageKv}
                          onChange={(e) => handleUpdateParamField('voltageKv', parseFloat(e.target.value) || 0)}
                          className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-right font-mono text-xs text-purple-300 font-bold"
                        />
                        <span className="text-zinc-400 text-[10px]">kV</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1000"
                      step="10"
                      value={localParams.voltageKv}
                      onChange={(e) => handleUpdateParamField('voltageKv', parseFloat(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>无电场 (0 kV)</span>
                      <span>高压电击 (500 kV)</span>
                      <span>频闪高能 (1000 kV)</span>
                    </div>
                  </div>

                  {/* 5. Anti-Photon Rate Slider */}
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                        🌌 光粒子/反光子抽拔率 (%)
                      </span>
                      <span className="text-indigo-300 font-bold font-mono">{localParams.antiPhotonRate}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={localParams.antiPhotonRate}
                      onChange={(e) => handleUpdateParamField('antiPhotonRate', parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-zinc-500">
                      强行抽拔魔能值核心中的高能粒子，影响能量自然恢复与护盾密度。
                    </p>
                  </div>

                  {/* 6. Turbidity Percent Slider */}
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                        🌫️ 液体/介质混浊度 (%)
                      </span>
                      <span className="text-cyan-300 font-bold font-mono">{localParams.turbidityPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={localParams.turbidityPercent}
                      onChange={(e) => handleUpdateParamField('turbidityPercent', parseFloat(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-zinc-500">
                      调节悬浮颗粒与视线遮蔽感，增加囚禁羞耻度与视感不透明度。
                    </p>
                  </div>

                  {/* 7. Viscosity Pas Slider */}
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                        流体包裹粘稠度 (Pas)
                      </span>
                      <span className="text-amber-300 font-bold font-mono">{localParams.viscosityPas} Pas</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1000"
                      step="10"
                      value={localParams.viscosityPas}
                      onChange={(e) => handleUpdateParamField('viscosityPas', parseFloat(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-zinc-500">
                      高粘稠流体阻碍肢体挣扎，限制战斗姿态并增加体力消耗。
                    </p>
                  </div>

                  {/* 8. Hypnosis Hz Slider */}
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                        🌀 潜意识催眠脑波频率 (Hz)
                      </span>
                      <span className="text-pink-300 font-bold font-mono">{localParams.hypnosisHz} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="500"
                      step="10"
                      value={localParams.hypnosisHz}
                      onChange={(e) => handleUpdateParamField('hypnosisHz', parseFloat(e.target.value))}
                      className="w-full accent-pink-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-zinc-500">
                      高频脑波共振直接瓦解意志防线，加速服从度与欲望发情转换。
                    </p>
                  </div>
                </div>
              </div>

              {/* 6 Individual Daily Extra Delta Sliders */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-4">
                <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4" />
                  <span>自定义额外每日跨夜数值微调 (Extra Deltas)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Extra HP Drain */}
                  <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-300 font-bold">额外 HP 每日变动</span>
                      <span className="text-rose-400 font-bold">{(localParams.extraHpDrain || 0) >= 0 ? '+' : ''}{localParams.extraHpDrain || 0}%/日</span>
                    </div>
                    <input
                      type="range"
                      min="-30"
                      max="30"
                      step="1"
                      value={localParams.extraHpDrain || 0}
                      onChange={(e) => handleUpdateParamField('extraHpDrain', parseFloat(e.target.value))}
                      className="w-full accent-rose-500 cursor-pointer"
                    />
                  </div>

                  {/* Extra Energy Drain */}
                  <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-300 font-bold">额外 能量 每日变动</span>
                      <span className="text-cyan-400 font-bold">{(localParams.extraEnergyDrain || 0) >= 0 ? '+' : ''}{localParams.extraEnergyDrain || 0}%/日</span>
                    </div>
                    <input
                      type="range"
                      min="-30"
                      max="30"
                      step="1"
                      value={localParams.extraEnergyDrain || 0}
                      onChange={(e) => handleUpdateParamField('extraEnergyDrain', parseFloat(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  {/* Extra Morale Drain */}
                  <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-300 font-bold">额外 意志 每日变动</span>
                      <span className="text-indigo-400 font-bold">{(localParams.extraMoraleDrain || 0) >= 0 ? '+' : ''}{localParams.extraMoraleDrain || 0}%/日</span>
                    </div>
                    <input
                      type="range"
                      min="-30"
                      max="30"
                      step="1"
                      value={localParams.extraMoraleDrain || 0}
                      onChange={(e) => handleUpdateParamField('extraMoraleDrain', parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Extra Shame Gain */}
                  <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-300 font-bold">额外 羞耻 每日变动</span>
                      <span className="text-fuchsia-400 font-bold">{(localParams.extraShameGain || 0) >= 0 ? '+' : ''}{localParams.extraShameGain || 0}%/日</span>
                    </div>
                    <input
                      type="range"
                      min="-30"
                      max="30"
                      step="1"
                      value={localParams.extraShameGain || 0}
                      onChange={(e) => handleUpdateParamField('extraShameGain', parseFloat(e.target.value))}
                      className="w-full accent-fuchsia-500 cursor-pointer"
                    />
                  </div>

                  {/* Extra Obedience Gain */}
                  <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-300 font-bold">额外 服从 每日变动</span>
                      <span className="text-purple-400 font-bold">{(localParams.extraObedienceGain || 0) >= 0 ? '+' : ''}{localParams.extraObedienceGain || 0}%/日</span>
                    </div>
                    <input
                      type="range"
                      min="-30"
                      max="30"
                      step="1"
                      value={localParams.extraObedienceGain || 0}
                      onChange={(e) => handleUpdateParamField('extraObedienceGain', parseFloat(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  {/* Extra Lust Gain */}
                  <div className="p-3 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-300 font-bold">额外 欲望 每日变动</span>
                      <span className="text-rose-400 font-bold">{(localParams.extraLustGain || 0) >= 0 ? '+' : ''}{localParams.extraLustGain || 0}%/日</span>
                    </div>
                    <input
                      type="range"
                      min="-30"
                      max="30"
                      step="1"
                      value={localParams.extraLustGain || 0}
                      onChange={(e) => handleUpdateParamField('extraLustGain', parseFloat(e.target.value))}
                      className="w-full accent-rose-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DAILY PREDICTION & WEAKNESS LINKAGE */}
          {activeTab === 'predict' && (
            <div className="space-y-6">
              {/* Outcome Dashboard */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-400" />
                    <span>第 {dayCount} 天 - 综合微调参数下的每日跨夜结算预测</span>
                  </h3>
                  <span className="text-[10px] text-zinc-400">
                    天数放大系数: <strong>{dayMult.toFixed(2)}x</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                  {/* HP Delta */}
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-rose-500/30 flex flex-col items-center text-center">
                    <span className="text-[10px] text-zinc-400 mb-0.5">生命值 (HP)</span>
                    <span className={`text-base font-bold font-mono ${netHpChange < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {netHpChange >= 0 ? '+' : ''}{netHpChange}%
                    </span>
                    <span className="text-[9px] text-zinc-500 mt-0.5">/ 每日跨夜</span>
                  </div>

                  {/* Energy Delta */}
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-cyan-500/30 flex flex-col items-center text-center">
                    <span className="text-[10px] text-zinc-400 mb-0.5">能量 (Energy)</span>
                    <span className={`text-base font-bold font-mono ${netEnergyChange < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {netEnergyChange >= 0 ? '+' : ''}{netEnergyChange}%
                    </span>
                    <span className="text-[9px] text-zinc-500 mt-0.5">/ 每日跨夜</span>
                  </div>

                  {/* Morale Delta */}
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-indigo-500/30 flex flex-col items-center text-center">
                    <span className="text-[10px] text-zinc-400 mb-0.5">意志力 (Morale)</span>
                    <span className={`text-base font-bold font-mono ${netMoraleChange < 0 ? 'text-indigo-400' : 'text-emerald-400'}`}>
                      {netMoraleChange >= 0 ? '+' : ''}{netMoraleChange}%
                    </span>
                    <span className="text-[9px] text-zinc-500 mt-0.5">/ 每日跨夜</span>
                  </div>

                  {/* Shame Delta */}
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-fuchsia-500/30 flex flex-col items-center text-center">
                    <span className="text-[10px] text-zinc-400 mb-0.5">羞耻感 (Shame)</span>
                    <span className={`text-base font-bold font-mono ${netShameChange > 0 ? 'text-fuchsia-400' : 'text-zinc-400'}`}>
                      {netShameChange >= 0 ? '+' : ''}{netShameChange}%
                    </span>
                    <span className="text-[9px] text-zinc-500 mt-0.5">/ 每日跨夜</span>
                  </div>

                  {/* Obedience Delta */}
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-purple-500/30 flex flex-col items-center text-center">
                    <span className="text-[10px] text-zinc-400 mb-0.5">服从度 (Obedience)</span>
                    <span className={`text-base font-bold font-mono ${netObedienceChange > 0 ? 'text-purple-400' : 'text-zinc-400'}`}>
                      {netObedienceChange >= 0 ? '+' : ''}{netObedienceChange}%
                    </span>
                    <span className="text-[9px] text-zinc-500 mt-0.5">/ 每日跨夜</span>
                  </div>

                  {/* Lust Delta */}
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-rose-500/30 flex flex-col items-center text-center">
                    <span className="text-[10px] text-zinc-400 mb-0.5">欲望度 (Lust)</span>
                    <span className={`text-base font-bold font-mono ${netLustChange > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                      {netLustChange >= 0 ? '+' : ''}{netLustChange}%
                    </span>
                    <span className="text-[9px] text-zinc-500 mt-0.5">/ 每日跨夜</span>
                  </div>
                </div>
              </div>

              {/* Weakness Linkage */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>目标【{selectedHero.name}】在此环境下的特定弱点联动状态</span>
                  </h3>
                  <span className="text-[10px] text-zinc-400">
                    已启用弱点: {activeWeaknesses.length} 个
                  </span>
                </div>

                {matchedWeakness ? (
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        ⚡ 匹配到特化环境弱点：{matchedWeakness.name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 font-bold">
                        创伤倍率: {matchedWeakness.damageMultiplier}x
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-100/90">
                      当在【{currentThemeName}】中进行打击时，将高效激活特化弱点，造成破格创伤与专属悲惨受创台词！
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 text-xs">
                    当前收容环境暂未激活【{selectedHero.name}】的特定环境弱点。可在参数定制面板中自由为她添加专属环境弱点规则。
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-zinc-400 font-mono flex items-center space-x-2">
            <span>当前挂载环境:</span>
            <span className="font-bold text-cyan-300">{currentThemeIcon} {currentThemeName}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                ultraAudio.playUiClick();
                onPassDay();
                onClose();
              }}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.3)]"
            >
              <FastForward className="w-4 h-4" />
              <span>跨越至下一天 (+1天结算)</span>
            </button>

            <button
              onClick={() => {
                ultraAudio.playUiClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition-all cursor-pointer"
            >
              完成并保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
