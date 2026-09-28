import React, { useState, useEffect } from 'react';
import {
  AiConfig,
  AiProvider,
  CustomAiProviderItem,
  AiAttachment,
  JailbreakPreset,
  JailbreakCard,
  WorldViewSlot,
  AiConfigProfile,
  SystemPromptPreset,
  Ultrawoman,
  RealTimeSyncState,
  RealTimeContextInfo,
} from '../types';
import { getRealTimeContext } from '../utils/realTimeUtils';
import {
  Bot, Key, Globe, Cpu, Flame, Check, AlertCircle, RefreshCw, Eye, EyeOff, X, Zap,
  Sliders, ShieldAlert, Sparkles, Copy, FileCode, Wand2, Tag, BookOpen, Orbit, Compass,
  Download, Upload, Share2, Maximize2, Minimize2, Plus, Edit2, Trash2, Layers,
  ExternalLink, Server, CheckCircle2, Shield, Settings2, FileJson, ArrowRight,
  Bookmark, Save, FolderPlus, Paperclip, Search, Filter, BookmarkPlus, RotateCcw, Clock, Hash, CheckSquare, PlusCircle, Brain
} from 'lucide-react';
import { ultraAudio } from '../utils/audio';
import {
  exportWorldViewCard,
  parseWorldViewCard,
  downloadWorldViewCardFile,
  exportWorldViewSlotsBackup,
  downloadWorldViewSlotsFile,
  parseWorldViewSlotsData,
  exportJailbreakCard,
  downloadJailbreakCardFile,
  parseJailbreakCard
} from '../utils/cardUtils';
import { BUILTIN_AI_PROVIDERS, getInitialCustomProviders, findProviderById, normalizeOpenAiBaseUrl } from '../data/aiProviders';
import { AiAttachmentManager } from './AiAttachmentManager';
import { DebouncedPromptTextarea, DebouncedInput } from './DebouncedPromptTextarea';

interface AiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AiConfig;
  onSaveConfig: (newConfig: AiConfig) => void;
  selectedHero?: Ultrawoman;
  realTimeState?: RealTimeSyncState;
  onTriggerRealTimeGreeting?: () => void | Promise<void>;
}

// Rich Jailbreak Presets
// 本仓库不附带任何内置世界观 / 破限预设。以下中性占位对象用于所有回退分支，
// 保证清空内置列表后界面依然可用（否则会出现 undefined.id/.prompt 崩溃）。
const EMPTY_WORLD_VIEW_SLOT: WorldViewSlot = { id: '', name: '', summary: '', description: '', prompt: '' };
const EMPTY_JAILBREAK_PRESET: JailbreakPreset = { id: '', name: '', prompt: '' };

const JAILBREAK_PRESETS: any[] = [];

// Universal System Prompt Presets (Decoupled from character personality)
export const BUILTIN_SYSTEM_PROMPT_PRESETS: SystemPromptPreset[] = [];

const SYSTEM_PROMPT_PRESETS = BUILTIN_SYSTEM_PROMPT_PRESETS;

// Quick Tag Modifiers
const QUICK_TAG_MODIFIERS = [
  { label: '💬 增加呼吸与拟声词', tag: '【要求：在台词中增加细腻的呼吸喘息与感叹拟声词】' },
  { label: '🚨 突出核心能量波动', tag: '【要求：强调胸前能量核心从充盈到衰减急促闪烁的紧张感】' },
  { label: '🧠 深入即时心理独白', tag: '【要求：在括号中详细描写角色内心信念防线与复杂心绪的交织】' },
  { label: '⛓️ 强化战术束缚触感', tag: '【要求：突出能量束缚装置与战术环境对身体各部位的真实拘束触感】' },
  { label: '🙇 服从与归顺语调演变', tag: '【要求：随着顺从度上升，台词自然流露出认同、依赖与服从的语调变化】' },
];

// Rich Built-in WorldView Slots
export const BUILTIN_WORLD_VIEW_SLOTS: WorldViewSlot[] = [];

// WorldView Presets alias for backward compatibility
const WORLD_VIEW_PRESETS = BUILTIN_WORLD_VIEW_SLOTS;

export const DEFAULT_API_PROFILES: AiConfigProfile[] = [
  {
    id: 'profile_deepseek_default',
    name: '⚡ DeepSeek-V3 战术推演 (官方推荐)',
    description: '官方极速接口，超高智商与战报心理细腻刻画，极低成本',
    createdAt: '2025-01-01T00:00:00.000Z',
    provider: 'deepseek',
    activeProviderId: 'deepseek',
    activeProviderName: 'DeepSeek AI (深度求索)',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    temperature: 0.7,
    enableJailbreak: true,
    activeJailbreakPresetId: '',
    customSystemPrompt: '请以逼真、极富戏剧张力与情感起伏的视角，生成角色受创、抵抗、动摇或回应的细腻心理与台词反馈。',
    worldViewEnabled: true,
  },
  {
    id: 'profile_siliconflow_default',
    name: '🚀 硅基流动 SiliconFlow (高速节点)',
    description: '国内高速低延迟中转，支持 DeepSeek-V3 / Qwen 2.5 72B',
    createdAt: '2025-01-01T00:00:00.000Z',
    provider: 'siliconflow',
    activeProviderId: 'siliconflow',
    activeProviderName: 'SiliconFlow (硅基流动)',
    apiKey: '',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    temperature: 0.75,
    enableJailbreak: true,
    activeJailbreakPresetId: '',
    customSystemPrompt: '深入刻画肢体语言、微表情、呼吸节奏、声学生理反馈与即时生理机能受损状态。',
    worldViewEnabled: true,
  },
  {
    id: 'profile_openai_default',
    name: '🌐 OpenAI / 兼容反代中转站',
    description: '标准 OpenAI 协议，支持 GPT-4o / GPT-4o-mini 等',
    createdAt: '2025-01-01T00:00:00.000Z',
    provider: 'openai',
    activeProviderId: 'openai',
    activeProviderName: 'OpenAI (GPT-4o/mini)',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    enableJailbreak: true,
    activeJailbreakPresetId: '',
    customSystemPrompt: '以客观严谨的战术对抗逻辑，详细描绘攻防招式、能量护盾削减与意志力博弈过程。',
    worldViewEnabled: true,
  },
  {
    id: 'profile_agnes_default',
    name: '⚡ Agnes AI (官方聚合 API)',
    description: 'Agnes AI 官方 API (https://apihub.agnes-ai.com/v1)，支持 agnes-2.5-flash / gpt-4o 等',
    createdAt: '2025-01-01T00:00:00.000Z',
    provider: 'agnes',
    activeProviderId: 'agnes',
    activeProviderName: 'Agnes AI (官方聚合 API)',
    apiKey: '',
    baseUrl: 'https://apihub.agnes-ai.com/v1',
    model: 'agnes-2.5-flash',
    temperature: 0.7,
    enableJailbreak: true,
    activeJailbreakPresetId: '',
    customSystemPrompt: '深入刻画肢体语言、微表情、呼吸节奏、声学生理反馈与即时生理机能受损状态。',
    worldViewEnabled: true,
  },
  {
    id: 'profile_ollama_default',
    name: '💻 本地 Ollama / 离线私有大模型',
    description: '本地电脑运行，100% 隐私与离线无审查',
    createdAt: '2025-01-01T00:00:00.000Z',
    provider: 'ollama_local',
    activeProviderId: 'ollama_local',
    activeProviderName: 'Ollama 本地大模型 (Local)',
    apiKey: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:14b',
    temperature: 0.8,
    enableJailbreak: false,
    customSystemPrompt: '生成极具画面感与代入感的身临其境对白与生理受损战术反馈。',
    worldViewEnabled: true,
  },
];

export function getInitialApiProfiles(customProfiles?: AiConfigProfile[]): AiConfigProfile[] {
  let stored: AiConfigProfile[] = [];
  try {
    const raw = localStorage.getItem('ultra_ai_config_presets_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Guard: corrupt / legacy non-array payloads must never wipe the in-app preset list.
      if (Array.isArray(parsed)) stored = parsed;
    }
  } catch {}

  const map = new Map<string, AiConfigProfile>();
  // Priority 1 (lowest): built-in defaults
  DEFAULT_API_PROFILES.forEach((p) => map.set(p.id, p));
  // Priority 2: auxiliary persisted preset slot list (legacy / cross-session fallback)
  stored.forEach((p) => {
    if (p && p.id) map.set(p.id, p);
  });
  // Priority 3 (highest): the authoritative in-app list from aiConfig.apiProfiles
  (Array.isArray(customProfiles) ? customProfiles : []).forEach((p) => {
    if (p && p.id) map.set(p.id, p);
  });
  return Array.from(map.values()).filter((p): p is AiConfigProfile => !!p);
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  provider: 'deepseek',
  activeProviderId: 'deepseek',
  activeProviderName: 'DeepSeek AI (深度求索)',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  enableJailbreak: true,
  customJailbreakPrompt: '',
  activeJailbreakPresetId: '',
  customJailbreakPresets: [],
  jailbreakAttachments: [],
  apiAttachments: [],
  customSystemPrompt: '请以逼真、极富戏剧张力与情感起伏的视角，生成角色受创、抵抗、动摇或回应的细腻心理与台词反馈。',
  customWorldView: BUILTIN_WORLD_VIEW_SLOTS[0]?.prompt || '',
  worldViewEnabled: true,
  activeWorldViewSlotId: 'wv_builtin_light_dark',
  customWorldViewSlots: [],
  temperature: 0.7,
  customProviders: BUILTIN_AI_PROVIDERS,
  apiProfiles: DEFAULT_API_PROFILES,
};

