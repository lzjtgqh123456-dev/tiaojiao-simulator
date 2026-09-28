import React, { useState, useEffect } from 'react';
import {
  Globe,
  Search,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  HelpCircle,
  Radio,
  BookOpen,
  Compass,
  Check,
  Zap,
} from 'lucide-react';
import { Ultrawoman, SearchEngineId, WebSearchResult } from '../types';
import { ultraAudio } from '../utils/audio';

interface WebSearchConfigEditorProps {
  hero: Ultrawoman;
  onUpdateHero: (updatedHero: Ultrawoman) => void;
}

const SEARCH_ENGINES: Array<{
  id: SearchEngineId;
  name: string;
  icon: string;
  badge: string;
  desc: string;
  tagColor: string;
}> = [
  {
    id: 'google',
    name: 'Google 谷歌搜索',
    icon: '🌐',
    badge: '全球最强',
    desc: '全球索引广度最高，支持跨语言最新事实与深度网页内容检索。',
    tagColor: 'border-blue-500/50 bg-blue-950/40 text-blue-300',
  },
  {
    id: 'bing',
    name: 'Bing 微软必应',
    icon: '🔍',
    badge: '综合稳健',
    desc: '微软必应搜索，针对中文信息、百科条目及新闻资讯优化良好。',
    tagColor: 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300',
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo 隐私检索',
    icon: '🦆',
    badge: '轻量快速',
    desc: '无跟踪即时检索，提供简洁精准的摘要与官方条目。',
    tagColor: 'border-amber-500/50 bg-amber-950/40 text-amber-300',
  },
  {
    id: 'baidu',
    name: '百度搜索 (Baidu)',
    icon: '🐾',
    badge: '中文圈推荐',
    desc: '专注中文语境、贴吧科普、萌娘百科及二次元圈子设定覆盖度高。',
    tagColor: 'border-red-500/50 bg-red-950/40 text-red-300',
  },
  {
    id: 'sogou',
    name: '搜狗搜索 (Sogou)',
    icon: '🐕',
    badge: '中文特化',
    desc: '集成知乎、微信生态及中文资讯，适合中文长文情报。',
    tagColor: 'border-orange-500/50 bg-orange-950/40 text-orange-300',
  },
  {
    id: 'wikipedia',
    name: '维基百科 (Wikipedia)',
    icon: '📚',
    badge: '权威百科',
    desc: '专注权威百科条目，提供准确的历史背景、角色设定与世界观事实。',
    tagColor: 'border-purple-500/50 bg-purple-950/40 text-purple-300',
  },
];

