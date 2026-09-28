import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Ultrawoman, Stats, AiConfig, AlienWeapon, BodyPartId, ScenarioConfig, RelationshipSlot, AutoReplySuggestion, DayConfig, getStagePromptRules, getActiveMilestones, AiAttachment, RealTimeSyncState, WebSearchSource, SearchEngineId } from '../types';
import { MessageSquare, Send, Bot, Trash2, RefreshCw, User, Terminal, AlertCircle, ShieldAlert, Cpu, Flame, Zap, Heart, Shield, Activity, Sparkles, Type, Maximize2, Minimize2, MoveHorizontal, MoveVertical, Sliders, FastForward, Expand, CornerDownLeft, X, Edit3, Layers, Paperclip, Image as ImageIcon, FileText, Upload, Plus, FileCode, Check, Eye, Download, Copy, ExternalLink, ZoomIn, BookmarkPlus, EyeOff, Brain, ChevronDown, ChevronUp, Clock, Globe } from 'lucide-react';
import { ultraAudio } from '../utils/audio';
import { checkSlotConditionMatch, getRelationshipCategoryTheme } from '../utils/relationshipUtils';
import { UNIVERSAL_PROMPT_GROUPS, DEFAULT_UNIVERSAL_PROMPTS } from '../data/promptPresets';
import { fetchAutoReplySuggestions } from '../utils/autoReplyService';
import { getRealTimeContext } from '../utils/realTimeUtils';

export interface ConsoleEntry {
  id: string;
  type: 'attack_log' | 'chat_user' | 'chat_hero' | 'system';
  time: string;
  heroId?: string;
  heroName?: string;
  speakerName?: string;
  // Attack Log metrics
  weaponName?: string;
  targetPartName?: string;
  damageDealt?: number;
  energyDrained?: number;
  moraleLost?: number;
  shameGained?: number;
  obedienceGained?: number;
  lustChanged?: number;
  shieldAbsorbRate?: number; // e.g. 0.60 for 60%
  // Text & Roleplay
  text?: string;
  sender?: 'interrogator' | 'heroine' | 'system';
  reactionType?: 'defiant' | 'pained' | 'wavering' | 'broken' | 'begging' | 'corpse' | 'healing';
  psychologicalAnalysis?: string;
  thinkingProcess?: string;
  envWeaknessName?: string;
  isCorpseHit?: boolean;
  isRevival?: boolean;
  specialEvent?: {
    name: string;
    type: 'resistance' | 'whisper' | 'surge' | 'faultline';
    tag: string;
    description: string;
  };
  customQuestion?: string; // 审讯官伴随本次攻击施加的言语/质问
  attachments?: AiAttachment[]; // 伴随本次发言发送的多模态图片或设定文档
  webSearchUsed?: boolean;
  searchEngine?: string;
  searchQuery?: string;
  searchSources?: WebSearchSource[];
}

function getEntryHeroSpeaker(
  entry: {
    speakerName?: string;
    heroName?: string;
    text?: string;
    psychologicalAnalysis?: string;
  },
  defaultHeroName: string
): string {
  if (entry.speakerName) return entry.speakerName;
  if (entry.heroName) return entry.heroName;

  // Try to parse from text
  if (entry.text) {
    const rawMatches = Array.from(entry.text.matchAll(/【([^】]+)】/g)).map((m) => m[1]);
    const filteredSpeakers = Array.from(
      new Set(
        rawMatches.filter(
          (name) =>
            !['系统', '提示', '战术', '环境', '第', '结算', '临界', '开局', '满血充能', '脱离休克', '契约', '关系', '光源', '时间线'].some(
              (skip) => name.startsWith(skip) || name.includes(skip)
            )
        )
      )
    );

    if (filteredSpeakers.length === 1) {
      return filteredSpeakers[0];
    } else if (filteredSpeakers.length > 1) {
      return '👥 在场小队全员';
    }
  }

  // Try to parse from psychologicalAnalysis
  if (entry.psychologicalAnalysis) {
    const match = entry.psychologicalAnalysis.match(/【([^】]+)】/);
    if (
      match &&
      match[1] &&
      !['系统', '提示', '战术', '环境', '第', '结算', '临界', '开局', '脱离休克', '满血充能'].some((skip) =>
        match[1].includes(skip)
      )
    ) {
      return match[1];
    }
  }

  return defaultHeroName;
}