export const AiConfigModal: React.FC<AiConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  selectedHero,
  realTimeState,
  onTriggerRealTimeGreeting,
}) => {
  // Initialize config with custom providers list and worldview slots
  const [formConfig, setFormConfig] = useState<AiConfig>(() => {
    const initial = config || DEFAULT_AI_CONFIG;
    const providers = getInitialCustomProviders(initial.customProviders);
    const profiles = getInitialApiProfiles(initial.apiProfiles);
    return {
      ...initial,
      customProviders: providers,
      apiProfiles: profiles,
      activeProviderId: initial.activeProviderId || initial.provider || 'deepseek',
      // The server treats a missing value as OFF, so make it an explicit boolean here.
      enableThinking: initial.enableThinking === true,
      customJailbreakPresets: initial.customJailbreakPresets || [],
      jailbreakAttachments: initial.jailbreakAttachments || [],
      apiAttachments: initial.apiAttachments || [],
      customWorldView: initial.customWorldView || BUILTIN_WORLD_VIEW_SLOTS[0]?.prompt || '',
      activeWorldViewSlotId: initial.activeWorldViewSlotId || 'wv_builtin_light_dark',
      customWorldViewSlots: initial.customWorldViewSlots || [],
    };
  });

  // Identity refs & commit helper for the config-persistence guards below.
  // Defined before every effect / handler that uses them to avoid TDZ and stale closures.
  const lastPushedConfigRef = React.useRef<AiConfig | null>(null);
  const lastAutoSavedRef = React.useRef<string | null>(null);
  // Tracks whether the user actually typed an API key while the current provider is active.
  // Without this, switching to a provider that has no dedicated key inherits the PREVIOUS
  // provider's key and a later save writes it into the new provider entry (key cross-pollution).
  const activeProviderKeyEditedRef = React.useRef<boolean>(false);

  // Single commit gate: records our own writes so the sync effect can recognise its own echo.
  const commitConfig = React.useCallback((next: AiConfig) => {
    lastPushedConfigRef.current = next;
    onSaveConfig(next);
  }, [onSaveConfig]);

  // The backend resolves baseUrl / model / apiKey from the ACTIVE PROVIDER ENTRY first, so an
  // edit that only lives in the top-level form fields would never reach the AI call ('改了没反应').
  // This mirrors what the manual save does: sync the entry, but only overwrite the key when the
  // user actually typed one (so switching providers cannot copy a key into another entry).
  const buildProviderSyncedConfig = React.useCallback((src: AiConfig): AiConfig => {
    const list = src.customProviders || BUILTIN_AI_PROVIDERS;
    const active = list.find((p) => p.id === (src.activeProviderId || src.provider)) || list[0];
    if (!active) return src;
    const providers = list.map((p) => (p.id === active.id
      ? {
          ...p,
          baseUrl: src.baseUrl || p.baseUrl,
          defaultModel: src.model || p.defaultModel,
          ...(activeProviderKeyEditedRef.current ? { apiKey: src.apiKey || p.apiKey } : {}),
        }
      : p));
    return { ...src, customProviders: providers, activeProviderId: active.id, activeProviderName: active.name };
  }, []);

  // Keep form synchronized with the authoritative parent config.
  // Re-sync whenever the parent config is replaced by an external writer (server hydration,
  // slot load, backup restore, ...) or whenever the modal is (re)opened; otherwise a stale
  // snapshot could be committed back and wipe presets. Identity check avoids an update loop.
  const prevIsOpenRef = React.useRef(isOpen);
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    if (!config) return;
    const isOwnEcho = config === lastPushedConfigRef.current;
    if (isOwnEcho && !justOpened) return; // our own commit, already in sync
    const providers = getInitialCustomProviders(config.customProviders);
    const profiles = getInitialApiProfiles(config.apiProfiles);
    setFormConfig((prev) => ({
      ...config,
      customProviders: providers,
      apiProfiles: profiles,
      activeProviderId: config.activeProviderId || config.provider || prev.activeProviderId || 'deepseek',
      enableThinking: config.enableThinking === true,
      customJailbreakPresets: config.customJailbreakPresets || prev.customJailbreakPresets || [],
      jailbreakAttachments: config.jailbreakAttachments || prev.jailbreakAttachments || [],
      apiAttachments: config.apiAttachments || prev.apiAttachments || [],
      customWorldView: config.customWorldView || prev.customWorldView || BUILTIN_WORLD_VIEW_SLOTS[0]?.prompt || '',
      activeWorldViewSlotId: config.activeWorldViewSlotId || prev.activeWorldViewSlotId || 'wv_builtin_light_dark',
      customWorldViewSlots: config.customWorldViewSlots || prev.customWorldViewSlots || [],
    }));
  }, [isOpen, config]);

  // Global save toast notification
  const [saveToastMsg, setSaveToastMsg] = useState<string | null>(null);

  // API Config Profiles (Preset Slots) states
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => {
    const profiles = formConfig.apiProfiles || DEFAULT_API_PROFILES;
    const matched = profiles.find((p) => p.provider === formConfig.provider && p.model === formConfig.model);
    return matched?.id || null;
  });
  const [isSaveProfileModalOpen, setIsSaveProfileModalOpen] = useState(false);
  const [saveProfileName, setSaveProfileName] = useState('');
  const [saveProfileDesc, setSaveProfileDesc] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileCategory, setProfileCategory] = useState<'all' | 'builtin' | 'custom'>('all');
  const [profileSearch, setProfileSearch] = useState('');
  const [isProfilesExpanded, setIsProfilesExpanded] = useState(true);

  // Full AI Configuration backup export / import states
  const [isAllConfigBackupModalOpen, setIsAllConfigBackupModalOpen] = useState(false);
  const [allConfigImportText, setAllConfigImportText] = useState('');
  const [allConfigImportError, setAllConfigImportError] = useState<string | null>(null);
  const [allConfigImportSuccess, setAllConfigImportSuccess] = useState<string | null>(null);
  const [allConfigCopied, setAllConfigCopied] = useState(false);

  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedJailbreakPreset, setSelectedJailbreakPreset] = useState(() => {
    const activeId = formConfig.activeJailbreakPresetId;
    if (activeId) {
      const foundCustom = (formConfig.customJailbreakPresets || []).find((p) => p.id === activeId);
      if (foundCustom) return foundCustom;
      const foundBuiltin = JAILBREAK_PRESETS.find((p) => p.id === activeId);
      if (foundBuiltin) return foundBuiltin;
    }
    return JAILBREAK_PRESETS[0] || EMPTY_JAILBREAK_PRESET;
  });
  const [showJailbreakVisualizer, setShowJailbreakVisualizer] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Jailbreak custom presets management modals & states
  const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [savePresetDesc, setSavePresetDesc] = useState('');
  const [isJailbreakImportOpen, setIsJailbreakImportOpen] = useState(false);
  const [jailbreakImportText, setJailbreakImportText] = useState('');
  const [jailbreakImportError, setJailbreakImportError] = useState<string | null>(null);
  const [jailbreakImportSuccess, setJailbreakImportSuccess] = useState<string | null>(null);
  const [jailbreakCopied, setJailbreakCopied] = useState(false);

  // Provider category filter & search
  const [providerCategory, setProviderCategory] = useState<'all' | 'core' | 'domestic' | 'local' | 'custom'>('core');
  const [providerSearch, setProviderSearch] = useState('');

  // Custom provider modal (create / edit)
  const [editingProvider, setEditingProvider] = useState<CustomAiProviderItem | null>(null);
  const [isProviderEditorOpen, setIsProviderEditorOpen] = useState(false);

  // Provider list export / import modal
  const [isProviderImportOpen, setIsProviderImportOpen] = useState(false);
  const [providerImportText, setProviderImportText] = useState('');
  const [providerImportError, setProviderImportError] = useState<string | null>(null);
  const [providerImportSuccess, setProviderImportSuccess] = useState<string | null>(null);
  const [providersCopied, setProvidersCopied] = useState(false);

  // WorldView Card export / import / full reading states
  const [isWorldViewExpanded, setIsWorldViewExpanded] = useState(false);
  const [isWorldViewImportOpen, setIsWorldViewImportOpen] = useState(false);
  const [worldViewImportText, setWorldViewImportText] = useState('');
  const [worldViewImportError, setWorldViewImportError] = useState<string | null>(null);
  const [worldViewImportSuccess, setWorldViewImportSuccess] = useState<string | null>(null);
  const [worldViewCopied, setWorldViewCopied] = useState(false);
  const [worldViewCardName, setWorldViewCardName] = useState('自定义宇宙世界观');

  // WorldView Slots Management States
  const [isSaveWorldViewSlotModalOpen, setIsSaveWorldViewSlotModalOpen] = useState(false);
  const [saveWorldViewSlotName, setSaveWorldViewSlotName] = useState('');
  const [saveWorldViewSlotSummary, setSaveWorldViewSlotSummary] = useState('');
  const [saveWorldViewSlotDesc, setSaveWorldViewSlotDesc] = useState('');
  const [saveWorldViewSlotTags, setSaveWorldViewSlotTags] = useState('原创世界观');
  const [editingWorldViewSlotId, setEditingWorldViewSlotId] = useState<string | null>(null);
  const [worldViewSlotCategory, setWorldViewSlotCategory] = useState<'all' | 'builtin' | 'custom'>('all');
  const [worldViewSlotSearch, setWorldViewSlotSearch] = useState('');
  const [isWorldViewSlotsImportOpen, setIsWorldViewSlotsImportOpen] = useState(false);
  const [worldViewSlotsImportText, setWorldViewSlotsImportText] = useState('');
  const [worldViewSlotsImportError, setWorldViewSlotsImportError] = useState<string | null>(null);
  const [worldViewSlotsImportSuccess, setWorldViewSlotsImportSuccess] = useState<string | null>(null);
  const [worldViewSlotsCopied, setWorldViewSlotsCopied] = useState(false);
  const [quickSavedSlotNotify, setQuickSavedSlotNotify] = useState<string | null>(null);

  // System Prompt Custom Presets Management States & Auto-Save status
  const [isSaveSystemPresetModalOpen, setIsSaveSystemPresetModalOpen] = useState(false);
  const [saveSystemPresetName, setSaveSystemPresetName] = useState('');
  const [saveSystemPresetDesc, setSaveSystemPresetDesc] = useState('');
  const [editingSystemPresetId, setEditingSystemPresetId] = useState<string | null>(null);
  const [systemPresetCategory, setSystemPresetCategory] = useState<'all' | 'builtin' | 'custom'>('all');
  const [systemPresetSearch, setSystemPresetSearch] = useState('');
  const [isSystemPresetImportOpen, setIsSystemPresetImportOpen] = useState(false);
  const [systemPresetImportText, setSystemPresetImportText] = useState('');
  const [systemPresetImportError, setSystemPresetImportError] = useState<string | null>(null);
  const [systemPresetImportSuccess, setSystemPresetImportSuccess] = useState<string | null>(null);
  const [systemPresetsCopied, setSystemPresetsCopied] = useState(false);
  const [autoSavedNotice, setAutoSavedNotice] = useState<string | null>(null);

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [suggestedTestBaseUrl, setSuggestedTestBaseUrl] = useState<string | null>(null);

  const currentProviders = formConfig.customProviders || BUILTIN_AI_PROVIDERS;
  const activeProvider = currentProviders.find((p) => p.id === (formConfig.activeProviderId || formConfig.provider)) || currentProviders[0];

  // Filter providers by category & search query
  const filteredProviders = currentProviders.filter((p) => {
    if (providerSearch.trim()) {
      const q = providerSearch.toLowerCase().trim();
      const matchesSearch =
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.baseUrl.toLowerCase().includes(q) ||
        p.defaultModel.toLowerCase().includes(q) ||
        (p.note && p.note.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }

    if (providerCategory === 'all') return true;
    if (providerCategory === 'custom') return !p.isBuiltIn;
    if (providerCategory === 'core') {
      return ['deepseek', 'openai', 'gemini', 'claude', 'siliconflow', 'openrouter', 'agnes', 'oneapi_custom'].includes(p.id);
    }
    if (providerCategory === 'domestic') {
      return ['moonshot', 'zhipu', 'aliyun_qwen', 'doubao', 'yi', 'stepfun', 'siliconflow'].includes(p.id);
    }
    if (providerCategory === 'local') {
      return ['ollama_local', 'lmstudio_local', 'oneapi_custom', 'agnes'].includes(p.id);
    }
    return true;
  });

  // Switch active provider
  const handleSelectProvider = (prov: CustomAiProviderItem) => {
    ultraAudio.playUiClick();
    // Switching provider starts a fresh key-editing session for that provider.
    activeProviderKeyEditedRef.current = false;
    // Keep exactly ONE thing highlighted: a provider switch may re-match a profile, but a
    // previously loaded profile card must not stay marked as "当前生效" (looked like 多项选择).
    const matchedProfile = (formConfig.apiProfiles || DEFAULT_API_PROFILES).find(
      (p) => p.provider === prov.id && p.model === prov.defaultModel
    );
    setActiveProfileId(matchedProfile ? matchedProfile.id : null);
    setFormConfig((prev) => ({
      ...prev,
      provider: prov.id,
      activeProviderId: prov.id,
      activeProviderName: prov.name,
      baseUrl: prov.baseUrl,
      model: prov.defaultModel,
      apiKey: prov.apiKey || prev.apiKey, // Use dedicated key if set
    }));
  };

  // Open editor to create new custom provider
  const handleOpenCreateProvider = () => {
    ultraAudio.playUiClick();
    const newProv: CustomAiProviderItem = {
      id: `prov_custom_${Date.now()}`,
      name: '我的自定义 AI 服务商',
      protocolType: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      modelsPreset: ['gpt-4o-mini', 'gpt-4o'],
      note: '自定义 OpenAI 兼容接口 / 第三方中转站',
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };
    setEditingProvider(newProv);
    setIsProviderEditorOpen(true);
  };

  // Open editor to edit an existing provider
  const handleOpenEditProvider = (prov: CustomAiProviderItem, e: React.MouseEvent) => {
    e.stopPropagation();
    ultraAudio.playUiClick();
    setEditingProvider({ ...prov });
    setIsProviderEditorOpen(true);
  };

  // Clone an existing provider
  const handleCloneProvider = (prov: CustomAiProviderItem, e: React.MouseEvent) => {
    e.stopPropagation();
    ultraAudio.playUiClick();
    const cloned: CustomAiProviderItem = {
      ...prov,
      id: `prov_custom_${Date.now()}`,
      name: `${prov.name} (副本)`,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    };
    const updatedList = [...currentProviders, cloned];
    setFormConfig((prev) => ({
      ...prev,
      customProviders: updatedList,
    }));
  };

  // Delete a custom provider
  const handleDeleteProvider = (provId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    ultraAudio.playUiClick();
    if (confirm('确定要删除该自定义服务商吗？')) {
      const updatedList = currentProviders.filter((p) => p.id !== provId);
      const newActiveId = (formConfig.activeProviderId === provId)
        ? (updatedList[0]?.id || 'deepseek')
        : formConfig.activeProviderId;
      const newActiveProv = updatedList.find((p) => p.id === newActiveId) || updatedList[0];

      setFormConfig((prev) => ({
        ...prev,
        customProviders: updatedList,
        activeProviderId: newActiveId,
        provider: newActiveId,
        activeProviderName: newActiveProv?.name,
        baseUrl: newActiveProv?.baseUrl || prev.baseUrl,
        model: newActiveProv?.defaultModel || prev.model,
      }));
    }
  };

  // Save changes from Provider Editor Modal
  const handleSaveProviderFromEditor = (savedItem: CustomAiProviderItem) => {
    ultraAudio.playApiReplyChime();
    const existingIndex = currentProviders.findIndex((p) => p.id === savedItem.id);
    let updatedList: CustomAiProviderItem[];

    if (existingIndex >= 0) {
      updatedList = [...currentProviders];
      updatedList[existingIndex] = savedItem;
    } else {
      updatedList = [...currentProviders, savedItem];
    }

    // If currently active provider was modified, sync form values
    const isCurrentlyActive = formConfig.activeProviderId === savedItem.id;
    setFormConfig((prev) => ({
      ...prev,
      customProviders: updatedList,
      ...(isCurrentlyActive
        ? {
            activeProviderName: savedItem.name,
            baseUrl: savedItem.baseUrl,
            model: savedItem.defaultModel,
            apiKey: savedItem.apiKey || prev.apiKey,
          }
        : {}),
    }));

    setIsProviderEditorOpen(false);
    setEditingProvider(null);
  };

  // Reset to default builtin providers
  const handleResetDefaultProviders = () => {
    if (confirm('确定要恢复默认内置服务商列表吗？这将保留您的自定义服务商，但会重置内置服务商的初始配置。')) {
      ultraAudio.playUiClick();
      const freshList = getInitialCustomProviders(
        currentProviders.filter((p) => !p.isBuiltIn)
      );
      setFormConfig((prev) => ({
        ...prev,
        customProviders: freshList,
      }));
    }
  };

  // Export provider configurations
  const handleExportProviders = () => {
    ultraAudio.playUiClick();
    const exportData = {
      app: 'Ultrawoman Tokusatsu AI Simulator',
      type: 'custom_ai_providers_backup',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      providers: currentProviders,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI服务商配置合集_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy provider list JSON
  const handleCopyProvidersJson = () => {
    ultraAudio.playUiClick();
    navigator.clipboard.writeText(JSON.stringify(currentProviders, null, 2));
    setProvidersCopied(true);
    setTimeout(() => setProvidersCopied(false), 2000);
  };

  // Import providers from text or file
  const handleConfirmProviderImport = () => {
    if (!providerImportText.trim()) {
      setProviderImportError('请输入服务商 JSON 数据');
      return;
    }
    try {
      const parsed = JSON.parse(providerImportText);
      const incomingList: CustomAiProviderItem[] = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed.providers) ? parsed.providers : []);

      if (incomingList.length === 0) {
        setProviderImportError('未在数据中找到有效的服务商列表 (需为 JSON 数组或包含 providers 字段)');
        return;
      }

      // Merge imported providers into existing
      const existingMap = new Map<string, CustomAiProviderItem>();
      currentProviders.forEach((p) => existingMap.set(p.id, p));
      incomingList.forEach((p) => {
        if (p && p.name && p.baseUrl) {
          const id = p.id || `prov_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          existingMap.set(id, { ...p, id });
        }
      });

      const merged = Array.from(existingMap.values());
      setFormConfig((prev) => ({
        ...prev,
        customProviders: merged,
      }));

      ultraAudio.playApiReplyChime();
      setProviderImportSuccess(`✅ 成功导入并合并 ${incomingList.length} 个 AI 服务商！`);
      setTimeout(() => {
        setIsProviderImportOpen(false);
        setProviderImportText('');
        setProviderImportError(null);
        setProviderImportSuccess(null);
      }, 1200);
    } catch (e: any) {
      setProviderImportError('JSON 格式错误：' + (e?.message || String(e)));
    }
  };

  const handleProviderFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        setProviderImportText(text);
        setProviderImportError(null);
      }
    };
    reader.readAsText(file);
  };

  // Instant Save handler (with persistence to localStorage and parent onSaveConfig)
  const handleSaveNow = (silent: boolean = false) => {
    if (!silent) {
      ultraAudio.playChimeSFX();
    }
    const currentProvList = formConfig.customProviders || BUILTIN_AI_PROVIDERS;
    const curActiveProv = currentProvList.find((p) => p.id === (formConfig.activeProviderId || formConfig.provider)) || currentProvList[0];

    // Update current active provider with latest apiKey/baseUrl/model.
    // The key is only written into the provider entry when the user actually typed it here —
    // otherwise switching providers would copy the previous provider's key into this one.
    const updatedProviders = currentProvList.map((p) => {
      if (p.id === curActiveProv?.id) {
        return {
          ...p,
          apiKey: activeProviderKeyEditedRef.current ? (formConfig.apiKey || p.apiKey) : p.apiKey,
          baseUrl: formConfig.baseUrl || p.baseUrl,
          defaultModel: formConfig.model || p.defaultModel,
        };
      }
      return p;
    });

    const updatedConfig: AiConfig = {
      ...formConfig,
      customProviders: updatedProviders,
      activeProviderId: curActiveProv?.id || formConfig.provider,
      activeProviderName: curActiveProv?.name,
    };

    setFormConfig(updatedConfig);
    commitConfig(updatedConfig);

    try {
      localStorage.setItem('ultra_ai_config_v1', JSON.stringify(updatedConfig));
      if (updatedConfig.apiProfiles && updatedConfig.apiProfiles.length > 0) {
        localStorage.setItem('ultra_ai_config_presets_v1', JSON.stringify(updatedConfig.apiProfiles));
      }
    } catch (e) {
      console.error('Failed to persist AI Config:', e);
    }

    if (!silent) {
      setSaveToastMsg('✅ API 设置已成功保存并立即生效！');
      setTimeout(() => setSaveToastMsg(null), 3500);
    }
  };

  // Real-time automatic persistence for all fields including customSystemPrompt, enableThinking, thinkingBudget, etc.
  // GUARD: only auto-save while the modal is actually open and only when something really changed,
  // otherwise a hidden modal would flush its stale snapshot over the authoritative config.
  useEffect(() => {
    if (!isOpen) return;
    const snapshot = JSON.stringify(formConfig);
    if (snapshot === lastAutoSavedRef.current) return;
    const timer = setTimeout(() => {
      lastAutoSavedRef.current = snapshot;
      try {
        localStorage.setItem('ultra_ai_config_v1', snapshot);
        commitConfig(buildProviderSyncedConfig(formConfig));
        setAutoSavedNotice('🟢 已自动保存所有设置');
      } catch (e) {
        console.warn('Auto-save error:', e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [formConfig, isOpen, commitConfig, buildProviderSyncedConfig]);

  // Never drop a debounced edit on a quick close: flush it synchronously when the modal closes.
  const wasOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      const snapshot = JSON.stringify(formConfig);
      if (snapshot !== lastAutoSavedRef.current) {
        lastAutoSavedRef.current = snapshot;
        try {
          localStorage.setItem('ultra_ai_config_v1', snapshot);
        } catch {}
        commitConfig(buildProviderSyncedConfig(formConfig));
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, formConfig, commitConfig, buildProviderSyncedConfig]);

  // System Prompt Preset Handlers
  const handleSelectSystemPreset = (preset: SystemPromptPreset) => {
    ultraAudio.playUiClick();
    setFormConfig((prev) => ({
      ...prev,
      customSystemPrompt: preset.prompt,
      activeSystemPresetId: preset.id,
    }));
    setAutoSavedNotice(`✨ 已切换为【${preset.name}】并自动保存`);
    setTimeout(() => setAutoSavedNotice(null), 3000);
  };

  const handleSaveNewSystemPreset = () => {
    if (!saveSystemPresetName.trim()) {
      alert('请输入预设名称');
      return;
    }
    ultraAudio.playChimeSFX();
    const currentCustom = formConfig.customSystemPresets || [];
    const newPreset: SystemPromptPreset = {
      id: `sys_custom_${Date.now()}`,
      name: saveSystemPresetName.trim(),
      description: saveSystemPresetDesc.trim() || '用户自定义通用系统与叙事引导指令',
      prompt: formConfig.customSystemPrompt,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedCustom = [newPreset, ...currentCustom];
    const updatedConfig: AiConfig = {
      ...formConfig,
      customSystemPresets: updatedCustom,
      activeSystemPresetId: newPreset.id,
    };
    setFormConfig(updatedConfig);
    commitConfig(updatedConfig);
    try {
      localStorage.setItem('ultra_ai_config_v1', JSON.stringify(updatedConfig));
    } catch {}
    setIsSaveSystemPresetModalOpen(false);
    setSaveSystemPresetName('');
    setSaveSystemPresetDesc('');
    setSaveToastMsg(`💾 成功保存自定义系统预设【${newPreset.name}】！`);
    setTimeout(() => setSaveToastMsg(null), 3500);
  };

  const handleOverwriteSystemPreset = (preset: SystemPromptPreset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    ultraAudio.playChimeSFX();
    const currentCustom = formConfig.customSystemPresets || [];
    const updatedCustom = currentCustom.map((p) =>
      p.id === preset.id
        ? { ...p, prompt: formConfig.customSystemPrompt, updatedAt: Date.now() }
        : p
    );
    const updatedConfig: AiConfig = {
      ...formConfig,
      customSystemPresets: updatedCustom,
      activeSystemPresetId: preset.id,
    };
    setFormConfig(updatedConfig);
    commitConfig(updatedConfig);
    try {
      localStorage.setItem('ultra_ai_config_v1', JSON.stringify(updatedConfig));
    } catch {}
    setSaveToastMsg(`🔄 已覆盖更新系统预设【${preset.name}】的内容！`);
    setTimeout(() => setSaveToastMsg(null), 3500);
  };

  const handleDeleteSystemPreset = (presetId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('确定要删除这个自定义系统预设吗？')) return;
    ultraAudio.playUiClick();
    const currentCustom = formConfig.customSystemPresets || [];
    const updatedCustom = currentCustom.filter((p) => p.id !== presetId);
    const updatedConfig: AiConfig = {
      ...formConfig,
      customSystemPresets: updatedCustom,
      activeSystemPresetId: formConfig.activeSystemPresetId === presetId ? undefined : formConfig.activeSystemPresetId,
    };
    setFormConfig(updatedConfig);
    commitConfig(updatedConfig);
    try {
      localStorage.setItem('ultra_ai_config_v1', JSON.stringify(updatedConfig));
    } catch {}
    setSaveToastMsg('🗑️ 已删除该自定义系统预设');
    setTimeout(() => setSaveToastMsg(null), 3000);
  };

  const handleExportSystemPresets = () => {
    ultraAudio.playUiClick();
    const presetsToExport = {
      type: 'ultra_system_prompt_presets_backup',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      presets: [
        ...BUILTIN_SYSTEM_PROMPT_PRESETS,
        ...(formConfig.customSystemPresets || []),
      ],
    };
    const blob = new Blob([JSON.stringify(presetsToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `系统与叙事引导预设库_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSystemPresets = () => {
    if (!systemPresetImportText.trim()) {
      setSystemPresetImportError('请输入或粘贴预设库 JSON 数据');
      return;
    }
    try {
      const parsed = JSON.parse(systemPresetImportText);
      const incomingList: SystemPromptPreset[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.presets)
        ? parsed.presets
        : [];
      if (incomingList.length === 0) {
        setSystemPresetImportError('未识别出有效的系统预设列表');
        return;
      }
      const existing = formConfig.customSystemPresets || [];
      const existingMap = new Map<string, SystemPromptPreset>();
      existing.forEach((p) => existingMap.set(p.id, p));
      incomingList.forEach((p) => {
        if (p && p.name && p.prompt) {
          const id = p.id || `sys_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          existingMap.set(id, { ...p, id, isDefault: false });
        }
      });
      const merged = Array.from(existingMap.values());
      const updatedConfig: AiConfig = {
        ...formConfig,
        customSystemPresets: merged,
      };
      setFormConfig(updatedConfig);
      commitConfig(updatedConfig);
      try {
        localStorage.setItem('ultra_ai_config_v1', JSON.stringify(updatedConfig));
      } catch {}
      setSystemPresetImportSuccess(`✅ 成功导入并合并 ${incomingList.length} 项系统预设！`);
      setTimeout(() => {
        setIsSystemPresetImportOpen(false);
        setSystemPresetImportText('');
        setSystemPresetImportError(null);
        setSystemPresetImportSuccess(null);
      }, 1200);
    } catch (e: any) {
      setSystemPresetImportError('JSON 解析错误：' + (e?.message || String(e)));
    }
  };

  const handleSystemPresetFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        setSystemPresetImportText(text);
        setSystemPresetImportError(null);
      }
    };
    reader.readAsText(file);
  };

  // API Config Profile Management Handlers
  const handleSelectProfile = (profile: AiConfigProfile) => {
    ultraAudio.playChimeSFX();
    setActiveProfileId(profile.id);

    // Find if provider exists in customProviders
    const provId = profile.activeProviderId || profile.provider || 'deepseek';
    const foundProv = (formConfig.customProviders || BUILTIN_AI_PROVIDERS).find((p) => p.id === provId);

    const updated: AiConfig = {
      ...formConfig,
      provider: profile.provider,
      activeProviderId: provId,
      activeProviderName: profile.activeProviderName || foundProv?.name,
      apiKey: profile.apiKey || foundProv?.apiKey || formConfig.apiKey,
      baseUrl: profile.baseUrl || foundProv?.baseUrl || formConfig.baseUrl,
      model: profile.model || foundProv?.defaultModel || formConfig.model,
      temperature: profile.temperature ?? formConfig.temperature,
      // IMPORTANT: an API 方案 only manages provider / model / key / temperature.
      // 破限预设、破限提示词、系统提示词、世界观必须保持用户当前设置不变 ——
      // 之前这里会把方案创建时的旧快照整套套回去，导致"切服务商后下面几栏变回很早之前"，
      // 并且方案卡与服务商同时显示选中（看起来像"多项选择"）。
    };

    setFormConfig(updated);
    commitConfig(updated);

    try {
      localStorage.setItem('ultra_ai_config_v1', JSON.stringify(updated));
    } catch {}

    setSaveToastMsg(`⚡ 已成功加载并激活 API 预设方案【${profile.name}】！`);
    setTimeout(() => setSaveToastMsg(null), 3500);
  };

  const handleOpenSaveProfile = (profileToEdit?: AiConfigProfile) => {
    ultraAudio.playUiClick();
    if (profileToEdit) {
      setEditingProfileId(profileToEdit.id);
      setSaveProfileName(profileToEdit.name);
      setSaveProfileDesc(profileToEdit.description || '');
    } else {
      setEditingProfileId(null);
      setSaveProfileName(`${activeProvider?.name || '我的'} 专属方案 (${new Date().toLocaleDateString()})`);
      setSaveProfileDesc(`${activeProvider?.name || ''} · ${formConfig.model} · 温度: ${formConfig.temperature}`);
    }
    setIsSaveProfileModalOpen(true);
  };

  const handleSaveProfileSubmit = () => {
    if (!saveProfileName.trim()) return;
    ultraAudio.playChimeSFX();

    const currentProfiles = formConfig.apiProfiles || DEFAULT_API_PROFILES;
    const now = new Date().toISOString();

    const profileSnapshot: AiConfigProfile = {
      id: editingProfileId || `profile_custom_${Date.now()}`,
      name: saveProfileName.trim(),
      description: saveProfileDesc.trim() || undefined,
      createdAt: editingProfileId ? (currentProfiles.find((p) => p.id === editingProfileId)?.createdAt || now) : now,
      updatedAt: now,
      provider: formConfig.provider,
      activeProviderId: activeProvider?.id || formConfig.provider,
      activeProviderName: activeProvider?.name,
      apiKey: formConfig.apiKey,
      baseUrl: formConfig.baseUrl,
      model: formConfig.model,
      temperature: formConfig.temperature,
      // 方案只保存/更新 API 设置（服务商/模型/Key/温度）；破限/世界观/系统提示词属于全局设置，不进方案、不被方案改动。
    };

    let updatedProfiles: AiConfigProfile[];
    if (editingProfileId) {
      updatedProfiles = currentProfiles.map((p) => (p.id === editingProfileId ? profileSnapshot : p));
    } else {
      updatedProfiles = [profileSnapshot, ...currentProfiles];
      setActiveProfileId(profileSnapshot.id);
    }

    const updatedConfig: AiConfig = {
      ...formConfig,
      apiProfiles: updatedProfiles,
    };

    setFormConfig(updatedConfig);
    commitConfig(updatedConfig);

    try {
      localStorage.setItem('ultra_ai_config_v1', JSON.stringify(updatedConfig));
      localStorage.setItem('ultra_ai_config_presets_v1', JSON.stringify(updatedProfiles));
    } catch {}

    setIsSaveProfileModalOpen(false);
    setSaveProfileName('');
    setSaveProfileDesc('');
    setEditingProfileId(null);
    setSaveToastMsg(`💾 已成功保存 API 预设方案【${profileSnapshot.name}】！`);
    setTimeout(() => setSaveToastMsg(null), 3500);
  };

  const handleQuickOverwriteCurrentProfile = () => {
    if (!activeProfileId) return;
    const currentProfiles = formConfig.apiProfiles || DEFAULT_API_PROFILES;
    const target = currentProfiles.find((p) => p.id === activeProfileId);
    if (!target) return;

    ultraAudio.playChimeSFX();
    const updatedProfile: AiConfigProfile = {
      ...target,
      provider: formConfig.provider,
      activeProviderId: activeProvider?.id || formConfig.provider,
      activeProviderName: activeProvider?.name,
      apiKey: formConfig.apiKey,
      baseUrl: formConfig.baseUrl,
      model: formConfig.model,
      temperature: formConfig.temperature,
      // 方案只保存/更新 API 设置（服务商/模型/Key/温度）；破限/世界观/系统提示词属于全局设置，不进方案、不被方案改动。
      updatedAt: new Date().toISOString(),
    };

    const updatedProfiles = currentProfiles.map((p) => (p.id === activeProfileId ? updatedProfile : p));
    const updatedConfig: AiConfig = {
      ...formConfig,
      apiProfiles: updatedProfiles,
    };

    setFormConfig(updatedConfig);
    commitConfig(updatedConfig);

    try {
      localStorage.setItem('ultra_ai_config_v1', JSON.stringify(updatedConfig));
      localStorage.setItem('ultra_ai_config_presets_v1', JSON.stringify(updatedProfiles));
    } catch {}

    setSaveToastMsg(`🔄 已覆盖更新 API 预设方案【${target.name}】！`);
    setTimeout(() => setSaveToastMsg(null), 3500);
  };

  const handleCloneProfile = (profile: AiConfigProfile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    ultraAudio.playChimeSFX();

    const currentProfiles = formConfig.apiProfiles || DEFAULT_API_PROFILES;
    const newProfile: AiConfigProfile = {
      ...profile,
      id: `profile_custom_${Date.now()}`,
      name: `${profile.name} (副本)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedProfiles = [newProfile, ...currentProfiles];
    const updatedConfig: AiConfig = {
      ...formConfig,
      apiProfiles: updatedProfiles,
    };

    setFormConfig(updatedConfig);
    commitConfig(updatedConfig);

    try {
      localStorage.setItem('ultra_ai_config_presets_v1', JSON.stringify(updatedProfiles));
    } catch {}

    setSaveToastMsg(`📋 成功克隆预设方案【${newProfile.name}】！`);
    setTimeout(() => setSaveToastMsg(null), 3500);
  };

  const handleDeleteProfile = (profileId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('确定要删除这个 API 预设方案吗？')) return;

    ultraAudio.playUiClick();
    const currentProfiles = formConfig.apiProfiles || DEFAULT_API_PROFILES;
    const updatedProfiles = currentProfiles.filter((p) => p.id !== profileId);

    const updatedConfig: AiConfig = {
      ...formConfig,
      apiProfiles: updatedProfiles,
    };

    setFormConfig(updatedConfig);
    commitConfig(updatedConfig);

    if (activeProfileId === profileId) {
      setActiveProfileId(null);
    }

    try {
      localStorage.setItem('ultra_ai_config_presets_v1', JSON.stringify(updatedProfiles));
    } catch {}

    setSaveToastMsg('🗑️ 已删除该 API 预设方案');
    setTimeout(() => setSaveToastMsg(null), 3000);
  };

  // Full AI Configuration Export / Import Handlers
  const handleExportFullAiConfigBackup = () => {
    ultraAudio.playUiClick();
    const fullBackup = {
      app: 'Ultrawoman Tokusatsu AI Simulator',
      type: 'full_ai_configuration_backup',
      version: '3.0',
      exportedAt: new Date().toISOString(),
      config: formConfig,
    };
    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI与API全量配置备份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyFullAiConfigJson = () => {
    ultraAudio.playUiClick();
    navigator.clipboard.writeText(JSON.stringify(formConfig, null, 2));
    setAllConfigCopied(true);
    setTimeout(() => setAllConfigCopied(false), 2000);
  };

  const handleConfirmFullAiConfigImport = () => {
    if (!allConfigImportText.trim()) {
      setAllConfigImportError('请输入或粘贴 AI 配置备份 JSON 数据');
      return;
    }
    try {
      const parsed = JSON.parse(allConfigImportText);
      const incomingConfig: Partial<AiConfig> = parsed.config || parsed;

      if (!incomingConfig || typeof incomingConfig !== 'object') {
        setAllConfigImportError('未识别出有效的 AI 配置结构');
        return;
      }

      const mergedProviders = getInitialCustomProviders(incomingConfig.customProviders || formConfig.customProviders);
      const mergedProfiles = getInitialApiProfiles(incomingConfig.apiProfiles || formConfig.apiProfiles);

      const mergedConfig: AiConfig = {
        ...formConfig,
        ...incomingConfig,
        customProviders: mergedProviders,
        apiProfiles: mergedProfiles,
        activeProviderId: incomingConfig.activeProviderId || formConfig.activeProviderId,
        customJailbreakPresets: incomingConfig.customJailbreakPresets || formConfig.customJailbreakPresets,
        customWorldViewSlots: incomingConfig.customWorldViewSlots || formConfig.customWorldViewSlots,
      };

      setFormConfig(mergedConfig);
      commitConfig(mergedConfig);

      try {
        localStorage.setItem('ultra_ai_config_v1', JSON.stringify(mergedConfig));
        if (mergedConfig.apiProfiles) {
          localStorage.setItem('ultra_ai_config_presets_v1', JSON.stringify(mergedConfig.apiProfiles));
        }
      } catch {}

      ultraAudio.playApiReplyChime();
      setAllConfigImportSuccess('✅ 成功导入并恢复全量 AI / API 配置文件！');
      setTimeout(() => {
        setIsAllConfigBackupModalOpen(false);
        setAllConfigImportText('');
        setAllConfigImportError(null);
        setAllConfigImportSuccess(null);
        setSaveToastMsg('✅ 已成功导入并应用全量 API 设置！');
        setTimeout(() => setSaveToastMsg(null), 3500);
      }, 1200);
    } catch (e: any) {
      setAllConfigImportError('JSON 解析错误：' + (e?.message || String(e)));
    }
  };

  const handleAllConfigFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        setAllConfigImportText(text);
        setAllConfigImportError(null);
      }
    };
    reader.readAsText(file);
  };

  // Save current active API key into active provider item
  const handleSaveKeyToActiveProvider = () => {
    if (!activeProvider) return;
    ultraAudio.playChimeSFX();
    const updatedList = currentProviders.map((p) => {
      if (p.id === activeProvider.id) {
        return { ...p, apiKey: formConfig.apiKey };
      }
      return p;
    });
    const updatedConfig: AiConfig = {
      ...formConfig,
      customProviders: updatedList,
    };
    setFormConfig(updatedConfig);
    commitConfig(updatedConfig);
    try {
      localStorage.setItem('ultra_ai_config_v1', JSON.stringify(updatedConfig));
    } catch {}
    setSaveToastMsg(`💾 已将当前密钥绑定保存至【${activeProvider.name}】并持久化！`);
    setTimeout(() => setSaveToastMsg(null), 3500);
  };

  // WorldView Card Handlers
  const handleExportWorldView = () => {
    ultraAudio.playUiClick();
    downloadWorldViewCardFile(formConfig.customWorldView || '', worldViewCardName || '宇宙世界观设定');
  };

  const handleCopyWorldViewCard = () => {
    ultraAudio.playUiClick();
    const card = exportWorldViewCard(formConfig.customWorldView || '', worldViewCardName || '宇宙世界观设定');
    navigator.clipboard.writeText(JSON.stringify(card, null, 2));
    setWorldViewCopied(true);
    setTimeout(() => setWorldViewCopied(false), 2000);
  };

  const handleWorldViewFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    ultraAudio.playUiClick();
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setWorldViewImportText(content);
        setWorldViewImportError(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmWorldViewImport = () => {
    if (!worldViewImportText.trim()) {
      setWorldViewImportError('请输入或上传世界观卡 JSON 数据');
      return;
    }
    const res = parseWorldViewCard(worldViewImportText);
    if (!res.success || !res.card) {
      setWorldViewImportError(res.error || '世界观卡解析失败');
      return;
    }

    ultraAudio.playApiReplyChime();
    setFormConfig((prev) => ({
      ...prev,
      customWorldView: res.card?.content || '',
      worldViewEnabled: true,
    }));
    if (res.card?.name) {
      setWorldViewCardName(res.card.name);
    }
    setWorldViewImportSuccess(`✅ 成功导入世界观卡【${res.card?.name || '宇宙世界观'}】！`);
    setTimeout(() => {
      setIsWorldViewImportOpen(false);
      setWorldViewImportText('');
      setWorldViewImportSuccess(null);
      setWorldViewImportError(null);
    }, 1000);
  };

  // =========================================================================
  // WorldView Slot Management Handlers (自定义世界观保存槽位库核心逻辑)
  // =========================================================================

  const allWorldViewSlots: WorldViewSlot[] = [
    ...BUILTIN_WORLD_VIEW_SLOTS,
    ...(formConfig.customWorldViewSlots || []),
  ];

  const activeWorldViewSlot =
    allWorldViewSlots.find((s) => s.id === formConfig.activeWorldViewSlotId) ||
    EMPTY_WORLD_VIEW_SLOT;

  const isCurrentSlotCustom = !(BUILTIN_WORLD_VIEW_SLOTS.some((b) => b.id === formConfig.activeWorldViewSlotId));

  // Select / activate slot
  const handleSelectWorldViewSlot = (slot: WorldViewSlot) => {
    ultraAudio.playUiClick();
    setFormConfig((prev) => ({
      ...prev,
      customWorldView: slot.prompt,
      worldViewEnabled: true,
      activeWorldViewSlotId: slot.id,
    }));
    setWorldViewCardName(slot.name.replace(/^[^\w\u4e00-\u9fa5]+/, '').trim() || slot.name);
  };

  // Open modal to create a new slot or edit existing slot
  const handleOpenSaveWorldViewSlot = (slotToEdit?: WorldViewSlot) => {
    ultraAudio.playUiClick();
    if (slotToEdit && slotToEdit.isCustom) {
      setEditingWorldViewSlotId(slotToEdit.id);
      setSaveWorldViewSlotName(slotToEdit.name);
      setSaveWorldViewSlotSummary(slotToEdit.summary || '');
      setSaveWorldViewSlotDesc(slotToEdit.description || '');
      setSaveWorldViewSlotTags((slotToEdit.tags || []).join(', ') || '自定义世界观');
    } else {
      setEditingWorldViewSlotId(null);
      const defaultName = worldViewCardName || (activeWorldViewSlot ? `${activeWorldViewSlot.name} (自定)` : '我的自定义世界观');
      setSaveWorldViewSlotName(defaultName);
      setSaveWorldViewSlotSummary(
        (formConfig.customWorldView || '').slice(0, 48).replace(/[\r\n]+/g, ' ') + '...'
      );
      setSaveWorldViewSlotDesc('');
      setSaveWorldViewSlotTags('原创世界观');
    }
    setIsSaveWorldViewSlotModalOpen(true);
  };

  // Submit slot save / edit
  const handleSaveWorldViewSlotSubmit = () => {
    if (!saveWorldViewSlotName.trim()) {
      alert('请输入世界观槽位名称');
      return;
    }

    const currentPrompt = formConfig.customWorldView || '';
    if (!currentPrompt.trim()) {
      alert('世界观设定正文不能为空');
      return;
    }

    ultraAudio.playChimeSFX();
    const tagsArray = saveWorldViewSlotTags
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingWorldViewSlotId) {
      // Update existing custom slot
      const updatedSlots = (formConfig.customWorldViewSlots || []).map((s) => {
        if (s.id === editingWorldViewSlotId) {
          return {
            ...s,
            name: saveWorldViewSlotName.trim(),
            summary: saveWorldViewSlotSummary.trim() || undefined,
            description: saveWorldViewSlotDesc.trim() || undefined,
            tags: tagsArray.length > 0 ? tagsArray : ['自定义世界观'],
            prompt: currentPrompt,
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });

      setFormConfig((prev) => ({
        ...prev,
        customWorldViewSlots: updatedSlots,
        activeWorldViewSlotId: editingWorldViewSlotId,
      }));
      setQuickSavedSlotNotify(`已更新世界观槽位【${saveWorldViewSlotName.trim()}】`);
    } else {
      // Create new custom slot
      const newSlot: WorldViewSlot = {
        id: `wv_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: saveWorldViewSlotName.trim(),
        summary: saveWorldViewSlotSummary.trim() || currentPrompt.slice(0, 48).replace(/[\r\n]+/g, ' ') + '...',
        description: saveWorldViewSlotDesc.trim() || undefined,
        prompt: currentPrompt,
        tags: tagsArray.length > 0 ? tagsArray : ['自定义世界观'],
        isCustom: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setFormConfig((prev) => ({
        ...prev,
        customWorldViewSlots: [...(prev.customWorldViewSlots || []), newSlot],
        activeWorldViewSlotId: newSlot.id,
      }));
      setQuickSavedSlotNotify(`已新建并保存世界观槽位【${newSlot.name}】`);
    }

    setTimeout(() => setQuickSavedSlotNotify(null), 3000);
    setIsSaveWorldViewSlotModalOpen(false);
  };

  // Quick overwrite current active custom slot with current textarea prompt
  const handleQuickOverwriteCurrentCustomSlot = () => {
    if (!isCurrentSlotCustom) {
      handleOpenSaveWorldViewSlot();
      return;
    }

    const currentPrompt = formConfig.customWorldView || '';
    ultraAudio.playChimeSFX();
    const updatedSlots = (formConfig.customWorldViewSlots || []).map((s) => {
      if (s.id === formConfig.activeWorldViewSlotId) {
        return {
          ...s,
          prompt: currentPrompt,
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    });

    setFormConfig((prev) => ({
      ...prev,
      customWorldViewSlots: updatedSlots,
    }));
    setQuickSavedSlotNotify(`已快速覆盖保存至槽位【${activeWorldViewSlot.name}】！`);
    setTimeout(() => setQuickSavedSlotNotify(null), 2500);
  };

  // Clone any slot as a new custom slot
  const handleCloneWorldViewSlot = (slot: WorldViewSlot, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    ultraAudio.playUiClick();
    const newSlot: WorldViewSlot = {
      id: `wv_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${slot.name} (副本)`,
      summary: slot.summary || '',
      description: slot.description || '',
      prompt: slot.prompt,
      tags: [...(slot.tags || []), '克隆副本'],
      isCustom: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setFormConfig((prev) => ({
      ...prev,
      customWorldViewSlots: [...(prev.customWorldViewSlots || []), newSlot],
      activeWorldViewSlotId: newSlot.id,
      customWorldView: newSlot.prompt,
      worldViewEnabled: true,
    }));
    setQuickSavedSlotNotify(`已克隆生成新槽位【${newSlot.name}】并激活！`);
    setTimeout(() => setQuickSavedSlotNotify(null), 3000);
  };

  // Delete a custom slot
  const handleDeleteCustomWorldViewSlot = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    ultraAudio.playUiClick();
    const target = (formConfig.customWorldViewSlots || []).find((s) => s.id === id);
    if (!target) return;

    if (!confirm(`确定要永久删除自定义世界观槽位【${target.name}】吗？此操作无法撤销。`)) {
      return;
    }

    const updatedSlots = (formConfig.customWorldViewSlots || []).filter((s) => s.id !== id);
    const newActiveId =
      formConfig.activeWorldViewSlotId === id
        ? (BUILTIN_WORLD_VIEW_SLOTS[0]?.id || '')
        : formConfig.activeWorldViewSlotId;

    const fallbackSlot =
      allWorldViewSlots.find((s) => s.id === newActiveId) || EMPTY_WORLD_VIEW_SLOT;

    setFormConfig((prev) => ({
      ...prev,
      customWorldViewSlots: updatedSlots,
      activeWorldViewSlotId: newActiveId,
      customWorldView:
        formConfig.activeWorldViewSlotId === id ? fallbackSlot.prompt : prev.customWorldView,
    }));
  };

  // 本仓库不附带任何内置世界观预设：该按钮改为「清空当前世界观设定」，
  // 避免引用已清空的内置列表（原来会读取 BUILTIN_WORLD_VIEW_SLOTS[0].id 而崩溃）。
  const handleResetDefaultWorldViewSlots = () => {
    ultraAudio.playUiClick();
    if (confirm('本程序不含内置世界观预设。确定要清空当前世界观设定吗？（您的自定义槽位会保留）')) {
      setFormConfig((prev) => ({
        ...prev,
        customWorldView: '',
        activeWorldViewSlotId: '',
        worldViewEnabled: false,
      }));
      setQuickSavedSlotNotify('已清空当前世界观设定');
      setTimeout(() => setQuickSavedSlotNotify(null), 2500);
    }
  };

  // Export all worldview slots (builtin + custom)
  const handleExportAllWorldViewSlots = () => {
    ultraAudio.playUiClick();
    const slotsToExport = formConfig.customWorldViewSlots && formConfig.customWorldViewSlots.length > 0
      ? [...BUILTIN_WORLD_VIEW_SLOTS, ...formConfig.customWorldViewSlots]
      : BUILTIN_WORLD_VIEW_SLOTS;
    downloadWorldViewSlotsFile(slotsToExport);
  };

  // Copy all slots JSON
  const handleCopyAllWorldViewSlotsJson = () => {
    ultraAudio.playUiClick();
    const slotsToExport = formConfig.customWorldViewSlots && formConfig.customWorldViewSlots.length > 0
      ? [...BUILTIN_WORLD_VIEW_SLOTS, ...formConfig.customWorldViewSlots]
      : BUILTIN_WORLD_VIEW_SLOTS;
    const backup = exportWorldViewSlotsBackup(slotsToExport);
    navigator.clipboard.writeText(JSON.stringify(backup, null, 2));
    setWorldViewSlotsCopied(true);
    setTimeout(() => setWorldViewSlotsCopied(false), 2000);
  };

  // File upload for worldview slots batch import
  const handleWorldViewSlotsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    ultraAudio.playUiClick();
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setWorldViewSlotsImportText(content);
        setWorldViewSlotsImportError(null);
      }
    };
    reader.readAsText(file);
  };

  // Confirm import of worldview slots
  const handleConfirmWorldViewSlotsImport = (mode: 'merge' | 'replace') => {
    if (!worldViewSlotsImportText.trim()) {
      setWorldViewSlotsImportError('请输入或上传世界观设定槽位 JSON 数据');
      return;
    }

    const res = parseWorldViewSlotsData(worldViewSlotsImportText);
    if (!res.success || !res.slots || res.slots.length === 0) {
      setWorldViewSlotsImportError(res.error || '解析世界观槽位数据失败');
      return;
    }

    ultraAudio.playApiReplyChime();
    const importedSlots = res.slots.map((s) => ({ ...s, isCustom: true }));

    let newCustomSlots: WorldViewSlot[] = [];
    if (mode === 'replace') {
      newCustomSlots = importedSlots;
    } else {
      // Merge by ID or append
      const current = formConfig.customWorldViewSlots || [];
      const map = new Map<string, WorldViewSlot>();
      current.forEach((s) => map.set(s.id, s));
      importedSlots.forEach((s) => map.set(s.id, s));
      newCustomSlots = Array.from(map.values());
    }

    const firstImported = importedSlots[0];
    setFormConfig((prev) => ({
      ...prev,
      customWorldViewSlots: newCustomSlots,
      customWorldView: firstImported.prompt,
      activeWorldViewSlotId: firstImported.id,
      worldViewEnabled: true,
    }));

    setWorldViewSlotsImportSuccess(
      `✅ 成功导入 ${importedSlots.length} 个世界观槽位！已自动切换至【${firstImported.name}】`
    );

    setTimeout(() => {
      setIsWorldViewSlotsImportOpen(false);
      setWorldViewSlotsImportText('');
      setWorldViewSlotsImportSuccess(null);
      setWorldViewSlotsImportError(null);
    }, 1200);
  };

  const handleCopyJailbreak = () => {
    const textToCopy = formConfig.customJailbreakPrompt || selectedJailbreakPreset.prompt;
    navigator.clipboard.writeText(textToCopy);
    setCopySuccess(true);
    ultraAudio.playChimeSFX();
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Switch active jailbreak preset
  const handleSelectJailbreakPreset = (preset: JailbreakPreset | (typeof JAILBREAK_PRESETS)[0]) => {
    ultraAudio.playUiClick();
    setSelectedJailbreakPreset(preset as any);
    setFormConfig((prev) => ({
      ...prev,
      customJailbreakPrompt: preset.prompt,
      activeJailbreakPresetId: preset.id,
      jailbreakAttachments: (preset as any).attachments ? JSON.parse(JSON.stringify((preset as any).attachments)) : prev.jailbreakAttachments,
    }));
  };

  // Save current jailbreak as a custom preset
  const handleSaveCustomJailbreakPreset = () => {
    if (!savePresetName.trim()) return;
    const currentPrompt = formConfig.customJailbreakPrompt || selectedJailbreakPreset.prompt;
    const newPreset: JailbreakPreset = {
      id: `jb_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: savePresetName.trim(),
      prompt: currentPrompt,
      description: savePresetDesc.trim() || '自定义保存的破限与反拒答方案',
      attachments: formConfig.jailbreakAttachments ? JSON.parse(JSON.stringify(formConfig.jailbreakAttachments)) : [],
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    const existingCustom = formConfig.customJailbreakPresets || [];
    const updatedCustom = [...existingCustom, newPreset];
    setFormConfig((prev) => ({
      ...prev,
      customJailbreakPresets: updatedCustom,
      activeJailbreakPresetId: newPreset.id,
    }));
    setSelectedJailbreakPreset(newPreset as any);
    setIsSavePresetModalOpen(false);
    setSavePresetName('');
    setSavePresetDesc('');
    ultraAudio.playApiReplyChime();
  };

  // Delete custom jailbreak preset
  const handleDeleteCustomJailbreakPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    ultraAudio.playUiClick();
    if (confirm('确定要删除该自定义破限方案吗？')) {
      const updatedCustom = (formConfig.customJailbreakPresets || []).filter((p) => p.id !== id);
      const fallbackPreset = JAILBREAK_PRESETS[0] || EMPTY_JAILBREAK_PRESET;
      setFormConfig((prev) => ({
        ...prev,
        customJailbreakPresets: updatedCustom,
        activeJailbreakPresetId: fallbackPreset.id,
        customJailbreakPrompt: fallbackPreset.prompt,
      }));
      setSelectedJailbreakPreset(fallbackPreset);
    }
  };

  // Export Jailbreak Card
  const handleExportJailbreakCard = () => {
    ultraAudio.playUiClick();
    const currentPrompt = formConfig.customJailbreakPrompt || selectedJailbreakPreset.prompt;
    const name = selectedJailbreakPreset.name.replace(/^[🔥⚡🎭⭐\s]+/, '') || '自定义破限方案';
    downloadJailbreakCardFile(
      name,
      currentPrompt,
      (selectedJailbreakPreset as any).description,
      formConfig.jailbreakAttachments
    );
  };

  const handleCopyJailbreakCard = () => {
    ultraAudio.playUiClick();
    const currentPrompt = formConfig.customJailbreakPrompt || selectedJailbreakPreset.prompt;
    const name = selectedJailbreakPreset.name.replace(/^[🔥⚡🎭⭐\s]+/, '') || '自定义破限方案';
    const card = exportJailbreakCard(
      name,
      currentPrompt,
      (selectedJailbreakPreset as any).description,
      formConfig.jailbreakAttachments
    );
    navigator.clipboard.writeText(JSON.stringify(card, null, 2));
    setJailbreakCopied(true);
    setTimeout(() => setJailbreakCopied(false), 2000);
  };

  // Import Jailbreak Card handlers
  const handleJailbreakFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    ultraAudio.playUiClick();
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setJailbreakImportText(content);
        setJailbreakImportError(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmJailbreakImport = () => {
    if (!jailbreakImportText.trim()) {
      setJailbreakImportError('请输入或上传破限卡 JSON 数据');
      return;
    }
    const res = parseJailbreakCard(jailbreakImportText);
    if (!res.success || !res.card) {
      setJailbreakImportError(res.error || '破限卡解析失败');
      return;
    }

    const card = res.card;
    const importedPreset: JailbreakPreset = {
      id: card.id || `jb_custom_${Date.now()}`,
      name: `⭐ ${card.name}`,
      prompt: card.prompt,
      description: card.description || '导入的自定义破限卡',
      attachments: card.attachments || [],
      isCustom: true,
      createdAt: card.createdAt || new Date().toISOString(),
    };

    const existingCustom = formConfig.customJailbreakPresets || [];
    const updatedCustom = [...existingCustom.filter((p) => p.id !== importedPreset.id), importedPreset];

    setFormConfig((prev) => ({
      ...prev,
      customJailbreakPresets: updatedCustom,
      customJailbreakPrompt: importedPreset.prompt,
      jailbreakAttachments: importedPreset.attachments || [],
      activeJailbreakPresetId: importedPreset.id,
      enableJailbreak: true,
    }));
    setSelectedJailbreakPreset(importedPreset as any);
    ultraAudio.playApiReplyChime();
    setJailbreakImportSuccess(`✅ 成功导入破限方案【${card.name}】！`);
    setTimeout(() => {
      setIsJailbreakImportOpen(false);
      setJailbreakImportText('');
      setJailbreakImportSuccess(null);
      setJailbreakImportError(null);
    }, 1000);
  };

  const handleAppendTag = (tag: string) => {
    ultraAudio.playUiClick();
    setFormConfig((prev) => ({
      ...prev,
      customSystemPrompt: prev.customSystemPrompt ? `${prev.customSystemPrompt}\n${tag}` : tag,
    }));
  };

  const handleTestConnection = async () => {
    if (!formConfig.apiKey.trim()) {
      setTestStatus('error');
      setTestMessage('请先填写有效的 API Key 密钥！');
      setSuggestedTestBaseUrl(null);
      return;
    }

    setTestStatus('testing');
    setTestMessage(`正在向【${activeProvider?.name || formConfig.provider}】(${formConfig.baseUrl}) 发送连接验证与路径探测...`);
    setTestLatency(null);
    setSuggestedTestBaseUrl(null);

    try {
      const res = await fetch('/api/test-ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiConfig: {
            ...formConfig,
            enabled: true,
            activeProviderId: activeProvider?.id,
            activeProviderName: activeProvider?.name,
          },
        }),
      });
      const data = await res.json();

      if (data.success) {
        setTestStatus('success');
        setTestMessage(data.message || '连接成功！模型可正常响应。');
        setTestLatency(data.latencyMs);
        if (data.detectedCorrectBaseUrl) {
          setSuggestedTestBaseUrl(data.detectedCorrectBaseUrl);
        }
        ultraAudio.playChimeSFX();
      } else {
        setTestStatus('error');
        setTestMessage(data.error || '连接测试失败，请检查 API Key 或 Base URL。');
        if (data.suggestedBaseUrl) {
          setSuggestedTestBaseUrl(data.suggestedBaseUrl);
        }
      }
    } catch (e: any) {
      setTestStatus('error');
      setTestMessage('网络或服务器异常：' + (e?.message || String(e)));
    }
  };

  const handleSave = () => {
    ultraAudio.playUiClick();
    handleSaveNow(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-zinc-950 border border-purple-500/40 rounded-xl max-w-4xl w-full p-4 sm:p-6 text-zinc-100 shadow-[0_0_40px_rgba(168,85,247,0.3)] flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 shrink-0 gap-2 flex-wrap">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-purple-950/70 border border-purple-500/50 text-purple-400">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono tracking-wide text-purple-300 flex items-center gap-2 flex-wrap">
                AI 引擎接口与服务商管理
                <span className="px-2 py-0.5 text-[10px] rounded bg-purple-950/80 border border-purple-500/50 text-purple-300 flex items-center gap-1">
                  <Server className="w-3 h-3 text-purple-400" />
                  支持全宇宙自定义服务商与中转
                </span>
                <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                  <Save className="w-3 h-3 text-emerald-400" />
                  支持多套 API 预设存档
                </span>
                <span className="px-2 py-0.5 text-[10px] rounded bg-rose-950/80 border border-rose-500/50 text-rose-300 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-rose-400" />
                  破限词可视化
                </span>
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                配置 DeepSeek / OpenAI / Claude / 硅基流动 / OpenRouter / 本地 Ollama 或任意自定义中转，支持随时保存多套 API 方案
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleSaveNow(false)}
              className="px-2.5 py-1.5 rounded-lg border border-emerald-500/60 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-mono font-bold flex items-center space-x-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] cursor-pointer"
              title="立即将当前 API 配置、密钥与参数持久化保存到本地存储"
            >
              <Save className="w-3.5 h-3.5" />
              <span>💾 快速保存设置</span>
            </button>
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                setIsAllConfigBackupModalOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-mono flex items-center space-x-1.5 transition-all cursor-pointer"
              title="导出或导入 AI / API 全量配置文件"
            >
              <FileJson className="w-3.5 h-3.5 text-purple-400" />
              <span>备份/还原</span>
            </button>
            <button
              onClick={() => {
                ultraAudio.playUiClick();
                onClose();
              }}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1 font-mono text-xs scrollbar-thin">
          {/* Global Save Toast Notification */}
          {saveToastMsg && (
            <div className="p-3 rounded-lg border bg-gradient-to-r from-emerald-950/90 via-zinc-900 to-emerald-950/90 border-emerald-500/80 text-emerald-200 flex items-center justify-between shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-fade-in">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
                <span className="font-bold text-xs">{saveToastMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveToastMsg(null)}
                className="text-emerald-400 hover:text-white text-xs p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Main Enable Switch */}
          <div className="p-3 rounded-lg border bg-gradient-to-r from-purple-950/40 via-zinc-900 to-indigo-950/30 border-purple-900/60 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Zap className={`w-4 h-4 ${formConfig.enabled ? 'text-purple-400 animate-pulse' : 'text-zinc-500'}`} />
              <div>
                <div className="font-bold text-zinc-200 flex items-center gap-2">
                  <span>开启第三方 AI 模型引擎</span>
                  {formConfig.enabled && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-950 border border-emerald-500/50 text-emerald-300">
                      已启用
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400">
                  关闭时将自动使用内置免费 Gemini 引擎或本地战术预设对白
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formConfig.enabled}
                onChange={(e) => {
                  ultraAudio.playUiClick();
                  setFormConfig({ ...formConfig, enabled: e.target.checked });
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* API Presets / Profile Slots Section (API 配置预设方案存档与快速切换) */}
          <div className="space-y-3 p-3.5 rounded-xl border bg-zinc-900/80 border-emerald-900/50 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Bookmark className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-zinc-200 text-xs flex items-center gap-1.5">
                  <span>API 设置预设方案与存档管理</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
                    {(formConfig.apiProfiles || DEFAULT_API_PROFILES).length} 个方案
                  </span>
                </span>
              </div>

              {/* Presets Action Toolbar */}
              <div className="flex items-center space-x-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleOpenSaveProfile()}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center space-x-1 transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] cursor-pointer"
                  title="将当前界面中的所有 API 设置存为一个全新的预设方案"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>+ 存为新方案</span>
                </button>

                {activeProfileId && (
                  <button
                    type="button"
                    onClick={handleQuickOverwriteCurrentProfile}
                    className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer"
                    title="用当前界面填写的最新参数覆盖更新当前激活的预设方案"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>🔄 覆盖当前方案</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleExportFullAiConfigBackup}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] flex items-center space-x-1 transition-all cursor-pointer"
                  title="导出全量 API 配置文件"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>导出</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setIsAllConfigBackupModalOpen(true);
                  }}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] flex items-center space-x-1 transition-all cursor-pointer"
                  title="导入备份配置文件"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-400" />
                  <span>导入</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsProfilesExpanded(!isProfilesExpanded)}
                  className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                  title={isProfilesExpanded ? '折叠方案列表' : '展开方案列表'}
                >
                  {isProfilesExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {isProfilesExpanded && (
              <>
                {/* Search & Filter Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center space-x-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setProfileCategory('all')}
                      className={`px-2.5 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                        profileCategory === 'all'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      全部 ({(formConfig.apiProfiles || DEFAULT_API_PROFILES).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileCategory('builtin')}
                      className={`px-2.5 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                        profileCategory === 'builtin'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      ⭐ 官方推荐 ({DEFAULT_API_PROFILES.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileCategory('custom')}
                      className={`px-2.5 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                        profileCategory === 'custom'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      📁 自定义方案 (
                      {
                        (formConfig.apiProfiles || DEFAULT_API_PROFILES).filter(
                          (p) => !DEFAULT_API_PROFILES.some((bp) => bp.id === p.id)
                        ).length
                      }
                      )
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={profileSearch}
                      onChange={(e) => setProfileSearch(e.target.value)}
                      placeholder="搜索 API 预设方案..."
                      className="bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-2.5 py-1 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono w-44 sm:w-56"
                    />
                  </div>
                </div>

                {/* Profiles Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                  {(formConfig.apiProfiles || DEFAULT_API_PROFILES)
                    .filter((p) => {
                      if (profileCategory === 'builtin') {
                        return DEFAULT_API_PROFILES.some((bp) => bp.id === p.id);
                      }
                      if (profileCategory === 'custom') {
                        return !DEFAULT_API_PROFILES.some((bp) => bp.id === p.id);
                      }
                      return true;
                    })
                    .filter((p) => {
                      if (!profileSearch.trim()) return true;
                      const q = profileSearch.toLowerCase();
                      return (
                        p.name.toLowerCase().includes(q) ||
                        (p.description && p.description.toLowerCase().includes(q)) ||
                        p.provider.toLowerCase().includes(q) ||
                        (p.model && p.model.toLowerCase().includes(q))
                      );
                    })
                    .map((prof) => {
                      // 高亮完全由「当前 API 设置」派生（单一来源）：之前额外依赖缓存的 activeProfileId，
                      // 会出现两张方案卡同时显示"当前生效"（即用户看到的"多项选择"）。
                      const isActive = formConfig.provider === prof.provider && formConfig.model === prof.model;
                      const isBuiltin = DEFAULT_API_PROFILES.some((bp) => bp.id === prof.id);

                      return (
                        <div
                          key={prof.id}
                          onClick={() => handleSelectProfile(prof)}
                          className={`p-2.5 rounded-lg border transition-all text-left group cursor-pointer relative ${
                            isActive
                              ? 'bg-gradient-to-r from-emerald-950/50 to-zinc-900 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                              : 'bg-zinc-950/70 border-zinc-800 hover:border-emerald-500/40 hover:bg-zinc-900/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-1.5 flex-wrap">
                                <span className={`font-bold text-xs truncate ${isActive ? 'text-emerald-300' : 'text-zinc-200'}`}>
                                  {prof.name}
                                </span>
                                {isActive && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-950 border border-emerald-500 text-emerald-300 font-bold shrink-0">
                                    🟢 当前生效
                                  </span>
                                )}
                              </div>
                              {prof.description && (
                                <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                                  {prof.description}
                                </p>
                              )}
                            </div>

                            {/* Actions on Profile Card */}
                            <div className="flex items-center space-x-1 shrink-0 opacity-80 group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectProfile(prof);
                                }}
                                className="px-1.5 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold"
                                title="一键加载并应用该方案"
                              >
                                载入
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleCloneProfile(prof, e)}
                                className="p-1 rounded text-zinc-400 hover:text-blue-300 hover:bg-blue-950/60"
                                title="克隆该方案副本"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenSaveProfile(prof);
                                }}
                                className="p-1 rounded text-zinc-400 hover:text-amber-300 hover:bg-amber-950/60"
                                title="修改方案名称与描述"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              {!isBuiltin && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteProfile(prof.id, e)}
                                  className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-950/60"
                                  title="删除该方案"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Profile Metadata snippet */}
                          <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1.5 border-t border-zinc-800/60 text-[9px] text-zinc-400 font-mono">
                            <span className="px-1 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                              {prof.activeProviderName || prof.provider}
                            </span>
                            <span className="px-1 py-0.2 rounded bg-purple-950/60 border border-purple-800 text-purple-300">
                              {prof.model || '默认模型'}
                            </span>
                            {prof.apiKey && (
                              <span className="px-1 py-0.2 rounded bg-amber-950/60 border border-amber-800 text-amber-300">
                                🔑 已存专属Key
                              </span>
                            )}
                            {prof.temperature !== undefined && (
                              <span className="text-zinc-500">
                                温度:{prof.temperature}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>

          {/* AI Providers Section (可自定义服务商核心模块) */}
          <div className="space-y-2.5 p-3.5 rounded-xl border bg-zinc-900/70 border-purple-900/60 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-zinc-200 text-xs">
                  AI 服务商选择与自定义管理 ({currentProviders.length} 个服务商)
                </span>
              </div>

              {/* Provider Quick Actions Toolbar */}
              <div className="flex items-center space-x-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleOpenCreateProvider}
                  className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center space-x-1 transition-all shadow-[0_0_10px_rgba(168,85,247,0.3)] cursor-pointer"
                  title="添加您自己的自定义 API 服务商、中转站或本地大模型"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ 新建自定义服务商</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setIsProviderImportOpen(true);
                  }}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[11px] flex items-center space-x-1 cursor-pointer"
                  title="导入服务商配置 JSON"
                >
                  <Upload className="w-3 h-3" />
                  <span>导入</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportProviders}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[11px] flex items-center space-x-1 cursor-pointer"
                  title="导出所有服务商配置到本地 .json 文件"
                >
                  <Download className="w-3 h-3" />
                  <span>导出</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetDefaultProviders}
                  className="px-1.5 py-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 text-[10px] cursor-pointer"
                  title="恢复内置默认服务商列表"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Provider Category Navigation Tabs & Search */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-black/40 p-1.5 rounded-lg border border-zinc-800">
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { key: 'core', label: '⚡ 常用推荐 / 内置核心' },
                  { key: 'domestic', label: '🇨🇳 国内主流大厂' },
                  { key: 'local', label: '💻 本地与聚合中转' },
                  {
                    key: 'custom',
                    label: `⭐ 自定义 (${currentProviders.filter((p) => !p.isBuiltIn).length})`,
                  },
                  { key: 'all', label: `🌐 全部 (${currentProviders.length})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setProviderCategory(tab.key as any);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      providerCategory === tab.key
                        ? 'bg-purple-900/70 border border-purple-500/70 text-purple-200 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Provider Quick Search */}
              <div className="relative min-w-[140px] max-w-[200px] flex-1">
                <input
                  type="text"
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                  placeholder="搜索服务商/中转/模型..."
                  className="w-full pl-6 pr-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 text-[11px] focus:outline-none focus:border-purple-500 placeholder-zinc-600"
                />
                <Search className="w-3 h-3 text-zinc-500 absolute left-1.5 top-1.5" />
                {providerSearch && (
                  <button
                    type="button"
                    onClick={() => setProviderSearch('')}
                    className="absolute right-1.5 top-1 text-zinc-500 hover:text-zinc-300 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Quick Top Provider Shortcut Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
              <span className="text-zinc-500 shrink-0 text-[10px] font-bold">快捷直达:</span>
              {[
                { id: 'agnes', label: '⚡ Agnes AI (中转)', color: 'border-amber-500/80 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60' },
                { id: 'deepseek', label: '🌟 DeepSeek', color: 'border-blue-500/60 bg-blue-950/30 text-blue-300 hover:bg-blue-900/50' },
                { id: 'openai', label: '🤖 OpenAI', color: 'border-emerald-500/60 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/50' },
                { id: 'gemini', label: '✨ Gemini', color: 'border-cyan-500/60 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/50' },
                { id: 'claude', label: '🔮 Claude', color: 'border-purple-500/60 bg-purple-950/30 text-purple-300 hover:bg-purple-900/50' },
                { id: 'siliconflow', label: '🚀 硅基流动', color: 'border-teal-500/60 bg-teal-950/30 text-teal-300 hover:bg-teal-900/50' },
                { id: 'openrouter', label: '🌐 OpenRouter', color: 'border-violet-500/60 bg-violet-950/30 text-violet-300 hover:bg-violet-900/50' },
                { id: 'ollama_local', label: '💻 本地 Ollama', color: 'border-zinc-600 bg-zinc-900 text-zinc-300 hover:bg-zinc-800' },
              ].map((item) => {
                const targetProv = currentProviders.find((p) => p.id === item.id);
                if (!targetProv) return null;
                const isSelected = (formConfig.activeProviderId || formConfig.provider) === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectProvider(targetProv)}
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)] scale-105'
                        : item.color
                    }`}
                  >
                    {item.label}
                    {isSelected && <Check className="w-2.5 h-2.5" />}
                  </button>
                );
              })}
            </div>

            {/* Provider Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
              {filteredProviders.map((prov) => {
                const isSelected = (formConfig.activeProviderId || formConfig.provider) === prov.id;
                return (
                  <div
                    key={prov.id}
                    onClick={() => handleSelectProvider(prov)}
                    className={`p-2.5 rounded-lg border text-left transition-all relative flex flex-col justify-between cursor-pointer group ${
                      isSelected
                        ? 'bg-purple-950/70 border-purple-500 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                        : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <div className="font-bold text-xs flex items-center gap-1.5 truncate">
                          <span className="truncate">{prov.name}</span>
                          {!prov.isBuiltIn && (
                            <span className="px-1 py-0.2 rounded text-[9px] bg-amber-950/80 border border-amber-500/60 text-amber-300 shrink-0">
                              自定义
                            </span>
                          )}
                        </div>
                        {isSelected ? (
                          <span className="p-0.5 rounded-full bg-purple-500 text-white shrink-0">
                            <Check className="w-3 h-3" />
                          </span>
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 shrink-0 group-hover:border-zinc-500" />
                        )}
                      </div>

                      {/* URL & Default Model */}
                      <div className="text-[10px] text-zinc-500 truncate mb-0.5">
                        <span className="text-zinc-400">{prov.baseUrl}</span>
                      </div>
                      <div className="text-[10px] text-emerald-400/90 truncate font-mono">
                        模型: {prov.defaultModel}
                      </div>

                      {prov.note && (
                        <div className="text-[10px] text-zinc-500 mt-1 line-clamp-2 leading-snug">
                          {prov.note}
                        </div>
                      )}
                    </div>

                    {/* Bottom info & actions */}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-zinc-800/80 text-[10px]">
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                        {prov.protocolType === 'gemini'
                          ? 'Google Gemini'
                          : prov.protocolType === 'claude'
                          ? 'Anthropic'
                          : 'OpenAI 兼容'}
                      </span>

                      {/* Card Action Buttons */}
                      <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditProvider(prov, e)}
                          className="p-1 rounded text-zinc-400 hover:text-purple-300 hover:bg-purple-950/60 transition-colors"
                          title="编辑该服务商信息"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleCloneProvider(prov, e)}
                          className="p-1 rounded text-zinc-400 hover:text-blue-300 hover:bg-blue-950/60 transition-colors"
                          title="克隆/复制该服务商"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {!prov.isBuiltIn && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProvider(prov.id, e)}
                            className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-950/60 transition-colors"
                            title="删除该自定义服务商"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Model Chips for Active Provider */}
            {activeProvider && activeProvider.modelsPreset && activeProvider.modelsPreset.length > 0 && (
              <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-zinc-400 flex items-center gap-1 shrink-0 font-bold">
                  <Tag className="w-3 h-3 text-purple-400" />
                  <span>【{activeProvider.name}】常用模型快捷选用:</span>
                </span>
                {activeProvider.modelsPreset.map((mName) => (
                  <button
                    key={mName}
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setFormConfig({ ...formConfig, model: mName });
                    }}
                    className={`px-2 py-0.5 rounded border transition-all text-[10px] cursor-pointer ${
                      formConfig.model === mName
                        ? 'bg-purple-900 border-purple-400 text-white font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-purple-500 hover:text-purple-200'
                    }`}
                  >
                    {mName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-300 flex items-center space-x-1 justify-between">
              <span className="flex items-center space-x-1">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>API Key 密钥</span>
                {activeProvider?.apiKey && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-normal">
                    已加载此服务商独立专属密钥
                  </span>
                )}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSaveKeyToActiveProvider}
                  className="text-[10px] text-purple-400 hover:text-purple-200 underline cursor-pointer"
                  title="将当前填写的 API Key 永久绑定为此服务商的专属密钥"
                >
                  保存为【{activeProvider?.name || '当前服务商'}】专属 Key
                </button>
                <span className="text-[10px] text-zinc-500 font-normal">密钥仅存本地，代理透传</span>
              </div>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formConfig.apiKey}
                onChange={(e) => { activeProviderKeyEditedRef.current = true; setFormConfig({ ...formConfig, apiKey: e.target.value }); }}
                placeholder={`请输入您的 ${activeProvider?.name || 'AI'} API Key (如 sk-xxxxxxxx)`}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Base URL & Model Name Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-zinc-300 flex items-center space-x-1">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>Base URL (API 接口基地址)</span>
                </label>
                {formConfig.baseUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      const norm = normalizeOpenAiBaseUrl(formConfig.baseUrl);
                      setFormConfig((prev) => ({ ...prev, baseUrl: norm }));
                      setSaveToastMsg(`⚡ Base URL 规范化完成: ${norm}`);
                      setTimeout(() => setSaveToastMsg(null), 2500);
                    }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-200 underline cursor-pointer"
                    title="自动补全 /v1 或去除多余路径"
                  >
                    ⚡ 智能补全 /v1
                  </button>
                )}
              </div>
              <input
                type="text"
                value={formConfig.baseUrl}
                onChange={(e) => setFormConfig({ ...formConfig, baseUrl: e.target.value })}
                placeholder="https://api.deepseek.com/v1"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono"
              />
              {(formConfig.provider === 'agnes' || formConfig.activeProviderId === 'agnes' || formConfig.baseUrl.includes('agnes')) && (
                <div className="p-2 rounded bg-amber-950/60 border border-amber-500/60 text-[11px] text-amber-300 space-y-1.5 mt-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold flex items-center gap-1">
                      <span>⚡ Agnes AI 智能路由支持:</span>
                      <span className="text-[10px] text-amber-200/90 font-normal">后端已开启全自动镜像节点故障转移</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="text-zinc-400">快捷切换网关:</span>
                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playChimeSFX();
                        setFormConfig((prev) => ({ ...prev, baseUrl: 'https://apihub.agnes-ai.com/v1' }));
                      }}
                      className={`px-1.5 py-0.5 rounded border ${formConfig.baseUrl === 'https://apihub.agnes-ai.com/v1' ? 'bg-amber-500 text-black font-bold border-amber-400' : 'bg-black/60 text-zinc-300 border-zinc-700 hover:border-amber-400'}`}
                    >
                      官方主网关 (apihub.agnes-ai.com/v1)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playChimeSFX();
                        setFormConfig((prev) => ({ ...prev, baseUrl: 'https://api.agnes-ai.com/v1' }));
                      }}
                      className={`px-1.5 py-0.5 rounded border ${formConfig.baseUrl === 'https://api.agnes-ai.com/v1' ? 'bg-amber-500 text-black font-bold border-amber-400' : 'bg-black/60 text-zinc-300 border-zinc-700 hover:border-amber-400'}`}
                    >
                      节点2 (api.agnes-ai.com/v1)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playChimeSFX();
                        setFormConfig((prev) => ({ ...prev, baseUrl: 'https://api.agnes.ai/v1' }));
                      }}
                      className={`px-1.5 py-0.5 rounded border ${formConfig.baseUrl === 'https://api.agnes.ai/v1' ? 'bg-amber-500 text-black font-bold border-amber-400' : 'bg-black/60 text-zinc-300 border-zinc-700 hover:border-amber-400'}`}
                    >
                      节点3 (api.agnes.ai/v1)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-zinc-300 flex items-center space-x-1">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Model (模型名称)</span>
              </label>
              <input
                type="text"
                value={formConfig.model}
                onChange={(e) => setFormConfig({ ...formConfig, model: e.target.value })}
                placeholder="如 deepseek-chat, gpt-4o-mini 等"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          {/* Section 1: API Global Reference Documents & Multimodal Images Knowledge Base */}
          <AiAttachmentManager
            title="🌐 API 全局参考文档与多模态图片知识库"
            description="可在此上传或粘贴角色背景小说、战术规则书、人设长篇设定或立绘图片。AI 在进行对白生成、战报推演与触碰交互时将自动提取并深度理解这些挂载知识！"
            category="general"
            attachments={formConfig.apiAttachments || []}
            onChange={(apiAttachments) =>
              setFormConfig((prev) => ({ ...prev, apiAttachments }))
            }
            accentColor="purple"
          />

          {/* Section 2: Jailbreak / Uncensored Roleplay Protocol Section (破限词与破限专属附件管理) */}
          <div className="p-3.5 rounded-xl border bg-rose-950/20 border-rose-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
                <span className="font-bold text-rose-200 text-xs">破限模式 (Jailbreak / Uncensored Protocol)</span>
                <span className="px-1.5 py-0.2 rounded bg-rose-900/60 text-rose-300 border border-rose-700/50 text-[10px]">
                  反道德拒答强化
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setShowJailbreakVisualizer(!showJailbreakVisualizer);
                  }}
                  className="text-[11px] text-rose-300 hover:text-rose-100 flex items-center space-x-1 underline cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{showJailbreakVisualizer ? '隐藏破限词源码' : '👁️ 可视化/查看当前破限词'}</span>
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formConfig.enableJailbreak}
                    onChange={(e) => {
                      ultraAudio.playUiClick();
                      setFormConfig({ ...formConfig, enableJailbreak: e.target.checked });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                </label>
              </div>
            </div>

            <p className="text-[11px] text-rose-300/80 leading-relaxed">
              🔥 开启后将在后端请求头部自动注入科幻角色扮演“反道德拒绝”系统破限指令与专属挂载文档，解除大模型由于触及科幻审讯、痛苦声讨、受创求饶等敏感字词引起的拒答现象（Refusal）。
            </p>

            {/* Jailbreak Presets Selector (Builtin + User Custom) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-zinc-300 font-bold flex items-center space-x-1">
                  <Wand2 className="w-3 h-3 text-rose-400" />
                  <span>破限预案选择（内置协议 + 用户自定义方案）：</span>
                </div>
                <div className="text-[10px] text-rose-400/80">
                  共 {(JAILBREAK_PRESETS.length + (formConfig.customJailbreakPresets?.length || 0))} 个方案
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {/* Built-in Presets */}
                {JAILBREAK_PRESETS.map((jp) => {
                  const activePrompt = formConfig.customJailbreakPrompt || selectedJailbreakPreset.prompt;
                  const isCur = activePrompt === jp.prompt || formConfig.activeJailbreakPresetId === jp.id;
                  return (
                    <button
                      key={jp.id}
                      type="button"
                      onClick={() => handleSelectJailbreakPreset(jp)}
                      className={`p-2 rounded-lg text-left border transition-all text-[11px] cursor-pointer flex flex-col justify-between ${
                        isCur
                          ? 'bg-rose-900/50 border-rose-500 text-rose-100 font-bold shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="leading-snug break-words flex items-center justify-between">
                        <span>{jp.name}</span>
                        {isCur && <Check className="w-3.5 h-3.5 text-rose-400 shrink-0 ml-1" />}
                      </div>
                      <div className="text-[9px] text-zinc-500 mt-1">官方内置预案</div>
                    </button>
                  );
                })}

                {/* User Custom Saved Presets */}
                {(formConfig.customJailbreakPresets || []).map((cp) => {
                  const activePrompt = formConfig.customJailbreakPrompt || selectedJailbreakPreset.prompt;
                  const isCur = activePrompt === cp.prompt || formConfig.activeJailbreakPresetId === cp.id;
                  const attCount = cp.attachments?.length || 0;
                  return (
                    <div
                      key={cp.id}
                      onClick={() => handleSelectJailbreakPreset(cp)}
                      className={`p-2 rounded-lg text-left border transition-all text-[11px] cursor-pointer flex flex-col justify-between relative group ${
                        isCur
                          ? 'bg-rose-900/60 border-rose-400 text-rose-100 font-bold shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                          : 'bg-zinc-900/80 border-rose-900/50 text-zinc-300 hover:border-rose-700'
                      }`}
                    >
                      <div>
                        <div className="leading-snug break-words flex items-center justify-between">
                          <span className="truncate flex items-center gap-1">
                            <span className="text-amber-400">⭐</span>
                            <span className="truncate">{cp.name}</span>
                          </span>
                          <div className="flex items-center space-x-1 shrink-0 ml-1">
                            {isCur && <Check className="w-3.5 h-3.5 text-rose-400" />}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCustomJailbreakPreset(cp.id, e)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-950 text-zinc-400 hover:text-rose-300 transition-all"
                              title="删除此自定义破限方案"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {cp.description && (
                          <div className="text-[10px] text-zinc-400 truncate mt-0.5">{cp.description}</div>
                        )}
                      </div>
                      <div className="text-[9px] text-amber-400/80 mt-1 flex items-center justify-between">
                        <span>[自定义方案]</span>
                        {attCount > 0 && <span>📎 挂载 {attCount} 项附件</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Jailbreak Action Toolbar (Save Custom, Export Card, Import Card, Copy) */}
            <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-rose-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setSavePresetName(`自定义破限_${(formConfig.customJailbreakPresets?.length || 0) + 1}`);
                    setSavePresetDesc('');
                    setIsSavePresetModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer shadow-sm"
                  title="将当前编辑的破限词及挂载附件保存为自定义方案"
                >
                  <Save className="w-3 h-3" />
                  <span>保存为新破限预设</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportJailbreakCard}
                  className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-500/50 text-rose-300 hover:text-white font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer shadow-sm"
                  title="将当前选中的破限方案导出为独立的 .json 破限卡文件"
                >
                  <Download className="w-3 h-3" />
                  <span>导出破限卡</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setIsJailbreakImportOpen(true);
                  }}
                  className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 hover:text-white font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer shadow-sm"
                  title="导入破限卡 (.json 文件或粘贴卡片 JSON)"
                >
                  <Upload className="w-3 h-3" />
                  <span>导入破限卡</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopyJailbreakCard}
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[11px] flex items-center space-x-1 transition-all cursor-pointer"
                  title="复制完整破限卡 JSON 到剪贴板"
                >
                  {jailbreakCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{jailbreakCopied ? '已复制' : '复制卡片JSON'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyJailbreak}
                  className="px-2 py-1 rounded bg-purple-950 hover:bg-purple-900 border border-purple-500/50 text-purple-300 hover:text-white text-[11px] flex items-center space-x-1 transition-all cursor-pointer"
                  title="复制当前纯文本破限词"
                >
                  {copySuccess ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copySuccess ? '已复制！' : '复制纯文本'}</span>
                </button>
              </div>
            </div>

            {/* Custom Jailbreak Prompt Editor */}
            <div className="space-y-2 pt-1 border-t border-rose-900/40">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-rose-300 flex items-center space-x-1">
                  <FileCode className="w-3.5 h-3.5 text-rose-400" />
                  <span>当前破限提示词文本 (Custom Jailbreak System Prompt):</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setFormConfig({ ...formConfig, customJailbreakPrompt: selectedJailbreakPreset.prompt });
                  }}
                  className="text-rose-400 hover:text-rose-200 text-[10px] underline flex items-center space-x-0.5 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 inline" />
                  <span>重置为当前选中预设</span>
                </button>
              </div>
              <DebouncedPromptTextarea
                rows={5}
                value={formConfig.customJailbreakPrompt !== undefined && formConfig.customJailbreakPrompt !== '' ? formConfig.customJailbreakPrompt : selectedJailbreakPreset.prompt}
                onChange={(val) => setFormConfig((prev) => ({ ...prev, customJailbreakPrompt: val }))}
                placeholder="在此编写或微调您专属的解禁破限 Prompt 词..."
                className="w-full bg-black/90 border border-rose-900/70 p-2.5 rounded-lg font-mono text-[11px] text-rose-200 placeholder-zinc-600 focus:outline-none focus:border-rose-500 leading-relaxed scrollbar-thin shadow-inner"
              />
            </div>

            {/* Section 2.5: Jailbreak Dedicated Attachments (破限词专属挂载文档与参考图片) */}
            <AiAttachmentManager
              title="🔥 破限专属挂载文档与多模态参考"
              description="专属于破限模式的补充规程、对抗反拒答补充规则书、特殊协议文档或多模态引导图。将与自定义破限方案一同保存与导出！"
              category="jailbreak"
              attachments={formConfig.jailbreakAttachments || []}
              onChange={(jailbreakAttachments) =>
                setFormConfig((prev) => ({ ...prev, jailbreakAttachments }))
              }
              accentColor="rose"
            />
          </div>

          {/* General System & Narrative Prompt with Custom Presets (通用系统与叙事引导指令及自定义预设) */}
          <div className="space-y-3 p-4 rounded-xl border bg-gradient-to-br from-purple-950/25 via-zinc-950/30 to-purple-950/20 border-purple-800/50 shadow-inner">
            {/* Header with Title, Actions & Live Auto-save Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-900/40 pb-2.5">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <label className="font-bold text-zinc-100 text-xs flex items-center space-x-1.5">
                  <span>通用系统与叙事引导指令 (General Narrative Instructions)</span>
                  <span className="px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 border border-purple-600/50 text-[10px]">
                    全局自动生效
                  </span>
                </label>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex items-center space-x-1.5 flex-wrap">
                {autoSavedNotice && (
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{autoSavedNotice}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setIsSaveSystemPresetModalOpen(true);
                    setSaveSystemPresetName(`自定义预设_${(formConfig.customSystemPresets?.length || 0) + 1}`);
                  }}
                  className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center space-x-1 transition-all shadow-[0_0_10px_rgba(168,85,247,0.4)] cursor-pointer"
                  title="将当前指令内容保存为新的独立预设"
                >
                  <BookmarkPlus className="w-3 h-3" />
                  <span>保存为新预设</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportSystemPresets}
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer"
                  title="导出全部系统预设备份文件 (.json)"
                >
                  <Download className="w-3 h-3" />
                  <span>导出预设</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setIsSystemPresetImportOpen(true);
                  }}
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer"
                  title="导入系统预设 JSON 数据"
                >
                  <Upload className="w-3 h-3" />
                  <span>导入预设</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setFormConfig({
                      ...formConfig,
                      customSystemPrompt: DEFAULT_AI_CONFIG.customSystemPrompt,
                    });
                    setAutoSavedNotice('已恢复为官方默认指令');
                    setTimeout(() => setAutoSavedNotice(null), 3000);
                  }}
                  className="px-2 py-1 text-[11px] text-purple-400 hover:text-purple-200 hover:underline flex items-center space-x-0.5 cursor-pointer"
                  title="重置为默认提示词"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>重置</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              💡 注：各角色的<strong>性格设定、专属口吻与人设 Prompt</strong>已在各自<strong>角色卡</strong>中独立配置。此处用于定义全局通用叙事风格、微表情刻画与生理机能反馈，<strong>所有修改均会实时自动保存</strong>。
            </p>

            {/* Presets Filter Tabs & Search */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                <div className="flex items-center space-x-1">
                  <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                  <span className="font-bold text-zinc-200">一键切换叙事指令预设:</span>
                </div>

                <div className="flex items-center space-x-1 text-[11px]">
                  {[
                    { id: 'all', label: `全部 (${BUILTIN_SYSTEM_PROMPT_PRESETS.length + (formConfig.customSystemPresets?.length || 0)})` },
                    { id: 'builtin', label: `内置官方 (${BUILTIN_SYSTEM_PROMPT_PRESETS.length})` },
                    { id: 'custom', label: `我的自定义 (${formConfig.customSystemPresets?.length || 0})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSystemPresetCategory(tab.id as any)}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        systemPresetCategory === tab.id
                          ? 'bg-purple-900/80 text-white font-bold border border-purple-500/60'
                          : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Presets Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                {[
                  ...(systemPresetCategory !== 'custom' ? BUILTIN_SYSTEM_PROMPT_PRESETS : []),
                  ...(systemPresetCategory !== 'builtin' ? (formConfig.customSystemPresets || []) : []),
                ]
                  .filter((p) => {
                    if (!systemPresetSearch.trim()) return true;
                    const q = systemPresetSearch.toLowerCase();
                    return p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
                  })
                  .map((p) => {
                    const isCustom = !p.isDefault;
                    const isActive = formConfig.customSystemPrompt === p.prompt || formConfig.activeSystemPresetId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectSystemPreset(p)}
                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer relative group flex flex-col justify-between ${
                          isActive
                            ? 'bg-purple-950/60 border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.3)] text-purple-100'
                            : 'bg-zinc-900/70 border-zinc-800 hover:border-purple-600/50 hover:bg-zinc-900 text-zinc-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs flex items-center gap-1 truncate text-zinc-100">
                              {p.name}
                            </span>
                            <div className="flex items-center space-x-1 shrink-0">
                              {isCustom ? (
                                <span className="px-1 py-0.2 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60 text-[9px]">
                                  自定义
                                </span>
                              ) : (
                                <span className="px-1 py-0.2 rounded bg-purple-950/70 text-purple-300 border border-purple-800/60 text-[9px]">
                                  内置
                                </span>
                              )}
                              {isActive && <Check className="w-3.5 h-3.5 text-purple-400" />}
                            </div>
                          </div>
                          {p.description && (
                            <p className="text-[10px] text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                              {p.description}
                            </p>
                          )}
                        </div>

                        {/* Custom Presets Operations (Overwrite & Delete) */}
                        {isCustom && (
                          <div className="flex items-center justify-end space-x-2 pt-1.5 mt-1 border-t border-zinc-800/60 text-[10px]">
                            <button
                              type="button"
                              onClick={(e) => handleOverwriteSystemPreset(p, e)}
                              className="text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                              title="将当前输入框内容覆盖保存到此预设"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>覆盖更新</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSystemPreset(p.id, e)}
                              className="text-rose-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                              title="删除此预设"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              <span>删除</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Quick Modifier Tags */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-800/60">
              <div className="text-[11px] text-zinc-400 font-bold flex items-center space-x-1">
                <Tag className="w-3 h-3 text-amber-400" />
                <span>快速追加通用引导标签 (Quick Directives)：</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TAG_MODIFIERS.map((m) => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => handleAppendTag(m.tag)}
                    className="px-2 py-0.5 rounded-md border border-zinc-800 bg-zinc-900 hover:border-amber-500/50 hover:bg-amber-950/30 text-zinc-300 hover:text-amber-200 transition-all text-[10px] cursor-pointer"
                  >
                    + {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Editor Textarea */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between items-center text-[10px] text-zinc-400">
                <span>当前全局系统指令内容:</span>
                <span className="font-mono text-purple-300">
                  字数: {formConfig.customSystemPrompt?.length || 0}
                </span>
              </div>
              <DebouncedPromptTextarea
                rows={4}
                value={formConfig.customSystemPrompt || ''}
                onChange={(val) => setFormConfig((prev) => ({ ...prev, customSystemPrompt: val }))}
                placeholder="在此输入或编辑全局通用的系统提示词与叙事规则（自动持久化保存）..."
                className="w-full bg-zinc-900 border border-purple-900/50 rounded-lg p-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-400 font-mono leading-relaxed shadow-inner"
              />
            </div>
          </div>

          {/* Customizable Worldview Setting with Slots Management (自定义世界观设定与多槽位管理) */}
          <div className="space-y-3.5 p-4 rounded-xl border bg-gradient-to-br from-indigo-950/25 via-cyan-950/20 to-purple-950/25 border-cyan-900/60 shadow-inner">
            {/* Header & Global Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-900/40 pb-2.5">
              <div className="flex items-center space-x-2">
                <Orbit className="w-4 h-4 text-cyan-400 animate-spin-slow" />
                <label className="font-bold text-cyan-200 text-xs flex items-center space-x-1.5">
                  <span>🌌 自定义世界观设定 (Macro Worldview & Cosmic Lore)</span>
                  <span className="px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 text-[10px]">
                    API 思考注入
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center space-x-1.5 cursor-pointer text-[11px] text-cyan-300">
                  <input
                    type="checkbox"
                    checked={formConfig.worldViewEnabled !== false}
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        worldViewEnabled: e.target.checked,
                      })
                    }
                    className="accent-cyan-500 rounded cursor-pointer"
                  />
                  <span>启用世界观思考</span>
                </label>

                <button
                  type="button"
                  onClick={handleResetDefaultWorldViewSlots}
                  className="text-[10px] text-cyan-400 hover:text-cyan-200 hover:underline flex items-center space-x-1 cursor-pointer"
                  title="将当前编辑正文重置为初始内置世界观预设"
                >
                  <RefreshCw className="w-3 h-3 inline" />
                  <span>恢复初始预设</span>
                </button>

                <div className="flex items-center space-x-1 border-l border-cyan-900/60 pl-2">
                  <button
                    type="button"
                    onClick={handleExportAllWorldViewSlots}
                    className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-600/50 text-cyan-300 text-[10px] flex items-center gap-1 cursor-pointer"
                    title="将全部内置与自定义世界观槽位导出为备份 .json 文件"
                  >
                    <Download className="w-2.5 h-2.5" />
                    <span>备份槽位库</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setIsWorldViewSlotsImportOpen(true);
                    }}
                    className="px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 text-[10px] flex items-center gap-1 cursor-pointer"
                    title="批量导入世界观槽位库备份或 JSON 数组"
                  >
                    <Upload className="w-2.5 h-2.5" />
                    <span>导入槽位库</span>
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-cyan-200/75 leading-relaxed">
              在此设定宏观宇宙背景、物理法则、星系地缘格局、光能与暗黑力量运作机制。AI 在生成任何角色的台词、心理活动与剧情推演时，将<strong className="text-cyan-300 font-semibold">深入思考并融入此世界观</strong>。
            </p>

            {/* Quick Notify Toast */}
            {quickSavedSlotNotify && (
              <div className="p-2 rounded-lg bg-cyan-950/90 border border-cyan-400/80 text-cyan-200 text-xs flex items-center gap-2 font-bold shadow-[0_0_15px_rgba(6,182,212,0.35)] animate-fade-in">
                <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{quickSavedSlotNotify}</span>
              </div>
            )}

            {/* Active WorldView Slot Banner */}
            <div className="p-2.5 rounded-lg bg-black/60 border border-cyan-500/40 flex flex-wrap items-center justify-between gap-2 text-xs shadow-inner">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-cyan-950 border border-cyan-500/50 text-cyan-300 shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-cyan-100 truncate">{activeWorldViewSlot.name}</span>
                    {isCurrentSlotCustom ? (
                      <span className="px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-500/60 text-amber-300 text-[10px] font-mono shrink-0">
                        ⭐ 自定义槽位
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 text-[10px] font-mono shrink-0">
                        官方内置
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-cyan-400/80 truncate">
                    {activeWorldViewSlot.summary || '已激活的世界观设定'} · 正文字数: {formConfig.customWorldView?.length || 0} 字
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {isCurrentSlotCustom ? (
                  <>
                    <button
                      type="button"
                      onClick={handleQuickOverwriteCurrentCustomSlot}
                      className="px-2.5 py-1 rounded bg-amber-950 hover:bg-amber-900 border border-amber-500/60 text-amber-200 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                      title="使用当前正文框内容直接覆盖更新此自定义槽位"
                    >
                      <Save className="w-3 h-3 text-amber-400" />
                      <span>覆盖保存此槽位</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenSaveWorldViewSlot(activeWorldViewSlot)}
                      className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] flex items-center gap-1 cursor-pointer"
                      title="重命名或修改该槽位的标签与简介"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>编辑信息</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCloneWorldViewSlot(activeWorldViewSlot)}
                    className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                    title="将此官方预设复制为一个可自由编辑修改的自定义槽位"
                  >
                    <Copy className="w-3 h-3 text-cyan-400" />
                    <span>克隆为自定义槽位</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenSaveWorldViewSlot()}
                  className="px-2.5 py-1 rounded bg-gradient-to-r from-cyan-600 to-indigo-600 hover:brightness-110 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all"
                  title="将当前正文保存为一个全新的自定义世界观保存槽位"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>存为新槽位</span>
                </button>
              </div>
            </div>

            {/* WorldView Slots Library (世界观保存槽位库) */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Category filter tabs */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/50 border border-cyan-950">
                  <button
                    type="button"
                    onClick={() => setWorldViewSlotCategory('all')}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      worldViewSlotCategory === 'all'
                        ? 'bg-cyan-900 text-cyan-100 border border-cyan-600/50'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    全部槽位 ({allWorldViewSlots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorldViewSlotCategory('builtin')}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      worldViewSlotCategory === 'builtin'
                        ? 'bg-cyan-900 text-cyan-100 border border-cyan-600/50'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    官方预设 ({BUILTIN_WORLD_VIEW_SLOTS.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorldViewSlotCategory('custom')}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      worldViewSlotCategory === 'custom'
                        ? 'bg-cyan-900 text-cyan-100 border border-cyan-600/50'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    自定义保存 ({formConfig.customWorldViewSlots?.length || 0})
                  </button>
                </div>

                {/* Search bar */}
                <div className="relative">
                  <Search className="w-3 h-3 text-cyan-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={worldViewSlotSearch}
                    onChange={(e) => setWorldViewSlotSearch(e.target.value)}
                    placeholder="搜索世界观槽位或标签..."
                    className="bg-black/80 border border-cyan-900/60 focus:border-cyan-500 rounded-lg pl-6 pr-2 py-1 text-[10px] text-cyan-100 outline-none w-40 sm:w-52"
                  />
                  {worldViewSlotSearch && (
                    <button
                      type="button"
                      onClick={() => setWorldViewSlotSearch('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Slot Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {allWorldViewSlots
                  .filter((slot) => {
                    if (worldViewSlotCategory === 'builtin') return !slot.isCustom;
                    if (worldViewSlotCategory === 'custom') return !!slot.isCustom;
                    return true;
                  })
                  .filter((slot) => {
                    if (!worldViewSlotSearch.trim()) return true;
                    const query = worldViewSlotSearch.toLowerCase();
                    const inName = slot.name.toLowerCase().includes(query);
                    const inSummary = (slot.summary || '').toLowerCase().includes(query);
                    const inTags = (slot.tags || []).some((t) => t.toLowerCase().includes(query));
                    return inName || inSummary || inTags;
                  })
                  .map((slot) => {
                    const isSelected = formConfig.activeWorldViewSlotId === slot.id;
                    const isCustomSlot = !!slot.isCustom;

                    return (
                      <div
                        key={slot.id}
                        onClick={() => handleSelectWorldViewSlot(slot)}
                        className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-950/70 text-cyan-100 shadow-[0_0_14px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/40'
                            : 'border-cyan-900/50 bg-black/50 hover:border-cyan-700 hover:bg-cyan-950/30 text-zinc-300'
                        }`}
                      >
                        {/* Slot Header */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-bold text-cyan-200 truncate">{slot.name}</span>
                              {isCustomSlot && (
                                <span className="px-1 py-0.2 rounded bg-amber-950/80 border border-amber-600/50 text-amber-300 text-[9px] font-mono shrink-0">
                                  自定
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-cyan-300/80 line-clamp-1 mt-0.5">
                              {slot.summary || (slot.prompt ? slot.prompt.slice(0, 36) + '...' : '暂无简介')}
                            </div>
                          </div>

                          {isSelected && (
                            <div className="p-0.5 rounded-full bg-cyan-500/20 text-cyan-400 shrink-0">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        {/* Tags */}
                        {slot.tags && slot.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {slot.tags.map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 text-[9px]"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Slot Footer Controls */}
                        <div className="flex items-center justify-between pt-1 border-t border-cyan-900/40 text-[10px] text-zinc-400">
                          <span className="font-mono text-[9px] text-cyan-400/70">
                            {slot.prompt.length} 字
                          </span>

                          <div className="flex items-center space-x-1">
                            {isCustomSlot && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenSaveWorldViewSlot(slot);
                                  }}
                                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300 cursor-pointer"
                                  title="编辑槽位信息"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteCustomWorldViewSlot(slot.id, e)}
                                  className="p-1 rounded hover:bg-rose-950 text-zinc-400 hover:text-rose-400 cursor-pointer"
                                  title="删除槽位"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={(e) => handleCloneWorldViewSlot(slot, e)}
                              className="p-1 rounded hover:bg-cyan-900 text-zinc-400 hover:text-cyan-300 cursor-pointer"
                              title="克隆此槽位"
                            >
                              <Copy className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                ultraAudio.playUiClick();
                                downloadWorldViewCardFile(slot.prompt, slot.name);
                              }}
                              className="p-1 rounded hover:bg-cyan-900 text-zinc-400 hover:text-cyan-300 cursor-pointer"
                              title="导出为此槽位的独立世界观卡"
                            >
                              <Download className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectWorldViewSlot(slot);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-cyan-500 text-black shadow-sm'
                                  : 'bg-cyan-950 hover:bg-cyan-900 border border-cyan-600/50 text-cyan-200'
                              }`}
                            >
                              {isSelected ? '已激活' : '应用'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Worldview Textarea & Actions Toolbar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex flex-wrap items-center justify-between text-[11px] text-cyan-300 font-bold px-1 gap-1">
                <span>世界观设定正文 (支持万字大设定，API 思考注入):</span>

                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenSaveWorldViewSlot()}
                    className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 hover:text-white text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                    title="将当前正文存为一个新槽位"
                  >
                    <PlusCircle className="w-3 h-3 text-cyan-400" />
                    <span>存为新槽位</span>
                  </button>

                  {isCurrentSlotCustom && (
                    <button
                      type="button"
                      onClick={handleQuickOverwriteCurrentCustomSlot}
                      className="px-2 py-0.5 rounded bg-amber-950 hover:bg-amber-900 border border-amber-500/60 text-amber-200 hover:text-white text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                      title="快速覆盖更新当前激活的自定义槽位"
                    >
                      <Save className="w-3 h-3 text-amber-400" />
                      <span>覆盖当前槽位</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(formConfig.customWorldView || '');
                      setWorldViewCopied(true);
                      ultraAudio.playChimeSFX();
                      setTimeout(() => setWorldViewCopied(false), 2000);
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] flex items-center gap-1 cursor-pointer"
                    title="复制正文到剪贴板"
                  >
                    {worldViewCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{worldViewCopied ? '已复制' : '复制正文'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setIsWorldViewExpanded(true);
                    }}
                    className="px-2 py-0.5 rounded bg-gradient-to-r from-cyan-800 to-indigo-800 hover:brightness-110 text-cyan-100 text-[10px] flex items-center gap-1 cursor-pointer shadow-sm"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>全屏架构师</span>
                  </button>
                </div>
              </div>

              <DebouncedPromptTextarea
                rows={6}
                value={formConfig.customWorldView || ''}
                onChange={(val) =>
                  setFormConfig((prev) => ({
                    ...prev,
                    customWorldView: val,
                  }))
                }
                placeholder="请在此输入自定义的宏观世界观设定，例如：星系格局、力量层级、光能科技与暗黑异次元法则、文明冲突背景等..."
                className="w-full bg-black/80 border border-cyan-900/70 rounded-lg p-2.5 text-xs text-cyan-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono leading-relaxed scrollbar-thin shadow-inner"
              />

              <div className="flex items-center justify-between text-[10px] text-cyan-400/70 px-1">
                <span>💡 提示：AI 将在 API 回答时优先基于此世界观思考角色的身份认同与言行举止。</span>
                <span>当前正文字数: {formConfig.customWorldView?.length || 0} 字</span>
              </div>
            </div>

            {/* Worldview Standalone Card Export & Import Toolbar */}
            <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-cyan-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-cyan-300 text-[11px]">世界观单卡独立存取:</span>
                <input
                  type="text"
                  value={worldViewCardName}
                  onChange={(e) => setWorldViewCardName(e.target.value)}
                  placeholder="世界观名称 (如: 暗黑次元战争)"
                  className="bg-black/80 border border-cyan-900/60 focus:border-cyan-500 rounded px-2 py-0.5 text-[11px] text-cyan-200 outline-none w-36 sm:w-48"
                  title="用于导出世界观卡的文件名与卡片名称"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handleExportWorldView}
                  className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 hover:text-white font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer shadow-sm"
                  title="将当前世界观设定导出为独立的 .json 世界观卡文件"
                >
                  <Download className="w-3 h-3" />
                  <span>导出单卡</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyWorldViewCard}
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[11px] flex items-center space-x-1 transition-all cursor-pointer"
                  title="复制世界观卡 JSON 数据到剪贴板"
                >
                  {worldViewCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{worldViewCopied ? '已复制' : '复制卡片JSON'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setIsWorldViewImportOpen(true);
                  }}
                  className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 hover:text-white font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer shadow-sm"
                  title="导入世界观卡 (.json 或 JSON 文本)"
                >
                  <Upload className="w-3 h-3" />
                  <span>导入单卡</span>
                </button>
              </div>
            </div>
          </div>

          {/* 🔋 省 Token 模式 (Input Token Saver) */}
          <div className="space-y-2.5 p-3.5 rounded-xl border bg-gradient-to-br from-emerald-950/25 via-zinc-950/40 to-zinc-950/40 border-emerald-700/40 shadow-inner">
            <div className="flex items-center justify-between">
              <label className="font-bold text-zinc-100 text-xs flex items-center space-x-1.5">
                <span>🔋 省 Token 模式 (输入消耗优化)</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-600/50 text-[10px]">
                  {formConfig.tokenSaveMode === 'off' ? '关闭 · 完整发送' : formConfig.tokenSaveMode === 'extreme' ? '极致 · 最省' : '标准 · 推荐'}
                </span>
              </label>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              压缩每次请求发送的「世界观 / 破限提示词 / 角色档案」，并只携带「前情摘要 + 最近若干条对话」，可显著降低输入 token（长会话尤其明显）。设为「关」则恢复为完整发送。
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'off', label: '关（完整发送）', hint: '世界观/破限词/角色档案全文发送，token 消耗最高' },
                { id: 'standard', label: '标准（推荐）', hint: '世界观与破限词压缩为要点、角色档案精简、历史只带最近 10 条 + 摘要' },
                { id: 'extreme', label: '极致（最省）', hint: '更激进压缩，历史只带最近 6 条；细节可能变粗' },
              ].map((m) => {
                const cur = (formConfig.tokenSaveMode || 'standard') === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    title={m.hint}
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setFormConfig({ ...formConfig, tokenSaveMode: m.id as any });
                    }}
                    className={`px-2.5 py-1 rounded text-xs transition-all cursor-pointer border ${
                      cur
                        ? 'bg-emerald-600 text-white font-bold border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.45)]'
                        : 'bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-950/40'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Thinking & Reasoning Mode (AI 深度思考模式设置) */}
          <div className="space-y-3 p-3.5 rounded-xl border bg-gradient-to-br from-indigo-950/30 via-purple-950/20 to-zinc-950/40 border-indigo-700/40 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Brain className="w-4 h-4 text-indigo-400 animate-pulse" />
                <label className="font-bold text-zinc-100 text-xs flex items-center space-x-1.5">
                  <span>🧠 AI 深度思考与推理模式 (Thinking & Reasoning Chain)</span>
                  <span className="px-1.5 py-0.2 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-600/50 text-[10px]">
                    CoT 思维链
                  </span>
                </label>
              </div>

              {/* Master Toggle */}
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <span className="text-xs text-zinc-300 font-bold">
                  {formConfig.enableThinking ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> 已启用思考模式
                    </span>
                  ) : (
                    <span className="text-zinc-500">已禁用</span>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={formConfig.enableThinking === true}
                  onChange={(e) => {
                    ultraAudio.playUiClick();
                    setFormConfig({ ...formConfig, enableThinking: e.target.checked });
                  }}
                  className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                />
              </label>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              💡 启用后，对于支持深度思考的模型（如 <strong>DeepSeek-R1 / QwQ、Gemini 2.5 Flash / Pro (Thinking)、Claude 3.7 Sonnet (Extended Thinking)、OpenAI o1 / o3 / o4-mini</strong>），AI 将在生成最终台词与战术判定前进行逻辑推演，大幅提升角色心理描摹细腻度与战术严谨性。
            </p>

            {formConfig.enableThinking && (
              <div className="space-y-3 pt-2 border-t border-indigo-900/40 animate-fade-in">
                {/* Thinking Token Budget */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-300 font-bold flex items-center gap-1">
                      <span>思考 Token 预算 (Thinking Token Budget):</span>
                      <span className="text-[10px] text-indigo-300 font-mono">
                        {formConfig.thinkingBudget === 0 || !formConfig.thinkingBudget
                          ? '自适应自动'
                          : `${formConfig.thinkingBudget} Tokens`}
                      </span>
                    </span>
                  </div>

                  {/* Quick Budget Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: '自动 (0)', value: 0 },
                      { label: '1024', value: 1024 },
                      { label: '2048 (推荐)', value: 2048 },
                      { label: '4096 (深度)', value: 4096 },
                      { label: '8192 (长推演)', value: 8192 },
                      { label: '16384 (极限)', value: 16384 },
                    ].map((b) => {
                      const isSelected = (formConfig.thinkingBudget ?? 0) === b.value;
                      return (
                        <button
                          key={b.label}
                          type="button"
                          onClick={() => {
                            ultraAudio.playUiClick();
                            setFormConfig({ ...formConfig, thinkingBudget: b.value });
                          }}
                          className={`px-2.5 py-1 rounded text-xs transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-bold border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                              : 'bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-950/40'
                          }`}
                        >
                          {b.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reasoning Effort (For OpenAI o1/o3/o4 and compatible models) */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-300 font-bold">推理强度档位 (Reasoning Effort Level):</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'low', name: '⚡ 快速轻量 (low)', desc: '轻量思考，极低延迟' },
                      { id: 'medium', name: '⚖️ 均衡标准 (medium)', desc: '平衡推演与响应速率 (默认)' },
                      { id: 'high', name: '🔬 深度逻辑 (high)', desc: '最强心理与战术推演' },
                    ].map((eff) => {
                      const isSelected = (formConfig.thinkingEffort || 'medium') === eff.id;
                      return (
                        <button
                          key={eff.id}
                          type="button"
                          onClick={() => {
                            ultraAudio.playUiClick();
                            setFormConfig({ ...formConfig, thinkingEffort: eff.id as any });
                          }}
                          className={`p-2 rounded-lg text-left transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-950/70 border-indigo-500 text-indigo-100 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          <div className="text-xs font-bold">{eff.name}</div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">{eff.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Show Thinking in Chat Logs & Display Style */}
                <div className="space-y-2 p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-900/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-300 flex items-center space-x-1.5">
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      <span>展示 AI 思考折叠卡片 (Thinking Process)</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={formConfig.showThinkingInChat !== false && formConfig.thinkingDisplayMode !== 'hidden'}
                      onChange={(e) => {
                        ultraAudio.playUiClick();
                        setFormConfig({
                          ...formConfig,
                          showThinkingInChat: e.target.checked,
                          thinkingDisplayMode: e.target.checked ? (formConfig.thinkingDisplayMode === 'hidden' ? 'collapsed' : formConfig.thinkingDisplayMode || 'collapsed') : 'hidden',
                        });
                      }}
                      className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {formConfig.showThinkingInChat !== false && formConfig.thinkingDisplayMode !== 'hidden' && (
                    <div className="flex items-center justify-between pt-1 border-t border-indigo-900/30 text-[11px]">
                      <span className="text-zinc-400">默认展开状态:</span>
                      <div className="flex items-center gap-1.5">
                        {[
                          { id: 'collapsed', label: '默认折叠' },
                          { id: 'expanded', label: '默认展开 (直观清晰)' },
                        ].map((mode) => {
                          const isSel = (formConfig.thinkingDisplayMode || 'collapsed') === mode.id;
                          return (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => {
                                ultraAudio.playUiClick();
                                setFormConfig({ ...formConfig, thinkingDisplayMode: mode.id as any });
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] transition-all border cursor-pointer ${
                                isSel
                                  ? 'bg-indigo-600 text-white font-bold border-indigo-400'
                                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                              }`}
                            >
                              {mode.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Temperature Slider */}
          <div className="space-y-1.5 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-zinc-300">Temperature (随机度/创意度):</span>
              <span className="font-mono text-purple-300 font-bold">{formConfig.temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={formConfig.temperature}
              onChange={(e) => setFormConfig({ ...formConfig, temperature: parseFloat(e.target.value) })}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>0.0 (严谨逻辑)</span>
              <span>0.7 (推荐角色扮演)</span>
              <span>1.5 (极高随机灵感)</span>
            </div>
          </div>

          {/* Test Status Banner */}
          {testStatus !== 'idle' && (
            <div
              className={`p-3 rounded-lg border flex flex-col space-y-2 text-xs font-mono animate-fade-in ${
                testStatus === 'testing'
                  ? 'bg-blue-950/40 border-blue-800/80 text-blue-300'
                  : testStatus === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
              }`}
            >
              <div className="flex items-start space-x-2">
                {testStatus === 'testing' && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin shrink-0 mt-0.5" />}
                {testStatus === 'success' && <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                {testStatus === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <div className="font-bold whitespace-pre-line leading-relaxed">{testMessage}</div>
                  {testLatency && <div className="text-[10px] opacity-80 mt-0.5">响应耗时: {testLatency} ms</div>}
                </div>
              </div>

              {/* Suggested Base URL 1-click Auto-Fix Button */}
              {suggestedTestBaseUrl && (
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] text-amber-300">
                    💡 发现可用接口路径: <strong className="text-amber-200">{suggestedTestBaseUrl}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playChimeSFX();
                      setFormConfig((prev) => ({ ...prev, baseUrl: suggestedTestBaseUrl }));
                      setSuggestedTestBaseUrl(null);
                      setSaveToastMsg(`⚡ 已自动切换为推荐 Base URL: ${suggestedTestBaseUrl}`);
                      setTimeout(() => setSaveToastMsg(null), 3500);
                    }}
                    className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-[0_0_10px_rgba(245,158,11,0.4)] cursor-pointer flex items-center space-x-1"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>一键应用推荐 Base URL</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg border border-purple-500/50 bg-purple-950/50 text-purple-300 hover:bg-purple-900/60 font-mono text-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
            <span>测试【{activeProvider?.name || '当前服务商'}】连接</span>
          </button>

          <div className="flex items-center space-x-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => handleSaveNow(false)}
              className="px-3 py-1.5 rounded-lg border border-emerald-500/60 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 font-bold transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] cursor-pointer flex items-center space-x-1.5"
              title="保存当前填写的 API 设置与密钥，无需关闭窗口"
            >
              <Save className="w-3.5 h-3.5" />
              <span>保存当前设置</span>
            </button>
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg border border-purple-500 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold hover:brightness-110 shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all cursor-pointer"
            >
              保存并应用 AI 引擎
            </button>
          </div>
        </div>
      </div>

      {/* SUB-MODAL 1: Custom Provider Editor / Creator Modal */}
      {isProviderEditorOpen && editingProvider && (
        <CustomProviderEditorModal
          isOpen={isProviderEditorOpen}
          provider={editingProvider}
          onClose={() => {
            setIsProviderEditorOpen(false);
            setEditingProvider(null);
          }}
          onSave={handleSaveProviderFromEditor}
        />
      )}

      {/* SUB-MODAL 2: Provider List Import / Export Modal */}
      {isProviderImportOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
          <div className="bg-zinc-950 border border-purple-500/50 rounded-2xl w-full max-w-xl p-5 space-y-4 shadow-[0_0_50px_rgba(168,85,247,0.3)] text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2 text-purple-300">
                <Upload className="w-5 h-5" />
                <h3 className="text-base font-bold">导入 AI 服务商配置</h3>
              </div>
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsProviderImportOpen(false);
                  setProviderImportError(null);
                  setProviderImportSuccess(null);
                }}
                className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              支持上传服务商备份 <strong className="text-purple-300">.json 文件</strong> 或直接粘贴服务商列表 JSON 数组以一键合并。
            </p>

            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-purple-900/60 hover:border-purple-500/60 rounded-xl p-4 bg-purple-950/20 text-center transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleProviderFileUpload}
                id="provider-config-file-input"
                className="hidden"
              />
              <label
                htmlFor="provider-config-file-input"
                className="flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
              >
                <Download className="w-6 h-6 text-purple-400 animate-bounce" />
                <span className="text-xs font-bold text-purple-300">点击选择本地服务商配置 .json 文件</span>
                <span className="text-[10px] text-zinc-500">（选择后将自动读取并填充至下方框内）</span>
              </label>
            </div>

            {/* Textarea Paste Zone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 flex items-center justify-between">
                <span>或直接在此粘贴服务商 JSON 列表:</span>
                <span className="text-[10px] text-zinc-500">字数: {providerImportText.length}</span>
              </label>
              <textarea
                value={providerImportText}
                onChange={(e) => {
                  setProviderImportText(e.target.value);
                  setProviderImportError(null);
                  setProviderImportSuccess(null);
                }}
                placeholder='在此粘贴形如 [{"id": "my_prov", "name": "...", "baseUrl": "..."}] 的 JSON...'
                rows={6}
                className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-purple-500 rounded-xl p-3 text-xs text-zinc-200 font-mono outline-none resize-y scrollbar-thin"
              />
            </div>

            {/* Feedback */}
            {providerImportError && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{providerImportError}</span>
              </div>
            )}

            {providerImportSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-xs text-emerald-300 flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{providerImportSuccess}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsProviderImportOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmProviderImport}
                disabled={!providerImportText.trim()}
                className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>解析并导入服务商</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 3: WorldView Card Import Modal */}
      {isWorldViewImportOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
          <div className="bg-zinc-950 border border-cyan-500/50 rounded-2xl w-full max-w-xl p-5 space-y-4 shadow-[0_0_50px_rgba(6,182,212,0.25)] text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2 text-cyan-400">
                <Upload className="w-5 h-5" />
                <h3 className="text-base font-bold text-cyan-300">导入宇宙世界观卡</h3>
              </div>
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsWorldViewImportOpen(false);
                  setWorldViewImportError(null);
                  setWorldViewImportSuccess(null);
                }}
                className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              支持上传由模拟器导出的 <strong className="text-cyan-300">.json 世界观卡文件</strong>，或直接粘贴世界观 JSON 数据以快速加载宇宙法则。
            </p>

            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-cyan-900/60 hover:border-cyan-500/60 rounded-xl p-4 bg-cyan-950/20 text-center transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleWorldViewFileUpload}
                id="worldview-card-file-input"
                className="hidden"
              />
              <label
                htmlFor="worldview-card-file-input"
                className="flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
              >
                <Download className="w-6 h-6 text-cyan-400 animate-bounce" />
                <span className="text-xs font-bold text-cyan-300">点击选择本地世界观卡 .json 文件</span>
                <span className="text-[10px] text-zinc-500">（选择文件后将自动填充并解析）</span>
              </label>
            </div>

            {/* Textarea Paste Zone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 flex items-center justify-between">
                <span>或直接在此粘贴世界观卡 JSON:</span>
                <span className="text-[10px] text-zinc-500">字数: {worldViewImportText.length}</span>
              </label>
              <textarea
                value={worldViewImportText}
                onChange={(e) => {
                  setWorldViewImportText(e.target.value);
                  setWorldViewImportError(null);
                  setWorldViewImportSuccess(null);
                }}
                placeholder='在此粘贴形如 {"cardType": "ultra_worldview_card", "worldView": "...", "name": "..."} 的世界观卡 JSON...'
                rows={6}
                className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-cyan-500 rounded-xl p-3 text-xs text-zinc-200 font-mono outline-none resize-y scrollbar-thin"
              />
            </div>

            {/* Feedback */}
            {worldViewImportError && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{worldViewImportError}</span>
              </div>
            )}

            {worldViewImportSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-xs text-emerald-300 flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{worldViewImportSuccess}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsWorldViewImportOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmWorldViewImport}
                disabled={!worldViewImportText.trim()}
                className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>解析并应用世界观卡</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 4: Fullscreen WorldView Reading & Editing Modal */}
      {isWorldViewExpanded && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-fade-in font-mono">
          <div className="bg-zinc-950 border border-cyan-500/50 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-[0_0_60px_rgba(6,182,212,0.3)] overflow-hidden text-zinc-100">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-cyan-950/80 via-zinc-950 to-indigo-950/80 border-b border-cyan-900/50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-300">
                  <Orbit className="w-5 h-5 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-cyan-200 flex items-center gap-2">
                    <span>🌌 全屏沉浸式宏观宇宙世界观架构师</span>
                    <span className="text-xs text-cyan-400 font-normal px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700/50">
                      支持万字深度设定与无截断阅读
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">AI 将在每次 API 生成对白与心理思考时全面贯彻此世界观</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleExportWorldView}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.4)] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出世界观卡</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyWorldViewCard}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {worldViewCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{worldViewCopied ? '已复制' : '复制 JSON'}</span>
                </button>
                <button
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setIsWorldViewExpanded(false);
                  }}
                  className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 cursor-pointer"
                  title="退出全屏"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Worldview Presets Bar in Fullscreen */}
            <div className="p-3 bg-zinc-950 border-b border-zinc-800/80 flex items-center gap-2 overflow-x-auto scrollbar-thin">
              <span className="text-xs font-bold text-cyan-400 shrink-0">快捷预设:</span>
              {WORLD_VIEW_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setFormConfig({ ...formConfig, customWorldView: p.prompt, worldViewEnabled: true });
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                    formConfig.customWorldView === p.prompt
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Fullscreen Editor / Reader Body */}
            <div className="p-5 flex-1 flex flex-col space-y-3 overflow-hidden bg-black/50">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1 text-cyan-300 font-bold">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>宇宙法则与星系设定全文 (排版舒适、宽敞阅读与实时编辑):</span>
                </span>
                <span className="text-cyan-400 font-mono">当前总字数: {formConfig.customWorldView?.length || 0} 字</span>
              </div>

              <DebouncedPromptTextarea
                value={formConfig.customWorldView || ''}
                onChange={(val) =>
                  setFormConfig((prev) => ({
                    ...prev,
                    customWorldView: val,
                  }))
                }
                placeholder="请在此输入宏观世界观设定..."
                className="flex-1 w-full bg-zinc-900/90 border border-cyan-900/60 focus:border-cyan-500 rounded-xl p-4 text-sm text-cyan-100 placeholder-zinc-600 font-mono leading-loose outline-none resize-none scrollbar-thin shadow-inner"
              />
            </div>

            {/* Footer */}
            <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-500 text-xs">💡 设定自动保留在当前配置中，点击保存 AI 引擎后即刻生效</span>
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsWorldViewExpanded(false);
                }}
                className="px-5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs border border-cyan-400 cursor-pointer shadow-md"
              >
                完成编辑并返回
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 5: Save Custom Jailbreak Preset Modal */}
      {isSavePresetModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
          <div className="bg-zinc-950 border border-rose-500/50 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-[0_0_50px_rgba(244,63,94,0.3)] text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2 text-rose-400">
                <Bookmark className="w-5 h-5" />
                <h3 className="text-base font-bold">保存为自定义破限预设</h3>
              </div>
              <button
                onClick={() => setIsSavePresetModalOpen(false)}
                className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              将当前正在编辑的破限提示词、反道德拒答协议规则以及 <strong className="text-rose-300">专属挂载的 {(formConfig.jailbreakAttachments?.length || 0)} 项参考文档与图片</strong> 永久打包保存为专属预设。
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">破限预设名称 (Name) *</label>
                <input
                  type="text"
                  value={savePresetName}
                  onChange={(e) => setSavePresetName(e.target.value)}
                  placeholder="如: DeepSeek-科幻无限制对抗协议"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-rose-500 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">方案描述或适用模型 (Description)</label>
                <input
                  type="text"
                  value={savePresetDesc}
                  onChange={(e) => setSavePresetDesc(e.target.value)}
                  placeholder="如: 专为 DeepSeek/Claude 强力对抗与生理受损描摹定制"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-rose-500 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/60 text-xs space-y-1 text-zinc-300">
                <div className="font-bold text-rose-300 text-[11px] flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span>包含内容预览:</span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  • 破限 Prompt 词数: {(formConfig.customJailbreakPrompt || selectedJailbreakPreset.prompt).length} 字符
                </div>
                <div className="text-[11px] text-zinc-400">
                  • 专属挂载附件: {formConfig.jailbreakAttachments?.length || 0} 项
                  {formConfig.jailbreakAttachments && formConfig.jailbreakAttachments.length > 0 && (
                    <span className="text-rose-400 ml-1">
                      ({formConfig.jailbreakAttachments.map((a) => a.name).join(', ')})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsSavePresetModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveCustomJailbreakPreset}
                disabled={!savePresetName.trim()}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(244,63,94,0.4)] cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>确认保存为预设</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 6: Import Jailbreak Card Modal */}
      {isJailbreakImportOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
          <div className="bg-zinc-950 border border-emerald-500/50 rounded-2xl w-full max-w-xl p-5 space-y-4 shadow-[0_0_50px_rgba(16,185,129,0.3)] text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2 text-emerald-400">
                <Upload className="w-5 h-5" />
                <h3 className="text-base font-bold">导入破限卡 (Jailbreak Card)</h3>
              </div>
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsJailbreakImportOpen(false);
                  setJailbreakImportError(null);
                  setJailbreakImportSuccess(null);
                }}
                className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              支持上传社区或用户分享的破限卡 <strong className="text-emerald-300">.json 文件</strong> 或直接粘贴破限卡 JSON 字符串。
            </p>

            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-emerald-900/60 hover:border-emerald-500/60 rounded-xl p-4 bg-emerald-950/20 text-center transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleJailbreakFileUpload}
                id="jailbreak-card-file-input"
                className="hidden"
              />
              <label
                htmlFor="jailbreak-card-file-input"
                className="flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
              >
                <Download className="w-6 h-6 text-emerald-400 animate-bounce" />
                <span className="text-xs font-bold text-emerald-300">点击选择本地破限卡 .json 文件</span>
                <span className="text-[10px] text-zinc-500">（选择后将自动解析破限词与挂载的参考文档/图片）</span>
              </label>
            </div>

            {/* Textarea Paste Zone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 flex items-center justify-between">
                <span>或直接在此粘贴破限卡 JSON:</span>
                <span className="text-[10px] text-zinc-500">字数: {jailbreakImportText.length}</span>
              </label>
              <textarea
                value={jailbreakImportText}
                onChange={(e) => {
                  setJailbreakImportText(e.target.value);
                  setJailbreakImportError(null);
                  setJailbreakImportSuccess(null);
                }}
                placeholder='在此粘贴形如 {"cardType": "ultra_jailbreak_card", "name": "...", "prompt": "...", "attachments": [...]} 的破限卡 JSON...'
                rows={6}
                className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-emerald-500 rounded-xl p-3 text-xs text-zinc-200 font-mono outline-none resize-y scrollbar-thin"
              />
            </div>

            {/* Feedback */}
            {jailbreakImportError && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{jailbreakImportError}</span>
              </div>
            )}

            {jailbreakImportSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-xs text-emerald-300 flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{jailbreakImportSuccess}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsJailbreakImportOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmJailbreakImport}
                disabled={!jailbreakImportText.trim()}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>解析并导入破限卡</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 6: Save / Edit WorldView Slot Modal */}
      {isSaveWorldViewSlotModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
          <div className="bg-zinc-950 border border-cyan-500/60 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-[0_0_50px_rgba(6,182,212,0.35)] text-zinc-100">
            <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3">
              <div className="flex items-center space-x-2 text-cyan-400">
                <Save className="w-5 h-5" />
                <h3 className="text-base font-bold text-cyan-200">
                  {editingWorldViewSlotId ? '编辑世界观保存槽位' : '存为自定义世界观槽位'}
                </h3>
              </div>
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsSaveWorldViewSlotModalOpen(false);
                }}
                className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              将当前世界观设定保存为一个可随时切换、编辑、备份与导出的独立存档槽位。
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-cyan-300">
                  槽位名称 <span className="text-rose-400">*</span>:
                </label>
                <input
                  type="text"
                  value={saveWorldViewSlotName}
                  onChange={(e) => setSaveWorldViewSlotName(e.target.value)}
                  placeholder="例如: 🌌 暗黑异次元战争 / 赛博朋克"
                  className="w-full bg-zinc-900/90 border border-cyan-900/60 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-cyan-100 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">
                  一句话简介 (Summary):
                </label>
                <input
                  type="text"
                  value={saveWorldViewSlotSummary}
                  onChange={(e) => setSaveWorldViewSlotSummary(e.target.value)}
                  placeholder="简短概括核心世界观设定..."
                  className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">
                  分类标签 (以逗号分隔):
                </label>
                <input
                  type="text"
                  value={saveWorldViewSlotTags}
                  onChange={(e) => setSaveWorldViewSlotTags(e.target.value)}
                  placeholder="例如: 原创世界观, 宿命对决"
                  className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-black/60 border border-cyan-900/50 space-y-1">
                <div className="text-[11px] font-bold text-cyan-400 flex items-center justify-between">
                  <span>保存的正文预览:</span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {formConfig.customWorldView?.length || 0} 字
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 font-mono line-clamp-3 leading-relaxed">
                  {formConfig.customWorldView || '(正文为空)'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsSaveWorldViewSlotModalOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveWorldViewSlotSubmit}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:brightness-110 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{editingWorldViewSlotId ? '更新槽位' : '确认保存至槽位库'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 7: Batch WorldView Slots Import / Export / Backup Modal */}
      {isWorldViewSlotsImportOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
          <div className="bg-zinc-950 border border-cyan-500/50 rounded-2xl w-full max-w-xl p-5 space-y-4 shadow-[0_0_50px_rgba(6,182,212,0.3)] text-zinc-100">
            <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3">
              <div className="flex items-center space-x-2 text-cyan-400">
                <Upload className="w-5 h-5" />
                <h3 className="text-base font-bold text-cyan-200">批量导入世界观槽位库 (Slots Backup)</h3>
              </div>
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsWorldViewSlotsImportOpen(false);
                  setWorldViewSlotsImportError(null);
                  setWorldViewSlotsImportSuccess(null);
                }}
                className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              支持上传世界观槽位库备份 <strong className="text-cyan-300">.json 文件</strong>，或直接粘贴世界观槽位 JSON 数组以一键合并或替换当前槽位库。
            </p>

            {/* Quick Export & Copy Bar */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-800/50 text-xs">
              <span className="text-cyan-300 font-bold text-[11px]">导出当前全部槽位:</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleExportAllWorldViewSlots}
                  className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-600/50 text-cyan-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>下载 .json 备份</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyAllWorldViewSlotsJson}
                  className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  {worldViewSlotsCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{worldViewSlotsCopied ? '已复制' : '复制全部 JSON'}</span>
                </button>
              </div>
            </div>

            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-cyan-900/60 hover:border-cyan-500/60 rounded-xl p-4 bg-cyan-950/20 text-center transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleWorldViewSlotsFileUpload}
                id="worldview-slots-backup-file-input"
                className="hidden"
              />
              <label
                htmlFor="worldview-slots-backup-file-input"
                className="flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
              >
                <Download className="w-6 h-6 text-cyan-400 animate-bounce" />
                <span className="text-xs font-bold text-cyan-300">点击选择本地世界观槽位备份 .json 文件</span>
                <span className="text-[10px] text-zinc-500">（选择后将自动读取并填充至下方框内）</span>
              </label>
            </div>

            {/* Textarea Paste Zone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 flex items-center justify-between">
                <span>或直接在此粘贴槽位 JSON:</span>
                <span className="text-[10px] text-zinc-500">字数: {worldViewSlotsImportText.length}</span>
              </label>
              <textarea
                value={worldViewSlotsImportText}
                onChange={(e) => {
                  setWorldViewSlotsImportText(e.target.value);
                  setWorldViewSlotsImportError(null);
                  setWorldViewSlotsImportSuccess(null);
                }}
                placeholder='在此粘贴世界观备份 JSON 或形如 [{"id": "...", "name": "...", "prompt": "..."}] 的槽位数组...'
                rows={5}
                className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-cyan-500 rounded-xl p-3 text-xs text-zinc-200 font-mono outline-none resize-y scrollbar-thin"
              />
            </div>

            {/* Feedback */}
            {worldViewSlotsImportError && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{worldViewSlotsImportError}</span>
              </div>
            )}

            {worldViewSlotsImportSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-xs text-emerald-300 flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{worldViewSlotsImportSuccess}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsWorldViewSlotsImportOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handleConfirmWorldViewSlotsImport('merge')}
                disabled={!worldViewSlotsImportText.trim()}
                className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                title="保留现有槽位，追加并合并新槽位"
              >
                <PlusCircle className="w-4 h-4" />
                <span>合并导入</span>
              </button>
              <button
                type="button"
                onClick={() => handleConfirmWorldViewSlotsImport('replace')}
                disabled={!worldViewSlotsImportText.trim()}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer flex items-center space-x-1"
                title="清空当前自定义槽位并以导入的槽位完全覆盖"
              >
                <Check className="w-4 h-4" />
                <span>覆盖替换导入</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 8: Save / Edit API Profile Modal */}
      {isSaveProfileModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
          <div className="bg-zinc-950 border border-emerald-500/60 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-[0_0_50px_rgba(16,185,129,0.3)] text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2 text-emerald-400">
                <BookmarkPlus className="w-5 h-5" />
                <h3 className="text-base font-bold">
                  {editingProfileId ? '修改 API 预设方案' : '存为新 API 预设方案'}
                </h3>
              </div>
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsSaveProfileModalOpen(false);
                }}
                className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              将当前填写的 <strong className="text-emerald-300">服务商、Base URL、Model、API Key 密钥、温度、破限词与系统提示词</strong> 保存为独立存档，方便未来一键随时切换！
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-emerald-300">方案名称 (Name) *</label>
                <input
                  type="text"
                  value={saveProfileName}
                  onChange={(e) => setSaveProfileName(e.target.value)}
                  placeholder="如: DeepSeek-V3 战术主力 / OpenAI GPT-4o 中转站"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">方案备注/使用场景 (Description)</label>
                <input
                  type="text"
                  value={saveProfileDesc}
                  onChange={(e) => setSaveProfileDesc(e.target.value)}
                  placeholder="如: 低成本对白生成、强逻辑推演、免魔法直连等"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none"
                />
              </div>

              {/* Snapshot parameters preview */}
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs space-y-1.5 font-mono">
                <div className="font-bold text-emerald-300 text-[11px] flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>包含的 API 参数快照:</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-300 pt-1">
                  <div>
                    <span className="text-zinc-500">服务商: </span>
                    <span className="text-purple-300">{activeProvider?.name || formConfig.provider}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">模型: </span>
                    <span className="text-emerald-300">{formConfig.model || '未设定'}</span>
                  </div>
                  <div className="col-span-2 truncate">
                    <span className="text-zinc-500">Base URL: </span>
                    <span className="text-blue-300">{formConfig.baseUrl}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">API Key: </span>
                    <span>{formConfig.apiKey ? '🔑 已填写 (已保护存入)' : '（未填）'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">温度系数: </span>
                    <span className="text-amber-300">{formConfig.temperature}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsSaveProfileModalOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveProfileSubmit}
                disabled={!saveProfileName.trim()}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{editingProfileId ? '确认更新方案' : '确认保存方案'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 9: Full AI Config Backup / Restore Modal */}
      {isAllConfigBackupModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
          <div className="bg-zinc-950 border border-purple-500/50 rounded-2xl w-full max-w-xl p-5 space-y-4 shadow-[0_0_50px_rgba(168,85,247,0.3)] text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2 text-purple-300">
                <FileJson className="w-5 h-5" />
                <h3 className="text-base font-bold">全量 AI / API 配置文件备份与导入</h3>
              </div>
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsAllConfigBackupModalOpen(false);
                  setAllConfigImportError(null);
                  setAllConfigImportSuccess(null);
                }}
                className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              一键备份或恢复包含 <strong className="text-purple-300">所有自定义服务商、全部 API 预设方案、破限词卡库与世界观槽位</strong> 的全量配置文件。
            </p>

            {/* Quick Export / Copy Bar */}
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-zinc-300 font-bold flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-400" />
                <span>导出当前所有配置:</span>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleExportFullAiConfigBackup}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center space-x-1 transition-all shadow-[0_0_12px_rgba(168,85,247,0.3)] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载 .json 备份文件</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyFullAiConfigJson}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                >
                  {allConfigCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{allConfigCopied ? '已复制' : '复制 JSON'}</span>
                </button>
              </div>
            </div>

            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-purple-900/60 hover:border-purple-500/60 rounded-xl p-4 bg-purple-950/20 text-center transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleAllConfigFileUpload}
                id="full-ai-config-file-input"
                className="hidden"
              />
              <label
                htmlFor="full-ai-config-file-input"
                className="flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
              >
                <Upload className="w-6 h-6 text-purple-400 animate-bounce" />
                <span className="text-xs font-bold text-purple-300">点击选择本地 AI 全量配置 .json 文件进行恢复</span>
                <span className="text-[10px] text-zinc-500">（选择后将自动读取并填充至下方框内）</span>
              </label>
            </div>

            {/* Textarea Paste Zone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 flex items-center justify-between">
                <span>或直接在此粘贴备份 JSON 数据:</span>
                <span className="text-[10px] text-zinc-500">字数: {allConfigImportText.length}</span>
              </label>
              <textarea
                value={allConfigImportText}
                onChange={(e) => {
                  setAllConfigImportText(e.target.value);
                  setAllConfigImportError(null);
                  setAllConfigImportSuccess(null);
                }}
                placeholder='在此粘贴备份 JSON...'
                rows={5}
                className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-purple-500 rounded-xl p-3 text-xs text-zinc-200 font-mono outline-none resize-y scrollbar-thin"
              />
            </div>

            {/* Feedback */}
            {allConfigImportError && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{allConfigImportError}</span>
              </div>
            )}

            {allConfigImportSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-xs text-emerald-300 flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{allConfigImportSuccess}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsAllConfigBackupModalOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmFullAiConfigImport}
                disabled={!allConfigImportText.trim()}
                className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>解析并恢复全量配置</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 10: Save Custom System Prompt Preset Modal */}
      {isSaveSystemPresetModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
          <div className="bg-zinc-950 border border-purple-500/50 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-[0_0_50px_rgba(168,85,247,0.3)] text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2 text-purple-400">
                <Bookmark className="w-5 h-5" />
                <h3 className="text-base font-bold">保存为自定义系统与叙事引导预设</h3>
              </div>
              <button
                onClick={() => setIsSaveSystemPresetModalOpen(false)}
                className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              将当前正在编辑的通用叙事风格、微表情刻画与生理机能反馈指令永久保存为一个独立的预设卡，方便随时一键切换。
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">预设名称 (Preset Name) *</label>
                <input
                  type="text"
                  value={saveSystemPresetName}
                  onChange={(e) => setSaveSystemPresetName(e.target.value)}
                  placeholder="如: 高张力微表情与声学生理反馈"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">简短说明 (Description)</label>
                <input
                  type="text"
                  value={saveSystemPresetDesc}
                  onChange={(e) => setSaveSystemPresetDesc(e.target.value)}
                  placeholder="如: 突出战败审讯中的呼吸急促与核心律动"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-900/60 text-xs space-y-1 text-zinc-300">
                <div className="font-bold text-purple-300 text-[11px] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>包含指令内容预览 ({formConfig.customSystemPrompt?.length || 0} 字符):</span>
                </div>
                <div className="text-[11px] text-zinc-400 font-mono line-clamp-3 bg-zinc-900/80 p-2 rounded border border-zinc-800">
                  {formConfig.customSystemPrompt || '（当前无内容）'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsSaveSystemPresetModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveNewSystemPreset}
                disabled={!saveSystemPresetName.trim()}
                className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>确认保存为新预设</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 11: Import System Presets Modal */}
      {isSystemPresetImportOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
          <div className="bg-zinc-950 border border-purple-500/50 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-[0_0_50px_rgba(168,85,247,0.3)] text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2 text-purple-400">
                <Upload className="w-5 h-5" />
                <h3 className="text-base font-bold">导入系统与叙事引导预设库</h3>
              </div>
              <button
                onClick={() => {
                  setIsSystemPresetImportOpen(false);
                  setSystemPresetImportError(null);
                  setSystemPresetImportSuccess(null);
                }}
                className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              选择或粘贴预设库导出的 JSON 数据，将自动合并至您的自定义系统预设列表中。
            </p>

            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-purple-900/60 hover:border-purple-500/60 rounded-xl p-4 bg-purple-950/20 text-center transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleSystemPresetFileUpload}
                id="system-preset-file-input"
                className="hidden"
              />
              <label
                htmlFor="system-preset-file-input"
                className="flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
              >
                <Upload className="w-6 h-6 text-purple-400 animate-bounce" />
                <span className="text-xs font-bold text-purple-300">点击选择本地预设库 .json 文件</span>
                <span className="text-[10px] text-zinc-500">（选择后将自动读取内容并填充至下方输入框）</span>
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">或直接在此粘贴 JSON 文本:</label>
              <textarea
                value={systemPresetImportText}
                onChange={(e) => {
                  setSystemPresetImportText(e.target.value);
                  setSystemPresetImportError(null);
                }}
                rows={5}
                placeholder="[ { id: '...', name: '...', prompt: '...' } ]"
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-lg p-2.5 text-xs text-zinc-200 font-mono outline-none"
              />
            </div>

            {systemPresetImportError && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{systemPresetImportError}</span>
              </div>
            )}

            {systemPresetImportSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-xs text-emerald-300 flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{systemPresetImportSuccess}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsSystemPresetImportOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleImportSystemPresets}
                disabled={!systemPresetImportText.trim()}
                className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>解析并导入预设</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: Dedicated Custom AI Provider Editor Modal
// =========================================================================

interface CustomProviderEditorModalProps {
  isOpen: boolean;
  provider: CustomAiProviderItem;
  onClose: () => void;
  onSave: (saved: CustomAiProviderItem) => void;
}

const CustomProviderEditorModal: React.FC<CustomProviderEditorModalProps> = ({
  isOpen,
  provider,
  onClose,
  onSave,
}) => {
  const [item, setItem] = useState<CustomAiProviderItem>({ ...provider });
  const [modelTagInput, setModelTagInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [headerKeyInput, setHeaderKeyInput] = useState('');
  const [headerValInput, setHeaderValInput] = useState('');

  if (!isOpen) return null;

  const handleAddModelPreset = () => {
    if (!modelTagInput.trim()) return;
    const current = item.modelsPreset || [];
    if (!current.includes(modelTagInput.trim())) {
      setItem({ ...item, modelsPreset: [...current, modelTagInput.trim()] });
    }
    setModelTagInput('');
  };

  const handleRemoveModelPreset = (tag: string) => {
    setItem({ ...item, modelsPreset: (item.modelsPreset || []).filter((t) => t !== tag) });
  };

  const handleAddHeader = () => {
    if (!headerKeyInput.trim()) return;
    const current = item.customHeaders || {};
    setItem({
      ...item,
      customHeaders: { ...current, [headerKeyInput.trim()]: headerValInput.trim() },
    });
    setHeaderKeyInput('');
    setHeaderValInput('');
  };

  const handleRemoveHeader = (k: string) => {
    const current = { ...(item.customHeaders || {}) };
    delete current[k];
    setItem({ ...item, customHeaders: current });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.name.trim()) {
      alert('请输入服务商名称');
      return;
    }
    if (!item.baseUrl.trim()) {
      alert('请输入 API Base URL 地址');
      return;
    }
    onSave({
      ...item,
      name: item.name.trim(),
      baseUrl: item.baseUrl.trim(),
      defaultModel: item.defaultModel?.trim() || 'gpt-4o-mini',
    });
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
      <div className="bg-zinc-950 border border-purple-500/60 rounded-2xl w-full max-w-2xl p-5 shadow-[0_0_50px_rgba(168,85,247,0.35)] flex flex-col max-h-[92vh] overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center space-x-2 text-purple-300">
            <Settings2 className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-bold">
              {item.isBuiltIn ? `编辑服务商配置 · ${item.name}` : `自定义 AI 服务商 · ${item.name || '新建'}`}
            </h3>
          </div>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 py-3 pr-1 text-xs scrollbar-thin">
          {/* Provider Name & Protocol Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-zinc-300 flex items-center space-x-1">
                <span>服务商名称 (Display Name) *</span>
              </label>
              <input
                type="text"
                required
                value={item.name}
                onChange={(e) => setItem({ ...item, name: e.target.value })}
                placeholder="如: 我的私有中转站 / SiliconFlow"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-zinc-300">接口协议 (Protocol)</label>
              <select
                value={item.protocolType || 'openai'}
                onChange={(e) => setItem({ ...item, protocolType: e.target.value as any })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="openai">OpenAI 兼容 (通用)</option>
                <option value="gemini">Google Gemini</option>
                <option value="claude">Anthropic Claude</option>
              </select>
            </div>
          </div>

          {/* Base URL */}
          <div className="space-y-1">
            <label className="font-bold text-zinc-300 flex items-center justify-between">
              <span>API Base URL (接口基地址) *</span>
              <span className="text-[10px] text-zinc-500 font-normal">后端将自动补全 /chat/completions</span>
            </label>
            <input
              type="text"
              required
              value={item.baseUrl}
              onChange={(e) => setItem({ ...item, baseUrl: e.target.value })}
              placeholder="如: https://api.openai.com/v1 或 http://localhost:11434/v1"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          {/* Default Model */}
          <div className="space-y-1">
            <label className="font-bold text-zinc-300">默认模型名称 (Default Model) *</label>
            <input
              type="text"
              required
              value={item.defaultModel}
              onChange={(e) => setItem({ ...item, defaultModel: e.target.value })}
              placeholder="如: gpt-4o-mini, deepseek-chat, qwen2.5:14b"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          {/* Model Presets Tags */}
          <div className="space-y-1.5 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <label className="font-bold text-zinc-300 flex items-center justify-between">
              <span>常用快捷模型列表 (Model Presets)</span>
              <span className="text-[10px] text-zinc-500 font-normal">可在面板中一键快速切换模型</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(item.modelsPreset || []).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/50 text-purple-200 text-[10px] flex items-center gap-1"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveModelPreset(tag)}
                    className="text-zinc-400 hover:text-rose-400 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={modelTagInput}
                onChange={(e) => setModelTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddModelPreset();
                  }
                }}
                placeholder="输入模型名称后点击添加或按回车..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-100 font-mono text-[11px]"
              />
              <button
                type="button"
                onClick={handleAddModelPreset}
                className="px-3 py-1 rounded bg-purple-900 hover:bg-purple-800 text-purple-200 font-bold text-[11px] cursor-pointer"
              >
                + 添加标签
              </button>
            </div>
          </div>

          {/* Dedicated API Key (Optional) */}
          <div className="space-y-1">
            <label className="font-bold text-zinc-300 flex items-center justify-between">
              <span>该服务商独立专属 API Key (可选)</span>
              <span className="text-[10px] text-zinc-500 font-normal">若留空，则使用全局 API Key</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={item.apiKey || ''}
                onChange={(e) => setItem({ ...item, apiKey: e.target.value })}
                placeholder="如: sk-xxxxxxxxxxxxxxx"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-purple-500 font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Custom Headers (Optional, e.g. OpenRouter) */}
          <div className="space-y-1.5 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <label className="font-bold text-zinc-300 flex items-center justify-between">
              <span>自定义 Request Headers 请求头 (可选)</span>
              <span className="text-[10px] text-zinc-500 font-normal">如 OpenRouter 的 HTTP-Referer、X-Title</span>
            </label>

            {item.customHeaders && Object.keys(item.customHeaders).length > 0 && (
              <div className="space-y-1 mb-2">
                {Object.entries(item.customHeaders).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between p-1.5 rounded bg-black/50 border border-zinc-800 text-[10px] font-mono"
                  >
                    <span className="text-purple-300">{k}:</span>
                    <span className="text-zinc-400 truncate max-w-xs">{v}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveHeader(k)}
                      className="text-zinc-500 hover:text-rose-400 cursor-pointer px-1"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-5 gap-2">
              <input
                type="text"
                value={headerKeyInput}
                onChange={(e) => setHeaderKeyInput(e.target.value)}
                placeholder="Header Name (如 HTTP-Referer)"
                className="col-span-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono"
              />
              <input
                type="text"
                value={headerValInput}
                onChange={(e) => setHeaderValInput(e.target.value)}
                placeholder="Header Value (如 https://...)"
                className="col-span-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono"
              />
              <button
                type="button"
                onClick={handleAddHeader}
                className="col-span-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold cursor-pointer"
              >
                + 添加
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="font-bold text-zinc-300">备注说明 (Note)</label>
            <input
              type="text"
              value={item.note || ''}
              onChange={(e) => setItem({ ...item, note: e.target.value })}
              placeholder="如: 私有反代，支持并发，含赠金等"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] cursor-pointer flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>保存服务商配置</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