export const WebSearchConfigEditor: React.FC<WebSearchConfigEditorProps> = ({
  hero,
  onUpdateHero,
}) => {
  // Local state initialized from props for instant responsive feedback
  const [localEnabled, setLocalEnabled] = useState<boolean>(Boolean(hero.webSearchEnabled));
  const [localEngine, setLocalEngine] = useState<SearchEngineId>(hero.searchEngine || 'google');
  const [localKeywords, setLocalKeywords] = useState<string>(hero.searchKeywords || '');
  const [localMaxResults, setLocalMaxResults] = useState<number>(hero.searchMaxResults || 3);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Synchronize when incoming hero changes
  useEffect(() => {
    setLocalEnabled(Boolean(hero.webSearchEnabled));
    setLocalEngine(hero.searchEngine || 'google');
    setLocalKeywords(hero.searchKeywords || '');
    setLocalMaxResults(hero.searchMaxResults || 3);
  }, [hero.id, hero.webSearchEnabled, hero.searchEngine, hero.searchKeywords, hero.searchMaxResults]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Test search states
  const [testQuery, setTestQuery] = useState(hero.name || '宇宙警备队');
  const [isSearching, setIsSearching] = useState(false);
  const [testResults, setTestResults] = useState<WebSearchResult[] | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testEngineUsed, setTestEngineUsed] = useState<string>('');

  const handleToggleEnable = () => {
    ultraAudio.playUiClick();
    const nextVal = !localEnabled;
    setLocalEnabled(nextVal);
    onUpdateHero({
      ...hero,
      webSearchEnabled: nextVal,
      searchEngine: localEngine,
      searchKeywords: localKeywords,
      searchMaxResults: localMaxResults,
    });
    showToast(nextVal ? `✅ 已为【${hero.name}】开启 AI 联网检索增强！` : `⚪ 已关闭【${hero.name}】的联网检索`);
  };

  const handleEngineChange = (engine: SearchEngineId) => {
    ultraAudio.playUiClick();
    setLocalEngine(engine);
    onUpdateHero({
      ...hero,
      searchEngine: engine,
    });
    showToast(`🔄 搜索引擎已切换至: ${engine.toUpperCase()}`);
  };

  const handleKeywordsChange = (keywords: string) => {
    setLocalKeywords(keywords);
    onUpdateHero({
      ...hero,
      searchKeywords: keywords,
    });
  };

  const handleMaxResultsChange = (val: number) => {
    const clamped = Math.min(Math.max(val, 1), 6);
    setLocalMaxResults(clamped);
    onUpdateHero({
      ...hero,
      searchMaxResults: clamped,
    });
  };

  const handleRunTestSearch = async () => {
    if (!testQuery.trim() || isSearching) return;
    ultraAudio.playUiClick();
    setIsSearching(true);
    setTestError(null);
    setTestResults(null);
    try {
      const resp = await fetch('/api/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: testQuery.trim(),
          engine: localEngine,
          maxResults: localMaxResults,
          characterKeywords: localKeywords,
        }),
      });
      const data = await resp.json();
      if (data.success && Array.isArray(data.results)) {
        setTestResults(data.results);
        setTestEngineUsed(data.engine || localEngine);
      } else {
        setTestError(data.error || '未能抓取到相关网络情报');
      }
    } catch (err: any) {
      setTestError(err?.message || '网络检索请求异常');
    } finally {
      setIsSearching(false);
    }
  };

  const quickKeywordPresets = [
    `${hero.name} 设定`,
    '百科',
    '语言',
    '深度搜索',
    '全部',
  ];

  const isEnabled = localEnabled;
  const currentEngine = localEngine;
  const currentKeywords = localKeywords;
  const currentMaxResults = localMaxResults;

  return (
    <div className={`p-4 rounded-xl border transition-all text-xs relative ${isEnabled ? 'bg-zinc-950/95 border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.15)]' : 'bg-zinc-950/80 border-zinc-800/80'}`}>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="absolute top-2 right-4 z-20 px-3 py-1.5 rounded-lg bg-cyan-950/90 border border-cyan-400/80 text-cyan-200 text-xs font-bold shadow-lg animate-fadeIn flex items-center space-x-1.5">
          <Zap className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header & Main Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2.5 rounded-lg transition-all ${isEnabled ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.4)]' : 'bg-zinc-900 text-zinc-500 border border-zinc-700'}`}>
            <Globe className={`w-5 h-5 ${isEnabled ? 'animate-spin-slow text-cyan-300' : ''}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-1.5">
                <span>角色独立 AI 联网搜索与实时情报增强 (Web Grounding)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  {hero.name} 专属
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              为【{hero.name}】独立开启多引擎实时互联网检索。对话或审讯交流时，AI将抓取真实网络资讯与百科设定融入回答。
            </p>
          </div>
        </div>

        {/* Master Toggle Button with Switch UI */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            id="role-web-search-master-toggle-btn"
            onClick={handleToggleEnable}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center space-x-2.5 cursor-pointer transition-all active:scale-95 shadow-md ${
              isEnabled
                ? 'bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-500 text-white shadow-[0_0_18px_rgba(6,182,212,0.6)] border border-cyan-300 hover:brightness-110'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500'
            }`}
            title="点击切换当前角色独立 AI 联网搜索状态"
          >
            {/* Animated toggle pill inside button */}
            <div className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 flex items-center ${isEnabled ? 'bg-cyan-950/80 justify-end' : 'bg-zinc-700 justify-start'}`}>
              <div className={`w-3 h-3 rounded-full shadow-sm transition-transform ${isEnabled ? 'bg-cyan-300' : 'bg-zinc-400'}`} />
            </div>
            <Radio className={`w-3.5 h-3.5 ${isEnabled ? 'animate-pulse text-white' : 'text-zinc-400'}`} />
            <span className="font-semibold tracking-wide">{isEnabled ? '已开启联网检索' : '未开启 (点击启用)'}</span>
          </button>
        </div>
      </div>

      {isEnabled && (
        <div className="space-y-4 pt-1">
          {/* Search Engine Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-zinc-300 font-bold">
              <span className="flex items-center gap-1.5 text-xs text-zinc-200">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>选择主要搜索引擎 (Search Engine Provider)</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-normal">
                若首选引擎偶发受限，系统将自动平滑回退至备选引擎
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {SEARCH_ENGINES.map((engine) => {
                const isSelected = currentEngine === engine.id;
                return (
                  <button
                    key={engine.id}
                    type="button"
                    onClick={() => handleEngineChange(engine.id)}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                      isSelected
                        ? `${engine.tagColor} border-2 shadow-[0_0_12px_rgba(6,182,212,0.25)]`
                        : 'bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 font-bold text-xs">
                        <span className="text-base">{engine.icon}</span>
                        <span className={isSelected ? 'text-white' : 'text-zinc-200'}>
                          {engine.name}
                        </span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono border border-current opacity-85">
                        {engine.badge}
                      </span>
                    </div>
                    <p className="text-[10px] opacity-75 line-clamp-2 leading-relaxed">
                      {engine.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Keywords & Parameters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Keywords Focus Field */}
            <div className="md:col-span-2 bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>角色检索专属前缀/关注领域 (Focus Keywords)</span>
                </label>
                <span className="text-[10px] text-zinc-400">可选，提高垂直精度</span>
              </div>
              <input
                type="text"
                value={currentKeywords}
                onChange={(e) => handleKeywordsChange(e.target.value)}
                placeholder="例如：百科"
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500 placeholder:text-zinc-600"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-zinc-400">快捷填充:</span>
                {quickKeywordPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleKeywordsChange(preset)}
                    className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
                {currentKeywords && (
                  <button
                    type="button"
                    onClick={() => handleKeywordsChange('')}
                    className="px-2 py-0.5 rounded text-[10px] bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 text-rose-300 cursor-pointer"
                  >
                    清空
                  </button>
                )}
              </div>
            </div>

            {/* Max Results Field */}
            <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 space-y-2">
              <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>单次对话检索条数 (Depth)</span>
              </label>
              <div className="flex items-center space-x-2 pt-1">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleMaxResultsChange(num)}
                    className={`flex-1 py-1 rounded text-xs font-bold font-mono transition-all cursor-pointer ${
                      currentMaxResults === num
                        ? 'bg-cyan-600 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)] border border-cyan-400'
                        : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    {num}条
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-400 pt-1 leading-tight">
                推荐 3 条（响应迅速且信息充实），深度研判可设为 5~6 条。
              </p>
            </div>
          </div>

          {/* Real-time Search Test Console */}
          <div className="bg-zinc-900/40 p-3.5 rounded-lg border border-cyan-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-cyan-300">
                  实时搜索测试终端 (Live Search Verification)
                </span>
              </div>
              <span className="text-[10px] text-zinc-400">
                即时验证当前引擎与关键词检索效果
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRunTestSearch();
                }}
                placeholder="输入测试检索词，如：百科"
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 placeholder:text-zinc-600"
              />
              <button
                type="button"
                onClick={handleRunTestSearch}
                disabled={isSearching || !testQuery.trim()}
                className="px-3.5 py-1.5 rounded font-bold text-xs bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>检索中...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>执行实时检索</span>
                  </>
                )}
              </button>
            </div>

            {/* Test Results Display */}
            {testError && (
              <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[11px] flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{testError}</span>
              </div>
            )}

            {testResults && (
              <div className="space-y-2 pt-1 border-t border-zinc-800/80">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>检索成功！来源引擎：{testEngineUsed}，共抓取到 {testResults.length} 条情报</span>
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    以下内容将在对话中自动转化为 AI 认知
                  </span>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                  {testResults.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-zinc-950 border border-zinc-800/80 hover:border-cyan-800/60 transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-cyan-200 text-xs truncate">
                          {idx + 1}. {item.title}
                        </span>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-0.5 text-[10px] shrink-0 font-mono"
                          >
                            <span>打开链接</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                        {item.snippet}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