function renderDialogueTextWithSpeakers(rawText?: string, fontSize: number = 13) {
  if (!rawText) return null;

  const rawLines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return null;

  const hasSpeakerTags = rawLines.some((l) =>
    /^\s*(【[^】]+】|\[[^\]]+\]|[\u4e00-\u9fa5a-zA-Z0-9_\-\.]{2,10}\s*[:：])/.test(l)
  );

  if (!hasSpeakerTags) {
    return (
      <p className="whitespace-pre-wrap font-sans leading-relaxed text-purple-100" style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}>
        {rawText}
      </p>
    );
  }

  return (
    <div className="space-y-2 my-1.5">
      {rawLines.map((line, idx) => {
        const match = line.match(/^\s*(【([^】]+)】|\[([^\]]+)\]|([\u4e00-\u9fa5a-zA-Z0-9_\-\.]{2,10})\s*[:：])\s*[:：]?\s*(.*)$/);
        if (match) {
          const speakerName = match[2] || match[3] || match[4];
          let dialogueBody = match[5];
          if (!dialogueBody && (line.includes('：') || line.includes(':'))) {
            const sepIdx = Math.max(line.indexOf('：'), line.indexOf(':'));
            dialogueBody = line.substring(sepIdx + 1).trim();
          }

          return (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-1.5 p-2.5 rounded-lg bg-black/60 border border-purple-500/40 shadow-md">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-gradient-to-r from-purple-950 to-indigo-950 text-purple-200 border border-purple-500/60 shrink-0 self-start shadow-[0_0_8px_rgba(168,85,247,0.3)]">
                👤 【{speakerName}】
              </span>
              <div className="text-purple-100 font-sans leading-relaxed flex-1 whitespace-pre-wrap" style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}>
                {dialogueBody || line}
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className="whitespace-pre-wrap font-sans text-purple-200/90 leading-relaxed px-1" style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}>
            {line}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Chat bubbles must read like a real conversation: the dialogue is the message, the tactical /
 * psychological evaluation only shows up when the user explicitly expands it.
 */
const PSYCH_EXPANDED_KEY = 'ultra_psych_expanded_v1';

/** 心理评估展开状态：默认展开，用户手动收起/展开后会被记住（非受控 details，可在任意子组件里渲染） */
function readPsychExpanded(): boolean {
  try {
    const v = localStorage.getItem(PSYCH_EXPANDED_KEY);
    return v === null ? true : v === '1';
  } catch (e) { return true; }
}

function writePsychExpanded(next: boolean): void {
  try { localStorage.setItem(PSYCH_EXPANDED_KEY, next ? '1' : '0'); } catch (e) {}
}

function renderCollapsibleAnalysis(psychText?: string) {
  if (!psychText) return null;
  return (
    <details
      ref={(el) => {
        // 首次渲染时按用户偏好设置展开状态（默认展开）
        if (el && el.dataset.psychInit !== '1') {
          el.dataset.psychInit = '1';
          el.open = readPsychExpanded();
        }
      }}
      onToggle={(e) => writePsychExpanded((e.currentTarget as HTMLDetailsElement).open)}
      className="mt-1.5 group"
    >
      <summary className="cursor-pointer select-none text-[10px] text-amber-300/80 font-mono hover:text-amber-200">
        🧠 心理评估（点击展开 / 收起）
      </summary>
      <div className="mt-0.5">{renderPsychologicalAnalysis(psychText)}</div>
    </details>
  );
}

function renderPsychologicalAnalysis(psychText?: string) {
  if (!psychText) return null;

  let lines = psychText.split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length === 1 && (psychText.match(/【[^】]+】/g) || []).length > 1) {
    lines = psychText
      .split(/(?=【[^】]+】)/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const hasSpeakerTags = lines.some((l) => /^\s*【[^】]+】/.test(l));

  if (!hasSpeakerTags) {
    return (
      <div className="mt-2 pt-1.5 border-t border-purple-900/50 text-[10px] text-amber-300/90 flex items-start space-x-1 font-mono">
        <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
        <span>战术弱点与心理评估: {psychText}</span>
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-purple-900/50 space-y-1.5 font-mono">
      <div className="text-[10px] font-bold text-amber-400 flex items-center space-x-1">
        <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
        <span>小队全员独立心理与战术状态反馈:</span>
      </div>
      <div className="space-y-1">
        {lines.map((line, idx) => {
          const match = line.match(/^\s*【([^】]+)】\s*[:：]?\s*(.*)$/);
          if (match) {
            const name = match[1];
            const content = match[2];
            return (
              <div key={idx} className="text-[10px] bg-amber-950/40 p-1.5 rounded border border-amber-500/30 text-amber-200/90 flex items-start space-x-1.5 shadow-sm">
                <span className="font-bold text-amber-300 shrink-0">💡 【{name}】:</span>
                <span className="flex-1 leading-relaxed">{content || line}</span>
              </div>
            );
          }
          return (
            <div key={idx} className="text-[10px] text-amber-300/80 px-1">
              • {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getReactionBadge(reactionType?: string) {
  switch (reactionType) {
    case 'defiant':
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/80 border border-rose-500/50 text-rose-300 font-bold">顽抗硬撑</span>;
    case 'pained':
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/80 border border-amber-500/50 text-amber-300 font-bold">痛苦喘息</span>;
    case 'wavering':
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/80 border border-purple-500/50 text-purple-300 font-bold">意志动摇</span>;
    case 'broken':
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-fuchsia-950/80 border border-fuchsia-500/50 text-fuchsia-300 font-bold">屈服臣服</span>;
    case 'begging':
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-900/90 border border-rose-400 text-rose-100 font-bold animate-pulse">卑微求饶</span>;
    case 'corpse':
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-900 border border-zinc-700 text-zinc-400 font-bold">死亡休克</span>;
    case 'healing':
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold">复苏感应</span>;
    default:
      return null;
  }
}

function ThinkingProcessCard({
  text,
  displayMode = 'collapsed',
}: {
  text?: string;
  displayMode?: 'collapsed' | 'expanded' | 'hidden';
}) {
  const [isOpen, setIsOpen] = useState(displayMode === 'expanded');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (displayMode === 'expanded') {
      setIsOpen(true);
    } else if (displayMode === 'collapsed') {
      setIsOpen(false);
    }
  }, [displayMode]);

  if (displayMode === 'hidden' || !text || !text.trim()) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    ultraAudio.playChimeSFX();
    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const charCount = text.trim().length;

  return (
    <div className="mt-2 rounded-lg border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-zinc-950/50 overflow-hidden text-xs">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/60 transition-colors text-indigo-300 font-mono text-[11px] cursor-pointer select-none"
      >
        <div className="flex items-center space-x-1.5">
          <Brain className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span className="font-bold">🧠 AI 深度思考与推理链 (Thinking Process)</span>
          <span className="text-[10px] text-indigo-400/80 font-mono">({charCount} 字)</span>
        </div>
        <div className="flex items-center space-x-2">
          {isOpen && (
            <button
              type="button"
              onClick={handleCopy}
              className="text-[10px] text-indigo-300 hover:text-white px-1.5 py-0.5 rounded bg-indigo-900/80 hover:bg-indigo-800 border border-indigo-600/50 flex items-center gap-1 transition-all cursor-pointer"
              title="复制思维链内容"
            >
              {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
              <span>{copied ? '已复制' : '复制思维链'}</span>
            </button>
          )}
          <div className="flex items-center space-x-1 text-[10px] text-indigo-400/90 bg-indigo-900/60 px-1.5 py-0.5 rounded border border-indigo-700/40">
            <span>{isOpen ? '收起思考' : '展开推理过程'}</span>
            {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="p-3 text-[11px] font-mono text-indigo-200/90 whitespace-pre-wrap leading-relaxed border-t border-indigo-500/20 max-h-64 overflow-y-auto bg-black/40 scrollbar-thin selection:bg-indigo-700 selection:text-white">
          {text.trim()}
        </div>
      )}
    </div>
  );
}

const ENGINE_LABELS: Record<string, { name: string; icon: string }> = {
  google: { name: 'Google 谷歌搜索', icon: '🌐' },
  bing: { name: 'Bing 微软必应', icon: '🔍' },
  duckduckgo: { name: 'DuckDuckGo 隐私检索', icon: '🦆' },
  baidu: { name: '百度搜索 (Baidu)', icon: '🐾' },
  sogou: { name: '搜狗搜索 (Sogou)', icon: '🐕' },
  wikipedia: { name: '维基百科 (Wikipedia)', icon: '📚' },
};

export const WebSearchSourcesCard: React.FC<{
  webSearchUsed?: boolean;
  searchEngine?: string;
  searchQuery?: string;
  searchSources?: WebSearchSource[];
}> = ({
  webSearchUsed,
  searchEngine,
  searchQuery,
  searchSources,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const sources = searchSources || [];
  if (!webSearchUsed && sources.length === 0) return null;

  const engineKey = (searchEngine || '').toLowerCase();
  const engineInfo = ENGINE_LABELS[engineKey] || {
    name: searchEngine || '实时多源检索',
    icon: '🌐',
  };

  return (
    <div className="mt-2 rounded-lg border border-cyan-800/60 bg-gradient-to-r from-cyan-950/40 via-zinc-950/60 to-blue-950/40 overflow-hidden text-xs shadow-sm">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none hover:bg-cyan-900/20 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <span className="text-sm">{engineInfo.icon}</span>
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-cyan-300 text-[11px] flex items-center gap-1">
              <span>已启用联网检索</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/50 text-cyan-200">
                {engineInfo.name}
              </span>
            </span>
            {searchQuery && (
              <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[180px] sm:max-w-[260px]">
                关键词: "{searchQuery}"
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-[10px] text-cyan-400/90 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-700/50">
          <span>{sources.length > 0 ? `${sources.length} 条参考事实` : '已检索'}</span>
          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </div>

      {isOpen && sources.length > 0 && (
        <div className="p-2.5 space-y-2 border-t border-cyan-900/40 bg-black/50">
          <div className="text-[10px] text-zinc-400 flex items-center justify-between">
            <span>📚 检索到的最新事实来源与网页摘要 (AI已融入角色回答与心智认知):</span>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
            {sources.map((src, i) => (
              <div
                key={i}
                className="p-2 rounded bg-zinc-950/90 border border-zinc-800 hover:border-cyan-700/60 transition-colors space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-cyan-200 text-xs truncate">
                    {i + 1}. {src.title}
                  </span>
                  {src.url && (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-0.5 text-[10px] shrink-0 font-mono"
                    >
                      <span>来源直达</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed font-sans line-clamp-3">
                  {src.snippet}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ConsoleEntryCardProps {
  entry: ConsoleEntry;
  heroName: string;
  interrogatorIdentity: string;
  fontSize: number;
  thinkingDisplayMode?: 'collapsed' | 'expanded' | 'hidden';
  onPreviewAttachment: (att: AiAttachment) => void;
}

const ConsoleEntryCard: React.FC<ConsoleEntryCardProps> = React.memo(({
  entry,
  heroName,
  interrogatorIdentity,
  fontSize,
  thinkingDisplayMode = 'collapsed',
  onPreviewAttachment,
}) => {
  if (entry.type === 'system') {
    return (
      <div className="text-center my-1.5">
        <span className="px-2.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-[10px] text-zinc-400 font-mono">
          ⚙️ {entry.text}
        </span>
      </div>
    );
  }

  if (entry.type === 'attack_log') {
    const absorbPct = Math.round((entry.shieldAbsorbRate || 0) * 100);
    return (
      <div className="bg-zinc-900/80 border border-blue-900/50 p-2.5 rounded-lg text-xs space-y-1.5 shadow-[0_0_10px_rgba(59,130,246,0.1)] relative overflow-hidden">
        <div className="flex items-center justify-between text-[11px] border-b border-zinc-800/80 pb-1">
          <div className="flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="font-bold text-blue-300">【{entry.weaponName}】</span>
            <span className="text-zinc-400">➔ Hit 部位:</span>
            <span className="font-bold text-amber-300">{entry.targetPartName}</span>
            {entry.envWeaknessName && (
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-950 text-amber-300 border border-amber-500/50 font-bold">
                ⚡ {entry.envWeaknessName}
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-500">[{entry.time}]</span>
        </div>

        {/* Damage Metrics & Shield Absorbed */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
          {absorbPct > 0 ? (
            <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              🛡️ 能量护盾抵扣 {absorbPct}% 伤害
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40">
              ⚡ 护盾破裂·全额肉体摧残
            </span>
          )}

          {entry.damageDealt !== undefined && entry.damageDealt !== 0 && (
            <span className={entry.damageDealt > 0 ? "text-rose-400" : "text-emerald-400"}>
              {entry.damageDealt > 0 ? `-${entry.damageDealt}` : `+${Math.abs(entry.damageDealt)}`} HP
            </span>
          )}
          {entry.energyDrained !== undefined && entry.energyDrained !== 0 && (
            <span className={entry.energyDrained > 0 ? "text-amber-400" : "text-cyan-400"}>
              {entry.energyDrained > 0 ? `-${entry.energyDrained}%` : `+${Math.abs(entry.energyDrained)}%`} 能量
            </span>
          )}
          {entry.moraleLost !== undefined && entry.moraleLost !== 0 && (
            <span className={entry.moraleLost > 0 ? "text-purple-400" : "text-indigo-400"}>
              {entry.moraleLost > 0 ? `-${entry.moraleLost}` : `+${Math.abs(entry.moraleLost)}`} 意志
            </span>
          )}
          {entry.shameGained !== undefined && entry.shameGained !== 0 && (
            <span className={entry.shameGained > 0 ? "text-fuchsia-400" : "text-amber-400"}>
              {entry.shameGained > 0 ? `+${entry.shameGained}` : entry.shameGained} 羞耻
            </span>
          )}
          {entry.obedienceGained !== undefined && entry.obedienceGained !== 0 && (
            <span className={entry.obedienceGained > 0 ? "text-blue-400" : "text-rose-400"}>
              {entry.obedienceGained > 0 ? `+${entry.obedienceGained}` : entry.obedienceGained} 信任
            </span>
          )}
          {entry.lustChanged !== undefined && entry.lustChanged !== 0 && (
            <span className={entry.lustChanged > 0 ? "text-pink-400" : "text-amber-400"}>
              {entry.lustChanged > 0 ? `+${entry.lustChanged}` : entry.lustChanged} 欲望
            </span>
          )}
        </div>

        {/* Special Low-HP Random Event Tag */}
        {entry.specialEvent && (
          <div className={`p-2 rounded-md border text-xs font-bold flex items-center justify-between shadow-md ${
            entry.specialEvent.type === 'resistance'
              ? 'bg-amber-950/90 border-amber-500 text-amber-200 shadow-amber-900/30'
              : entry.specialEvent.type === 'whisper'
              ? 'bg-purple-950/90 border-fuchsia-500 text-fuchsia-200 shadow-fuchsia-900/30'
              : entry.specialEvent.type === 'surge'
              ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200 shadow-cyan-900/30'
              : 'bg-rose-950/90 border-rose-500 text-rose-200 shadow-rose-900/30'
          }`}>
            <div className="flex items-center space-x-2">
              <span className="text-base animate-bounce">{entry.specialEvent.tag.split(' ')[0]}</span>
              <div>
                <div className="text-xs tracking-wider uppercase font-extrabold flex items-center gap-1.5">
                  <span>{entry.specialEvent.name}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/60 border border-white/20 font-mono font-normal">🎲 临界随机事件 (HP&lt;30%)</span>
                </div>
                <div className="text-[10px] opacity-90 font-normal mt-0.5">{entry.specialEvent.description}</div>
              </div>
            </div>
          </div>
        )}

        {/* Interrogator Custom Speech Badge */}
        {entry.customQuestion && (
          <div className="bg-blue-950/70 p-2 rounded border border-blue-500/40 text-blue-200 text-xs flex items-start space-x-1.5 font-mono">
            <User className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-blue-300">{entry.speakerName || interrogatorIdentity}发言/质问:</span>
              <p className="whitespace-pre-wrap text-blue-100 font-sans font-medium mt-0.5" style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}>"{entry.customQuestion}"</p>
            </div>
          </div>
        )}

        {/* Character Hit Reaction Quote */}
        {entry.text && (
          <div className="bg-black/50 p-2.5 rounded border border-purple-900/30 text-purple-200 text-xs flex items-start space-x-1.5">
            <Bot className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-1">
                  <span className="font-bold text-purple-300">
                    {entry.text.includes('【') && getEntryHeroSpeaker(entry, heroName) === '👥 在场小队全员'
                      ? '👥 小队在场全员实时回应与反馈:'
                      : `${getEntryHeroSpeaker(entry, heroName)}:`}
                  </span>
                  {getReactionBadge(entry.reactionType)}
                </div>
              </div>
              {renderDialogueTextWithSpeakers(entry.text, fontSize)}
            </div>
          </div>
        )}

        {/* AI Psychological Analysis */}
        {renderCollapsibleAnalysis(entry.psychologicalAnalysis)}

        {/* AI Thinking Process */}
        {entry.thinkingProcess && (
          <ThinkingProcessCard text={entry.thinkingProcess} displayMode={thinkingDisplayMode} />
        )}

        {/* Web Search Grounding Sources */}
        <WebSearchSourcesCard
          webSearchUsed={entry.webSearchUsed}
          searchEngine={entry.searchEngine}
          searchQuery={entry.searchQuery}
          searchSources={entry.searchSources}
        />
      </div>
    );
  }

  // User Chat vs Hero Roleplay Chat
  const isInterrogator = entry.sender === 'interrogator';
  const speakerLabel = isInterrogator
    ? (entry.speakerName || interrogatorIdentity)
    : getEntryHeroSpeaker(entry, heroName);

  return (
    <div className={`flex flex-col ${isInterrogator ? 'items-end' : 'items-start'} space-y-1`}>
      <div className="flex items-center space-x-1.5 text-[10px] text-zinc-500 font-mono px-1">
        {isInterrogator ? (
          <>
            <span className="text-blue-400 font-bold">{speakerLabel}</span>
            <User className="w-3 h-3 text-blue-400" />
          </>
        ) : (
          <>
            <Bot className="w-3 h-3 text-purple-400" />
            <span className="text-purple-300 font-bold">{speakerLabel}</span>
            {getReactionBadge(entry.reactionType)}
          </>
        )}
        <span className="text-[9px] opacity-60">[{entry.time}]</span>
      </div>

      <div
        className={`p-3 rounded-lg leading-relaxed max-w-[88%] ${
          isInterrogator
            ? 'bg-blue-950/80 border border-blue-500/50 text-blue-100 rounded-tr-none shadow-[0_0_12px_rgba(59,130,246,0.2)]'
            : 'bg-zinc-900/90 border border-purple-500/40 text-purple-100 rounded-tl-none shadow-[0_0_12px_rgba(168,85,247,0.15)]'
        }`}
      >
        {isInterrogator ? (
          <p className="whitespace-pre-wrap font-sans" style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}>{entry.text}</p>
        ) : (
          renderDialogueTextWithSpeakers(entry.text, fontSize)
        )}

        {/* Multimodal Attachments rendered inside message */}
        {entry.attachments && entry.attachments.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-col space-y-2">
            {/* Attached Images Gallery */}
            {entry.attachments.some((a) => a && a.type === 'image') && (
              <div className="flex flex-wrap gap-2">
                {entry.attachments
                  .filter((a) => a && a.type === 'image')
                  .map((att) => (
                    <div
                      key={att.id}
                      onClick={() => onPreviewAttachment(att)}
                      className="group relative cursor-pointer rounded-lg overflow-hidden border border-purple-500/50 hover:border-purple-300 shadow-md transition-all max-w-[200px] bg-black/60"
                      title={`点击放大查看: ${att.name}`}
                    >
                      <img
                        src={att.content}
                        alt={att.name}
                        className="w-full max-h-32 object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold">
                        <Eye className="w-4 h-4 mr-1 text-purple-300" /> 查看图片
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-black/75 px-1.5 py-0.5 text-[9px] text-zinc-300 truncate">
                        {att.name}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Attached Documents Capsules */}
            {entry.attachments.some((a) => a && (a.type === 'document' || !a.type)) && (
              <div className="flex flex-wrap gap-1.5">
                {entry.attachments
                  .filter((a) => a && (a.type === 'document' || !a.type))
                  .map((att) => (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => onPreviewAttachment(att)}
                      className="px-2.5 py-1.5 rounded-lg bg-black/40 hover:bg-black/70 border border-blue-500/40 hover:border-blue-300 text-blue-200 text-xs flex items-center space-x-2 transition-all text-left cursor-pointer shadow-sm"
                      title={`点击阅读全文: ${att.name}`}
                    >
                      <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div className="flex flex-col max-w-[220px]">
                        <span className="font-bold truncate text-[11px] text-zinc-100">{att.name}</span>
                        <span className="text-[9px] text-zinc-400">
                          {att.sizeBytes ? `${Math.round(att.sizeBytes / 1024)} KB` : `${att.content.length} 字符`} · 点击阅读
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {renderCollapsibleAnalysis(entry.psychologicalAnalysis)}
        {entry.thinkingProcess && (
          <ThinkingProcessCard text={entry.thinkingProcess} displayMode={thinkingDisplayMode} />
        )}
        <WebSearchSourcesCard
          webSearchUsed={entry.webSearchUsed}
          searchEngine={entry.searchEngine}
          searchQuery={entry.searchQuery}
          searchSources={entry.searchSources}
        />
      </div>
    </div>
  );
});

interface UnifiedInterrogationConsoleProps {
  hero: Ultrawoman;
  stats: Stats;
  aiConfig: AiConfig;
  entries: ConsoleEntry[];
  onSendChatMessage: (text: string, attachments?: AiAttachment[]) => Promise<void>;
  onClearConsole: () => void;
  isLoading: boolean;
  selectedWeapon?: AlienWeapon;
  selectedPart?: BodyPartId;
  onExecuteAttack?: (weapon: AlienWeapon, targetPart: BodyPartId, intensity?: number, customQuestion?: string) => void;
  interrogatorIdentity?: string;
  currentScenarioName?: string;
  activeRelationshipTitle?: string;
  activeRelationship?: RelationshipSlot;
  allRelationshipSlots?: RelationshipSlot[];
  scenarioConfig?: ScenarioConfig;
  dayCount?: number;
  dayConfig?: DayConfig;
  dialogueFontSize?: number;
  onUpdateDialogueFontSize?: (size: number) => void;
  consoleHeight?: number;
  consoleWidthMode?: 'normal' | 'wide' | 'full';
  onUpdateConsoleHeight?: (height: number) => void;
  onUpdateConsoleWidthMode?: (mode: 'normal' | 'wide' | 'full') => void;
  onOpenRelationshipModal?: () => void;
  onTriggerRelationshipEval?: () => void;
  onSwitchRelationship?: (slot: RelationshipSlot) => void;
  onSaveToGlobalAttachments?: (attachment: AiAttachment) => void;
  realTimeState?: RealTimeSyncState;
  onTriggerRealTimeGreeting?: () => void | Promise<void>;
  onToggleWebSearch?: () => void;
  onChangeSearchEngine?: (engine: SearchEngineId) => void;
  /** 以下三项用于让「智能建议」拿到更完整的现场上下文（环境 / 部位状态） */
  environmentTheme?: string;
  partDamage?: Record<string, number>;
  partExposure?: Record<string, number>;
  /** 在场角色名单（多人同台时让智能建议分清谁是谁） */
  presentCharacters?: Array<{ id?: string; name: string; relationshipTitle?: string; personality?: string }>;
}

const ENGINE_ITEMS: Array<{ id: SearchEngineId; label: string; icon: string }> = [
  { id: 'google', label: 'Google 谷歌', icon: '🌐' },
  { id: 'bing', label: 'Bing 微软必应', icon: '🔍' },
  { id: 'duckduckgo', label: 'DuckDuckGo', icon: '🦆' },
  { id: 'baidu', label: '百度搜索', icon: '🐾' },
  { id: 'sogou', label: '搜狗搜索', icon: '🐕' },
  { id: 'wikipedia', label: '维基百科', icon: '📚' },
];

const BaseUnifiedInterrogationConsole: React.FC<UnifiedInterrogationConsoleProps> = ({
  hero,
  stats,
  aiConfig,
  entries,
  onSendChatMessage,
  onClearConsole,
  isLoading,
  selectedWeapon,
  selectedPart,
  onExecuteAttack,
  interrogatorIdentity = '审讯官',
  currentScenarioName = '开局剧情',
  activeRelationshipTitle = '战友关系',
  activeRelationship,
  allRelationshipSlots = [],
  scenarioConfig,
  dayCount = 1,
  dayConfig,
  dialogueFontSize: dialogueFontSizeProp,
  onUpdateDialogueFontSize,
  consoleHeight: consoleHeightProp,
  consoleWidthMode: consoleWidthModeProp,
  onUpdateConsoleHeight,
  onUpdateConsoleWidthMode,
  onOpenRelationshipModal,
  onTriggerRelationshipEval,
  onSwitchRelationship,
  onSaveToGlobalAttachments,
  realTimeState,
  onTriggerRealTimeGreeting,
  onToggleWebSearch,
  onChangeSearchEngine,
  environmentTheme,
  partDamage,
  partExposure,
  presentCharacters,
}) => {
  const [realTimeCtx, setRealTimeCtx] = useState(() => getRealTimeContext(realTimeState));
  const [isEngineDropdownOpen, setIsEngineDropdownOpen] = useState(false);
  useEffect(() => {
    setRealTimeCtx(getRealTimeContext(realTimeState));
    const timer = setInterval(() => {
      setRealTimeCtx(getRealTimeContext(realTimeState));
    }, 1000);
    return () => clearInterval(timer);
  }, [realTimeState]);

  const [inputText, setInputText] = useState(() => {
    try {
      return localStorage.getItem('ultrawoman_chat_input_draft') || '';
    } catch {
      return '';
    }
  });
  const [syncAttack, setSyncAttack] = useState(() => {
    try {
      return localStorage.getItem('ultrawoman_sync_attack') === 'true';
    } catch {
      return false;
    }
  });
  const [isExpandedEditorOpen, setIsExpandedEditorOpen] = useState(false);

  const [enterSendMode, setEnterSendMode] = useState<'enter' | 'ctrlEnter'>(() => {
    try {
      // 一次性迁移：旧版本把快捷键存成「Ctrl+Enter 发送」，现在统一改为「Enter 发送 / Shift+Enter 换行」。
      // 迁移只做一次，之后仍可用下方按钮切回 Ctrl+Enter。
      if (!localStorage.getItem('ultrawoman_enter_send_mode_v2')) {
        localStorage.setItem('ultrawoman_enter_send_mode_v2', '1');
        localStorage.setItem('ultrawoman_enter_send_mode', 'enter');
        return 'enter';
      }
      const saved = localStorage.getItem('ultrawoman_enter_send_mode');
      if (saved === 'enter' || saved === 'ctrlEnter') return saved;
    } catch {}
    // 默认：Enter 直接发送，Shift+Enter 换行
    return 'enter';
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multimodal Attachments Management State
  const [pendingAttachments, setPendingAttachments] = useState<AiAttachment[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewModalAttachment, setPreviewModalAttachment] = useState<AiAttachment | null>(null);
  const [isManualDocModalOpen, setIsManualDocModalOpen] = useState(false);
  const [manualDocName, setManualDocName] = useState('');
  const [manualDocContent, setManualDocContent] = useState('');
  const [manualDocDesc, setManualDocDesc] = useState('');
  const [isManualImgModalOpen, setIsManualImgModalOpen] = useState(false);
  const [manualImgName, setManualImgName] = useState('');
  const [manualImgUrl, setManualImgUrl] = useState('');
  const [manualImgDesc, setManualImgDesc] = useState('');
  const [syncToGlobalLibrary, setSyncToGlobalLibrary] = useState(() => {
    try {
      return localStorage.getItem('ultrawoman_sync_to_global_library') === 'true';
    } catch {
      return false;
    }
  });

  // AI Thinking / Reasoning Chain Display Mode (hidden / collapsed / expanded)
  const [thinkingDisplayMode, setThinkingDisplayMode] = useState<'collapsed' | 'expanded' | 'hidden'>(() => {
    try {
      const saved = localStorage.getItem('ultrawoman_thinking_display_mode');
      if (saved === 'collapsed' || saved === 'expanded' || saved === 'hidden') return saved;
      if (aiConfig.showThinkingInChat === false) return 'hidden';
    } catch {}
    return 'collapsed';
  });

  const changeThinkingDisplayMode = (mode: 'collapsed' | 'expanded' | 'hidden') => {
    ultraAudio.playUiClick();
    setThinkingDisplayMode(mode);
    try {
      localStorage.setItem('ultrawoman_thinking_display_mode', mode);
    } catch {}
  };

  const dragCounterRef = useRef<number>(0);

  // Synchronize inputText draft with localStorage
  useEffect(() => {
    try {
      if (inputText) {
        localStorage.setItem('ultrawoman_chat_input_draft', inputText);
      } else {
        localStorage.removeItem('ultrawoman_chat_input_draft');
      }
    } catch {}
  }, [inputText]);

  // Synchronize syncAttack with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ultrawoman_sync_attack', String(syncAttack));
    } catch {}
  }, [syncAttack]);

  // Synchronize enterSendMode with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ultrawoman_enter_send_mode', enterSendMode);
    } catch {}
  }, [enterSendMode]);

  // Synchronize syncToGlobalLibrary with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ultrawoman_sync_to_global_library', String(syncToGlobalLibrary));
    } catch {}
  }, [syncToGlobalLibrary]);

  // Auto-resize input textarea when typing long content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [inputText]);

  const [fontSize, setFontSize] = useState<number>(() => {
    if (dialogueFontSizeProp) return dialogueFontSizeProp;
    const saved = localStorage.getItem('ultrawoman_dialogue_font_size');
    return saved ? parseInt(saved, 10) : 14;
  });

  const [consoleHeight, setConsoleHeight] = useState<number>(() => {
    if (consoleHeightProp) return consoleHeightProp;
    const saved = localStorage.getItem('ultrawoman_console_height');
    return saved ? parseInt(saved, 10) : 650; // enlarged and lengthened default 650px
  });

  const [widthMode, setWidthMode] = useState<'normal' | 'wide' | 'full'>(() => {
    if (consoleWidthModeProp) return consoleWidthModeProp;
    const saved = localStorage.getItem('ultrawoman_console_width_mode');
    return (saved as any) || 'normal';
  });

  const [activePromptCategory, setActivePromptCategory] = useState<string>(() => {
    try {
      return localStorage.getItem('ultrawoman_prompt_category') || 'all';
    } catch {
      return 'all';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ultrawoman_prompt_category', activePromptCategory);
    } catch {}
  }, [activePromptCategory]);

  const [showCategorySelector, setShowCategorySelector] = useState<boolean>(false);

  // Current Day stage & active milestones info
  const stageRules = useMemo(() => getStagePromptRules(dayConfig), [dayConfig]);
  const currentStage = useMemo(() => {
    return stageRules.find((r) => {
      const min = r.minDay || 1;
      const max = r.maxDay;
      return dayCount >= min && (max === null || max === undefined || dayCount <= max);
    }) || stageRules[0];
  }, [stageRules, dayCount]);

  const activeMilestones = useMemo(() => getActiveMilestones(dayConfig, dayCount), [dayConfig, dayCount]);

  // Auto-Reply Suggestions State (AI Context-Aware Response Options) - Default to FALSE (off/on-demand)
  const [showAutoReply, setShowAutoReply] = useState<boolean>(() => {
    const saved = localStorage.getItem('ultrawoman_show_auto_reply');
    return saved === 'true'; // defaults to false if unset
  });
  const [suggestions, setSuggestions] = useState<AutoReplySuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);
  const [suggestionAnchor, setSuggestionAnchor] = useState<string>('');
  // 用 ref 保存当前建议，避免 loadSuggestions 依赖 suggestions 造成"取建议→依赖变化→再取建议"的死循环
  const suggestionsRef = useRef<AutoReplySuggestion[]>([]);
  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);
  const isLoadingSuggestionsRef = useRef<boolean>(false);

  // 最近一条女战士台词：既用于喂给建议接口，也用于在 UI 上显示"本次建议承接的是哪一句"
  const lastHeroineLine = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e: any = entries[i];
      if (!e || e.type === 'summary' || e.type === 'system') continue;
      if (e.sender === 'interrogator' || e.sender === 'user' || e.sender === 'player') continue;
      const raw = String(e.text || '').replace(/\s+/g, ' ').trim();
      if (!raw || /^⏳\s*\[/.test(raw)) continue;
      return raw.slice(0, 90);
    }
    return '';
  }, [entries]);

  const loadSuggestions = useCallback(async (isRefresh = false) => {
    // 防重入：避免 effect 与按钮同时触发造成并发重复请求
    if (isLoadingSuggestionsRef.current) return;
    isLoadingSuggestionsRef.current = true;
    setIsLoadingSuggestions(true);
    try {
      const results = await fetchAutoReplySuggestions({
        hero,
        stats,
        activeRelationship,
        scenarioConfig,
        aiConfig,
        dayCount,
        dayConfig,
        messages: entries.slice(-20),
        environmentTheme,
        partDamage,
        partExposure,
        // 多人同台：把在场角色名单一起带上，避免建议把角色张冠李戴
        presentCharacters,
        // “换一批”：把当前这 3 条带过去，让模型避开重复内容
        avoid: isRefresh ? suggestionsRef.current.map((s) => s.text) : undefined,
      });
      if (results && results.length > 0) {
        setSuggestions(results);
        setSuggestionAnchor(lastHeroineLine);
      }
    } catch (err) {
      console.error('Failed to load auto-reply suggestions:', err);
    } finally {
      isLoadingSuggestionsRef.current = false;
      setIsLoadingSuggestions(false);
    }
  }, [hero, stats, activeRelationship, scenarioConfig, aiConfig, dayCount, dayConfig, entries, environmentTheme, partDamage, partExposure, presentCharacters, lastHeroineLine]);

  const toggleAutoReply = useCallback(() => {
    setShowAutoReply((prev) => {
      const next = !prev;
      localStorage.setItem('ultrawoman_show_auto_reply', String(next));
      return next;
    });
  }, []);

  // 仅在"开启建议"时自动拉取一次；后续由对话推进（entries 变化）触发刷新
  useEffect(() => {
    if (showAutoReply) {
      loadSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAutoReply, entries.length]);

  const displayedPrompts = useMemo(() => {
    if (activePromptCategory === 'all') return DEFAULT_UNIVERSAL_PROMPTS;
    const group = UNIVERSAL_PROMPT_GROUPS.find((g) => g.id === activePromptCategory);
    return group ? group.prompts : DEFAULT_UNIVERSAL_PROMPTS;
  }, [activePromptCategory]);

  useEffect(() => {
    if (dialogueFontSizeProp) setFontSize(dialogueFontSizeProp);
  }, [dialogueFontSizeProp]);

  useEffect(() => {
    if (consoleHeightProp) setConsoleHeight(consoleHeightProp);
  }, [consoleHeightProp]);

  useEffect(() => {
    if (consoleWidthModeProp) setWidthMode(consoleWidthModeProp);
  }, [consoleWidthModeProp]);

  const changeFontSize = (newSize: number) => {
    const clamped = Math.min(26, Math.max(11, newSize));
    setFontSize(clamped);
    localStorage.setItem('ultrawoman_dialogue_font_size', String(clamped));
    if (onUpdateDialogueFontSize) {
      onUpdateDialogueFontSize(clamped);
    }
  };

  const changeConsoleHeight = (newH: number) => {
    const clamped = Math.min(1200, Math.max(400, newH));
    setConsoleHeight(clamped);
    localStorage.setItem('ultrawoman_console_height', String(clamped));
    if (onUpdateConsoleHeight) {
      onUpdateConsoleHeight(clamped);
    }
  };

  const changeWidthMode = (newMode: 'normal' | 'wide' | 'full') => {
    setWidthMode(newMode);
    localStorage.setItem('ultrawoman_console_width_mode', newMode);
    if (onUpdateConsoleWidthMode) {
      onUpdateConsoleWidthMode(newMode);
    }
  };

  // 评估当前数值条件下满足的所有关系槽位
  const satisfiedSlots = useMemo(() => {
    if (!allRelationshipSlots || allRelationshipSlots.length === 0 || !stats || !hero) return [];
    return allRelationshipSlots.filter((slot) => {
      const res = checkSlotConditionMatch(slot, stats, hero, scenarioConfig, dayCount);
      return res.matched;
    });
  }, [allRelationshipSlots, stats, hero, scenarioConfig, dayCount]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [entries, isLoading]);

  // File processing and attachment helpers
  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    fileArray.forEach((file) => {
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);

      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (content) {
            const newAtt: AiAttachment = {
              id: `att_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              name: file.name,
              type: 'image',
              mimeType: file.type || 'image/png',
              sizeBytes: file.size,
              content,
              description: `拖入/挂载的图像 (${Math.round(file.size / 1024)} KB)`,
              enabled: true,
              category: 'general',
              createdAt: new Date().toISOString(),
            };
            setPendingAttachments((prev) => [...prev, newAtt]);
            if (syncToGlobalLibrary && onSaveToGlobalAttachments) {
              onSaveToGlobalAttachments(newAtt);
            }
            ultraAudio.playChimeSFX();
          }
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (content !== undefined) {
            const newAtt: AiAttachment = {
              id: `att_doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              name: file.name,
              type: 'document',
              mimeType: file.type || 'text/plain',
              sizeBytes: file.size,
              content,
              description: `拖入/挂载的文本设定资料 (${Math.round(file.size / 1024)} KB)`,
              enabled: true,
              category: 'general',
              createdAt: new Date().toISOString(),
            };
            setPendingAttachments((prev) => [...prev, newAtt]);
            if (syncToGlobalLibrary && onSaveToGlobalAttachments) {
              onSaveToGlobalAttachments(newAtt);
            }
            ultraAudio.playChimeSFX();
          }
        };
        reader.readAsText(file, 'utf-8');
      }
    });
  }, [syncToGlobalLibrary, onSaveToGlobalAttachments]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToProcess: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          filesToProcess.push(file);
        }
      }
    }

    if (filesToProcess.length > 0) {
      processFiles(filesToProcess);
    }
  }, [processFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && pendingAttachments.length === 0) || isLoading) return;

    const textToSend = inputText.trim() || (pendingAttachments.length > 0 ? '【审讯官出示/挂载了多模态现场图片或设定参考资料】' : '');
    const attachmentsToSend = [...pendingAttachments];
    setInputText('');
    setPendingAttachments([]);
    ultraAudio.playUiClick();

    if (syncAttack && selectedWeapon && selectedPart && onExecuteAttack) {
      onExecuteAttack(selectedWeapon, selectedPart, undefined, textToSend);
    } else {
      await onSendChatMessage(textToSend, attachmentsToSend);
    }
  };

  const handleContinueStory = async () => {
    if (isLoading) return;
    ultraAudio.playUiClick();

    const textToSend = inputText.trim() || (pendingAttachments.length > 0 ? '【审讯官出示/挂载了多模态现场图片或设定参考资料】' : '（保持沉默，什么都不做，等待剧情进一步自然发展演化……）');
    const attachmentsToSend = [...pendingAttachments];
    setInputText('');
    setPendingAttachments([]);

    if (syncAttack && selectedWeapon && selectedPart && onExecuteAttack) {
      onExecuteAttack(selectedWeapon, selectedPart, undefined, textToSend);
    } else {
      await onSendChatMessage(textToSend, attachmentsToSend);
    }
  };

  // Show all chat and dialogue entries without folding or truncating
  const displayedEntries = entries;

  const maxHp = stats.maxHp || hero?.defaultStats?.maxHp || 100;
  const maxEnergy = stats.maxEnergy || hero?.defaultStats?.maxEnergy || 100;
  const maxMorale = stats.maxMorale || hero?.defaultStats?.maxMorale || 100;
  const maxObedience = stats.maxObedience || hero?.defaultStats?.maxObedience || 100;
  const maxShame = stats.maxShame || hero?.defaultStats?.maxShame || 100;
  const maxLust = stats.maxLust || hero?.defaultStats?.maxLust || 100;

  const hpPct = Math.round(Math.max(0, Math.min(100, (stats.hp / maxHp) * 100)));
  const energyPct = Math.round(Math.max(0, Math.min(100, (stats.energy / maxEnergy) * 100)));
  const moralePct = Math.round(Math.max(0, Math.min(100, (stats.morale / maxMorale) * 100)));
  const obediencePct = Math.round(Math.max(0, Math.min(100, (stats.obedience / maxObedience) * 100)));
  const shamePct = Math.round(Math.max(0, Math.min(100, ((stats.shame ?? 0) / maxShame) * 100)));
  const lustPct = Math.round(Math.max(0, Math.min(100, ((stats.lust ?? 10) / maxLust) * 100)));

  // Determine current state label
  const getStateBadge = () => {
    if (stats.hp <= 0) return { label: '休克死亡', color: 'text-zinc-500 border-zinc-700 bg-zinc-900' };
    if (energyPct > 50) return { label: `能量护盾正常(${energyPct}%)`, color: 'text-cyan-300 border-cyan-600 bg-cyan-950/60' };
    if (energyPct > 0) return { label: `护盾低能Warning(${energyPct}%)`, color: 'text-yellow-300 border-yellow-600 bg-yellow-950/60' };
    if (moralePct <= 20) return { label: '护盾破裂·意志绝望求饶', color: 'text-rose-400 border-rose-600 bg-rose-950/60' };
    if (obediencePct >= 70) return { label: '护盾破裂·深度归顺沉沦', color: 'text-fuchsia-300 border-fuchsia-600 bg-fuchsia-950/60' };
    return { label: '护盾破裂·全额肉体承受', color: 'text-rose-300 border-rose-700 bg-rose-950/60' };
  };

  const stateBadge = getStateBadge();

  // Energy shield mitigation percentage indicator
  const currentShieldAbsorptionPct = Math.round((energyPct / 100) * 75);

  const consoleContent = (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-zinc-950 rounded-lg border border-purple-900/50 p-3.5 text-zinc-100 flex flex-col space-y-3 shadow-[0_0_30px_rgba(168,85,247,0.15)] font-mono relative overflow-hidden transition-all duration-300 ${
        widthMode === 'full' ? 'w-full h-full max-h-[92vh]' : 'w-full'
      }`}
      style={widthMode === 'full' ? undefined : { height: `${consoleHeight}px` }}
    >
      {/* Background Subtle Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Multimodal Drag-and-Drop HUD Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-purple-950/90 backdrop-blur-sm border-2 border-dashed border-purple-400 rounded-lg flex flex-col items-center justify-center p-6 pointer-events-none animate-fadeIn">
          <div className="p-4 rounded-full bg-purple-900/70 border border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.6)] mb-3 animate-bounce">
            <Upload className="w-8 h-8 text-purple-300" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">
            松开鼠标即可挂载多模态图片或设定文档
          </h3>
          <p className="text-xs text-purple-200 text-center max-w-md">
            支持 PNG、JPG、WebP、GIF 等各类图片，以及 TXT、MD、JSON、CSV、PDF 等背景设定文档
          </p>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-2.5 shrink-0 z-10 gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded bg-purple-950/80 border border-purple-500/50 text-purple-300">
            <Terminal className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-wider text-purple-300 flex items-center gap-2">
              对话终端
              <span className={`px-2 py-0.5 text-[10px] rounded border font-bold ${stateBadge.color}`}>
                {stateBadge.label}
              </span>
              <span
                className="px-2 py-0.5 text-[10px] rounded border bg-indigo-950/80 border-indigo-500/50 text-indigo-200 font-bold flex items-center gap-1 shadow-sm"
                title={`当前天数与剧情阶段：第 ${dayCount} 天 (${currentStage?.name || '当前阶段'})\n阶段指导：${currentStage?.prompt || '进行中'}`}
              >
                <span>⏳ 第 {dayCount} 天</span>
                <span className="text-indigo-400 font-normal">| {currentStage?.name || '初期'}</span>
              </span>
              {activeMilestones.map((m) => (
                <span
                  key={m.id}
                  className="px-2 py-0.5 text-[10px] rounded border bg-amber-950/80 border-amber-500/60 text-amber-200 font-bold flex items-center gap-1 shadow-sm animate-pulse"
                  title={`🌟 重大事件节点：${m.name}\n${m.description || ''}\n对话指导：${m.dialogueGuidance || ''}`}
                >
                  <span>🌟 {m.name.split(' ')[0] || '重大节点'}</span>
                </span>
              ))}
            </h2>
            <p className="text-[10px] text-zinc-400">
              对象: <strong className="text-blue-300">{hero.name}</strong> ({hero.personality || '坚毅正义'}) | 弱点: <span className="text-amber-300">{hero.bodyParts[hero.weakPart]?.name}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onOpenRelationshipModal && (
            <button
              onClick={() => {
                ultraAudio.playUiClick();
                onOpenRelationshipModal();
              }}
              className="text-[10px] px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/60 text-rose-200 hover:text-white hover:bg-rose-900 font-bold flex items-center space-x-1 transition-all cursor-pointer shadow-[0_0_8px_rgba(244,63,94,0.2)]"
              title="关系/羁绊槽位管理：点击评定或切换纯爱/邪恶语气风格"
            >
              <Heart className="w-3 h-3 text-rose-400 animate-pulse" />
              <span>💞 关系: {activeRelationshipTitle}</span>
            </button>
          )}

          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 font-bold flex items-center space-x-1 hidden md:flex" title="AI模型已同步完整的历史打击与提问记忆，打击与对话保持同一时空维度">
            <span>🧠 记忆 ({entries.length}条)</span>
          </span>

          {aiConfig.enabled && aiConfig.apiKey ? (
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/60 text-purple-200 flex items-center space-x-1 font-bold hidden lg:flex" title={aiConfig.activeProviderName || String(aiConfig.provider)}>
              <Bot className="w-3 h-3 text-purple-400 animate-pulse" />
              <span className="max-w-[120px] truncate">{aiConfig.activeProviderName || String(aiConfig.provider).toUpperCase()}</span>
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 hidden lg:flex">
              内置记忆
            </span>
          )}

          {onTriggerRealTimeGreeting && (
            <button
              id="console-header-realtime-greeting-btn"
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                onTriggerRealTimeGreeting();
              }}
              disabled={isLoading}
              className="text-[10px] px-2 py-0.5 rounded bg-gradient-to-r from-purple-950/90 to-indigo-950/90 border border-purple-500/60 text-purple-200 hover:text-white hover:border-purple-400 font-bold flex items-center space-x-1 transition-all cursor-pointer shadow-[0_0_8px_rgba(168,85,247,0.3)] disabled:opacity-50"
              title={`点击立即根据当下现实时刻（${realTimeCtx.currentTimeStr} ${realTimeCtx.timePeriod}）触发 ${hero.name} 的时间感应问候`}
            >
              <Clock className="w-3 h-3 text-purple-400 animate-pulse" />
              <span>⏱️ 感应问候 ({realTimeCtx.timePeriod})</span>
            </button>
          )}

          {/* 🔤 对话字号调控 Widget */}
          <div className="flex items-center space-x-1 bg-zinc-900 border border-purple-900/60 rounded px-1.5 py-0.5 text-[10px] text-purple-200 shadow-sm" title="自定义对话与审讯台词字体大小">
            <Type className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                changeFontSize(fontSize - 1);
              }}
              className="w-4 h-4 rounded bg-zinc-800 hover:bg-purple-900 text-purple-200 font-bold flex items-center justify-center cursor-pointer transition-all border border-zinc-700 hover:border-purple-500"
              title="缩小字体 (-1px)"
            >
              -
            </button>
            <span className="font-mono text-purple-300 font-bold w-5 text-center">{fontSize}p</span>
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                changeFontSize(fontSize + 1);
              }}
              className="w-4 h-4 rounded bg-zinc-800 hover:bg-purple-900 text-purple-200 font-bold flex items-center justify-center cursor-pointer transition-all border border-zinc-700 hover:border-purple-500"
              title="放大字体 (+1px)"
            >
              +
            </button>
          </div>

          {/* 📏 高度调控 Widget (自定义加长加大) */}
          <div className="flex items-center space-x-1 bg-zinc-900 border border-indigo-900/60 rounded px-1.5 py-0.5 text-[10px] text-indigo-200 shadow-sm" title="自定义对话框加长/高度 (400px - 1200px)">
            <MoveVertical className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                changeConsoleHeight(consoleHeight - 50);
              }}
              className="w-4 h-4 rounded bg-zinc-800 hover:bg-indigo-900 text-indigo-200 font-bold flex items-center justify-center cursor-pointer transition-all border border-zinc-700 hover:border-indigo-500"
              title="减小高度 (-50px)"
            >
              -
            </button>
            <span className="font-mono text-indigo-300 font-bold px-0.5 min-w-[38px] text-center">{consoleHeight}p</span>
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                changeConsoleHeight(consoleHeight + 50);
              }}
              className="w-4 h-4 rounded bg-zinc-800 hover:bg-indigo-900 text-indigo-200 font-bold flex items-center justify-center cursor-pointer transition-all border border-zinc-700 hover:border-indigo-500"
              title="增加高度 (+50px)"
            >
              +
            </button>
          </div>

          {/* ↔️ 宽度模式切换 Widget */}
          <div className="flex items-center bg-zinc-900 border border-purple-900/60 rounded p-0.5 text-[10px] space-x-0.5">
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                changeWidthMode('normal');
              }}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold ${
                widthMode === 'normal'
                  ? 'bg-purple-900 text-purple-100 border border-purple-500/50 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="标准列宽"
            >
              7列
            </button>
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                changeWidthMode('wide');
              }}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold ${
                widthMode === 'wide'
                  ? 'bg-indigo-900 text-indigo-100 border border-indigo-500/50 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="12列全宽拓宽对话框"
            >
              12列拓宽
            </button>
            <button
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                changeWidthMode(widthMode === 'full' ? 'normal' : 'full');
              }}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold flex items-center space-x-1 ${
                widthMode === 'full'
                  ? 'bg-rose-900 text-rose-100 border border-rose-500/60 animate-pulse shadow-sm'
                  : 'text-zinc-400 hover:text-rose-300'
              }`}
              title={widthMode === 'full' ? '退出全屏' : '沉浸全屏大屏对话'}
            >
              {widthMode === 'full' ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              <span>{widthMode === 'full' ? '退出' : '全屏'}</span>
            </button>
          </div>

          {/* 🧠 AI 思维链显示模式切换 Widget */}
          <div className="flex items-center bg-zinc-900 border border-indigo-900/60 rounded p-0.5 text-[10px] space-x-0.5">
            <span className="text-[9px] text-indigo-400 font-bold px-1 flex items-center space-x-0.5">
              <Brain className="w-3 h-3 text-indigo-400" />
              <span className="hidden sm:inline">思维链:</span>
            </span>
            <button
              type="button"
              onClick={() => changeThinkingDisplayMode('hidden')}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold ${
                thinkingDisplayMode === 'hidden'
                  ? 'bg-zinc-800 text-zinc-200 border border-zinc-600 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="完全隐藏 AI 深度思考推理链"
            >
              隐藏
            </button>
            <button
              type="button"
              onClick={() => changeThinkingDisplayMode('collapsed')}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold ${
                thinkingDisplayMode === 'collapsed'
                  ? 'bg-indigo-900 text-indigo-100 border border-indigo-500/60 shadow-sm'
                  : 'text-zinc-400 hover:text-indigo-300'
              }`}
              title="以可折叠卡片展示（点击展开/收起）"
            >
              折叠
            </button>
            <button
              type="button"
              onClick={() => changeThinkingDisplayMode('expanded')}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold ${
                thinkingDisplayMode === 'expanded'
                  ? 'bg-purple-800 text-purple-100 border border-purple-400 shadow-sm animate-pulse'
                  : 'text-zinc-400 hover:text-purple-300'
              }`}
              title="全部默认直接展开展示完整思维链"
            >
              展开
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              onClearConsole();
            }}
            title="清空终端记录"
            className="text-zinc-500 hover:text-rose-400 p-1.5 rounded hover:bg-zinc-900 transition-all cursor-pointer ml-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ⚡ 属性满足后，在页面中增加“成为这种关系”的切换按钮 */}
      {satisfiedSlots.length > 0 && (
        <div className="bg-gradient-to-r from-purple-950/90 via-pink-950/80 to-zinc-900 border border-purple-500/60 p-2.5 rounded-lg my-2 shadow-[0_0_15px_rgba(168,85,247,0.25)] flex flex-wrap items-center justify-between gap-2 shrink-0 animate-fadeIn z-10">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40 animate-pulse">
              <Heart className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-pink-200 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>属性与数值契合度达成！</span>
              </div>
              <p className="text-[10px] text-zinc-300">
                当前属性满足判定条件，点击按钮即可在页面一键确立对应羁绊关系
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {satisfiedSlots.map((slot) => {
              const isCurrent = activeRelationship && slot.id === activeRelationship.id;
              const theme = getRelationshipCategoryTheme(slot.category);
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => {
                    if (isCurrent) return;
                    ultraAudio.playChimeSFX();
                    if (onSwitchRelationship) {
                      onSwitchRelationship(slot);
                    }
                  }}
                  disabled={isCurrent}
                  title={isCurrent ? '当前已激活的关系' : `点击直接在页面确立关系为【${slot.title}】：${slot.description}`}
                  className={`px-3 py-1.5 rounded text-xs font-bold flex items-center space-x-1.5 transition-all ${
                    isCurrent
                      ? 'bg-zinc-800/90 text-purple-300 border border-purple-500/40 opacity-80 cursor-default'
                      : 'bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white border border-pink-300 shadow-[0_0_12px_rgba(236,72,153,0.5)] animate-bounce cursor-pointer hover:scale-105'
                  }`}
                >
                  <span>{theme.icon}</span>
                  <span>{isCurrent ? `当前已是: ${slot.title}` : `成为【${slot.title}】`}</span>
                  {!isCurrent && <Sparkles className="w-3 h-3 text-amber-300" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Integrated Left Durability Bars HUD */}
      <div className="bg-gradient-to-r from-zinc-900/90 via-purple-950/40 to-zinc-900/90 p-2 rounded border border-purple-900/40 text-[11px] shrink-0 z-10 flex flex-wrap items-center justify-between gap-2 shadow-inner">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1 font-bold text-rose-400">
            <Activity className="w-3.5 h-3.5" />
            <span>HP: {hpPct}%</span>
          </span>
          <span className="flex items-center space-x-1 font-bold text-cyan-300">
            <Shield className="w-3.5 h-3.5" />
            <span>护盾能量: {energyPct}%</span>
          </span>
          <span className="flex items-center space-x-1 font-bold text-amber-300">
            <Zap className="w-3.5 h-3.5" />
            <span>意志: {moralePct}%</span>
          </span>
          <span className="flex items-center space-x-1 font-bold text-blue-400">
            <User className="w-3.5 h-3.5" />
            <span>信任: {obediencePct}%</span>
          </span>
          <span className="flex items-center space-x-1 font-bold text-fuchsia-300">
            <Flame className="w-3.5 h-3.5" />
            <span>羞耻: {shamePct}%</span>
          </span>
          <span className="flex items-center space-x-1 font-bold text-rose-300">
            <Heart className="w-3.5 h-3.5" />
            <span>欲望: {lustPct}%</span>
          </span>
        </div>

        <div className="text-[10px] text-cyan-300/90 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40 font-bold">
          🛡️ 护盾吸收率: {currentShieldAbsorptionPct}% 伤害减免
        </div>
      </div>

      {/* Stream Entries Container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin z-10">
        {entries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-xs space-y-2">
            <Terminal className="w-8 h-8 text-purple-950/80 animate-pulse" />
            <p className="text-center">综合战术控制终端已准备就绪。<br />执行右侧打击武器，或在下方输入审讯台词与 <strong className="text-purple-400">{hero.name}</strong> 实时对话。</p>
          </div>
        ) : (
          entries.map((entry) => (
            <ConsoleEntryCard
              key={entry.id}
              entry={entry}
              heroName={hero.name}
              interrogatorIdentity={interrogatorIdentity || '审讯官'}
              fontSize={fontSize}
              thinkingDisplayMode={thinkingDisplayMode}
              onPreviewAttachment={setPreviewModalAttachment}
            />
          ))
        )}

        {isLoading && (
          <div className="flex items-center space-x-2 text-xs text-purple-400 bg-purple-950/40 p-2.5 rounded-lg border border-purple-500/30 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-300" />
            <span>【{hero.name} 思考中】准备回应...</span>
          </div>
        )}
      </div>

      {/* AI Context-Aware Auto-Reply Suggestions Bar (Collapsible / On-demand Only) */}
      {showAutoReply && (
        <div className="flex flex-col space-y-1 bg-gradient-to-r from-purple-950/40 via-zinc-900/60 to-indigo-950/40 p-1.5 rounded-lg border border-purple-900/40 shrink-0 z-10 animate-fade-in">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center space-x-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-purple-300">AI 智能应答建议 (Auto-Reply):</span>
              <span className="text-zinc-500 font-mono text-[9px] hidden sm:inline">承接最近对话 · 贴合当前关系与场景</span>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => loadSuggestions(true)}
                disabled={isLoadingSuggestions}
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-purple-300 border border-zinc-700 text-[9px] font-mono cursor-pointer transition-colors disabled:opacity-50"
                title="换一批：基于最近对话重新生成，并自动避开重复内容"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isLoadingSuggestions ? 'animate-spin text-amber-400' : 'text-purple-400'}`} />
                <span>{isLoadingSuggestions ? '生成中...' : '换一批'}</span>
              </button>

              <button
                type="button"
                onClick={toggleAutoReply}
                className="flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 text-[9px] cursor-pointer"
                title="收起智能应答建议"
              >
                <X className="w-2.5 h-2.5" />
                <span>关闭</span>
              </button>
            </div>
          </div>

          {/* 承接锚点：让用户一眼看出这次建议是接着哪一句生成的 */}
          {!isLoadingSuggestions && suggestionAnchor && (
            <div className="text-[9px] text-zinc-500 font-mono px-0.5 truncate" title={`本次建议承接的是女战士最后一句：${suggestionAnchor}`}>
              ↳ 承接她刚才的话：<span className="text-zinc-400">“{suggestionAnchor}”</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {isLoadingSuggestions && suggestions.length === 0
              ? [0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col p-1.5 rounded bg-zinc-900/60 border border-zinc-800 animate-pulse min-h-[64px]">
                    <div className="h-2.5 w-16 bg-zinc-700/70 rounded mb-2" />
                    <div className="h-2 w-full bg-zinc-800 rounded mb-1" />
                    <div className="h-2 w-4/5 bg-zinc-800 rounded" />
                  </div>
                ))
              : suggestions.map((sugg) => (
              <button
                key={sugg.id}
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  setInputText(sugg.text);
                }}
                title={sugg.text}
                className="flex flex-col text-left p-1.5 rounded bg-zinc-900/90 hover:bg-purple-950/80 border border-zinc-800 hover:border-purple-500/80 transition-all cursor-pointer group shadow-sm"
              >
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="font-bold text-amber-300 flex items-center space-x-1">
                    <span>{sugg.category === 'dominant' ? '👑' : sugg.category === 'psychological' ? '🔮' : '⚡'}</span>
                    <span>{sugg.tag}</span>
                  </span>
                  {sugg.tone && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800/80 text-zinc-400 group-hover:text-purple-300 font-mono">
                      {sugg.tone}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-300 group-hover:text-purple-100 leading-relaxed font-sans whitespace-pre-wrap">
                  {sugg.text}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Universal Dialogue & Story Prompts */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 text-[10px] no-scrollbar shrink-0 z-10">
        {onTriggerRealTimeGreeting && (
          <button
            id="chat-quick-realtime-greeting-btn"
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              onTriggerRealTimeGreeting();
            }}
            disabled={isLoading}
            title={`根据当前现实时间【${realTimeCtx.currentTimeStr} (${realTimeCtx.timePeriodDetail})】触发 ${hero.name} 的即时陪伴心声与真实时段问候`}
            className="px-2.5 py-0.5 rounded border border-purple-500/70 bg-gradient-to-r from-purple-950 via-indigo-950 to-purple-950 hover:from-purple-900 hover:to-indigo-900 text-purple-200 hover:text-white font-bold text-[10px] flex items-center space-x-1 cursor-pointer transition-all shrink-0 shadow-[0_0_10px_rgba(168,85,247,0.3)] disabled:opacity-50"
          >
            <Clock className="w-3 h-3 text-purple-400 animate-pulse" />
            <span>🗣️ 感应问候</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-purple-900/80 text-purple-300 font-normal">
              {realTimeCtx.timePeriod}
            </span>
          </button>
        )}

        {/* Toggle Auto-Reply Suggestions on demand */}
        <button
          type="button"
          onClick={toggleAutoReply}
          className={`px-2 py-0.5 rounded border text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition-all shrink-0 ${
            showAutoReply
              ? 'bg-purple-900 text-purple-100 border-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
              : 'bg-zinc-900 hover:bg-purple-950/70 text-zinc-400 hover:text-purple-300 border-zinc-800 hover:border-purple-600/50'
          }`}
          title="点击开启/关闭 AI 智能应答建议（平时不开启，仅在需要时点击展开）"
        >
          <Sparkles className={`w-3 h-3 ${showAutoReply ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}`} />
          <span>{showAutoReply ? '✨ 智能建议: 开' : '💡 智能建议'}</span>
        </button>

        <div className="flex items-center space-x-1 shrink-0">
          <span className="text-zinc-400 font-bold shrink-0">通用/剧情口令:</span>
          {/* Category Dropdown Toggle */}
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setShowCategorySelector(!showCategorySelector)}
              className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 hover:border-purple-400 text-purple-300 text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition-colors"
              title="切换预设类别"
            >
              <Layers className="w-2.5 h-2.5 text-purple-400" />
              <span>
                {activePromptCategory === 'all'
                  ? '全部通用'
                  : UNIVERSAL_PROMPT_GROUPS.find((g) => g.id === activePromptCategory)?.name || '预设'}
              </span>
            </button>

            {showCategorySelector && (
              <div className="absolute left-0 bottom-full mb-1 z-30 bg-zinc-950 border border-purple-500/60 rounded shadow-xl p-1 w-32 flex flex-col space-y-0.5 animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    setActivePromptCategory('all');
                    setShowCategorySelector(false);
                  }}
                  className={`text-left px-2 py-1 rounded text-[10px] transition-colors cursor-pointer ${
                    activePromptCategory === 'all'
                      ? 'bg-purple-900/60 text-purple-200 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  ✨ 全部通用精选
                </button>
                {UNIVERSAL_PROMPT_GROUPS.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      setActivePromptCategory(group.id);
                      setShowCategorySelector(false);
                    }}
                    className={`text-left px-2 py-1 rounded text-[10px] transition-colors cursor-pointer flex items-center space-x-1 ${
                      activePromptCategory === group.id
                        ? 'bg-purple-900/60 text-purple-200 font-bold'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <span>{group.icon}</span>
                    <span>{group.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleContinueStory}
          disabled={isLoading}
          className="px-2 py-0.5 rounded border border-emerald-600/60 bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 hover:border-emerald-400 whitespace-nowrap transition-all cursor-pointer font-bold flex items-center space-x-1 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.2)] disabled:opacity-50"
        >
          <FastForward className="w-3 h-3 text-emerald-300" />
          <span>⏩ 静观其变·继续剧情</span>
        </button>

        {displayedPrompts.map((quickText, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              setInputText(quickText);
            }}
            title={quickText}
            className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:text-purple-200 hover:border-purple-500/60 whitespace-nowrap transition-all cursor-pointer font-mono"
          >
            💬 {quickText.length > 14 ? `${quickText.substring(0, 14)}...` : quickText}
          </button>
        ))}
      </div>

      {/* Equipped Weapon Status & Sync Attack Toggle Bar */}
      {selectedWeapon && (
        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] bg-zinc-900/80 px-2 py-1 rounded border border-purple-900/40 shrink-0 z-10 font-mono">
          <div className="flex items-center space-x-1.5 text-zinc-300 flex-wrap">
            <span className="text-zinc-500 font-bold shrink-0">就绪武器:</span>
            <span className="font-bold text-blue-300">【{selectedWeapon.name}】</span>
            <span className="text-zinc-500 font-bold shrink-0">➔ 锁定:</span>
            <span className="font-bold text-amber-300">{hero.bodyParts[selectedPart || 'timer']?.name || '能量核心'}</span>
          </div>

          <button
            type="button"
            onClick={() => setSyncAttack(!syncAttack)}
            title="开启后，在下方发送台词将同步对当前部位发动该武器的打击效果！"
            className={`px-2 py-0.5 rounded border text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
              syncAttack
                ? 'bg-amber-950 border-amber-500 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.4)] animate-pulse'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-purple-300 hover:border-purple-500/50'
            }`}
          >
            <Zap className={`w-3 h-3 ${syncAttack ? 'text-amber-300' : 'text-zinc-500'}`} />
            <span>{syncAttack ? '⚡ 模式: 发送台词同步触发【武器物理打击】' : '点击开启: 发送台词同步触发【物理打击】'}</span>
          </button>
        </div>
      )}

      {/* Hidden File Input for images and documents */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt,.md,.json,.csv,.yaml,.yml,.xml,.pdf,.js,.ts,.html,.log"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            processFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Pending Multimodal Attachments Tray */}
      {pendingAttachments.length > 0 && (
        <div className="bg-purple-950/40 border border-purple-500/40 rounded-lg p-2 flex flex-col space-y-1.5 shrink-0 z-10 animate-fadeIn">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1.5 font-bold text-purple-300">
              <Paperclip className="w-3.5 h-3.5 text-purple-400" />
              <span>当前发言挂载附件 ({pendingAttachments.length})</span>
              <span className="text-[10px] text-zinc-400 font-normal hidden sm:inline">（将伴随本次发言一并送入AI多模态大模型）</span>
            </div>
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-1 text-[10px] text-purple-300 hover:text-purple-200 cursor-pointer select-none" title="勾选后，添加的附件将同时同步持久化保存在AI全局资料库中">
                <input
                  type="checkbox"
                  checked={syncToGlobalLibrary}
                  onChange={(e) => setSyncToGlobalLibrary(e.target.checked)}
                  className="rounded border-purple-500/50 bg-zinc-900 text-purple-600 focus:ring-0 w-3 h-3 cursor-pointer"
                />
                <span>⭐ 同步存入全局库</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-purple-400 hover:text-purple-200 hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> 继续添加
              </button>
              <button
                type="button"
                onClick={() => setPendingAttachments([])}
                className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <Trash2 className="w-3 h-3" /> 清空
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-0.5">
            {pendingAttachments.map((att) => (
              <div
                key={att.id}
                className="group relative flex items-center space-x-1.5 bg-zinc-900/90 hover:bg-zinc-800 border border-purple-500/50 hover:border-purple-400 rounded-lg px-2 py-1 transition-all shadow-sm max-w-[260px]"
              >
                {att.type === 'image' ? (
                  <div
                    className="w-6 h-6 rounded overflow-hidden cursor-pointer border border-purple-500/50 shrink-0"
                    onClick={() => setPreviewModalAttachment(att)}
                    title="点击放大预览"
                  >
                    <img src={att.content} alt={att.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <FileText className="w-4 h-4 text-cyan-400 shrink-0 cursor-pointer" onClick={() => setPreviewModalAttachment(att)} />
                )}

                <div
                  className="flex flex-col min-w-0 flex-1 cursor-pointer"
                  onClick={() => setPreviewModalAttachment(att)}
                  title={`点击查看: ${att.name}`}
                >
                  <span className="text-[11px] font-medium text-zinc-200 truncate">{att.name}</span>
                  <span className="text-[9px] text-zinc-400">
                    {att.type === 'image' ? '多模态图片' : '设定文档'} · {att.sizeBytes ? `${Math.round(att.sizeBytes / 1024)} KB` : `${att.content.length} 字`}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setPendingAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                  className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-700 cursor-pointer shrink-0 transition-colors"
                  title="移除此附件"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Chat Input Form with Multi-line, Multimodal and Long Text Support */}
      <form onSubmit={handleSend} className="flex flex-col space-y-1.5 shrink-0 z-10">
        <div className="flex items-end space-x-2">
          <div className="flex-1 relative flex items-center bg-zinc-900 border border-purple-900/60 rounded-lg focus-within:border-purple-500 transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                // 中文输入法组词中（拼音候选还没确认）时，Enter 只用于选词，绝不能发送
                if ((e.nativeEvent as any)?.isComposing || (e as any).keyCode === 229) return;
                if (enterSendMode === 'enter') {
                  // Enter 直接发送；Shift+Enter 交给浏览器插入换行
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                  return;
                }
                // Ctrl+Enter / Cmd+Enter 发送；Enter 换行
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`对 ${hero.name} 发言对话、质问或诱导台词... 可直接粘贴截图或拖入文件 (${enterSendMode === 'enter' ? 'Enter发送, Shift+Enter换行' : 'Ctrl+Enter发送, Enter换行'})`}
              disabled={isLoading}
              className="w-full bg-transparent px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none font-mono resize-none leading-relaxed min-h-[38px] max-h-[160px] overflow-y-auto"
            />

            {/* Quick Actions inside input box */}
            <div className="flex items-center space-x-1 pr-2 pb-1.5 self-end shrink-0">
              {inputText.length > 0 && (
                <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline" title="当前输入字符数">
                  {inputText.length}字
                </span>
              )}

              {/* Attachment File Trigger */}
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  fileInputRef.current?.click();
                }}
                className="p-1 rounded text-purple-400 hover:text-purple-200 hover:bg-purple-950/80 transition-all cursor-pointer flex items-center gap-0.5 border border-purple-900/50"
                title="挂载多模态图片或设定文档 (支持本地文件选择或直接拖入/截图粘贴)"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>

              {/* Image Input Trigger */}
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsManualImgModalOpen(true);
                }}
                className="p-1 rounded text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/80 transition-all cursor-pointer flex items-center gap-0.5 border border-cyan-900/50"
                title="输入网络图片URL或多模态图像"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>

              {/* Text Doc Creator Trigger */}
              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsManualDocModalOpen(true);
                }}
                className="p-1 rounded text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950/80 transition-all cursor-pointer flex items-center gap-0.5 border border-emerald-900/50"
                title="手动创建/粘贴文本设定参考文档"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>

              {/* Character Independent Web Search Quick Toggle */}
              {onToggleWebSearch && (
                <button
                  type="button"
                  id="console-quick-web-search-toggle-btn"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    onToggleWebSearch();
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer flex items-center gap-1 border ${
                    hero.webSearchEnabled
                      ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border-zinc-800'
                  }`}
                  title={
                    hero.webSearchEnabled
                      ? `【${hero.name}】独立 AI 联网搜索已开启 (${hero.searchEngine || 'google'}) - 点击快速关闭`
                      : `【${hero.name}】独立 AI 联网搜索未开启 - 点击快速启用`
                  }
                >
                  <Globe className={`w-3 h-3 ${hero.webSearchEnabled ? 'text-cyan-400 animate-pulse' : 'text-zinc-500'}`} />
                  <span className="hidden sm:inline">
                    {hero.webSearchEnabled ? '联网开' : '联网关'}
                  </span>
                </button>
              )}

              {/* Character Independent Search Engine Quick Switcher */}
              {onChangeSearchEngine && (
                <div className="relative">
                  <button
                    type="button"
                    id="console-quick-engine-selector-btn"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setIsEngineDropdownOpen((prev) => !prev);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer flex items-center gap-1 border ${
                      hero.webSearchEnabled
                        ? 'bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 border-cyan-500/50 shadow-sm'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-800'
                    }`}
                    title={`当前搜索引擎: ${ENGINE_ITEMS.find((e) => e.id === (hero.searchEngine || 'google'))?.label} - 点击切换`}
                  >
                    <span>{ENGINE_ITEMS.find((e) => e.id === (hero.searchEngine || 'google'))?.icon || '🌐'}</span>
                    <span className="hidden sm:inline font-bold">
                      {ENGINE_ITEMS.find((e) => e.id === (hero.searchEngine || 'google'))?.label.split(' ')[0] || 'Google'}
                    </span>
                    <ChevronDown className="w-2.5 h-2.5 text-zinc-400" />
                  </button>

                  {/* Dropdown Menu */}
                  {isEngineDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsEngineDropdownOpen(false)}
                      />
                      <div className="absolute bottom-full mb-1 left-0 z-50 bg-zinc-950 border border-cyan-500/60 rounded-xl p-1.5 shadow-2xl min-w-[155px] space-y-1 backdrop-blur-md animate-fadeIn">
                        <div className="px-2 py-1 text-[9px] font-bold text-cyan-400 border-b border-zinc-800 flex items-center justify-between">
                          <span>切换搜索引擎</span>
                          <span className="text-zinc-500 font-normal">点击即换</span>
                        </div>
                        {ENGINE_ITEMS.map((item) => {
                          const isSelected = (hero.searchEngine || 'google') === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                ultraAudio.playUiClick();
                                onChangeSearchEngine(item.id);
                                setIsEngineDropdownOpen(false);
                              }}
                              className={`w-full px-2 py-1.5 rounded-lg text-left text-[11px] font-medium transition-all flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'bg-cyan-950 text-cyan-200 border border-cyan-500/50 font-bold'
                                  : 'hover:bg-zinc-900 text-zinc-300 hover:text-white'
                              }`}
                            >
                              <span className="flex items-center space-x-1.5">
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                              </span>
                              {isSelected && <Check className="w-3 h-3 text-cyan-400" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {inputText.length > 0 && (
                <button
                  type="button"
                  onClick={() => setInputText('')}
                  className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-all cursor-pointer"
                  title="清空当前输入"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  ultraAudio.playUiClick();
                  setIsExpandedEditorOpen(true);
                }}
                className="p-1 rounded text-purple-400 hover:text-purple-200 hover:bg-purple-950/80 transition-all cursor-pointer flex items-center gap-0.5 border border-purple-900/50"
                title="展开全景大屏多行文本编辑器 (适合输入长篇剧情、多角色剧本或设定)"
              >
                <Expand className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {onTriggerRealTimeGreeting && (
            <button
              id="chat-bottom-realtime-greeting-btn"
              type="button"
              onClick={() => {
                ultraAudio.playUiClick();
                onTriggerRealTimeGreeting();
              }}
              disabled={isLoading}
              title={`【现实时间动态感应问候】根据当前现实时间（${realTimeCtx.currentTimeStr} ${realTimeCtx.timePeriod}）让 ${hero.name} 立即感应并发表现实生活感的心声对白`}
              className="px-3.5 py-2.5 rounded-lg bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-700 hover:from-purple-600 hover:to-indigo-600 border border-purple-400 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] disabled:opacity-50 cursor-pointer shrink-0 h-[38px] hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
              <span>感应问候</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleContinueStory}
            disabled={isLoading}
            title="保持沉默或无动作，直接推进后续剧情与自然反应"
            className="px-3.5 py-2.5 rounded-lg bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 border border-teal-500 text-teal-100 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)] disabled:opacity-50 cursor-pointer shrink-0 h-[38px]"
          >
            <FastForward className="w-3.5 h-3.5 text-teal-300" />
            <span>继续剧情</span>
          </button>
          <button
            type="submit"
            disabled={(!inputText.trim() && pendingAttachments.length === 0) || isLoading}
            className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 border border-purple-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50 cursor-pointer shrink-0 h-[38px]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>发送台词</span>
          </button>
        </div>

        {/* Input Assistant Bar */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1">
          <div className="flex items-center space-x-2">
            <span>发送快捷键:</span>
            <button
              type="button"
              onClick={() => setEnterSendMode(enterSendMode === 'enter' ? 'ctrlEnter' : 'enter')}
              className="text-purple-400 hover:underline cursor-pointer font-bold"
            >
              {enterSendMode === 'enter' ? '⚡ Enter 直接发送 (Shift+Enter 换行)' : '⌨️ Ctrl+Enter 发送 (Enter 直接换行)'}
            </button>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400 flex items-center gap-1">
              <Upload className="w-3 h-3 text-purple-400" /> 支持图片/文档直接拖入或截图粘贴
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              setIsExpandedEditorOpen(true);
            }}
            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer font-bold"
          >
            <Edit3 className="w-3 h-3" />
            <span>长篇剧本/大段文本编辑模式</span>
          </button>
        </div>
      </form>

      {/* Expanded Multi-line Text & Scenario Editor Modal */}
      {isExpandedEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-zinc-950 border border-purple-500/70 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-[0_0_50px_rgba(168,85,247,0.3)] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/90">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-purple-950 border border-purple-500 text-purple-300">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">长篇剧本 & 自定义超长剧情发言编辑器</h3>
                  <p className="text-xs text-zinc-400">支持输入超长文本、多段落剧情描写与多角色对白，支持挂载多模态图片和设定文档</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpandedEditorOpen(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 flex-1 flex flex-col space-y-3 overflow-y-auto">
              {/* Attachments within Expanded Modal */}
              {pendingAttachments.length > 0 && (
                <div className="bg-purple-950/40 border border-purple-500/40 rounded-lg p-2 flex flex-col space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-purple-300 flex items-center gap-1">
                      <Paperclip className="w-3.5 h-3.5" /> 已挂载多模态附件 ({pendingAttachments.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[10px] text-purple-400 hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> 添加更多
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pendingAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center space-x-1.5 bg-zinc-900 border border-purple-500/50 rounded-lg px-2 py-1 max-w-[240px]"
                      >
                        {att.type === 'image' ? (
                          <img src={att.content} alt={att.name} className="w-5 h-5 rounded object-cover" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                        <span className="text-[11px] text-zinc-200 truncate flex-1">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => setPendingAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                          className="text-zinc-500 hover:text-rose-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center space-x-2">
                  <span>对 <strong>{hero.name}</strong> 的发言/长篇指示:</span>
                  <span className="text-purple-300 font-mono font-bold">[{inputText.length} 字符]</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/50 text-purple-200 text-[11px] cursor-pointer flex items-center gap-1"
                  >
                    <Paperclip className="w-3 h-3" /> 挂载文件/图片
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setInputText((prev) => (prev ? `${prev}\n【剧情环境指示】：` : '【剧情环境指示】：'));
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] cursor-pointer"
                  >
                    + 插入环境描写
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setInputText((prev) => (prev ? `${prev}\n【${interrogatorIdentity}】：“` : `【${interrogatorIdentity}】：“`));
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] cursor-pointer"
                  >
                    + 插入台词格式
                  </button>
                </div>
              </div>

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPaste={handlePaste}
                placeholder="在此输入您的长篇剧情、背景铺垫、复杂提问、多角色对话或详细的战术指引……\n所有内容都将完整送入 AI 模型并保持完整语义读取，支持换行和任意标点，支持直接粘贴截图或拖入文件。"
                rows={12}
                className="w-full flex-1 bg-zinc-900/90 border border-purple-900/80 rounded-xl p-3.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 font-mono leading-relaxed resize-none shadow-inner"
              />

              {/* Quick Preset Long Story Snippets */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-zinc-500">常用长文开头:</span>
                {[
                  '（环顾四周昏暗的基地，缓步走到受控的目标面前，语气冰冷而充满压迫感）',
                  '【基地警报鸣响】“放弃吧，你们所属的防卫舰队已经被全域拦截，现在只有我能决定你的去留。”',
                  '（启动高能监测光幕，细致扫描其全身受损与能量衰竭状态）“让我看看，你引以为傲的战躯还能撑多久。”',
                ].map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setInputText((prev) => (prev ? `${prev}\n${s}` : s));
                    }}
                    className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-purple-500 text-zinc-400 hover:text-purple-200 cursor-pointer text-[10px]"
                  >
                    📝 {s.substring(0, 16)}...
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-zinc-800 bg-zinc-900/90">
              <button
                type="button"
                onClick={() => setInputText('')}
                disabled={!inputText}
                className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-rose-950 hover:text-rose-300 text-zinc-400 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
              >
                清空文本
              </button>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsExpandedEditorOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                >
                  保留并返回
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsExpandedEditorOpen(false);
                    await handleSend();
                  }}
                  disabled={(!inputText.trim() && pendingAttachments.length === 0) || isLoading}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 border border-purple-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>立即发送全部内容与附件</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Fullscreen Preview Lightbox Modal */}
      {previewModalAttachment && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-zinc-950 border border-purple-500/70 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(168,85,247,0.4)] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/90">
              <div className="flex items-center space-x-2">
                {previewModalAttachment.type === 'image' ? (
                  <ImageIcon className="w-5 h-5 text-purple-400" />
                ) : (
                  <FileText className="w-5 h-5 text-blue-400" />
                )}
                <div>
                  <h3 className="font-bold text-white text-sm">{previewModalAttachment.name}</h3>
                  <p className="text-xs text-zinc-400">
                    {previewModalAttachment.type === 'image' ? '多模态视觉图像' : '设定参考文档'} · {previewModalAttachment.sizeBytes ? `${Math.round(previewModalAttachment.sizeBytes / 1024)} KB` : `${previewModalAttachment.content.length} 字符`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalAttachment(null)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto flex flex-col items-center justify-center">
              {previewModalAttachment.type === 'image' ? (
                <div className="max-h-[60vh] max-w-full rounded-lg overflow-hidden border border-zinc-800 shadow-2xl bg-black">
                  <img
                    src={previewModalAttachment.content}
                    alt={previewModalAttachment.name}
                    className="max-h-[60vh] max-w-full object-contain mx-auto"
                  />
                </div>
              ) : (
                <div className="w-full h-full max-h-[60vh] bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 overflow-y-auto font-mono text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {previewModalAttachment.content}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 border-t border-zinc-800 bg-zinc-900/90 text-xs">
              <div className="flex items-center space-x-2">
                {onSaveToGlobalAttachments && (
                  <button
                    type="button"
                    onClick={() => {
                      onSaveToGlobalAttachments(previewModalAttachment);
                      ultraAudio.playChimeSFX();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-500/60 text-purple-200 font-bold flex items-center space-x-1 cursor-pointer transition-all"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>存入全局AI挂载库</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(previewModalAttachment.content);
                    ultraAudio.playUiClick();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center space-x-1 cursor-pointer transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>复制{previewModalAttachment.type === 'image' ? 'Base64/URL' : '文本内容'}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalAttachment(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold cursor-pointer transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Document Creator Modal */}
      {isManualDocModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-zinc-950 border border-emerald-500/70 rounded-2xl w-full max-w-2xl flex flex-col shadow-[0_0_50px_rgba(16,185,129,0.3)] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/90">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">创建/粘贴设定参考文档</h3>
                  <p className="text-xs text-zinc-400">文档内容将作为高权重战术与设定参考注入本次对话上下文</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualDocModalOpen(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex flex-col space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">文档名称:</label>
                <input
                  type="text"
                  value={manualDocName}
                  onChange={(e) => setManualDocName(e.target.value)}
                  placeholder="例如: 战术分析报告.txt / 身体核心弱点档案.md"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">简要描述 (可选):</label>
                <input
                  type="text"
                  value={manualDocDesc}
                  onChange={(e) => setManualDocDesc(e.target.value)}
                  placeholder="例如: 记录了目标在不同能量阶段的心理抗拒变化"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">文档正文内容:</label>
                <textarea
                  value={manualDocContent}
                  onChange={(e) => setManualDocContent(e.target.value)}
                  rows={8}
                  placeholder="在此直接粘贴或输入设定文档、背景故事、世界观规则或多角色对白台本……"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 p-4 border-t border-zinc-800 bg-zinc-900/90">
              <button
                type="button"
                onClick={() => setIsManualDocModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!manualDocContent.trim()) return;
                  const newAtt: AiAttachment = {
                    id: `att_doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    name: manualDocName.trim() || `设定文档_${new Date().toLocaleTimeString('zh-CN', { hour12: false })}.txt`,
                    type: 'document',
                    mimeType: 'text/plain',
                    sizeBytes: manualDocContent.length,
                    content: manualDocContent,
                    description: manualDocDesc.trim() || '手动输入的设定文档',
                    enabled: true,
                    category: 'general',
                    createdAt: new Date().toISOString(),
                  };
                  setPendingAttachments((prev) => [...prev, newAtt]);
                  if (syncToGlobalLibrary && onSaveToGlobalAttachments) {
                    onSaveToGlobalAttachments(newAtt);
                  }
                  setManualDocName('');
                  setManualDocContent('');
                  setManualDocDesc('');
                  setIsManualDocModalOpen(false);
                  ultraAudio.playChimeSFX();
                }}
                disabled={!manualDocContent.trim()}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 shadow-md"
              >
                挂载至当前发言
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Image URL Modal */}
      {isManualImgModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-zinc-950 border border-cyan-500/70 rounded-2xl w-full max-w-xl flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.3)] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/90">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">挂载多模态图片 (URL/Base64)</h3>
                  <p className="text-xs text-zinc-400">支持直接输入图片公网URL或Base64数据</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualImgModalOpen(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex flex-col space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">图片名称:</label>
                <input
                  type="text"
                  value={manualImgName}
                  onChange={(e) => setManualImgName(e.target.value)}
                  placeholder="例如: 现场立绘特写.png / 战术监控画面.jpg"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">图片URL或Base64数据:</label>
                <textarea
                  value={manualImgUrl}
                  onChange={(e) => setManualImgUrl(e.target.value)}
                  rows={4}
                  placeholder="https://... 或 data:image/png;base64,..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500 leading-relaxed"
                />
              </div>

              {manualImgUrl.trim() && (
                <div className="max-h-36 rounded-lg overflow-hidden border border-zinc-800 bg-black flex items-center justify-center p-2">
                  <img
                    src={manualImgUrl.trim()}
                    alt="Preview"
                    className="max-h-32 max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 p-4 border-t border-zinc-800 bg-zinc-900/90">
              <button
                type="button"
                onClick={() => setIsManualImgModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!manualImgUrl.trim()) return;
                  const newAtt: AiAttachment = {
                    id: `att_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    name: manualImgName.trim() || `图片_${new Date().toLocaleTimeString('zh-CN', { hour12: false })}.png`,
                    type: 'image',
                    mimeType: 'image/png',
                    sizeBytes: manualImgUrl.length,
                    content: manualImgUrl.trim(),
                    description: manualImgDesc.trim() || '挂载的多模态图像',
                    enabled: true,
                    category: 'general',
                    createdAt: new Date().toISOString(),
                  };
                  setPendingAttachments((prev) => [...prev, newAtt]);
                  if (syncToGlobalLibrary && onSaveToGlobalAttachments) {
                    onSaveToGlobalAttachments(newAtt);
                  }
                  setManualImgName('');
                  setManualImgUrl('');
                  setManualImgDesc('');
                  setIsManualImgModalOpen(false);
                  ultraAudio.playChimeSFX();
                }}
                disabled={!manualImgUrl.trim()}
                className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 shadow-md"
              >
                挂载至当前发言
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (widthMode === 'full') {
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
        <div className="w-full h-full max-w-[1600px] max-h-[95vh] flex flex-col relative">
          {consoleContent}
        </div>
      </div>
    );
  }

  return consoleContent;
};

export const UnifiedInterrogationConsole = React.memo(BaseUnifiedInterrogationConsole);
