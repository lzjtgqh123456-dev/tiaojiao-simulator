import React, { useState, useMemo, useEffect } from 'react';
import { Ultrawoman, Faction, BodyPartId, RelationshipSlot } from '../types';
import {
  X,
  Search,
  Plus,
  UserCheck,
  Settings,
  Trash2,
  Sparkles,
  User,
  Users,
  Check,
  UserPlus,
  Shield,
  Eye,
  Heart,
  Download,
  Upload,
  Copy,
  FileText,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Share2,
  Info,
  AlertCircle,
  Crown,
  Star,
  Layers,
  Sliders,
  Zap,
  Volume2,
  Target,
  TestTube,
  Paperclip,
  Image as ImageIcon,
  Flame,
  Activity,
  CheckCircle2,
  Package,
  FolderDown,
  Code,
  CheckSquare,
  Square,
  DownloadCloud,
} from 'lucide-react';
import { ultraAudio } from '../utils/audio';
import { PortraitMediaDisplay } from './PortraitMediaDisplay';
import { DEFAULT_FACTIONS, getFactionById, getHeroFactionMemberships, isHeroInFaction, isHeroUnassigned, getSubFactionById } from '../data/factions';
import {
  getAllAvailablePersonalities,
  applyPersonalityToHero,
  loadCustomPersonalitySlotsFromStorage,
  loadPresetPersonalitiesFromStorage,
  PERSONALITY_DEFINITIONS,
} from '../data/personalities';
import {
  downloadCharacterCardFile,
  exportCharacterCard,
  downloadCharacterDeckFile,
  exportCharacterDeck,
  parseCharacterCard,
  buildTavernLorebook,
  CharacterCardExportOptions,
  CharacterDeckExportOptions,
  ParsedCharacterCardResult,
} from '../utils/cardUtils';
import { downloadFullLocalBackup } from '../services/storageSync';

interface HeroSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  heroines: Ultrawoman[];
  factions?: Faction[];
  selectedHero: Ultrawoman;
  activeTeamIds?: string[];
  allRelationshipSlots?: RelationshipSlot[];
  onSelectHero: (hero: Ultrawoman) => void;
  onSetSingleHeroMode?: (hero: Ultrawoman) => void;
  onToggleTeamMember?: (heroId: string) => void;
  onSelectAllTeam?: () => void;
  onResetTeamSingle?: () => void;
  onAddHero: () => void;
  onDeleteHero?: (heroId: string) => void;
  onOpenCustomizerForHero?: (hero: Ultrawoman) => void;
  onUpdateHero?: (hero: Ultrawoman) => void;
  onImportCharacterCard?: (hero: Ultrawoman) => void;
  onImportBatchHeroes?: (heroes: Ultrawoman[], factions?: Faction[], relationshipSlots?: RelationshipSlot[]) => void;
}

type CardInspectTab =
  | 'overview'
  | 'appearance'
  | 'factions'
  | 'personality'
  | 'anatomy_stats'
  | 'voice_lines'
  | 'triggers_env'
  | 'relationships_attachments'
  | 'lorebook_json';

