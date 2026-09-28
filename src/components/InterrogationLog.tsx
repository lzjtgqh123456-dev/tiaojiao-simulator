import React, { useRef, useEffect } from 'react';
import { LogEntry, Ultrawoman } from '../types';
import { Scroll, Terminal, Trash2, MessageSquare, AlertCircle, Volume2, Zap } from 'lucide-react';
import { ultraAudio } from '../utils/audio';

interface InterrogationLogProps {
  logs: LogEntry[];
  hero: Ultrawoman;
  onClearLogs: () => void;
}

export const InterrogationLog: React.FC<InterrogationLogProps> = ({ logs, hero, onClearLogs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-3.5 text-zinc-100 flex flex-col space-y-2.5 shadow-2xl h-[380px] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-bold tracking-widest text-blue-400 uppercase text-glow-blue">
            战术实时反应日志
          </h2>
        </div>
        <button
          onClick={() => {
            ultraAudio.playUiClick();
            onClearLogs();
          }}
          className="text-[11px] text-zinc-400 hover:text-rose-400 flex items-center space-x-1 p-0.5 rounded transition-all uppercase font-bold"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>清空日志</span>
        </button>
      </div>

      {/* Logs Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-xs space-y-1 uppercase tracking-widest">
            <Scroll className="w-6 h-6 text-zinc-700" />
            <span>等待武器发射与打击指令...</span>
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={log.id ? `${log.id}_${index}` : index}
              className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800/90 flex flex-col space-y-1.5 text-xs transition-all hover:border-zinc-700"
            >
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-blue-400 font-bold">[{log.time}]</span>
                <span className="font-bold text-rose-300">
                  【{log.weaponName}】 ➔ 【{log.targetPartName}】
                </span>
              </div>

              {/* Stat Deltas */}
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                {log.damageDealt !== undefined && log.damageDealt !== 0 && (
                  <span className={`px-1 py-0.2 rounded border font-bold ${log.damageDealt > 0 ? 'bg-rose-950 text-rose-300 border-rose-800/60' : log.damageDealt < 0 ? 'bg-emerald-950 text-emerald-300 border-emerald-800/60' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>
                    HP {log.damageDealt > 0 ? `-${log.damageDealt}` : `+${Math.abs(log.damageDealt)}`}
                  </span>
                )}
                {log.energyDrained !== undefined && log.energyDrained !== 0 && (
                  <span className={`px-1 py-0.2 rounded border font-bold ${log.energyDrained > 0 ? 'bg-amber-950 text-amber-300 border-amber-800/60' : log.energyDrained < 0 ? 'bg-cyan-950 text-cyan-300 border-cyan-800/60' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>
                    能量 {log.energyDrained > 0 ? `-${log.energyDrained}%` : `+${Math.abs(log.energyDrained)}%`}
                  </span>
                )}
                {log.obedienceGained !== undefined && (
                  <span className={`px-1 py-0.2 rounded border font-bold ${log.obedienceGained > 0 ? 'bg-blue-950 text-blue-300 border-blue-800/60' : log.obedienceGained < 0 ? 'bg-rose-950 text-rose-300 border-rose-800/60' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>
                    信任 {log.obedienceGained > 0 ? `+${log.obedienceGained}` : log.obedienceGained}
                  </span>
                )}
                {log.shameGained !== undefined && (
                  <span className={`px-1 py-0.2 rounded border font-bold ${log.shameGained > 0 ? 'bg-purple-950 text-purple-300 border-purple-800/60' : log.shameGained < 0 ? 'bg-fuchsia-950 text-fuchsia-300 border-fuchsia-800/60' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>
                    羞耻 {log.shameGained > 0 ? `+${log.shameGained}` : log.shameGained}
                  </span>
                )}
                {log.lustChanged !== undefined && (
                  <span className={`px-1 py-0.2 rounded border font-bold ${log.lustChanged > 0 ? 'bg-pink-950 text-pink-300 border-pink-800/60' : log.lustChanged < 0 ? 'bg-amber-950 text-amber-300 border-amber-800/60' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>
                    欲望 {log.lustChanged > 0 ? `+${log.lustChanged}` : log.lustChanged}
                  </span>
                )}
              </div>

              {/* Environmental Weakness Trigger Tag */}
              {log.envWeaknessHit && (
                <div className="flex items-center space-x-1.5 text-[10px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-600/60 shadow-[0_0_8px_rgba(245,158,11,0.25)]">
                  <Zap className="w-3 h-3 text-amber-400 shrink-0 animate-pulse" />
                  <span>⚡ 环境弱点联动生效: {log.envWeaknessHit.name} ({log.envWeaknessHit.multiplier}x 伤害加成)</span>
                </div>
              )}

              {/* Character Quote Reaction */}
              {log.characterQuote && (
                <div className="bg-zinc-950 p-2 rounded border border-blue-900/50 text-blue-100 flex space-x-2 text-[11px]">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    {log.characterQuote.includes('【') ? (
                      <div className="whitespace-pre-wrap font-sans text-blue-100 leading-relaxed">
                        {log.characterQuote}
                      </div>
                    ) : (
                      <div>
                        <span className="font-bold text-blue-300">{log.speakerName || log.heroName || hero.name}: </span>
                        <span className="italic">“{log.characterQuote}”</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI Psychological Analysis */}
              {log.aiAnalysis && (
                <div className="text-[10px] text-zinc-400 flex items-start space-x-1.5 bg-zinc-950/60 p-2 rounded border border-zinc-800">
                  <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 whitespace-pre-wrap font-mono leading-relaxed">
                    <span className="font-bold text-amber-300">战术与状态评估: </span>
                    {log.aiAnalysis}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

