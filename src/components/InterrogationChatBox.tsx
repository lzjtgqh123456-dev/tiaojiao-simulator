import React, { useState, useRef, useEffect } from 'react';
import { Ultrawoman, Stats, AiConfig, ChatMessage } from '../types';
import { MessageSquare, Send, Bot, Sparkles, Trash2, RefreshCw, User, Terminal, AlertCircle, ShieldAlert, Cpu, Heart, Flame, Zap, FastForward, Brain, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { ultraAudio } from '../utils/audio';
import { DEFAULT_UNIVERSAL_PROMPTS } from '../data/promptPresets';

interface InterrogationChatBoxProps {
  hero: Ultrawoman;
  stats: Stats;
  aiConfig: AiConfig;
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onClearChat: () => void;
  isLoading: boolean;
  interrogatorIdentity?: string;
  currentScenarioName?: string;
}

function getMessageHeroSpeaker(
  msg: {
    speakerName?: string;
    heroName?: string;
    text?: string;
    psychologicalAnalysis?: string;
  },
  defaultHeroName: string
): string {
  if (msg.speakerName) return msg.speakerName;
  if (msg.heroName) return msg.heroName;

  if (msg.text) {
    const rawMatches = Array.from(msg.text.matchAll(/【([^】]+)】/g)).map((m) => m[1]);
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

  if (msg.psychologicalAnalysis) {
    const match = msg.psychologicalAnalysis.match(/【([^】]+)】/);
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

function ChatThinkingCard({
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
        <div className="p-3 text-[11px] font-mono text-indigo-200/90 whitespace-pre-wrap leading-relaxed border-t border-indigo-500/20 max-h-56 overflow-y-auto bg-black/40 scrollbar-thin selection:bg-indigo-700 selection:text-white">
          {text.trim()}
        </div>
      )}
    </div>
  );
}

export const InterrogationChatBox: React.FC<InterrogationChatBoxProps> = ({
  hero,
  stats,
  aiConfig,
  messages,
  onSendMessage,
  onClearChat,
  isLoading,
  interrogatorIdentity = '审讯官',
  currentScenarioName = '开局剧情模式',
}) => {
  const [inputText, setInputText] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Thinking Display Mode (collapsed / expanded / hidden)
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

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const textToSend = inputText.trim();
    setInputText('');
    ultraAudio.playUiClick();
    await onSendMessage(textToSend);
  };

  const handleContinueStory = async () => {
    if (isLoading) return;
    ultraAudio.playUiClick();
    const textToSend = inputText.trim() || '（保持沉默，什么都不做，等待剧情进一步自然发展演化……）';
    setInputText('');
    await onSendMessage(textToSend);
  };

  const getReactionBadge = (reactionType?: string) => {
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
  };

  const maxHp = stats.maxHp || hero?.defaultStats?.maxHp || 100;
  const maxMorale = stats.maxMorale || hero?.defaultStats?.maxMorale || 100;
  const maxObedience = stats.maxObedience || hero?.defaultStats?.maxObedience || 100;

  const hpPct = Math.round(Math.max(0, Math.min(100, (stats.hp / maxHp) * 100)));
  const moralePct = Math.round(Math.max(0, Math.min(100, (stats.morale / maxMorale) * 100)));
  const obediencePct = Math.round(Math.max(0, Math.min(100, (stats.obedience / maxObedience) * 100)));

  // Determine current state label
  const getStateBadge = () => {
    if (stats.hp <= 0) return { label: '生命死亡沉寂', color: 'text-zinc-500 border-zinc-700 bg-zinc-900' };
    if (stats.energy <= 0) return { label: '能量休克·浅意识', color: 'text-cyan-300 border-cyan-600 bg-cyan-950/60' };
    if (moralePct <= 20) return { label: '精神崩解求饶', color: 'text-rose-400 border-rose-600 bg-rose-950/60' };
    if (obediencePct >= 70) return { label: '深度服从沉沦', color: 'text-fuchsia-300 border-fuchsia-600 bg-fuchsia-950/60' };
    if (moralePct <= 50) return { label: '防线摇摇欲坠', color: 'text-amber-300 border-amber-600 bg-amber-950/60' };
    return { label: '顽强抵抗中', color: 'text-blue-300 border-blue-600 bg-blue-950/60' };
  };

  const stateBadge = getStateBadge();

  return (
    <div className="bg-zinc-950 rounded-lg border border-purple-900/40 p-3.5 text-zinc-100 flex flex-col space-y-3 shadow-[0_0_25px_rgba(168,85,247,0.15)] h-[440px] font-mono relative overflow-hidden">
      {/* Background Subtle Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-purple-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 shrink-0 z-10">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded bg-purple-950/80 border border-purple-500/50 text-purple-300">
            <MessageSquare className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-wider text-purple-300 flex items-center gap-1.5">
              <span>{interrogatorIdentity}</span>
              <span className="text-zinc-500">➔</span>
              <span>对白独立终端</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-900/60 border border-purple-500/40 text-purple-200 font-mono">
                {currentScenarioName}
              </span>
              <span className={`px-1.5 py-0.2 text-[10px] rounded border font-bold ${stateBadge.color}`}>
                {stateBadge.label}
              </span>
            </h2>
            <p className="text-[10px] text-zinc-400">
              对象: <strong className="text-blue-300">{hero.name}</strong> ({hero.personality || '坚毅正义'}) | API注入弱点&状态提示词
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
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

          {aiConfig.enabled && aiConfig.apiKey ? (
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/60 text-purple-200 flex items-center space-x-1 font-bold">
              <Bot className="w-3 h-3 text-purple-400 animate-pulse" />
              <span>{aiConfig.activeProviderName || String(aiConfig.provider).toUpperCase()} AI 动态解析中</span>
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500">
              内置免费 API 引擎
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              onClearChat();
            }}
            title="清空对话记录"
            className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-zinc-900 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dynamic Dynamic AI Prompt Conditions Bar */}
      <div className="bg-zinc-900/90 p-2 rounded border border-zinc-800 text-[10px] text-zinc-400 flex flex-wrap items-center justify-between gap-1.5 shrink-0 z-10">
        <div className="flex items-center space-x-1.5">
          <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>实时提示词规则:</span>
          <span className="text-amber-300 font-bold">弱点:{hero.bodyParts[hero.weakPart]?.name}</span>
          <span>|</span>
          <span className="text-fuchsia-300 font-bold">发情部位:{hero.bodyParts[hero.sensitivePart || 'timer']?.name}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-rose-400 font-bold">HP:{hpPct}%</span>
          <span className="text-amber-400 font-bold">意志:{moralePct}%</span>
          <span className="text-blue-400 font-bold">服从:{obediencePct}%</span>
        </div>
      </div>

      {/* Chat Messages Scroll Container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin z-10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-xs space-y-2">
            <Bot className="w-8 h-8 text-zinc-700" />
            <p className="text-center">在下方输入审讯台词、威逼利诱或真言提问<br />API 将根据 <strong className="text-purple-400">{hero.name}</strong> 的实时痛觉、服从度与性格弱点生成震撼反响。</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isInterrogator = msg.sender === 'interrogator';
            const isSystem = msg.sender === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center my-1.5">
                  <span className="px-2.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-[10px] text-zinc-400 font-mono">
                    ⚙️ {msg.text}
                  </span>
                </div>
              );
            }

            const speakerName = isInterrogator
              ? (msg.speakerName || interrogatorIdentity)
              : getMessageHeroSpeaker(msg, hero.name);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isInterrogator ? 'items-end' : 'items-start'} space-y-1`}
              >
                {/* Header label */}
                <div className="flex items-center space-x-1.5 text-[10px] text-zinc-500 font-mono px-1">
                  {isInterrogator ? (
                    <>
                      <span className="text-blue-400 font-bold">{speakerName}</span>
                      <User className="w-3 h-3 text-blue-400" />
                    </>
                  ) : (
                    <>
                      <Bot className="w-3 h-3 text-purple-400" />
                      <span className="text-purple-300 font-bold">{speakerName}</span>
                      {getReactionBadge(msg.reactionType)}
                    </>
                  )}
                  <span className="text-[9px] opacity-60">[{msg.time}]</span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`p-3 rounded-lg text-xs leading-relaxed max-w-[88%] ${
                    isInterrogator
                      ? 'bg-blue-950/80 border border-blue-500/50 text-blue-100 rounded-tr-none shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                      : 'bg-zinc-900/90 border border-purple-500/40 text-purple-100 rounded-tl-none shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* AI Psychological Analysis / Personality Tag */}
                  {msg.psychologicalAnalysis && (
                    <details open className="mt-1.5">
                      <summary className="cursor-pointer select-none text-[10px] text-amber-300/80 font-mono hover:text-amber-200">
                        🧠 战术与心理评估（点击收起）
                      </summary>
                      <div className="mt-1 pt-1.5 border-t border-purple-900/50 text-[10px] text-amber-300/90 flex items-start space-x-1 font-mono">
                        <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                        <span>{msg.psychologicalAnalysis}</span>
                      </div>
                    </details>
                  )}

                  {/* AI Deep Thinking Process */}
                  {msg.thinkingProcess && (
                    <ChatThinkingCard text={msg.thinkingProcess} displayMode={thinkingDisplayMode} />
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center space-x-2 text-xs text-purple-400 bg-purple-950/40 p-2.5 rounded-lg border border-purple-500/30 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-300" />
            <span>【{hero.name} 思考中】准备回应...</span>
          </div>
        )}
      </div>

      {/* Quick Prompts Bar */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 text-[10px] no-scrollbar shrink-0 z-10">
        <span className="text-zinc-400 font-bold shrink-0">通用剧情口令:</span>
        <button
          type="button"
          onClick={handleContinueStory}
          disabled={isLoading}
          className="px-2 py-0.5 rounded border border-emerald-600/60 bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 hover:border-emerald-400 whitespace-nowrap transition-all cursor-pointer font-bold flex items-center space-x-1 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.2)] disabled:opacity-50"
        >
          <FastForward className="w-3 h-3 text-emerald-300" />
          <span>⏩ 静观其变·继续剧情</span>
        </button>
        {DEFAULT_UNIVERSAL_PROMPTS.map((quickText, idx) => (
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

      {/* Input Box Form */}
      <form onSubmit={handleSend} className="flex items-center space-x-2 shrink-0 z-10">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`对 ${hero.name} 说的台词、质问或互动口令... (无输入点击“继续剧情”可保持沉默推进剧情)`}
          disabled={isLoading}
          className="flex-1 bg-zinc-900 border border-purple-900/60 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 font-mono"
        />
        <button
          type="button"
          onClick={handleContinueStory}
          disabled={isLoading}
          title="保持沉默或无动作，直接推进后续剧情与自然反应"
          className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 border border-teal-500 text-teal-100 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)] disabled:opacity-50 cursor-pointer shrink-0"
        >
          <FastForward className="w-3.5 h-3.5 text-teal-300" />
          <span>继续剧情</span>
        </button>
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 border border-purple-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>发送台词</span>
        </button>
      </form>
    </div>
  );
};