export const HeroSelectorModal: React.FC<HeroSelectorModalProps> = ({
  isOpen,
  onClose,
  heroines,
  factions = DEFAULT_FACTIONS,
  selectedHero,
  activeTeamIds = [],
  allRelationshipSlots = [],
  onSelectHero,
  onSetSingleHeroMode,
  onToggleTeamMember,
  onSelectAllTeam,
  onResetTeamSingle,
  onAddHero,
  onDeleteHero,
  onOpenCustomizerForHero,
  onUpdateHero,
  onImportCharacterCard,
  onImportBatchHeroes,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'preset' | 'custom'>('all');
  const [factionFilter, setFactionFilter] = useState<string>('all');
  const [subFactionFilter, setSubFactionFilter] = useState<string>('all');

  // Expanded card state to view full text without truncation
  const [expandedHeroIds, setExpandedHeroIds] = useState<Set<string>>(new Set());

  // Holographic Character Card preview modal
  const [previewingCardHero, setPreviewingCardHero] = useState<Ultrawoman | null>(null);
  const [cardInspectTab, setCardInspectTab] = useState<CardInspectTab>('overview');

  // Export options state for single card
  const [exportFormat, setExportFormat] = useState<'ultra_v3' | 'tavern_v2'>('ultra_v3');
  const [exportIncludePortrait, setExportIncludePortrait] = useState(true);
  const [exportIncludeAttachments, setExportIncludeAttachments] = useState(true);
  const [exportIncludeRelationships, setExportIncludeRelationships] = useState(true);
  const [exportAuthor, setExportAuthor] = useState('Commander');
  const [exportNotes, setExportNotes] = useState('');
  const [lorebookCopySuccess, setLorebookCopySuccess] = useState(false);

  // Deck Export sub-modal state
  const [isDeckExportModalOpen, setIsDeckExportModalOpen] = useState(false);
  const [deckExportSelectedIds, setDeckExportSelectedIds] = useState<Set<string>>(() => new Set(heroines.map((h) => h.id)));
  const [deckExportName, setDeckExportName] = useState('特勤战术干员全息名册卡包 (Character Deck)');
  const [deckExportDescription, setDeckExportDescription] = useState('包含全体特勤干员、专属生理弱点防线、人际羁绊与多模态档案的完整名册卡包。');
  const [deckExportAuthor, setDeckExportAuthor] = useState('Commander');
  const [deckExportIncludePortraits, setDeckExportIncludePortraits] = useState(true);
  const [deckExportIncludeAttachments, setDeckExportIncludeAttachments] = useState(true);
  const [deckExportIncludeRelationships, setDeckExportIncludeRelationships] = useState(true);

  // Import Character Card / Deck sub-modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importFactionTarget, setImportFactionTarget] = useState<string>('preserve');
  const [importIdStrategy, setImportIdStrategy] = useState<'new_id' | 'overwrite_if_exists'>('new_id');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [copiedHeroId, setCopiedHeroId] = useState<string | null>(null);
  const [deckImportSelectedHeroIds, setDeckImportSelectedHeroIds] = useState<Set<string>>(new Set());
  const [isBackingUpMedia, setIsBackingUpMedia] = useState(false);
  const [mediaBackupToast, setMediaBackupToast] = useState<string | null>(null);

  const handleBackupAllHeroesAndMedia = async () => {
    ultraAudio.playUiClick();
    setIsBackingUpMedia(true);
    try {
      const res = await downloadFullLocalBackup(
        { heroines, factions },
        '（模拟）_Heroes_Media_Backup',
        false,
        true
      );
      if (res.success) {
        ultraAudio.playApiReplyChime();
        setMediaBackupToast(`✅ 已完整备份 ${heroines.length} 位角色及全部视频/图片立绘与附件 (${res.sizeKb} KB)`);
        setTimeout(() => setMediaBackupToast(null), 4500);
      }
    } catch (e: any) {
      setMediaBackupToast(`⚠️ 备份提示: ${e?.message || '备份失败'}`);
      setTimeout(() => setMediaBackupToast(null), 3500);
    } finally {
      setIsBackingUpMedia(false);
    }
  };

  // Keep deckExportSelectedIds synchronized when heroines list changes
  useEffect(() => {
    setDeckExportSelectedIds(new Set(heroines.map((h) => h.id)));
  }, [heroines.length]);

  // Realtime Parse character card for preview in Import modal
  const parsedImportResult = useMemo<ParsedCharacterCardResult | null>(() => {
    if (!importJsonText.trim()) return null;
    return parseCharacterCard(importJsonText, {
      allFactions: factions,
      forceNewId: importIdStrategy === 'new_id',
    });
  }, [importJsonText, factions, importIdStrategy]);

  // When a deck is detected during import, select all its heroes by default
  useEffect(() => {
    if (parsedImportResult?.isDeckPackage && parsedImportResult.deckHeroes) {
      setDeckImportSelectedHeroIds(new Set(parsedImportResult.deckHeroes.map((h) => h.id)));
    }
  }, [parsedImportResult]);

  const toggleExpandHero = (heroId: string) => {
    ultraAudio.playUiClick();
    setExpandedHeroIds((prev) => {
      const next = new Set(prev);
      if (next.has(heroId)) next.delete(heroId);
      else next.add(heroId);
      return next;
    });
  };

  const getExportOptions = (): CharacterCardExportOptions => ({
    format: exportFormat,
    includePortrait: exportIncludePortrait,
    includeAttachments: exportIncludeAttachments,
    includeRelationships: exportIncludeRelationships,
    allFactions: factions,
    allRelationshipSlots,
    author: exportAuthor.trim() || 'Commander',
    notes: exportNotes.trim() || undefined,
  });

  const handleCopyCard = (hero: Ultrawoman) => {
    ultraAudio.playUiClick();
    const options = getExportOptions();
    const card = exportCharacterCard(hero, options);
    navigator.clipboard.writeText(JSON.stringify(card, null, 2));
    setCopiedHeroId(hero.id);
    setTimeout(() => setCopiedHeroId(null), 2000);
  };

  const handleCloneHero = (heroToClone: Ultrawoman) => {
    ultraAudio.playPowerUp();
    const clonedId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const clonedHero: Ultrawoman = {
      ...JSON.parse(JSON.stringify(heroToClone)),
      id: clonedId,
      name: `${heroToClone.name} (复制体)`,
      title: heroToClone.title ? `${heroToClone.title} [特勤复制体]` : '特勤复制体',
    };
    if (onImportCharacterCard) {
      onImportCharacterCard(clonedHero);
    } else {
      onAddHero();
    }
  };

  const handleDownloadCard = (hero: Ultrawoman) => {
    ultraAudio.playUiClick();
    const options = getExportOptions();
    downloadCharacterCardFile(hero, options);
  };

  // Download entire or selected heroes as a Character Deck Package (.json)
  const handleDownloadDeck = () => {
    ultraAudio.playUiClick();
    const selectedDeckHeroes = heroines.filter((h) => deckExportSelectedIds.has(h.id));
    if (selectedDeckHeroes.length === 0) return;

    const deckOptions: CharacterDeckExportOptions = {
      deckName: deckExportName.trim() || '特勤干员名册卡包',
      deckDescription: deckExportDescription.trim() || undefined,
      author: deckExportAuthor.trim() || 'Commander',
      includePortraits: deckExportIncludePortraits,
      includeAttachments: deckExportIncludeAttachments,
      includeRelationships: deckExportIncludeRelationships,
      allFactions: factions,
      allRelationshipSlots,
    };

    downloadCharacterDeckFile(selectedDeckHeroes, deckOptions);
    setIsDeckExportModalOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    ultraAudio.playUiClick();
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportJsonText(content);
        setImportError(null);
      }
    };
    reader.readAsText(file);
  };

  const isHeroUnassigned = (hero: Ultrawoman, factionList: Faction[]) => {
    if (!hero.factionId || hero.factionId.trim() === '' || hero.factionId === 'unassigned') return true;
    return !factionList.some((f) => f.id === hero.factionId);
  };

  const handleConfirmImport = () => {
    if (!importJsonText.trim()) {
      setImportError('请输入或上传角色卡 JSON 数据');
      return;
    }
    const result = parseCharacterCard(importJsonText, {
      allFactions: factions,
      forceNewId: importIdStrategy === 'new_id',
    });
    if (!result.success) {
      setImportError(result.error || '角色卡解析失败');
      return;
    }

    // Handle Deck Package import
    if (result.isDeckPackage && result.deckHeroes && result.deckHeroes.length > 0) {
      const selectedDeckHeroes = result.deckHeroes.filter((h) => deckImportSelectedHeroIds.has(h.id));
      if (selectedDeckHeroes.length === 0) {
        setImportError('请至少勾选一位要导入的干员！');
        return;
      }

      ultraAudio.playApiReplyChime();
      if (onImportBatchHeroes) {
        onImportBatchHeroes(selectedDeckHeroes, result.customFactions, result.associatedRelationshipSlots);
      } else if (onImportCharacterCard) {
        selectedDeckHeroes.forEach((hero) => onImportCharacterCard(hero));
      }
      setImportSuccessMsg(`📦 成功批量导入名册卡包内 ${selectedDeckHeroes.length} 位干员及关联数据！`);
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportJsonText('');
        setImportSuccessMsg(null);
        setImportError(null);
      }, 1200);
      return;
    }

    if (!result.hero) {
      setImportError(result.error || '未能解析出有效的角色数据');
      return;
    }

    const finalHero = { ...result.hero };

    // Apply faction target
    if (importFactionTarget === 'unassigned') {
      finalHero.factionId = undefined;
      finalHero.factionRole = undefined;
      finalHero.subFactionId = undefined;
      finalHero.subFactionName = undefined;
    } else if (importFactionTarget !== 'preserve') {
      finalHero.factionId = importFactionTarget;
      finalHero.factionRole = finalHero.factionRole || '执行官';
    }

    ultraAudio.playApiReplyChime();
    if (onImportCharacterCard) {
      onImportCharacterCard(finalHero);
    }
    setImportSuccessMsg(`✅ 成功导入角色卡【${finalHero.name}】（格式: ${result.formatLabel || '标准'}）！`);
    setTimeout(() => {
      setIsImportModalOpen(false);
      setImportJsonText('');
      setImportSuccessMsg(null);
      setImportError(null);
    }, 1200);
  };

  const currentTeamIds = activeTeamIds.length > 0 ? activeTeamIds : [selectedHero.id];

  const filteredHeroines = heroines.filter((hero) => {
    // 1. Category Filter
    const matchesCategory =
      categoryFilter === 'all'
        ? true
        : categoryFilter === 'custom'
        ? hero.id.startsWith('custom_')
        : !hero.id.startsWith('custom_');

    if (!matchesCategory) return false;

    // 2. Faction Filter
    if (factionFilter !== 'all') {
      if (factionFilter === 'unassigned') {
        if (!isHeroUnassigned(hero, factions)) return false;
      } else {
        if (!isHeroInFaction(hero, factionFilter, factions)) return false;
      }
    }

    // 2.5 Sub-Faction Filter
    if (subFactionFilter !== 'all') {
      const memberships = getHeroFactionMemberships(hero, factions);
      if (subFactionFilter === 'none') {
        if (factionFilter !== 'all' && factionFilter !== 'unassigned') {
          const currentMem = memberships.find((m) => m.factionId === factionFilter);
          if (currentMem?.subFactionId) return false;
        }
      } else {
        const matchesSub = memberships.some((m) => m.subFactionId === subFactionFilter);
        if (!matchesSub) return false;
      }
    }

    // 3. Search Query
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const appStr = hero.appearance
      ? `${hero.appearance.hairStyle || ''} ${hero.appearance.eyeColor || ''} ${hero.appearance.skinTone || ''} ${hero.appearance.outfit || ''} ${hero.appearance.bodyFeatures || ''}`.toLowerCase()
      : '';
    const raceStr = `${hero.race || ''} ${(hero.raceTraits || []).join(' ')}`.toLowerCase();
    const memberships = getHeroFactionMemberships(hero, factions);
    const factionStr = memberships
      .map((m) => {
        const f = factions.find((fac) => fac.id === m.factionId);
        const sub = m.subFactionId ? getSubFactionById(factions, m.subFactionId) : undefined;
        return `${f?.name || ''} ${f?.shortName || ''} ${sub?.name || ''} ${m.subFactionName || ''} ${m.role || ''} ${m.title || ''} ${m.customNotes || ''}`;
      })
      .join(' ')
      .toLowerCase();

    return (
      hero.name.toLowerCase().includes(q) ||
      (hero.title && hero.title.toLowerCase().includes(q)) ||
      (hero.homePlanet && hero.homePlanet.toLowerCase().includes(q)) ||
      (hero.description && hero.description.toLowerCase().includes(q)) ||
      raceStr.includes(q) ||
      factionStr.includes(q) ||
      appStr.includes(q)
    );
  });

  const customCount = heroines.filter((h) => h.id.startsWith('custom_')).length;
  const presetCount = heroines.length - customCount;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-zinc-950 border border-blue-500/40 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-[0_0_50px_rgba(59,130,246,0.25)] overflow-hidden font-mono text-zinc-100">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-gradient-to-r from-blue-950/60 via-zinc-950 to-purple-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/50 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Users className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-blue-300 flex items-center gap-2">
                <span>角色图鉴 · 阵营与在场人员管理</span>
                <span className="text-xs font-normal text-zinc-400 bg-blue-950/80 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  当前在场: {currentTeamIds.length} / 共 {heroines.length} 位
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                支持按阵营分类与设定在场人员，可灵活选择谁在现场共同参与互动与对白！
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleBackupAllHeroesAndMedia}
              disabled={isBackingUpMedia}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-500/50 text-blue-300 font-bold text-xs transition-all shadow-[0_0_12px_rgba(59,130,246,0.3)] cursor-pointer disabled:opacity-50"
              title="重新全量备份全体角色的视频/图片立绘、设定文档与所有数据至本地"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>{isBackingUpMedia ? '备份打包中...' : '备份角色与媒体'}</span>
            </button>

            <button
              onClick={() => {
                ultraAudio.playUiClick();
                setIsDeckExportModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-purple-300 font-bold text-xs transition-all shadow-[0_0_12px_rgba(168,85,247,0.3)] cursor-pointer"
              title="打包导出多个或全部干员名册全息卡包 (Deck Package)"
            >
              <Package className="w-3.5 h-3.5" />
              <span>导出名册卡包</span>
            </button>

            <button
              onClick={() => {
                ultraAudio.playUiClick();
                setIsImportModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-bold text-xs transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)] cursor-pointer"
              title="从 JSON 文件或剪贴板导入独立角色卡或名册卡包"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>导入角色卡/卡包</span>
            </button>

            {onSelectAllTeam && (
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  onSelectAllTeam();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/40 text-purple-300 hover:text-white font-bold text-xs transition-all cursor-pointer hidden sm:flex items-center space-x-1"
                title="设为全部角色都在场"
              >
                <Users className="w-3.5 h-3.5" />
                <span>全员在场</span>
              </button>
            )}

            {onResetTeamSingle && (
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  onResetTeamSingle();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/70 border border-zinc-800 hover:border-rose-600/50 text-zinc-300 hover:text-rose-200 font-bold text-xs transition-all cursor-pointer flex items-center space-x-1 shadow-sm"
                title="一键除了主角色外的退场（仅保留当前主角色在场）"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>一键其余退场</span>
              </button>
            )}

            <button
              onClick={() => {
                ultraAudio.playUiClick();
                onAddHero();
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-[0_0_12px_rgba(59,130,246,0.4)] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新建角色</span>
            </button>

            <button
              onClick={() => {
                ultraAudio.playUiClick();
                onClose();
              }}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Faction Filter Bar */}
        {mediaBackupToast && (
          <div className="px-4 py-2 bg-blue-950/90 border-b border-blue-500/40 text-xs font-bold text-blue-200 flex items-center justify-between animate-fadeIn">
            <span>{mediaBackupToast}</span>
            <button
              onClick={() => setMediaBackupToast(null)}
              className="text-blue-300 hover:text-white text-xs px-2 py-0.5 rounded bg-blue-900/60"
            >
              ✕
            </button>
          </div>
        )}
        <div className="px-4 py-2.5 bg-zinc-950 border-b border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>阵营分类:</span>
          </span>

          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setFactionFilter('all');
              setSubFactionFilter('all');
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              factionFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm border border-blue-400'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            全部阵营 ({heroines.length})
          </button>

          {factions.map((f) => {
            const count = heroines.filter((h) => isHeroInFaction(h, f.id, factions)).length;
            const isSelected = factionFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => {
                  ultraAudio.playUiClick();
                  setFactionFilter(f.id);
                  setSubFactionFilter('all');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-zinc-800 text-white border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/50'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-800/80'
                }`}
              >
                <span>{f.shortName || f.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-950 border border-zinc-700 text-zinc-400">
                  {count}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => {
              ultraAudio.playUiClick();
              setFactionFilter('unassigned');
              setSubFactionFilter('all');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer border ${
              factionFilter === 'unassigned'
                ? 'bg-zinc-800 text-white border-blue-500 shadow-sm'
                : 'bg-zinc-900/60 text-zinc-500 hover:text-zinc-300 border-zinc-800'
            }`}
          >
            未指定阵营 ({heroines.filter((h) => isHeroUnassigned(h, factions)).length})
          </button>
        </div>

        {/* Sub-Faction Filter Bar (when a specific faction is selected or available) */}
        {(() => {
          const activeFaction = factions.find((f) => f.id === factionFilter);
          const availableSubFactions = activeFaction
            ? activeFaction.subFactions || []
            : factionFilter === 'all'
            ? factions.flatMap((f) => f.subFactions || [])
            : [];

          if (availableSubFactions.length === 0) return null;

          return (
            <div className="px-4 py-2 bg-zinc-950/90 border-b border-zinc-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-thin text-xs">
              <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-sky-400" />
                <span>从属组织分类:</span>
              </span>

              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  setSubFactionFilter('all');
                }}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all shrink-0 cursor-pointer border ${
                  subFactionFilter === 'all'
                    ? 'bg-sky-600 text-white border-sky-400 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                }`}
              >
                全部编制
              </button>

              {availableSubFactions.map((sf) => {
                const isSelected = subFactionFilter === sf.id;
                const matchCount = heroines.filter((h) => {
                  const mems = getHeroFactionMemberships(h, factions);
                  return mems.some((m) => m.subFactionId === sf.id);
                }).length;

                return (
                  <button
                    key={sf.id}
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setSubFactionFilter(sf.id);
                    }}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 border ${
                      isSelected
                        ? 'bg-sky-950 text-sky-200 border-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.3)] ring-1 ring-sky-500/50'
                        : 'bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                    }`}
                  >
                    <span>{sf.name}</span>
                    {sf.code && <span className="text-[9px] text-zinc-500 font-mono">({sf.code})</span>}
                    <span className="text-[9px] px-1 rounded-full bg-zinc-950 border border-zinc-700 text-zinc-400">
                      {matchCount}
                    </span>
                  </button>
                );
              })}

              {factionFilter !== 'all' && (
                <button
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setSubFactionFilter('none');
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all shrink-0 cursor-pointer border ${
                    subFactionFilter === 'none'
                      ? 'bg-zinc-800 text-white border-sky-500 shadow-sm'
                      : 'bg-zinc-900/60 text-zinc-500 hover:text-zinc-300 border-zinc-800'
                  }`}
                >
                  未定从属分支
                </button>
              )}
            </div>
          );
        })()}

        {/* Toolbar: Category Preset/Custom Tabs & Search Bar */}
        <div className="p-3 sm:p-4 bg-zinc-900/60 border-b border-zinc-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Category Filter Tabs */}
          <div className="flex items-center space-x-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              全部类型 ({heroines.length})
            </button>
            <button
              onClick={() => setCategoryFilter('preset')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'preset'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              预设角色 ({presetCount})
            </button>
            <button
              onClick={() => setCategoryFilter('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'custom'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              自定义/原创 ({customCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="搜索角色名、外貌、种族、阵营、职务、背景..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Character Cards Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 scrollbar-thin space-y-4">
          {filteredHeroines.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 space-y-3">
              <User className="w-12 h-12 mx-auto text-zinc-700" />
              <p className="text-sm">未找到匹配的角色记录</p>
              <button
                onClick={onAddHero}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600/30 border border-blue-500/50 text-blue-300 hover:bg-blue-600/50 text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>立即创建新角色</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHeroines.map((hero) => {
                const isPrimarySelected = hero.id === selectedHero.id;
                const isInTeam = currentTeamIds.includes(hero.id);
                const isCustom = hero.id.startsWith('custom_');
                const heroMemberships = getHeroFactionMemberships(hero, factions);
                const primaryMembership = heroMemberships[0];
                const primaryFaction = primaryMembership ? factions.find((f) => f.id === primaryMembership.factionId) : undefined;
                const app = hero.appearance;

                return (
                  <div
                    key={hero.id}
                    className={`relative rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden group ${
                      isPrimarySelected
                        ? 'bg-blue-950/40 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/50'
                        : isInTeam
                        ? 'bg-purple-950/20 border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                        : 'bg-zinc-900/60 border-zinc-800/90 hover:border-zinc-700 hover:bg-zinc-900/90'
                    }`}
                  >
                    {/* Top Color Accent Line */}
                    <div
                      className="h-1.5 w-full"
                      style={{ backgroundColor: hero.colorTheme?.primary || '#3b82f6' }}
                    />

                    {/* Card Main Body */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="flex items-start space-x-3">
                        {/* Portrait Thumbnail */}
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-zinc-700/80 bg-zinc-950 shrink-0 flex items-center justify-center">
                          {hero.customPortrait ? (
                            <PortraitMediaDisplay
                              src={hero.customPortrait}
                              alt={hero.name}
                              fitMode="cover"
                              isMuted={true}
                              showMediaBadge={false}
                            />
                          ) : (
                            <div
                              className="w-full h-full flex flex-col items-center justify-center text-white font-bold text-lg"
                              style={{
                                background: `radial-gradient(circle, ${hero.colorTheme?.primary}88 0%, #09090b 100%)`,
                              }}
                            >
                              <span>{hero.name.slice(0, 1)}</span>
                            </div>
                          )}
                          {isPrimarySelected && (
                            <div className="absolute inset-0 bg-blue-500/20 border-2 border-blue-400 rounded-xl" />
                          )}
                        </div>

                        {/* Title, Name & Faction */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 truncate">
                                {hero.homePlanet ? hero.homePlanet.split(' ')[0] : '来源未定'}
                              </span>
                              {isCustom ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-500/50 text-purple-300 flex items-center gap-0.5">
                                  <span>✨ 自定义</span>
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-500/40 text-blue-300 flex items-center gap-0.5">
                                  <span>🛡️ 预设</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {isPrimarySelected && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center gap-1 shrink-0">
                                  <Sparkles className="w-3 h-3 text-blue-400" />
                                  <span>主焦点</span>
                                </span>
                              )}
                              {isInTeam && !isPrimarySelected && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center gap-1 shrink-0">
                                  <Users className="w-3 h-3 text-purple-400" />
                                  <span>小队在场</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <h3 className="text-sm font-bold text-zinc-100 truncate mt-1 group-hover:text-blue-300 transition-colors">
                            {hero.name}
                          </h3>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {hero.title || '战术角色'}
                          </p>
                        </div>
                      </div>

                      {/* Faction & Race Badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {primaryFaction ? (
                          <>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 truncate text-amber-300 border-amber-500/40 bg-amber-950/40"
                              title={`主属阵营(优先级1): ${primaryFaction.name} (${primaryMembership?.role || '战术成员'})`}
                            >
                              <Crown className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
                              <span className="truncate">{primaryFaction.shortName || primaryFaction.name}</span>
                              {primaryMembership?.role && (
                                <span className="text-[9px] opacity-75 truncate">· {primaryMembership.role}</span>
                              )}
                            </span>

                            {primaryMembership?.subFactionId && (() => {
                              const sub = getSubFactionById(factions, primaryMembership.subFactionId);
                              const subName = primaryMembership.subFactionName || sub?.name;
                              if (!subName) return null;
                              return (
                                <span
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 truncate text-sky-300 border-sky-500/40 bg-sky-950/40"
                                  title={`从属组织/下属编制: ${subName}${sub?.code ? ` (${sub.code})` : ''}${sub?.leader ? ` | 主官: ${sub.leader}` : ''}`}
                                >
                                  <Layers className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                                  <span className="truncate">{subName}</span>
                                </span>
                              );
                            })()}
                          </>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-500">
                            自由势力
                          </span>
                        )}

                        {heroMemberships.length > 1 && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 flex items-center gap-0.5"
                            title={`多重阵营归属:\n${heroMemberships.map((m, idx) => `第${idx + 1}位: ${factions.find((f) => f.id === m.factionId)?.name || m.factionId} (${m.role || '成员'}${m.title ? ` - ${m.title}` : ''}${m.subFactionName ? ` [${m.subFactionName}]` : ''})`).join('\n')}`}
                          >
                            <Star className="w-2.5 h-2.5 text-cyan-400" />
                            <span>+{heroMemberships.length - 1} 兼任</span>
                          </span>
                        )}

                        {hero.race && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 truncate"
                            title={`种族: ${hero.race}${hero.raceTraits ? ` | 特质: ${hero.raceTraits.join('、')}` : ''}`}
                          >
                            🧬 {hero.race}
                          </span>
                        )}
                      </div>

                      {/* Appearance Details Snippet */}
                      {app && (app.hairStyle || app.eyeColor || app.outfit) && (
                        <div className="bg-zinc-950/80 p-2 rounded-lg border border-zinc-800/60 text-[10px] text-zinc-300 space-y-1">
                          <div className="flex items-center gap-2 text-zinc-400 font-bold">
                            <Eye className="w-3 h-3 text-pink-400" />
                            <span>外貌特征:</span>
                          </div>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-zinc-400">
                            {app.hairStyle && <span>发型: <strong className="text-zinc-200">{app.hairStyle}</strong></span>}
                            {app.eyeColor && <span>瞳色: <strong className="text-zinc-200">{app.eyeColor}</strong></span>}
                            {app.outfit && <span className="truncate">装束: <strong className="text-zinc-200">{app.outfit}</strong></span>}
                          </div>
                        </div>
                      )}

                      {/* Description / Background snippet & Expansion Toggle */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-blue-400" />
                            <span>角色背景与设定:</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleExpandHero(hero.id)}
                            className="text-[10px] text-blue-400 hover:text-blue-200 flex items-center gap-0.5 cursor-pointer"
                          >
                            {expandedHeroIds.has(hero.id) ? (
                              <>
                                <span>收起档案</span>
                                <ChevronUp className="w-3 h-3" />
                              </>
                            ) : (
                              <>
                                <span>展开全文字档案</span>
                                <ChevronDown className="w-3 h-3" />
                              </>
                            )}
                          </button>
                        </div>

                        {expandedHeroIds.has(hero.id) ? (
                          <div className="space-y-2 bg-zinc-950/90 p-3 rounded-lg border border-blue-500/30 text-[11px] text-zinc-300 leading-relaxed break-words animate-fade-in max-h-60 overflow-y-auto scrollbar-thin">
                            <div>
                              <strong className="text-blue-300 block mb-0.5">完整故事背景:</strong>
                              <p className="whitespace-pre-wrap">{hero.description || '暂无详细故事背景。'}</p>
                            </div>

                            {hero.weakness && (
                              <div className="pt-1 border-t border-zinc-800 text-[10px] text-amber-300">
                                <strong>⚠️ 核心弱点与敏感带:</strong> {hero.weakness}
                              </div>
                            )}

                            {hero.raceTraits && hero.raceTraits.length > 0 && (
                              <div className="pt-1 border-t border-zinc-800 text-[10px]">
                                <strong className="text-indigo-300 block mb-1">🧬 种族特质清单:</strong>
                                <div className="flex flex-wrap gap-1">
                                  {hero.raceTraits.map((t, idx) => (
                                    <span key={idx} className="px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/30 text-indigo-200">
                                      • {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {hero.customPrompt && (
                              <div className="pt-1 border-t border-zinc-800 text-[10px] text-purple-300 font-mono">
                                <strong>🤖 专属 AI 人设提示词:</strong>
                                <p className="mt-0.5 text-purple-200/90 whitespace-pre-wrap break-words">{hero.customPrompt}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p
                            onClick={() => toggleExpandHero(hero.id)}
                            className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/50 cursor-pointer hover:border-zinc-700 hover:text-zinc-300 transition-colors"
                            title="点击可展开查看全部完整背景设定"
                          >
                            {hero.description || '暂无详细故事背景。'}
                          </p>
                        )}
                      </div>

                      {/* Character Card Fast Export/Share/Clone Toolbar */}
                      <div className="bg-zinc-950/70 p-1.5 rounded-lg border border-zinc-800/70 flex items-center justify-between gap-1 text-[10px]">
                        <span className="text-zinc-400 font-bold flex items-center gap-1">
                          <Share2 className="w-3 h-3 text-cyan-400" />
                          <span>角色卡操作:</span>
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleCloneHero(hero)}
                            className="px-2 py-1 rounded bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                            title="复制并克隆此角色为新的独立自定义槽位"
                          >
                            <Copy className="w-3 h-3" />
                            <span>克隆副本</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadCard(hero)}
                            className="px-2 py-1 rounded bg-blue-950/80 hover:bg-blue-900 border border-blue-500/40 text-blue-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                            title="将此角色导出为独立的 .json 角色卡文件"
                          >
                            <Download className="w-3 h-3" />
                            <span>导出卡</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyCard(hero)}
                            className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                            title="复制角色卡 JSON 数据"
                          >
                            {copiedHeroId === hero.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Code className="w-3 h-3" />}
                            <span>{copiedHeroId === hero.id ? '已复制' : 'JSON'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewingCardHero(hero)}
                            className="px-2 py-1 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                            title="全息全屏查看此角色卡"
                          >
                            <Eye className="w-3 h-3" />
                            <span>全息卡</span>
                          </button>
                        </div>
                      </div>

                      {/* Custom Relationships Badges */}
                      {hero.heroRelationships && hero.heroRelationships.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {hero.heroRelationships.slice(0, 2).map((rel) => {
                            const targetHero = heroines.find((h) => h.id === rel.targetHeroId);
                            const targetName = targetHero ? targetHero.name : rel.targetHeroName || rel.targetHeroId;
                            return (
                              <span
                                key={rel.targetHeroId}
                                className="text-[9px] font-bold bg-pink-950/70 border border-pink-500/40 text-pink-300 px-1.5 py-0.5 rounded flex items-center gap-1 truncate"
                                title={`对【${targetName}】: ${rel.relationType}`}
                              >
                                <span>👥 对【{targetName}】:</span>
                                <span className="text-pink-200">{rel.relationType}</span>
                              </span>
                            );
                          })}
                          {hero.heroRelationships.length > 2 && (
                            <span className="text-[9px] text-pink-400 font-mono self-center">
                              +{hero.heroRelationships.length - 2}关系
                            </span>
                          )}
                        </div>
                      )}

                      {/* Attribute Visual Status Bars */}
                      <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-zinc-300 pt-1">
                        <div className="bg-rose-950/30 border border-rose-900/50 rounded p-1 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-[9px] text-rose-300 font-bold">
                            <span>HP</span>
                            <span>{hero.defaultStats?.maxHp || 100}</span>
                          </div>
                          <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden mt-0.5">
                            <div className="bg-gradient-to-r from-rose-500 to-rose-400 h-full w-full" />
                          </div>
                        </div>

                        <div className="bg-cyan-950/30 border border-cyan-900/50 rounded p-1 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-[9px] text-cyan-300 font-bold">
                            <span>能量</span>
                            <span>{hero.defaultStats?.maxEnergy || 100}</span>
                          </div>
                          <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden mt-0.5">
                            <div className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-full w-full" />
                          </div>
                        </div>

                        <div className="bg-purple-950/30 border border-purple-900/50 rounded p-1 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-[9px] text-purple-300 font-bold">
                            <span>意志</span>
                            <span>{hero.defaultStats?.maxMorale || 100}</span>
                          </div>
                          <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden mt-0.5">
                            <div className="bg-gradient-to-r from-purple-500 to-purple-400 h-full w-full" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-2.5 bg-zinc-950/90 border-t border-zinc-800/80 flex items-center justify-between gap-1.5">
                      {/* Set as Single Hero Exclusive */}
                      <button
                        onClick={() => {
                          ultraAudio.playUiClick();
                          if (onSetSingleHeroMode) {
                            onSetSingleHeroMode(hero);
                          } else {
                            onSelectHero(hero);
                          }
                          onClose();
                        }}
                        className="py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all flex items-center space-x-1 cursor-pointer shadow-sm shrink-0"
                        title="仅留此人在场互动"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span className="text-[11px] hidden sm:inline">仅此在场</span>
                        <span className="text-[11px] sm:hidden">独占</span>
                      </button>

                      {/* Set as Primary Selected in Team */}
                      <button
                        onClick={() => {
                          ultraAudio.playUiClick();
                          onSelectHero(hero);
                          onClose();
                        }}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                          isPrimarySelected
                            ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 hover:bg-blue-600/50 shadow-[0_0_8px_rgba(59,130,246,0.25)]'
                            : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300'
                        }`}
                        title="设为主视角人物（保留其他在场人员）"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[11px]">{isPrimarySelected ? '主视角' : '设为主视角'}</span>
                      </button>

                      {/* Toggle In Team Button */}
                      {onToggleTeamMember && (
                        <button
                          onClick={() => {
                            ultraAudio.playUiClick();
                            onToggleTeamMember(hero.id);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer border shrink-0 ${
                            isInTeam
                              ? 'bg-purple-950/80 border-purple-500 text-purple-300 hover:bg-purple-900/80 shadow-[0_0_8px_rgba(168,85,247,0.25)]'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                          }`}
                          title={isInTeam ? '点击从现场移出' : '点击设为此人在场（多人共同在场）'}
                        >
                          {isInTeam ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-purple-400" />
                              <span className="text-[11px]">已在场</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3.5 h-3.5 text-zinc-400" />
                              <span className="text-[11px]">在场</span>
                            </>
                          )}
                        </button>
                      )}

                      {onOpenCustomizerForHero && (
                        <button
                          onClick={() => {
                            ultraAudio.playUiClick();
                            onSelectHero(hero);
                            onOpenCustomizerForHero(hero);
                            onClose();
                          }}
                          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-purple-300 hover:bg-purple-950/60 hover:border-purple-500/50 transition-all cursor-pointer shrink-0"
                          title="修改/定制该角色参数与设定工坊"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      )}

                      {isCustom && onDeleteHero && heroines.length > 1 && (
                        <button
                          onClick={() => {
                            ultraAudio.playUiClick();
                            if (window.confirm(`确定要删除自定义角色【${hero.name}】吗？`)) {
                              onDeleteHero(hero.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-rose-400 hover:bg-rose-950/60 hover:border-rose-500/50 transition-all cursor-pointer shrink-0"
                          title="删除此自定义角色槽位"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Note */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <span>💡 勾选多位角色可在场同时出阵，AI 对白将触发阵营立场互动、连锁多角反应与专属声线！</span>
          <button
            onClick={() => {
              ultraAudio.playUiClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold border border-zinc-800 cursor-pointer"
          >
            关闭并生效
          </button>
        </div>
      </div>

      {/* SUB-MODAL 1: Upgraded Character Card Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-zinc-950 border border-emerald-500/50 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col p-5 space-y-4 shadow-[0_0_50px_rgba(16,185,129,0.25)] font-mono text-zinc-100 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2 text-emerald-400">
                <Upload className="w-5 h-5" />
                <h3 className="text-base font-bold text-emerald-300">多维全息角色卡 · 智能导入中心</h3>
              </div>
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsImportModalOpen(false);
                  setImportError(null);
                  setImportSuccessMsg(null);
                }}
                className="p-1 rounded text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scrollbar-thin text-xs text-zinc-300">
              <p className="text-zinc-400 leading-relaxed text-xs">
                支持导入 <strong className="text-emerald-300">Ultra Card v3.0 / v2.0 / v1.0 全量角色卡</strong>、<strong className="text-purple-300">SillyTavern / TavernAI (v2/v1) 酒馆卡</strong>，以及原生角色对象。自动兼容包含挂载附件、多重阵营、生理部位、语音库与条件触发器。
              </p>

              {/* File Upload Zone */}
              <div className="border-2 border-dashed border-emerald-900/60 hover:border-emerald-500/60 rounded-xl p-4 bg-emerald-950/20 text-center transition-colors">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  id="character-card-file-input"
                  className="hidden"
                />
                <label
                  htmlFor="character-card-file-input"
                  className="flex flex-col items-center justify-center space-y-1.5 cursor-pointer"
                >
                  <Download className="w-6 h-6 text-emerald-400 animate-bounce" />
                  <span className="text-xs font-bold text-emerald-300">点击选择本地角色卡 .json 文件</span>
                  <span className="text-[10px] text-zinc-500">（支持拖放或点击上传，自动即时解析）</span>
                </label>
              </div>

              {/* Textarea Paste Zone */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-zinc-400 text-xs font-bold">
                  <span>或直接在此粘贴角色卡 JSON:</span>
                  <span className="text-[10px] text-zinc-500">字符数: {importJsonText.length}</span>
                </div>
                <textarea
                  value={importJsonText}
                  onChange={(e) => {
                    setImportJsonText(e.target.value);
                    setImportError(null);
                    setImportSuccessMsg(null);
                  }}
                  placeholder='在此粘贴角色卡 JSON 数据...'
                  rows={4}
                  className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-emerald-500 rounded-xl p-3 text-xs text-zinc-200 font-mono outline-none resize-y scrollbar-thin"
                />
              </div>

              {/* Live Parse Preview Card */}
              {parsedImportResult && parsedImportResult.success && (
                <div className="space-y-3 animate-fade-in">
                  {/* Case A: Deck Package (Multiple Heroes + Factions + Relationships) */}
                  {parsedImportResult.isDeckPackage && parsedImportResult.deckHeroes ? (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/60 via-zinc-900 to-indigo-950/60 border border-purple-500/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Package className="w-5 h-5 text-purple-400 animate-pulse" />
                          <span className="text-xs font-bold text-purple-200">
                            {parsedImportResult.formatLabel || '📦 特勤名册卡包 (Character Deck)'}
                          </span>
                        </div>
                        <span className="text-[10px] text-purple-300 px-2 py-0.5 rounded-full bg-purple-950 border border-purple-700/50">
                          包含 {parsedImportResult.deckHeroes.length} 位干员
                        </span>
                      </div>

                      <div className="bg-black/40 p-3 rounded-lg border border-zinc-800 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-purple-200">
                            {parsedImportResult.deckMetadata?.name || '特勤战术干员全息名册'}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            制作者: {parsedImportResult.deckMetadata?.author || 'Commander'}
                          </span>
                        </div>
                        {parsedImportResult.deckMetadata?.description && (
                          <p className="text-[11px] text-zinc-400">
                            {parsedImportResult.deckMetadata.description}
                          </p>
                        )}
                      </div>

                      {/* Summary Badges for Deck */}
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800 text-center">
                          <span className="text-zinc-500 block">干员总数</span>
                          <strong className="text-purple-300 font-bold">{parsedImportResult.deckHeroes.length} 位</strong>
                        </div>
                        <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800 text-center">
                          <span className="text-zinc-500 block">自定义组织阵营</span>
                          <strong className="text-amber-300 font-bold">{parsedImportResult.customFactions?.length || 0} 个</strong>
                        </div>
                        <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800 text-center">
                          <span className="text-zinc-500 block">关联羁绊槽位</span>
                          <strong className="text-pink-300 font-bold">{parsedImportResult.associatedRelationshipSlots?.length || 0} 条</strong>
                        </div>
                      </div>

                      {/* Hero Selection Checkboxes List */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-zinc-300 flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                            <span>选择要导入的干员 (已选 {deckImportSelectedHeroIds.size} / {parsedImportResult.deckHeroes.length}):</span>
                          </span>
                          <div className="flex items-center space-x-1.5 text-[11px]">
                            <button
                              type="button"
                              onClick={() => {
                                ultraAudio.playUiClick();
                                setDeckImportSelectedHeroIds(new Set(parsedImportResult.deckHeroes!.map((h) => h.id)));
                              }}
                              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-purple-300"
                            >
                              全选
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                ultraAudio.playUiClick();
                                setDeckImportSelectedHeroIds(new Set());
                              }}
                              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                            >
                              全不选
                            </button>
                          </div>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                          {parsedImportResult.deckHeroes.map((dh) => {
                            const isChecked = deckImportSelectedHeroIds.has(dh.id);
                            return (
                              <div
                                key={dh.id}
                                onClick={() => {
                                  ultraAudio.playUiClick();
                                  setDeckImportSelectedHeroIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(dh.id)) next.delete(dh.id);
                                    else next.add(dh.id);
                                    return next;
                                  });
                                }}
                                className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all text-xs ${
                                  isChecked
                                    ? 'bg-purple-950/40 border-purple-500/60 text-purple-200'
                                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 opacity-60'
                                }`}
                              >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="rounded accent-purple-600"
                                  />
                                  <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                                    {dh.customPortrait ? (
                                      <img src={dh.customPortrait} alt={dh.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="font-bold text-xs">{dh.name.slice(0, 1)}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-zinc-200 truncate">{dh.name}</div>
                                    <div className="text-[10px] text-zinc-500 truncate">{dh.title || dh.race || '战术特勤干员'}</div>
                                  </div>
                                </div>
                                <div className="text-[10px] text-zinc-400 shrink-0">
                                  {dh.characterAttachments?.length ? `📎 ${dh.characterAttachments.length} 附件` : ''}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : parsedImportResult.hero && parsedImportResult.summary ? (
                    /* Case B: Single Character Card */
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/50 via-zinc-900 to-teal-950/50 border border-emerald-500/40 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                          <span className="text-xs font-bold text-emerald-300">
                            {parsedImportResult.formatLabel || '识别成功'}
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-400/80 px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700/50">
                          解析校验通过
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 bg-black/40 p-2.5 rounded-lg border border-zinc-800">
                        <div className="w-12 h-16 rounded-lg overflow-hidden bg-zinc-900 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          {parsedImportResult.hero.customPortrait ? (
                            <PortraitMediaDisplay
                              src={parsedImportResult.hero.customPortrait}
                              alt={parsedImportResult.hero.name}
                              fitMode="cover"
                              isMuted={true}
                              showMediaBadge={false}
                            />
                          ) : (
                            <span className="text-emerald-400 font-bold text-lg">
                              {parsedImportResult.hero.name.slice(0, 1)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-white truncate">
                              {parsedImportResult.hero.name}
                            </span>
                            <span className="text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 truncate">
                              {parsedImportResult.hero.title || '战术特勤干员'}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 flex flex-wrap gap-2">
                            <span>种族: <strong className="text-emerald-300">{parsedImportResult.hero.race || '宇宙特勤族'}</strong></span>
                            <span>身高/体重: {parsedImportResult.hero.height || '未知'} / {parsedImportResult.hero.weight || '未知'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Summary Metric Badges */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-[10px]">
                        <div className="p-1.5 rounded bg-zinc-900/90 border border-zinc-800 text-center">
                          <span className="text-zinc-500 block">生理部位</span>
                          <strong className="text-emerald-300">{parsedImportResult.summary.bodyPartsCount} 个部位</strong>
                        </div>
                        <div className="p-1.5 rounded bg-zinc-900/90 border border-zinc-800 text-center">
                          <span className="text-zinc-500 block">专属语音</span>
                          <strong className="text-purple-300">{parsedImportResult.summary.voiceLinesCount} 条</strong>
                        </div>
                        <div className="p-1.5 rounded bg-zinc-900/90 border border-zinc-800 text-center">
                          <span className="text-zinc-500 block">条件触发器</span>
                          <strong className="text-amber-300">{parsedImportResult.summary.triggersCount} 条</strong>
                        </div>
                        <div className="p-1.5 rounded bg-zinc-900/90 border border-zinc-800 text-center">
                          <span className="text-zinc-500 block">环境弱点</span>
                          <strong className="text-rose-300">{parsedImportResult.summary.envWeaknessesCount} 项</strong>
                        </div>
                        <div className="p-1.5 rounded bg-zinc-900/90 border border-zinc-800 text-center">
                          <span className="text-zinc-500 block">人际羁绊</span>
                          <strong className="text-pink-300">{parsedImportResult.summary.relationshipsCount} 个</strong>
                        </div>
                        <div className="p-1.5 rounded bg-zinc-900/90 border border-zinc-800 text-center">
                          <span className="text-zinc-500 block">挂载附件</span>
                          <strong className="text-blue-300">{parsedImportResult.summary.attachmentsCount} 份</strong>
                        </div>
                      </div>

                      {/* Import Configuration Controls */}
                      <div className="pt-2 border-t border-emerald-950 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[11px] text-zinc-400 block mb-1 font-bold">
                            🚩 阵营归属指派:
                          </label>
                          <select
                            value={importFactionTarget}
                            onChange={(e) => setImportFactionTarget(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                          >
                            <option value="preserve">保持原卡阵营设置（若有）</option>
                            <option value="unassigned">归入【未指定阵营】（独立特勤）</option>
                            {factions.map((f) => (
                              <option key={f.id} value={f.id}>
                                指派至: {f.name} ({f.shortName || f.id})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] text-zinc-400 block mb-1 font-bold">
                            🆔 ID与冲突策略:
                          </label>
                          <select
                            value={importIdStrategy}
                            onChange={(e) => setImportIdStrategy(e.target.value as any)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                          >
                            <option value="new_id">作为全新角色导入 (生成新唯一ID)</option>
                            <option value="overwrite_if_exists">若存在同名/同ID角色则直接覆盖</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Error or Success feedback */}
              {importError && (
                <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccessMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-xs text-emerald-300 flex items-center gap-2 font-bold">
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{importSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsImportModalOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!importJsonText.trim()}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>
                  {parsedImportResult?.isDeckPackage
                    ? `批量导入所选干员 (${deckImportSelectedHeroIds.size} 位)`
                    : '确认导入角色卡'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: Full Multi-Dimensional Holographic Character Card Detail & Export Modal */}
      {previewingCardHero && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-lg animate-fade-in">
          <div className="bg-zinc-950 border border-purple-500/50 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-[0_0_60px_rgba(168,85,247,0.3)] overflow-hidden font-mono text-zinc-100">
            {/* Header */}
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-purple-950/80 via-zinc-950 to-blue-950/80 border-b border-purple-900/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/50 text-purple-300">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-purple-200 flex items-center gap-2">
                    <span>【{previewingCardHero.name}】全息全维角色卡</span>
                    <span className="text-xs text-zinc-400 font-normal px-2 py-0.5 rounded-full bg-purple-950 border border-purple-700/50">
                      {previewingCardHero.race || '宇宙特勤族'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    完整生理结构、数值属性、语音库、触发器、环境弱点、人际羁绊与挂载附件全量检视与导出
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleDownloadCard(previewingCardHero)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(59,130,246,0.4)] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出 .json 角色卡</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyCard(previewingCardHero)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedHeroId === previewingCardHero.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedHeroId === previewingCardHero.id ? '已复制' : '复制 JSON'}</span>
                </button>
                <button
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setPreviewingCardHero(null);
                  }}
                  className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex items-center space-x-1 px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 overflow-x-auto text-xs scrollbar-none">
              {[
                { id: 'overview', label: '📌 概览与档案', color: 'purple' },
                { id: 'appearance', label: '👗 详细外貌', color: 'indigo' },
                { id: 'factions', label: '🛡️ 阵营与职位', color: 'amber' },
                { id: 'personality', label: '💖 性格与AI心智', color: 'pink' },
                { id: 'anatomy_stats', label: '📊 战术生理与部位', color: 'cyan' },
                { id: 'voice_lines', label: '🎙️ 语音台词全库', color: 'violet' },
                { id: 'triggers_env', label: '⚡ 触发器与环境弱点', color: 'yellow' },
                { id: 'relationships_attachments', label: '🤝 人际羁绊与附件', color: 'emerald' },
                { id: 'lorebook_json', label: '📖 世界书与全量JSON', color: 'blue' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setCardInspectTab(tab.id as CardInspectTab);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                    cardInspectTab === tab.id
                      ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin text-xs text-zinc-300">
              {/* TAB 1: Overview */}
              {cardInspectTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Left: Portrait & Base Bio */}
                  <div className="space-y-3 md:col-span-1">
                    <div className="aspect-[3/4] w-full rounded-xl overflow-hidden border border-purple-500/40 bg-zinc-900 relative shadow-inner flex items-center justify-center">
                      {previewingCardHero.customPortrait ? (
                        <PortraitMediaDisplay
                          src={previewingCardHero.customPortrait}
                          alt={previewingCardHero.name}
                          fitMode="cover"
                          isMuted={true}
                          showMediaBadge={true}
                        />
                      ) : (
                        <div
                          className="w-full h-full flex flex-col items-center justify-center text-white font-bold text-3xl"
                          style={{
                            background: `radial-gradient(circle, ${previewingCardHero.colorTheme?.primary || '#8b5cf6'}88 0%, #09090b 100%)`,
                          }}
                        >
                          <span>{previewingCardHero.name.slice(0, 1)}</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 space-y-1.5">
                      <div className="flex justify-between"><span className="text-zinc-500">称号/头衔:</span><span className="text-zinc-200 font-bold">{previewingCardHero.title || '战术干员'}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">身高/体重:</span><span className="text-zinc-200 font-bold">{previewingCardHero.height || '未知'} / {previewingCardHero.weight || '未知'}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">原籍星系:</span><span className="text-zinc-200 font-bold">{previewingCardHero.homePlanet || '未知'}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">种族血统:</span><span className="text-indigo-300 font-bold">{previewingCardHero.race || '宇宙特勤族'}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">致命弱点部位:</span><span className="text-rose-400 font-bold">{previewingCardHero.weakPart || 'timer'}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">敏感神经部位:</span><span className="text-pink-400 font-bold">{previewingCardHero.sensitivePart || 'torso'}</span></div>
                    </div>
                  </div>

                  {/* Right: Narrative Story & Traits */}
                  <div className="space-y-3 md:col-span-2">
                    <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 space-y-2">
                      <div className="text-sm font-bold text-purple-300 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-purple-400" />
                        <span>全文本故事背景与设定档案</span>
                      </div>
                      <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap break-words bg-black/40 p-3 rounded-lg border border-zinc-800/80">
                        {previewingCardHero.description || '暂无详细故事背景。'}
                      </p>
                    </div>

                    <div className="bg-zinc-900/80 p-4 rounded-xl border border-amber-900/40 space-y-2">
                      <div className="text-sm font-bold text-amber-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                        <span>主要弱点与生理防线瓦解机制</span>
                      </div>
                      <p className="text-amber-200/90 leading-relaxed whitespace-pre-wrap break-words bg-black/40 p-3 rounded-lg border border-zinc-800/80">
                        {previewingCardHero.weakness || '暂无特定弱点描述。'}
                      </p>
                    </div>

                    {previewingCardHero.raceTraits && previewingCardHero.raceTraits.length > 0 && (
                      <div className="bg-zinc-900/80 p-3.5 rounded-xl border border-indigo-900/40 space-y-2">
                        <div className="text-xs font-bold text-indigo-300 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-indigo-400" />
                          <span>种族生理机制与特质 ({previewingCardHero.raceTraits.length} 项)</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {previewingCardHero.raceTraits.map((t, idx) => (
                            <span key={idx} className="px-2 py-1 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 text-xs">
                              🧬 {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Appearance */}
              {cardInspectTab === 'appearance' && (
                <div className="space-y-3">
                  <div className="bg-zinc-900/80 p-4 rounded-xl border border-indigo-900/40 space-y-3">
                    <div className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span>详细外貌、身形体态与战甲装束刻画</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-black/40 p-3.5 rounded-lg border border-zinc-800/80">
                      <div><span className="text-zinc-500">发型发色:</span> <span className="text-zinc-200 font-medium">{previewingCardHero.appearance?.hairStyle || '未特别指定'}</span></div>
                      <div><span className="text-zinc-500">瞳色神采:</span> <span className="text-zinc-200 font-medium">{previewingCardHero.appearance?.eyeColor || '未特别指定'}</span></div>
                      <div><span className="text-zinc-500">肤色特质:</span> <span className="text-zinc-200 font-medium">{previewingCardHero.appearance?.skinTone || '未特别指定'}</span></div>
                      <div><span className="text-zinc-500">身段体态:</span> <span className="text-zinc-200 font-medium">{previewingCardHero.appearance?.bodyFeatures || '未特别指定'}</span></div>
                      <div className="sm:col-span-2"><span className="text-zinc-500">战装/服饰:</span> <span className="text-zinc-200 font-medium">{previewingCardHero.appearance?.outfit || '未特别指定'}</span></div>
                      <div className="sm:col-span-2"><span className="text-zinc-500">饰品配件:</span> <span className="text-zinc-200 font-medium">{previewingCardHero.appearance?.accessories || '未特别指定'}</span></div>
                      {previewingCardHero.appearance?.customVisualPrompt && (
                        <div className="sm:col-span-2 pt-2 border-t border-zinc-800/60">
                          <span className="text-zinc-500 block text-[11px] mb-1">视觉细节刻画 Prompt:</span>
                          <span className="text-indigo-200 font-mono text-[11px] leading-relaxed block bg-zinc-950 p-2.5 rounded border border-zinc-800">
                            {previewingCardHero.appearance.customVisualPrompt}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Factions & Roles */}
              {cardInspectTab === 'factions' && (
                <div className="space-y-3">
                  <div className="bg-zinc-900/80 p-4 rounded-xl border border-amber-900/40 space-y-3">
                    <div className="text-sm font-bold text-amber-300 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span>主属阵营与下属分支机构</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-black/40 p-3.5 rounded-lg border border-zinc-800">
                      <div>
                        <span className="text-zinc-500">主属势力阵营:</span>{' '}
                        <strong className="text-amber-300">
                          {factions.find((f) => f.id === previewingCardHero.factionId)?.name || (previewingCardHero.factionId ? previewingCardHero.factionId : '未指定阵营')}
                        </strong>
                      </div>
                      <div>
                        <span className="text-zinc-500">首要职务头衔:</span>{' '}
                        <strong className="text-amber-200">{previewingCardHero.factionRole || '执行官'}</strong>
                      </div>
                      {previewingCardHero.subFactionName && (
                        <div className="sm:col-span-2">
                          <span className="text-zinc-500">从属分支/战术部门:</span>{' '}
                          <span className="text-zinc-200 font-bold">{previewingCardHero.subFactionName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Multi Faction Memberships table */}
                  {previewingCardHero.factionMemberships && previewingCardHero.factionMemberships.length > 0 && (
                    <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 space-y-2">
                      <div className="text-xs font-bold text-zinc-300">多重阵营归属与兼任序列:</div>
                      <div className="space-y-1.5">
                        {previewingCardHero.factionMemberships.map((m, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-black/40 border border-zinc-800 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-amber-300">
                                {factions.find((f) => f.id === m.factionId)?.name || m.factionId}
                              </span>
                              {m.subFactionName && <span className="text-zinc-400 text-[11px] ml-1">· {m.subFactionName}</span>}
                              <span className="text-zinc-400 ml-2">【{m.title || m.role}】</span>
                            </div>
                            {m.customNotes && <span className="text-zinc-500 text-[11px] italic">{m.customNotes}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Personality & AI Mind */}
              {cardInspectTab === 'personality' && (
                <div className="space-y-3">
                  <div className="bg-zinc-900/80 p-4 rounded-xl border border-pink-900/40 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
                      <div className="text-sm font-bold text-pink-300 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-pink-400" />
                        <span>性格设定、对白语气与 AI 心理行为准则</span>
                      </div>

                      {onOpenCustomizerForHero && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenCustomizerForHero(previewingCardHero);
                          }}
                          className="px-2.5 py-1 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-purple-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>在定制器中完整编辑</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-3 bg-black/40 p-3.5 rounded-lg border border-zinc-800 text-xs">
                      <div className="flex flex-wrap items-center gap-3">
                        <div>
                          <span className="text-zinc-500">性格名称:</span>{' '}
                          <strong className="text-pink-300 text-sm">
                            {previewingCardHero.personalityCustomName || previewingCardHero.personality || '坚毅不屈'}
                          </strong>
                        </div>
                        {previewingCardHero.personalityTone && (
                          <div>
                            <span className="text-zinc-500">口吻语调:</span>{' '}
                            <strong className="text-zinc-200">{previewingCardHero.personalityTone}</strong>
                          </div>
                        )}
                        <div>
                          <span className="text-zinc-500">语音音调:</span>{' '}
                          <strong className="text-zinc-200">{(previewingCardHero.voicePitch || 1.0).toFixed(2)}x</strong>
                        </div>
                      </div>

                      {previewingCardHero.personalityCustomTags && previewingCardHero.personalityCustomTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {previewingCardHero.personalityCustomTags.map((tag, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-pink-950/60 border border-pink-500/40 text-pink-200 text-[11px]">
                              🏷️ {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {(previewingCardHero.personalityCustomPrompt || previewingCardHero.customPrompt) && (
                        <div className="pt-2 border-t border-zinc-800/60">
                          <span className="text-zinc-500 block text-[11px] mb-1 font-bold">专属人设系统 Prompt:</span>
                          <p className="text-pink-200/90 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words bg-zinc-950 p-3 rounded border border-zinc-800">
                            {previewingCardHero.personalityCustomPrompt || previewingCardHero.customPrompt}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Universal Personality Presets & Custom Slots Switcher */}
                    <div className="p-3 bg-zinc-950/70 rounded-lg border border-purple-900/40 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span>一键切换通用性格预设 (Universal Preset / Custom Slot):</span>
                        </span>

                        <select
                          value={previewingCardHero.personality || 'tsundere'}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const customSlots = loadCustomPersonalitySlotsFromStorage();
                            const updated = applyPersonalityToHero(previewingCardHero, val, customSlots);
                            setPreviewingCardHero(updated);
                            if (onUpdateHero) onUpdateHero(updated);
                          }}
                          className="bg-zinc-900 border border-purple-500/50 rounded px-2 py-1 text-xs text-purple-200 focus:border-purple-400 outline-none cursor-pointer"
                        >
                          <optgroup label="👑 系统通用预设性格">
                            {loadPresetPersonalitiesFromStorage().map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.icon || '✨'} {p.name} - {p.tags.slice(0, 2).join('/')}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="💎 全角色通用自定义性格槽位">
                            {loadCustomPersonalitySlotsFromStorage().map((slot) => (
                              <option key={slot.id} value={slot.id}>
                                {slot.icon || '💎'} {slot.name} - {slot.tags.slice(0, 2).join('/')}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                        {getAllAvailablePersonalities().map((p) => {
                          const isCur = (previewingCardHero.personality === p.id) || (previewingCardHero.personalityCustomName === p.name);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                const customSlots = loadCustomPersonalitySlotsFromStorage();
                                const updated = applyPersonalityToHero(previewingCardHero, p.id, customSlots);
                                setPreviewingCardHero(updated);
                                if (onUpdateHero) onUpdateHero(updated);
                              }}
                              className={`p-1.5 rounded border text-left text-[11px] transition-all cursor-pointer truncate ${
                                isCur
                                  ? 'bg-purple-950 border-purple-400 text-purple-200 font-bold ring-1 ring-purple-400'
                                  : 'bg-zinc-900/60 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                              title={`${p.name}: ${p.description || p.tone}`}
                            >
                              <span className="mr-1">{p.icon || '✨'}</span>
                              <span>{p.name}</span>
                              {p.type === 'custom' && <span className="ml-1 text-[9px] text-amber-400 font-mono">(自定义)</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Anatomy & Stats */}
              {cardInspectTab === 'anatomy_stats' && (
                <div className="space-y-3">
                  {/* Stats Gauges */}
                  <div className="bg-zinc-900/80 p-4 rounded-xl border border-cyan-900/40 space-y-2.5">
                    <div className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      <span>战术六维初始数值与上限 (Default Stats & Capacities)</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {[
                        { label: '生命值 (HP)', cur: previewingCardHero.defaultStats?.hp ?? 100, max: previewingCardHero.defaultStats?.maxHp ?? 100, color: 'emerald' },
                        { label: '魔能值 (Energy)', cur: previewingCardHero.defaultStats?.energy ?? 100, max: previewingCardHero.defaultStats?.maxEnergy ?? 100, color: 'blue' },
                        { label: '抵抗斗志 (Morale)', cur: previewingCardHero.defaultStats?.morale ?? 100, max: previewingCardHero.defaultStats?.maxMorale ?? 100, color: 'purple' },
                        { label: '羞耻感 (Shame)', cur: previewingCardHero.defaultStats?.shame ?? 0, max: previewingCardHero.defaultStats?.maxShame ?? 100, color: 'rose' },
                        { label: '服从度 (Obedience)', cur: previewingCardHero.defaultStats?.obedience ?? 0, max: previewingCardHero.defaultStats?.maxObedience ?? 100, color: 'amber' },
                        { label: '敏感沉沦 (Lust)', cur: previewingCardHero.defaultStats?.lust ?? 0, max: previewingCardHero.defaultStats?.maxLust ?? 100, color: 'pink' },
                      ].map((st, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-black/40 border border-zinc-800 flex justify-between items-center">
                          <span className="text-zinc-400">{st.label}:</span>
                          <strong className="text-white">{st.cur} <span className="text-zinc-500 font-normal">/ {st.max}</span></strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Body Parts Anatomy Grid */}
                  <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 space-y-2.5">
                    <div className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-indigo-400" />
                      <span>7 大身体部位生理结构与弱点防御矩阵</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {Object.values(previewingCardHero.bodyParts || {}).map((part) => (
                        <div key={part.id} className="p-2.5 rounded-lg bg-black/40 border border-zinc-800 space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-indigo-300">{part.name}</span>
                            <span className="text-[10px] text-zinc-400">倍率: {part.weaknessMultiplier}x</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-zinc-400">
                            <span>耐久: {part.currentHealth}/{part.maxHealth}</span>
                            <span>破衣/异化: {part.exposure}%</span>
                          </div>
                          {part.description && <p className="text-[10px] text-zinc-500">{part.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: Voice Lines Library */}
              {cardInspectTab === 'voice_lines' && (
                <div className="space-y-3">
                  <div className="bg-zinc-900/80 p-4 rounded-xl border border-purple-900/40 space-y-3">
                    <div className="text-sm font-bold text-purple-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-purple-400" />
                        <span>16 大战术情境语音反应全库 (Voice Lines Library)</span>
                      </div>
                      <span className="text-xs text-zinc-500">
                        共 {Object.values(previewingCardHero.voiceLines || {}).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0)} 条台词
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {[
                        { key: 'greeting', label: '👋 交互开场' },
                        { key: 'hitSmall', label: '💥 轻微打击' },
                        { key: 'hitHeavy', label: '⚡ 重创痛击' },
                        { key: 'hitWeakPoint', label: '🎯 核心弱点中枢' },
                        { key: 'hitSensitivePoint', label: '🌸 敏感神经触碰' },
                        { key: 'timerLow', label: '⏳ 能量红灯告急' },
                        { key: 'touchReaction', label: '🖐️ 身体亵玩触碰' },
                        { key: 'hypnosisReaction', label: '🌀 脑波洗脑催眠' },
                        { key: 'envDamageReaction', label: '☣️ 极端环境侵蚀' },
                        { key: 'defiant', label: '🛡️ 誓死顽抗凛然' },
                        { key: 'wavering', label: '💔 防线动摇颤栗' },
                        { key: 'broken', label: '🖤 意志崩溃沦陷' },
                        { key: 'beggingResistant', label: '🛑 绝望抗拒求饶' },
                        { key: 'beggingDesperate', label: '😭 崩溃卑微哀求' },
                        { key: 'beggingSubmissive', label: '🎀 媚奴彻底臣服' },
                        { key: 'corpseReaction', label: '💀 昏厥休克抽搐' },
                        { key: 'healingReaction', label: '✨ 能量注入复苏' },
                      ].map(({ key, label }) => {
                        const lines = (previewingCardHero.voiceLines as any)?.[key] || [];
                        return (
                          <div key={key} className="p-3 rounded-lg bg-black/40 border border-zinc-800 space-y-1.5">
                            <div className="flex items-center justify-between text-purple-300 font-bold">
                              <span>{label}</span>
                              <span className="text-[10px] text-zinc-500">{lines.length} 条</span>
                            </div>
                            <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin">
                              {lines.length > 0 ? (
                                lines.map((l: string, i: number) => (
                                  <p key={i} className="text-[11px] text-zinc-300 bg-zinc-950/70 p-1.5 rounded border border-zinc-800/80">
                                    "{l}"
                                  </p>
                                ))
                              ) : (
                                <span className="text-zinc-600 text-[10px] italic">暂无预设台词</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: Triggers & Env Weaknesses */}
              {cardInspectTab === 'triggers_env' && (
                <div className="space-y-3">
                  {/* Triggers */}
                  <div className="bg-zinc-900/80 p-4 rounded-xl border border-yellow-900/40 space-y-2.5">
                    <div className="text-sm font-bold text-yellow-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span>条件专属触发器 (Custom Voice Triggers)</span>
                      </div>
                      <span className="text-xs text-zinc-500">{previewingCardHero.customVoiceTriggers?.length || 0} 条规则</span>
                    </div>

                    {previewingCardHero.customVoiceTriggers && previewingCardHero.customVoiceTriggers.length > 0 ? (
                      <div className="space-y-2">
                        {previewingCardHero.customVoiceTriggers.map((tr) => (
                          <div key={tr.id} className="p-3 rounded-lg bg-black/40 border border-zinc-800 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-yellow-300">{tr.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${tr.enabled ? 'bg-emerald-950 text-emerald-300' : 'bg-zinc-800 text-zinc-500'}`}>
                                {tr.enabled ? '已启用' : '已禁用'}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              触发类型: {tr.conditionType} · 命中部位: {tr.targetPartId || '全部'}
                            </div>
                            <div className="space-y-1">
                              {tr.lines.map((l, i) => (
                                <p key={i} className="text-[11px] text-zinc-200 bg-zinc-950 p-1.5 rounded border border-zinc-800">
                                  "{l}"
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-xs italic bg-black/40 p-3 rounded-lg border border-zinc-800">暂无自定义触发器设定。</p>
                    )}
                  </div>

                  {/* Environmental Weaknesses */}
                  <div className="bg-zinc-900/80 p-4 rounded-xl border border-rose-900/40 space-y-2.5">
                    <div className="text-sm font-bold text-rose-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-rose-400" />
                        <span>极端环境要素弱点 (Environmental Weaknesses)</span>
                      </div>
                      <span className="text-xs text-zinc-500">{previewingCardHero.envWeaknesses?.length || 0} 项机制</span>
                    </div>

                    {previewingCardHero.envWeaknesses && previewingCardHero.envWeaknesses.length > 0 ? (
                      <div className="space-y-2">
                        {previewingCardHero.envWeaknesses.map((ew) => (
                          <div key={ew.id} className="p-3 rounded-lg bg-black/40 border border-zinc-800 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-rose-300">{ew.name}</span>
                              <span className="text-[10px] text-amber-300">易伤倍率: {ew.damageMultiplier}x</span>
                            </div>
                            <div className="text-[11px] text-zinc-400">环境主题: {ew.envTheme} · 弱点受创部位: {ew.targetPartId}</div>
                            <div className="space-y-1">
                              {ew.lines.map((l, i) => (
                                <p key={i} className="text-[11px] text-zinc-200 bg-zinc-950 p-1.5 rounded border border-zinc-800">
                                  "{l}"
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-xs italic bg-black/40 p-3 rounded-lg border border-zinc-800">暂无环境弱点设定。</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 8: Relationships & Attachments */}
              {cardInspectTab === 'relationships_attachments' && (
                <div className="space-y-3">
                  {/* Hero Relationships */}
                  <div className="bg-zinc-900/80 p-4 rounded-xl border border-pink-900/40 space-y-2.5">
                    <div className="text-sm font-bold text-pink-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-pink-400" />
                        <span>角色间人际羁绊与态度纽带 (Hero Relationships)</span>
                      </div>
                      <span className="text-xs text-zinc-500">{previewingCardHero.heroRelationships?.length || 0} 个羁绊</span>
                    </div>

                    {previewingCardHero.heroRelationships && previewingCardHero.heroRelationships.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {previewingCardHero.heroRelationships.map((r, i) => (
                          <div key={i} className="p-3 rounded-lg bg-black/40 border border-zinc-800 space-y-1">
                            <div className="flex justify-between items-center font-bold">
                              <span className="text-pink-300">与【{r.targetHeroName}】</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-950 border border-pink-700/50 text-pink-200">
                                {r.relationType}
                              </span>
                            </div>
                            {r.attitudeTone && <div className="text-[11px] text-zinc-400">口吻态度: {r.attitudeTone}</div>}
                            {r.description && <p className="text-[11px] text-zinc-300 bg-zinc-950 p-2 rounded border border-zinc-800">{r.description}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-xs italic bg-black/40 p-3 rounded-lg border border-zinc-800">暂无特定人际羁绊。</p>
                    )}
                  </div>

                  {/* Character Attachments (Docs & Reference Images) */}
                  <div className="bg-zinc-900/80 p-4 rounded-xl border border-blue-900/40 space-y-2.5">
                    <div className="text-sm font-bold text-blue-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-blue-400" />
                        <span>角色专属挂载文档与多模态参考图片 ({previewingCardHero.characterAttachments?.length || 0} 份)</span>
                      </div>
                    </div>

                    {previewingCardHero.characterAttachments && previewingCardHero.characterAttachments.length > 0 ? (
                      <div className="space-y-2">
                        {previewingCardHero.characterAttachments.map((att) => (
                          <div key={att.id} className="p-3 rounded-lg bg-black/40 border border-zinc-800 space-y-1 text-xs">
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-blue-300 flex items-center gap-1.5">
                                {att.type === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                                {att.name}
                              </span>
                              <span className="text-[10px] text-zinc-500">{((att.sizeBytes || att.content?.length || 0) / 1024).toFixed(1)} KB</span>
                            </div>
                            {att.content && (
                              <p className="text-[11px] text-zinc-300 bg-zinc-950 p-2 rounded border border-zinc-800 line-clamp-3 font-mono">
                                {att.type === 'image' ? (att.content.startsWith('data:') ? '[已内嵌 Base64 图像数据]' : att.content) : att.content}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-xs italic bg-black/40 p-3 rounded-lg border border-zinc-800">暂无挂载专属文档或参考图。</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 9: Lorebook & Live Card JSON */}
              {cardInspectTab === 'lorebook_json' && (
                <div className="space-y-4">
                  {/* Lorebook Entries View */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-blue-400" />
                        <span>自动生成的 TavernAI 世界书词条库 (Character Book / Lorebook Entries)</span>
                      </div>
                      <span className="text-[10px] text-zinc-500">
                        {buildTavernLorebook(previewingCardHero, factions).entries.length} 个条目
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                      {buildTavernLorebook(previewingCardHero, factions).entries.map((entry) => (
                        <div key={entry.id} className="p-2.5 rounded-lg bg-black/40 border border-zinc-800 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-purple-300">{entry.comment}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">优先级: {entry.insertion_order}</span>
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono">
                            关键词: <span className="text-amber-300">{entry.keys.join(', ')}</span>
                          </div>
                          <p className="text-[11px] text-zinc-300 bg-zinc-950 p-1.5 rounded border border-zinc-900 line-clamp-3 leading-relaxed">
                            {entry.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Live JSON Preview */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-300 flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5 text-emerald-400" />
                        <span>实时序列化角色卡代码 (Live Card JSON Preview)</span>
                      </span>
                      <button
                        onClick={() => {
                          const options = getExportOptions();
                          const card = exportCharacterCard(previewingCardHero, options);
                          navigator.clipboard.writeText(JSON.stringify(card, null, 2));
                          setLorebookCopySuccess(true);
                          setTimeout(() => setLorebookCopySuccess(false), 2000);
                        }}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-purple-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {lorebookCopySuccess ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{lorebookCopySuccess ? '已复制完整代码' : '一键复制 JSON'}</span>
                      </button>
                    </div>

                    <pre className="p-3 bg-black/80 rounded-xl border border-zinc-800 text-[10px] text-emerald-400 font-mono max-h-64 overflow-y-auto scrollbar-thin whitespace-pre-wrap select-all">
                      {JSON.stringify(exportCharacterCard(previewingCardHero, getExportOptions()), null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Export Options Customization Bar */}
              <div className="p-3 rounded-xl bg-zinc-900/90 border border-purple-900/50 space-y-2.5">
                <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>导出角色卡配置选项 (Export Configurations)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">导出格式:</label>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none"
                    >
                      <option value="ultra_v3">💎 Ultra Card v3.0 (旗舰全量卡)</option>
                      <option value="tavern_v2">🎭 TavernAI / SillyTavern v2 兼容卡</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center space-x-2 text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportIncludePortrait}
                        onChange={(e) => setExportIncludePortrait(e.target.checked)}
                        className="rounded accent-purple-600"
                      />
                      <span>包含高清立绘 Base64</span>
                    </label>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center space-x-2 text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportIncludeAttachments}
                        onChange={(e) => setExportIncludeAttachments(e.target.checked)}
                        className="rounded accent-purple-600"
                      />
                      <span>包含挂载附件与文档</span>
                    </label>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center space-x-2 text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportIncludeRelationships}
                        onChange={(e) => setExportIncludeRelationships(e.target.checked)}
                        className="rounded accent-purple-600"
                      />
                      <span>包含人际羁绊数据</span>
                    </label>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">署名作者:</label>
                    <input
                      type="text"
                      value={exportAuthor}
                      onChange={(e) => setExportAuthor(e.target.value)}
                      placeholder="Commander"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-500 text-xs">
                卡片规范: {exportFormat === 'ultra_v3' ? 'Ultra Character Card v3.0' : 'SillyTavern Card v2.0'}
              </span>
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  setPreviewingCardHero(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold border border-zinc-800 cursor-pointer"
              >
                关闭预览
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 3: Character Deck Package Batch Export Modal */}
      {isDeckExportModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-zinc-950 border border-purple-500/50 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col p-5 space-y-4 shadow-[0_0_50px_rgba(168,85,247,0.25)] font-mono text-zinc-100 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2 text-purple-400">
                <Package className="w-5 h-5" />
                <h3 className="text-base font-bold text-purple-300">特勤干员名册卡包 · 批量全息导出中心</h3>
              </div>
              <button
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsDeckExportModalOpen(false);
                }}
                className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scrollbar-thin text-xs text-zinc-300">
              <p className="text-zinc-400 leading-relaxed text-xs">
                将多位或全部特勤干员打包导出为单一 <strong className="text-purple-300">.json 名册卡包 (Character Deck)</strong>。完整保留各干员立绘、战术生理防线、人际羁绊网络与挂载文档，支持在任意终端一键批量还原！
              </p>

              {/* Package Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/70 p-3.5 rounded-xl border border-zinc-800">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1 font-bold">📦 卡包名称:</label>
                  <input
                    type="text"
                    value={deckExportName}
                    onChange={(e) => setDeckExportName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                    placeholder="特勤战术干员全息名册卡包"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1 font-bold">✍️ 制作者 / 署名:</label>
                  <input
                    type="text"
                    value={deckExportAuthor}
                    onChange={(e) => setDeckExportAuthor(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                    placeholder="Commander"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-zinc-400 block mb-1 font-bold">📝 卡包描述与备注:</label>
                  <input
                    type="text"
                    value={deckExportDescription}
                    onChange={(e) => setDeckExportDescription(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                    placeholder="包含特勤战队全员数据与关联羁绊..."
                  />
                </div>
              </div>

              {/* Checkbox Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-black/40 p-3 rounded-xl border border-zinc-800 text-xs">
                <label className="flex items-center space-x-2 text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deckExportIncludePortraits}
                    onChange={(e) => setDeckExportIncludePortraits(e.target.checked)}
                    className="rounded accent-purple-600"
                  />
                  <span>包含高清立绘 Base64</span>
                </label>

                <label className="flex items-center space-x-2 text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deckExportIncludeAttachments}
                    onChange={(e) => setDeckExportIncludeAttachments(e.target.checked)}
                    className="rounded accent-purple-600"
                  />
                  <span>包含挂载附件与文档</span>
                </label>

                <label className="flex items-center space-x-2 text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deckExportIncludeRelationships}
                    onChange={(e) => setDeckExportIncludeRelationships(e.target.checked)}
                    className="rounded accent-purple-600"
                  />
                  <span>包含人际羁绊网络</span>
                </label>
              </div>

              {/* Hero Selection for Deck */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>勾选要打包导出的干员 (已选 {deckExportSelectedIds.size} / {heroines.length} 位):</span>
                  </span>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        setDeckExportSelectedIds(new Set(heroines.map((h) => h.id)));
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-purple-300 cursor-pointer"
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        ultraAudio.playUiClick();
                        setDeckExportSelectedIds(new Set());
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 cursor-pointer"
                    >
                      全不选
                    </button>
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {heroines.map((h) => {
                    const isChecked = deckExportSelectedIds.has(h.id);
                    return (
                      <div
                        key={h.id}
                        onClick={() => {
                          ultraAudio.playUiClick();
                          setDeckExportSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(h.id)) next.delete(h.id);
                            else next.add(h.id);
                            return next;
                          });
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all text-xs ${
                          isChecked
                            ? 'bg-purple-950/40 border-purple-500/60 text-purple-200'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded accent-purple-600"
                          />
                          <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                            {h.customPortrait ? (
                              <img src={h.customPortrait} alt={h.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-bold text-xs">{h.name.slice(0, 1)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-zinc-200 truncate">{h.name}</div>
                            <div className="text-[10px] text-zinc-500 truncate">{h.title || h.race || '战术特勤干员'}</div>
                          </div>
                        </div>
                        <div className="text-[10px] text-zinc-400 shrink-0">
                          {h.characterAttachments?.length ? `📎 ${h.characterAttachments.length} 附件` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <span className="text-[11px] text-zinc-500">
                将生成并导出 Character Deck v1.0 格式 JSON
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setIsDeckExportModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDeck}
                  disabled={deckExportSelectedIds.size === 0}
                  className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] cursor-pointer flex items-center space-x-1.5"
                >
                  <DownloadCloud className="w-4 h-4" />
                  <span>下载名册卡包 .json ({deckExportSelectedIds.size} 位干员)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
